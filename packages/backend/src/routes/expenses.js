const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');
const { USER_ROLE } = require('@gym-system/shared');

const router = express.Router();
router.use(authenticate, authorize(USER_ROLE.ADMIN));

/**
 * GET /api/expenses
 * List expenses with optional date range filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const where = {};
    if (startDate || endDate) {
      where.spentAt = {};
      if (startDate) where.spentAt.gte = new Date(startDate);
      if (endDate) where.spentAt.lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          recordedBy: { select: { fullName: true } }
        },
        orderBy: { spentAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.expense.count({ where })
    ]);

    const totalAmountResult = await prisma.expense.aggregate({
      where,
      _sum: { amount: true }
    });

    res.json({ 
      expenses, 
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
 * POST /api/expenses
 * Record a new expense
 */
router.post('/', async (req, res, next) => {
  try {
    const { amount, category, description, spentAt } = req.body;

    if (!amount || !category) {
      return res.status(400).json({ 
        error: { message: 'Amount and category are required.', code: 'VALIDATION_ERROR' } 
      });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: Number(amount),
        category: category.trim(),
        description: description?.trim() || null,
        spentAt: spentAt ? new Date(spentAt) : new Date(),
        recordedByUserId: req.user.id
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'expense_recorded',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { amount: expense.amount, category: expense.category }
    });

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete (void) an expense. Admin only.
 */
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({ where: { id } });

    if (!expense) {
      return res.status(404).json({ error: { message: 'Expense not found.', code: 'NOT_FOUND' } });
    }

    await prisma.expense.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'expense_voided',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { amount: expense.amount, category: expense.category }
    });

    res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
