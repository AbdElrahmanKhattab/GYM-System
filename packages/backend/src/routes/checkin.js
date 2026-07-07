const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { evaluateAttendance } = require('../lib/attendanceRules');
const { logActivity } = require('../lib/activityLog');
const { authenticateMemberSession } = require('../middleware/checkinAuth');
const {
  MEMBER_STATUS,
  ENTRY_METHOD,
  SESSION_TOKEN_LENGTH,
  SESSION_EXPIRY_DAYS,
} = require('@gym-system/shared');

const router = express.Router();

/**
 * In-memory rate-limiting store for PIN login attempts.
 * Keyed by phone number. For MVP this is sufficient; Redis can replace it later.
 */
const loginAttempts = new Map();

function getLoginAttempts(phone) {
  const record = loginAttempts.get(phone);
  if (!record) return 0;
  const windowMs = 15 * 60 * 1000;
  if (Date.now() - record.windowStart > windowMs) {
    loginAttempts.delete(phone);
    return 0;
  }
  return record.count;
}

function incrementLoginAttempts(phone) {
  const windowMs = 15 * 60 * 1000;
  const record = loginAttempts.get(phone) || { count: 0, windowStart: Date.now() };
  record.count++;
  loginAttempts.set(phone, record);
}

function resetLoginAttempts(phone) {
  loginAttempts.delete(phone);
}

/**
 * POST /api/public/checkin/login
 * Member login using phone + PIN. Returns a session token.
 * Rate-limited: 5 attempts per phone per 15 minutes.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({
        error: { message: 'Phone number and PIN are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const cleanedPhone = phone.replace(/[\s-]/g, '');
    const cleanedPin = pin.replace(/\s/g, '');

    // Rate limiting
    const attempts = getLoginAttempts(cleanedPhone);
    if (attempts >= 5) {
      return res.status(429).json({
        error: { message: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
      });
    }

    // Look up member by phone
    const member = await prisma.member.findFirst({
      where: {
        phone: cleanedPhone,
        deletedAt: null,
        pinHash: { not: null },
      },
    });

    if (!member) {
      incrementLoginAttempts(cleanedPhone);
      return res.status(401).json({
        error: { message: 'Invalid phone number or PIN.', code: 'INVALID_CREDENTIALS' },
      });
    }

    // Verify PIN
    const pinValid = await bcrypt.compare(cleanedPin, member.pinHash);
    if (!pinValid) {
      incrementLoginAttempts(cleanedPhone);
      return res.status(401).json({
        error: { message: 'Invalid phone number or PIN.', code: 'INVALID_CREDENTIALS' },
      });
    }

    // Success — reset rate limit
    resetLoginAttempts(cleanedPhone);

    // Generate session token
    const sessionToken = crypto.randomBytes(SESSION_TOKEN_LENGTH).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await prisma.memberSession.create({
      data: {
        memberId: member.id,
        sessionToken,
        expiresAt,
      },
    });

    res.json({
      sessionToken,
      expiresAt,
      member: {
        id: member.id,
        fullName: member.fullName,
        photoUrl: member.photoUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/public/checkin/logout
 * Revoke the current session.
 */
router.post('/logout', authenticateMemberSession, async (req, res, next) => {
  try {
    await prisma.memberSession.update({
      where: { id: req.memberSession.id },
      data: { revokedAt: new Date() },
    });

    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public/checkin/session
 * Validate the session token and return member info for the confirm screen.
 */
router.get('/session', authenticateMemberSession, async (req, res, next) => {
  try {
    res.json({
      valid: true,
      member: {
        id: req.member.id,
        fullName: req.member.fullName,
        photoUrl: req.member.photoUrl,
        status: req.member.status,
      },
      sessionCreatedAt: req.memberSession.createdAt,
      expiresAt: req.memberSession.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/public/checkin/confirm
 * Member confirms their check-in. Calls the same evaluateAttendance() rules engine
 * used by the staff scanner. No duplicated rule logic.
 *
 * Session-authenticated (requires x-session-token header).
 */
router.post('/confirm', authenticateMemberSession, async (req, res, next) => {
  const startTime = Date.now();

  try {
    const member = req.member;

    // ─── 0. Check that self check-in is enabled ───
    const checkinConfig = await prisma.gymCheckinConfig.findFirst();
    if (checkinConfig && !checkinConfig.isSelfCheckinEnabled) {
      return res.status(403).json({
        result: 'rejected',
        rejectionReason: 'SELF_CHECKIN_DISABLED',
        message: 'Self check-in is currently disabled. Please see staff for assistance.',
        processingTimeMs: Date.now() - startTime,
      });
    }

    // ─── 1. Load the current subscription term ───
    const currentTerm = await prisma.memberSubscription.findFirst({
      where: { memberId: member.id, isCurrent: true },
      include: {
        subscription: {
          select: {
            name: true,
            durationType: true,
            durationValue: true,
            price: true,
            allowMultipleCheckinsPerDay: true,
          },
        },
      },
    });

    // ─── 2. Load today's attendance records ───
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAttendance = await prisma.attendanceRecord.findMany({
      where: {
        memberId: member.id,
        isVoided: false,
        checkedInAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // ─── 3. Load the attendance rules config ───
    let rulesConfig = await prisma.attendanceRule.findFirst();
    if (!rulesConfig) {
      rulesConfig = {
        blockExpiredMemberships: true,
        blockZeroRemainingSessions: true,
        warnOnUnpaidBalance: true,
        autoCompleteOnZeroSessions: true,
        expiringSoonWindowDays: 7,
      };
    }

    // ─── 4. Compute pending balance ───
    const subscriptionPrice = currentTerm ? Number(currentTerm.subscription.price) : 0;
    let pendingBalance = 0;
    if (currentTerm) {
      const paymentsAggregate = await prisma.payment.aggregate({
        where: { memberSubscriptionId: currentTerm.id },
        _sum: { amount: true },
      });
      const totalPaid = Number(paymentsAggregate._sum.amount || 0);
      pendingBalance = Math.max(0, subscriptionPrice - totalPaid);
    }

    const memberWithBalance = { ...member, pendingBalance };

    // ─── 5. Evaluate attendance rules (same function as staff scanner) ───
    const evaluation = evaluateAttendance(memberWithBalance, currentTerm, todayAttendance, rulesConfig);

    if (!evaluation.allowed) {
      return res.json({
        result: 'rejected',
        rejectionReason: evaluation.rejectionReason,
        message: getRejectionMessage(evaluation.rejectionReason),
        member: {
          fullName: member.fullName,
          photoUrl: member.photoUrl,
          status: member.status,
        },
        processingTimeMs: Date.now() - startTime,
      });
    }

    // ─── 6. Record the attendance ───
    let sessionsRemainingAfter = null;

    if (currentTerm && currentTerm.remainingSessions !== null) {
      sessionsRemainingAfter = currentTerm.remainingSessions - 1;

      await prisma.memberSubscription.update({
        where: { id: currentTerm.id },
        data: { remainingSessions: sessionsRemainingAfter },
      });
    }

    const attendanceRecord = await prisma.attendanceRecord.create({
      data: {
        memberId: member.id,
        memberSubscriptionId: currentTerm.id,
        entryMethod: ENTRY_METHOD.SELF_CHECKIN,
        recordedByUserId: null,
        sessionsRemainingAfter,
      },
    });

    // ─── 7. Auto-complete if last session ───
    if (evaluation.shouldAutoComplete) {
      await prisma.member.update({
        where: { id: member.id },
        data: { status: MEMBER_STATUS.COMPLETED },
      });

      await logActivity({
        userId: null,
        action: 'member_auto_completed',
        entityType: 'member',
        entityId: member.id,
        metadata: { reason: 'Zero sessions remaining after self check-in' },
      });
    }

    // ─── 8. Update session last_used_at ───
    await prisma.memberSession.update({
      where: { id: req.memberSession.id },
      data: { lastUsedAt: new Date() },
    });

    await logActivity({
      userId: null,
      action: 'attendance_recorded',
      entityType: 'attendance',
      entityId: attendanceRecord.id,
      metadata: { memberName: member.fullName, entryMethod: 'self_checkin' },
    });

    // ─── 9. Compute remaining days ───
    let remainingDays = null;
    if (currentTerm && currentTerm.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(currentTerm.endDate);
      end.setHours(0, 0, 0, 0);
      remainingDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return res.json({
      result: 'success',
      message: 'Attendance Recorded',
      warning: evaluation.warning,
      member: {
        fullName: member.fullName,
        photoUrl: member.photoUrl,
        status: evaluation.shouldAutoComplete ? MEMBER_STATUS.COMPLETED : member.status,
      },
      subscription: currentTerm ? {
        name: currentTerm.subscription.name,
        durationType: currentTerm.subscription.durationType,
        remainingSessions: sessionsRemainingAfter,
        remainingDays,
        endDate: currentTerm.endDate,
      } : null,
      pendingBalance,
      checkedInAt: attendanceRecord.checkedInAt,
      processingTimeMs: Date.now() - startTime,
    });

  } catch (error) {
    next(error);
  }
});

function getRejectionMessage(reason) {
  const messages = {
    NOT_FOUND: 'QR Code Not Found / Invalid Code',
    EXPIRED: 'Subscription Expired — Please Renew',
    ALREADY_CHECKED_IN_TODAY: 'Already Checked In Today',
    FROZEN: 'Frozen Membership',
    COMPLETED_NO_SESSIONS: 'Completed Session Package (Zero Sessions Remaining)',
    SUSPENDED: 'Suspended Member',
    NO_ACTIVE_SUBSCRIPTION: 'No Active Subscription',
    SELF_CHECKIN_DISABLED: 'Self check-in is currently disabled. Please see staff.',
  };
  return messages[reason] || 'Check-in Not Allowed';
}

module.exports = router;
