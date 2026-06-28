const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

// Require authentication for all routes
router.use(authenticate);

/**
 * Helper to get the singleton rules record.
 * Creates it with defaults if it doesn't exist.
 */
async function getSingletonRules() {
  let rules = await prisma.attendanceRule.findFirst();
  
  if (!rules) {
    rules = await prisma.attendanceRule.create({
      data: {
        blockExpiredMemberships: true,
        blockZeroRemainingSessions: true,
        warnOnUnpaidBalance: true,
        autoCompleteOnZeroSessions: true,
        expiringSoonWindowDays: 7,
      }
    });
  }
  return rules;
}

/**
 * GET /api/attendance-rules
 * Get the current gym attendance rules config.
 * Any authenticated staff can read this (needed by the scanner).
 */
router.get('/', async (req, res, next) => {
  try {
    const rules = await getSingletonRules();
    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/attendance-rules
 * Update the rules config. Admin only.
 */
router.patch('/', authorize('admin'), async (req, res, next) => {
  try {
    const current = await getSingletonRules();
    
    // Whitelist allowed fields to update
    const {
      blockExpiredMemberships,
      blockZeroRemainingSessions,
      warnOnUnpaidBalance,
      autoCompleteOnZeroSessions,
      expiringSoonWindowDays,
    } = req.body;

    const data = {};
    if (blockExpiredMemberships !== undefined) data.blockExpiredMemberships = Boolean(blockExpiredMemberships);
    if (blockZeroRemainingSessions !== undefined) data.blockZeroRemainingSessions = Boolean(blockZeroRemainingSessions);
    if (warnOnUnpaidBalance !== undefined) data.warnOnUnpaidBalance = Boolean(warnOnUnpaidBalance);
    if (autoCompleteOnZeroSessions !== undefined) data.autoCompleteOnZeroSessions = Boolean(autoCompleteOnZeroSessions);
    if (expiringSoonWindowDays !== undefined) data.expiringSoonWindowDays = Number(expiringSoonWindowDays);

    const rules = await prisma.attendanceRule.update({
      where: { id: current.id },
      data: {
        ...data,
        updatedByUserId: req.user.id,
      },
    });

    await logActivity({
      userId: req.user.id,
      action: 'attendance_rules_updated',
      entityType: 'attendance_rule',
      entityId: rules.id,
      metadata: { changedKeys: Object.keys(data) },
    });

    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
