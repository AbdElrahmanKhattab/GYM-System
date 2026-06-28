const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

// All subscription management routes require authentication
router.use(authenticate);

/**
 * GET /api/subscriptions
 * List all subscriptions (both active and inactive), ordered by displayOrder.
 */
router.get('/', async (req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ],
    });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions
 * Create a new subscription (Admin only).
 */
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { name, description, price, durationType, durationValue, freezeAllowed, isActive, displayOrder } = req.body;

    // Basic validation
    if (!name || price === undefined || !durationType || durationValue === undefined) {
      return res.status(400).json({
        error: { message: 'Name, price, duration type, and duration value are required.', code: 'VALIDATION_ERROR' },
      });
    }

    if (!['months', 'days', 'sessions'].includes(durationType)) {
      return res.status(400).json({
        error: { message: 'Invalid duration type.', code: 'VALIDATION_ERROR' },
      });
    }

    if (durationValue <= 0 || !Number.isInteger(Number(durationValue))) {
      return res.status(400).json({
        error: { message: 'Duration value must be a positive integer.', code: 'VALIDATION_ERROR' },
      });
    }

    if (Number(price) < 0) {
      return res.status(400).json({
        error: { message: 'Price cannot be negative.', code: 'VALIDATION_ERROR' },
      });
    }

    const subscription = await prisma.subscription.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: Number(price),
        durationType,
        durationValue: Number(durationValue),
        freezeAllowed: Boolean(freezeAllowed),
        allowMultipleCheckinsPerDay: Boolean(allowMultipleCheckinsPerDay),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      },
    });

    await logActivity({
      userId: req.user.id,
      action: 'subscription_created',
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: { name: subscription.name, price: subscription.price },
    });

    res.status(201).json({ subscription });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/subscriptions/:id
 * Edit subscription details or toggle isActive (Admin only).
 */
router.patch('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, durationType, durationValue, freezeAllowed, allowMultipleCheckinsPerDay, isActive, displayOrder } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (price !== undefined) {
      if (Number(price) < 0) {
        return res.status(400).json({
          error: { message: 'Price cannot be negative.', code: 'VALIDATION_ERROR' },
        });
      }
      updateData.price = Number(price);
    }
    
    if (durationType !== undefined) {
      if (!['months', 'days', 'sessions'].includes(durationType)) {
        return res.status(400).json({
          error: { message: 'Invalid duration type.', code: 'VALIDATION_ERROR' },
        });
      }
      updateData.durationType = durationType;
    }

    if (durationValue !== undefined) {
      if (durationValue <= 0 || !Number.isInteger(Number(durationValue))) {
        return res.status(400).json({
          error: { message: 'Duration value must be a positive integer.', code: 'VALIDATION_ERROR' },
        });
      }
      updateData.durationValue = Number(durationValue);
    }

    if (freezeAllowed !== undefined) updateData.freezeAllowed = Boolean(freezeAllowed);
    if (allowMultipleCheckinsPerDay !== undefined) updateData.allowMultipleCheckinsPerDay = Boolean(allowMultipleCheckinsPerDay);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: { message: 'No fields to update.', code: 'VALIDATION_ERROR' },
      });
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: req.user.id,
      action: 'subscription_updated',
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: { updatedFields: Object.keys(updateData) },
    });

    res.json({ subscription });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: { message: 'Subscription not found.', code: 'NOT_FOUND' },
      });
    }
    next(error);
  }
});

module.exports = router;
