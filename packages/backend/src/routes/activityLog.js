const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('@gym-system/shared');

const router = express.Router();

// Only Admins can access activity logs
router.use(authenticate, authorize(USER_ROLE.ADMIN));

/**
 * GET /api/activity-log
 * Get a paginated and filtered list of activity logs.
 */
router.get('/', async (req, res, next) => {
  try {
    const { userId, actionType, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};

    if (userId) {
      where.userId = userId;
    }

    if (actionType) {
      where.action = actionType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { fullName: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.activityLog.count({ where })
    ]);

    res.json({
      logs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / take)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/activity-log/actions
 * Get a distinct list of actions that have been logged, for use in filter dropdowns.
 */
router.get('/actions', async (req, res, next) => {
  try {
    const distinctActions = await prisma.activityLog.findMany({
      select: { action: true },
      distinct: ['action']
    });

    res.json({ actions: distinctActions.map(a => a.action).sort() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
