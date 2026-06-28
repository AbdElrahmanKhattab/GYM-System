const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');
const { evaluateAttendance } = require('../lib/attendanceRules');
const { MEMBER_STATUS, USER_ROLE } = require('@gym-system/shared');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/attendance
 * Paginated attendance history with optional date-range and member filters.
 */
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, memberId, page = 1, limit = 50 } = req.query;

    const where = {};

    if (memberId) {
      where.memberId = memberId;
    }

    if (startDate || endDate) {
      where.checkedInAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.checkedInAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.checkedInAt.lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        include: {
          member: { select: { fullName: true, photoUrl: true, manualCode: true } },
          memberSubscription: {
            include: {
              subscription: { select: { name: true, durationType: true } }
            }
          },
          recordedBy: { select: { fullName: true } }
        },
        orderBy: { checkedInAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.attendanceRecord.count({ where })
    ]);

    res.json({ records, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/attendance/scan
 * 
 * Accepts a token (QR or manual code), runs it through the rules engine,
 * records attendance if allowed, and returns a structured result.
 * 
 * Body: { token: string, entryMethod: 'qr' | 'manual_code' | 'search_name' | 'search_phone' }
 * 
 * For search-based entry, pass memberId directly instead of token:
 * Body: { memberId: string, entryMethod: 'search_name' | 'search_phone' }
 */
router.post('/scan', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { token, memberId, entryMethod = 'qr' } = req.body;

    if (!token && !memberId) {
      return res.status(400).json({
        result: 'error',
        rejectionReason: 'INVALID_INPUT',
        message: 'A token or member ID is required.',
      });
    }

    // ─── 1. Look up the member ───
    let member = null;

    if (memberId) {
      // Direct lookup by ID (from search fallback)
      member = await prisma.member.findUnique({
        where: { id: memberId },
      });
    } else if (token) {
      // Try QR token first, then manual code
      member = await prisma.member.findUnique({
        where: { qrToken: token },
      });

      if (!member) {
        member = await prisma.member.findUnique({
          where: { manualCode: token.toUpperCase() },
        });
      }
    }

    if (!member) {
      return res.json({
        result: 'rejected',
        rejectionReason: 'NOT_FOUND',
        message: 'QR Code Not Found / Invalid Code',
        processingTimeMs: Date.now() - startTime,
      });
    }

    // ─── 2. Load the current subscription term (with subscription details) ───
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

    // ─── 3. Load today's attendance records ───
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

    // ─── 4. Load the attendance rules config ───
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

    // ─── 5. Compute pending balance for warnings ───
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

    // Attach pending balance to member for rules evaluation
    const memberWithBalance = { ...member, pendingBalance };

    // ─── 6. Evaluate attendance rules ───
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

    // ─── 7. Record the attendance ───
    let sessionsRemainingAfter = null;

    if (currentTerm && currentTerm.remainingSessions !== null) {
      // Session-based: decrement
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
        entryMethod,
        recordedByUserId: req.user.id,
        sessionsRemainingAfter,
      },
    });

    // ─── 8. Auto-complete if last session ───
    if (evaluation.shouldAutoComplete) {
      await prisma.member.update({
        where: { id: member.id },
        data: { status: MEMBER_STATUS.COMPLETED },
      });

      await logActivity({
        userId: req.user.id,
        action: 'member_auto_completed',
        entityType: 'member',
        entityId: member.id,
        metadata: { reason: 'Zero sessions remaining after scan' },
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'attendance_recorded',
      entityType: 'attendance',
      entityId: attendanceRecord.id,
      metadata: { memberName: member.fullName, entryMethod },
    });

    // ─── 9. Compute remaining days for date-based plans ───
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

/**
 * DELETE /api/attendance/:id
 * Void an attendance record (Admin only).
 * If the record belonged to a session-based subscription, refund the session.
 */
router.delete('/:id', authorize(USER_ROLE.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        member: { select: { fullName: true } },
        memberSubscription: {
          include: {
            subscription: { select: { durationType: true } }
          }
        }
      }
    });

    if (!record) {
      return res.status(404).json({ error: { message: 'Attendance record not found.' } });
    }

    if (record.isVoided) {
      return res.status(400).json({ error: { message: 'This record is already voided.' } });
    }

    // Void the record
    await prisma.attendanceRecord.update({
      where: { id },
      data: { isVoided: true }
    });

    // Refund session if session-based
    if (
      record.memberSubscription &&
      record.memberSubscription.subscription.durationType === 'sessions' &&
      record.memberSubscription.remainingSessions !== null
    ) {
      await prisma.memberSubscription.update({
        where: { id: record.memberSubscription.id },
        data: { remainingSessions: { increment: 1 } }
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'attendance_voided',
      entityType: 'attendance',
      entityId: id,
      metadata: { memberName: record.member?.fullName }
    });

    res.json({ message: 'Attendance record voided successfully.' });
  } catch (error) {
    next(error);
  }
});

/**
 * Maps rejection reason codes to user-facing messages.
 */
function getRejectionMessage(reason) {
  const messages = {
    NOT_FOUND: 'QR Code Not Found / Invalid Code',
    EXPIRED: 'Subscription Expired — Please Renew',
    ALREADY_CHECKED_IN_TODAY: 'Already Checked In Today',
    FROZEN: 'Frozen Membership',
    COMPLETED_NO_SESSIONS: 'Completed Session Package (Zero Sessions Remaining)',
    SUSPENDED: 'Suspended Member',
    NO_ACTIVE_SUBSCRIPTION: 'No Active Subscription',
  };
  return messages[reason] || 'Check-in Not Allowed';
}

module.exports = router;

