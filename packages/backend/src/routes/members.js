const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');
const { generateQrToken, generateManualCode } = require('../lib/codeGenerators');
const { createSubscriptionTerm } = require('../lib/subscriptionHelper');
const { MEMBER_STATUS } = require('@gym-system/shared');

const router = express.Router();

router.use(authenticate);

// ─── Valid status transitions (state machine) ───
const VALID_TRANSITIONS = {
  [MEMBER_STATUS.PENDING_APPROVAL]: [MEMBER_STATUS.ACTIVE],
  [MEMBER_STATUS.ACTIVE]:           [MEMBER_STATUS.FROZEN, MEMBER_STATUS.EXPIRED, MEMBER_STATUS.COMPLETED, MEMBER_STATUS.SUSPENDED, MEMBER_STATUS.DELETED],
  [MEMBER_STATUS.FROZEN]:           [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.SUSPENDED, MEMBER_STATUS.DELETED],
  [MEMBER_STATUS.EXPIRED]:          [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.DELETED], // active via renewal
  [MEMBER_STATUS.COMPLETED]:        [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.DELETED], // active via renewal
  [MEMBER_STATUS.SUSPENDED]:        [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.DELETED],
  [MEMBER_STATUS.DELETED]:          [MEMBER_STATUS.ACTIVE], // restore
};

/**
 * GET /api/members/search?q=
 * Global search across name, phone, QR token, manual code.
 * Must be defined BEFORE /:id to avoid route conflicts.
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ members: [] });
    }

    const searchTerm = q.trim();

    const members = await prisma.member.findMany({
      where: {
        deletedAt: null,
        OR: [
          { fullName: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm } },
          { manualCode: { equals: searchTerm.toUpperCase() } },
          { qrToken: { equals: searchTerm } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        manualCode: true,
        status: true,
        photoUrl: true,
      },
      take: 20,
      orderBy: { fullName: 'asc' },
    });

    res.json({ members });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/members
 * List all members (excluding soft-deleted unless ?includeDeleted=true).
 * Supports ?status= filter.
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, includeDeleted, page = 1, limit = 50 } = req.query;

    const where = {};

    if (!includeDeleted || includeDeleted !== 'true') {
      where.deletedAt = null;
    }

    if (status && Object.values(MEMBER_STATUS).includes(status)) {
      where.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: {
          memberSubscriptions: {
            where: { isCurrent: true },
            include: {
              subscription: {
                select: { name: true, durationType: true, durationValue: true }
              }
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.member.count({ where }),
    ]);

    res.json({ members, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/members/:id
 * Full member detail including subscription history.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        memberSubscriptions: {
          include: {
            subscription: {
              select: { name: true, durationType: true, durationValue: true, price: true, freezeAllowed: true }
            }
          },
          orderBy: { createdAt: 'desc' },
        },
        createdBy: {
          select: { fullName: true }
        },
        payments: {
          orderBy: { paidAt: 'desc' }
        }
      },
    });

    if (!member) {
      return res.status(404).json({
        error: { message: 'Member not found.', code: 'NOT_FOUND' },
      });
    }

    // Compute pending balance for the current active subscription term
    const currentTerm = member.memberSubscriptions?.find(t => t.isCurrent);
    let pendingBalance = 0;
    
    if (currentTerm && currentTerm.subscription) {
      const planPrice = Number(currentTerm.subscription.price) || 0;
      
      // Sum all payments linked to this specific subscription term
      const paymentsForTerm = member.payments.filter(p => p.memberSubscriptionId === currentTerm.id);
      const totalPaidForTerm = paymentsForTerm.reduce((sum, p) => sum + Number(p.amount), 0);
      
      pendingBalance = Math.max(0, planPrice - totalPaidForTerm);
    }
    
    member.pendingBalance = pendingBalance;

    res.json({ member });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/members
 * Create a member manually (bypassing the registration pipeline).
 * Admin only.
 */
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const {
      fullName, phone, gender, birthday, heightCm, weightKg,
      fitnessGoal, notes, emergencyContact, subscriptionId,
    } = req.body;

    if (!fullName || !phone || !gender) {
      return res.status(400).json({
        error: { message: 'Full name, phone, and gender are required.', code: 'VALIDATION_ERROR' },
      });
    }

    if (!subscriptionId) {
      return res.status(400).json({
        error: { message: 'A subscription plan must be selected.', code: 'VALIDATION_ERROR' },
      });
    }

    const qrToken = await generateQrToken();
    const manualCode = await generateManualCode();

    const member = await prisma.member.create({
      data: {
        fullName: fullName.trim(),
        phone: phone.replace(/[\s-]/g, ''),
        gender,
        birthday: birthday ? new Date(birthday) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        fitnessGoal: fitnessGoal?.trim() || null,
        notes: notes?.trim() || null,
        emergencyContact: emergencyContact?.trim() || null,
        qrToken,
        manualCode,
        status: MEMBER_STATUS.ACTIVE,
        createdByUserId: req.user.id,
      },
    });

    // Create the first subscription term
    await createSubscriptionTerm({
      memberId: member.id,
      subscriptionId,
    });

    await logActivity({
      userId: req.user.id,
      action: 'member_created',
      entityType: 'member',
      entityId: member.id,
      metadata: { fullName: member.fullName, manualCode: member.manualCode },
    });

    // Re-fetch with subscription info
    const fullMember = await prisma.member.findUnique({
      where: { id: member.id },
      include: {
        memberSubscriptions: {
          where: { isCurrent: true },
          include: { subscription: { select: { name: true } } },
          take: 1,
        },
      },
    });

    res.status(201).json({ member: fullMember });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/members/:id
 * Update member details (personal info, status transitions).
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      fullName, phone, gender, birthday, heightCm, weightKg,
      fitnessGoal, notes, emergencyContact, status,
    } = req.body;

    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        error: { message: 'Member not found.', code: 'NOT_FOUND' },
      });
    }

    const updateData = {};

    // Personal info updates
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (phone !== undefined) updateData.phone = phone.replace(/[\s-]/g, '');
    if (gender !== undefined) updateData.gender = gender;
    if (birthday !== undefined) updateData.birthday = birthday ? new Date(birthday) : null;
    if (heightCm !== undefined) updateData.heightCm = heightCm ? Number(heightCm) : null;
    if (weightKg !== undefined) updateData.weightKg = weightKg ? Number(weightKg) : null;
    if (fitnessGoal !== undefined) updateData.fitnessGoal = fitnessGoal?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact?.trim() || null;

    // Status transition validation
    if (status !== undefined && status !== existing.status) {
      const validNext = VALID_TRANSITIONS[existing.status] || [];
      if (!validNext.includes(status)) {
        return res.status(400).json({
          error: {
            message: `Cannot transition from "${existing.status}" to "${status}".`,
            code: 'INVALID_STATE_TRANSITION',
          },
        });
      }
      updateData.status = status;

      // If transitioning to deleted, set deletedAt
      if (status === MEMBER_STATUS.DELETED) {
        updateData.deletedAt = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: { message: 'No fields to update.', code: 'VALIDATION_ERROR' },
      });
    }

    const member = await prisma.member.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: req.user.id,
      action: 'member_updated',
      entityType: 'member',
      entityId: member.id,
      metadata: { updatedFields: Object.keys(updateData) },
    });

    res.json({ member });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/members/:id
 * Soft-delete a member. Admin only.
 */
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const member = await prisma.member.findUnique({ where: { id: req.params.id } });

    if (!member) {
      return res.status(404).json({
        error: { message: 'Member not found.', code: 'NOT_FOUND' },
      });
    }

    if (member.deletedAt) {
      return res.status(400).json({
        error: { message: 'Member is already deleted.', code: 'ALREADY_DELETED' },
      });
    }

    await prisma.member.update({
      where: { id: req.params.id },
      data: {
        status: MEMBER_STATUS.DELETED,
        deletedAt: new Date(),
      },
    });

    await logActivity({
      userId: req.user.id,
      action: 'member_deleted',
      entityType: 'member',
      entityId: member.id,
    });

    res.json({ message: 'Member deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/members/:id/restore
 * Restore a soft-deleted member. Admin only.
 */
router.patch('/:id/restore', authorize('admin'), async (req, res, next) => {
  try {
    const member = await prisma.member.findUnique({ where: { id: req.params.id } });

    if (!member) {
      return res.status(404).json({
        error: { message: 'Member not found.', code: 'NOT_FOUND' },
      });
    }

    if (!member.deletedAt) {
      return res.status(400).json({
        error: { message: 'Member is not deleted.', code: 'NOT_DELETED' },
      });
    }

    const updatedMember = await prisma.member.update({
      where: { id: req.params.id },
      data: {
        status: MEMBER_STATUS.ACTIVE,
        deletedAt: null,
      },
    });

    await logActivity({
      userId: req.user.id,
      action: 'member_restored',
      entityType: 'member',
      entityId: member.id,
    });

    res.json({ member: updatedMember });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/members/:id/regenerate-qr
 * Invalidates the old QR token and generates a new one. Admin only.
 */
router.post('/:id/regenerate-qr', authorize('admin'), async (req, res, next) => {
  try {
    const member = await prisma.member.findUnique({ where: { id: req.params.id } });

    if (!member) {
      return res.status(404).json({
        error: { message: 'Member not found.', code: 'NOT_FOUND' },
      });
    }

    const newQrToken = await generateQrToken();
    const oldToken = member.qrToken;

    const updatedMember = await prisma.member.update({
      where: { id: req.params.id },
      data: {
        qrToken: newQrToken,
        qrTokenRegeneratedAt: new Date(),
      },
    });

    await logActivity({
      userId: req.user.id,
      action: 'qr_token_regenerated',
      entityType: 'member',
      entityId: member.id,
      metadata: { oldTokenPrefix: oldToken.substring(0, 8) + '...' },
    });

    res.json({
      member: updatedMember,
      message: 'QR token regenerated. The old token is now invalid — reprint the member card.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/members/:id/renew
 * Creates a new subscription term (renewal).
 */
router.post('/:id/renew', async (req, res, next) => {
  try {
    const { subscriptionId, startDate } = req.body;
    const { id } = req.params;

    if (!subscriptionId) {
      return res.status(400).json({
        error: { message: 'A subscription plan must be selected for renewal.', code: 'VALIDATION_ERROR' },
      });
    }

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
      return res.status(404).json({
        error: { message: 'Member not found.', code: 'NOT_FOUND' },
      });
    }

    const term = await createSubscriptionTerm({
      memberId: id,
      subscriptionId,
      startDate: startDate ? new Date(startDate) : undefined,
    });

    // If the member was expired or completed, transition them back to active
    if ([MEMBER_STATUS.EXPIRED, MEMBER_STATUS.COMPLETED].includes(member.status)) {
      await prisma.member.update({
        where: { id },
        data: { status: MEMBER_STATUS.ACTIVE },
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'member_renewed',
      entityType: 'member',
      entityId: id,
      metadata: { subscriptionName: term.subscription.name },
    });

    res.status(201).json({ term });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/members/:id/freeze
 * Freezes an active member.
 */
router.post('/:id/freeze', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        memberSubscriptions: {
          where: { isCurrent: true },
          include: { subscription: true }
        }
      }
    });

    if (!member) {
      return res.status(404).json({ error: { message: 'Member not found.', code: 'NOT_FOUND' } });
    }

    if (member.status !== MEMBER_STATUS.ACTIVE) {
      return res.status(400).json({ error: { message: `Cannot freeze member in status: ${member.status}. Only ACTIVE members can be frozen.`, code: 'INVALID_STATE_TRANSITION' } });
    }

    const currentTerm = member.memberSubscriptions[0];
    if (!currentTerm) {
      return res.status(400).json({ error: { message: 'Member has no active subscription to freeze.', code: 'VALIDATION_ERROR' } });
    }

    if (!currentTerm.subscription.freezeAllowed) {
      return res.status(400).json({ error: { message: 'The current subscription plan does not allow freezing.', code: 'VALIDATION_ERROR' } });
    }

    // Begin Transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Create Freeze record
      await tx.freeze.create({
        data: {
          memberId: id,
          memberSubscriptionId: currentTerm.id,
          startDate: new Date(),
          appliedByUserId: req.user.id,
        }
      });

      // 2. Update Member status
      await tx.member.update({
        where: { id },
        data: { status: MEMBER_STATUS.FROZEN }
      });
    });

    await logActivity({
      userId: req.user.id,
      action: 'member_frozen',
      entityType: 'member',
      entityId: id,
      metadata: { subscriptionName: currentTerm.subscription.name }
    });

    res.json({ message: 'Member successfully frozen.' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/members/:id/unfreeze
 * Unfreezes a frozen member and extends their subscription.
 */
router.post('/:id/unfreeze', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        freezes: {
          where: { endDate: null },
          orderBy: { startDate: 'desc' },
          take: 1
        },
        memberSubscriptions: {
          where: { isCurrent: true },
          include: { subscription: true }
        }
      }
    });

    if (!member) {
      return res.status(404).json({ error: { message: 'Member not found.', code: 'NOT_FOUND' } });
    }

    if (member.status !== MEMBER_STATUS.FROZEN) {
      return res.status(400).json({ error: { message: `Member is currently ${member.status}, not FROZEN.`, code: 'INVALID_STATE_TRANSITION' } });
    }

    const activeFreeze = member.freezes[0];
    if (!activeFreeze) {
      return res.status(400).json({ error: { message: 'No active freeze record found to unfreeze.', code: 'DATA_ERROR' } });
    }

    const currentTerm = member.memberSubscriptions[0];

    // Calculate days frozen
    const now = new Date();
    // Use Math.max(1) so if unfreezing same day, it counts as at least 1 day, or 0? 
    // Usually same day unfreeze = 0 days extended, but let's just do straight diff.
    const diffTime = now.getTime() - new Date(activeFreeze.startDate).getTime();
    const daysFrozen = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    await prisma.$transaction(async (tx) => {
      // 1. Close the Freeze record
      await tx.freeze.update({
        where: { id: activeFreeze.id },
        data: {
          endDate: now,
          daysCount: daysFrozen
        }
      });

      // 2. Extend subscription
      if (currentTerm) {
        let newEndDate = currentTerm.endDate;
        if (newEndDate && daysFrozen > 0) {
          newEndDate = new Date(newEndDate);
          newEndDate.setDate(newEndDate.getDate() + daysFrozen);
        }

        await tx.memberSubscription.update({
          where: { id: currentTerm.id },
          data: {
            totalFrozenDays: currentTerm.totalFrozenDays + daysFrozen,
            endDate: newEndDate
          }
        });
      }

      // 3. Update Member status back to ACTIVE
      await tx.member.update({
        where: { id },
        data: { status: MEMBER_STATUS.ACTIVE }
      });
    });

    await logActivity({
      userId: req.user.id,
      action: 'member_unfrozen',
      entityType: 'member',
      entityId: id,
      metadata: { daysFrozen }
    });

    res.json({ message: 'Member successfully unfrozen.', daysFrozen });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
