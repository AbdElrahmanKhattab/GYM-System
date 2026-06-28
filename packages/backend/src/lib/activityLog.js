const prisma = require('./prisma');

/**
 * Writes a structured entry to the activity_log table.
 * Called from routes/services after any significant action.
 *
 * @param {Object} params
 * @param {string|null} params.userId - The user who performed the action (null for system events)
 * @param {string} params.action - Action identifier (e.g., 'login', 'member_created')
 * @param {string|null} [params.entityType] - Entity type (e.g., 'member', 'payment')
 * @param {string|null} [params.entityId] - Entity UUID
 * @param {Object|null} [params.metadata] - Extra context (e.g., old/new values)
 */
async function logActivity({ userId, action, entityType = null, entityId = null, metadata = null }) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    // Activity logging should never crash the main operation
    console.error('[ActivityLog] Failed to write log entry:', error.message);
  }
}

module.exports = { logActivity };
