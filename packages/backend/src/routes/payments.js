const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/payments
 * List payments with optional filtering (date ranges, member search)
 */
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, memberId, page = 1, limit = 50 } = req.query;
    
    const where = {};
    if (memberId) {
      where.memberId = memberId;
    }
    
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = new Date(startDate);
      if (endDate) where.paidAt.lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          member: { select: { fullName: true, id: true } },
          recordedBy: { select: { fullName: true } },
          memberSubscription: { 
            include: { subscription: { select: { name: true } } }
          }
        },
        orderBy: { paidAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.payment.count({ where })
    ]);

    // Compute sum for the filtered period
    const totalAmountResult = await prisma.payment.aggregate({
      where,
      _sum: { amount: true }
    });

    res.json({ 
      payments, 
      total, 
      page: Number(page), 
      limit: Number(limit),
      totalAmount: totalAmountResult._sum.amount || 0
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments
 * Record a new payment
 */
router.post('/', async (req, res, next) => {
  try {
    const { memberId, memberSubscriptionId, amount, paymentMethod, paidAt, notes } = req.body;

    if (!memberId || !amount || !paymentMethod) {
      return res.status(400).json({ 
        error: { message: 'Member ID, amount, and payment method are required.', code: 'VALIDATION_ERROR' } 
      });
    }

    const payment = await prisma.payment.create({
      data: {
        memberId,
        memberSubscriptionId: memberSubscriptionId || null,
        amount: Number(amount),
        paymentMethod,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        notes: notes?.trim() || null,
        recordedByUserId: req.user.id
      },
      include: {
        member: { select: { fullName: true } }
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'payment_recorded',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { amount: payment.amount, memberName: payment.member.fullName, method: paymentMethod }
    });

    res.status(201).json({ payment });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/payments/:id
 * Delete (void) a payment. Admin only.
 */
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({ 
      where: { id },
      include: { member: { select: { fullName: true } } }
    });

    if (!payment) {
      return res.status(404).json({ error: { message: 'Payment not found.', code: 'NOT_FOUND' } });
    }

    await prisma.payment.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'payment_voided',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { amount: payment.amount, memberName: payment.member.fullName }
    });

    res.json({ message: 'Payment deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
