const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');
const { generateQrToken, generateManualCode } = require('../lib/codeGenerators');
const { createSubscriptionTerm } = require('../lib/subscriptionHelper');
const { MEMBER_STATUS, PIN_MIN_LENGTH, PIN_MAX_LENGTH } = require('@gym-system/shared');

const router = express.Router();

// Require authentication for all dashboard routes
router.use(authenticate);

/**
 * GET /api/new-customers
 * List registrations. Can filter by status (?status=pending).
 */
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const where = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const customers = await prisma.newCustomer.findMany({
      where,
      include: {
        preferredSubscription: {
          select: { name: true }
        },
        reviewedBy: {
          select: { fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ customers });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/new-customers/:id/status
 * Admin endpoint to approve or reject a new customer.
 * On approval: creates a Member + first subscription term.
 */
router.patch('/:id/status', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, subscriptionId } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: { message: 'Status must be "approved" or "rejected".', code: 'VALIDATION_ERROR' },
      });
    }

    const customer = await prisma.newCustomer.findUnique({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({
        error: { message: 'Customer registration not found.', code: 'NOT_FOUND' }
      });
    }

    if (customer.status !== 'pending') {
      return res.status(400).json({
        error: { message: `Customer is already ${customer.status}.`, code: 'INVALID_STATE' }
      });
    }

    let resultingMemberId = null;

    // ─── On Approval: Create the Member ───
    if (status === 'approved') {
      // Determine which subscription to use: explicit override or customer's preference
      const planId = subscriptionId || customer.preferredSubscriptionId;

      if (!planId) {
        return res.status(400).json({
          error: { message: 'A subscription plan must be selected to approve this registration.', code: 'VALIDATION_ERROR' },
        });
      }

      // Validate optional PIN
      let pinHash = null;
      if (req.body.pin) {
        const cleanedPin = req.body.pin.replace(/\s/g, '');
        if (!/^\d+$/.test(cleanedPin)) {
          return res.status(400).json({
            error: { message: 'PIN must contain only digits.', code: 'VALIDATION_ERROR' },
          });
        }
        if (cleanedPin.length < PIN_MIN_LENGTH || cleanedPin.length > PIN_MAX_LENGTH) {
          return res.status(400).json({
            error: { message: `PIN must be between ${PIN_MIN_LENGTH} and ${PIN_MAX_LENGTH} digits.`, code: 'VALIDATION_ERROR' },
          });
        }
        pinHash = await bcrypt.hash(cleanedPin, 10);
      }

      // Generate secure codes
      const qrToken = await generateQrToken();
      const manualCode = await generateManualCode();

      // Create the member
      const member = await prisma.member.create({
        data: {
          fullName: customer.fullName,
          phone: customer.phone,
          gender: customer.gender,
          heightCm: customer.heightCm,
          weightKg: customer.weightKg,
          fitnessGoal: customer.fitnessGoal,
          notes: customer.notes,
          qrToken,
          manualCode,
          pinHash,
          pinSetAt: pinHash ? new Date() : null,
          status: MEMBER_STATUS.ACTIVE,
          createdByUserId: req.user.id,
        },
      });

      resultingMemberId = member.id;

      // Create the first subscription term
      await createSubscriptionTerm({
        memberId: member.id,
        subscriptionId: planId,
      });

      await logActivity({
        userId: req.user.id,
        action: 'member_created',
        entityType: 'member',
        entityId: member.id,
        metadata: { source: 'approval', fullName: member.fullName, manualCode: member.manualCode },
      });
    }

    // Update the customer record
    const updatedCustomer = await prisma.newCustomer.update({
      where: { id },
      data: {
        status,
        reviewedByUserId: req.user.id,
        reviewedAt: new Date(),
        resultingMemberId,
      },
    });

    await logActivity({
      userId: req.user.id,
      action: status === 'approved' ? 'customer_approved' : 'customer_rejected',
      entityType: 'new_customer',
      entityId: updatedCustomer.id,
    });

    res.json({ customer: updatedCustomer, memberId: resultingMemberId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
