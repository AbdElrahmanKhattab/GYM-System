const { MEMBER_STATUS } = require('@gym-system/shared');

/**
 * Evaluates whether a member is allowed to check in based on their current state,
 * today's attendance history, and the globally configured attendance rules.
 * 
 * This is a pure/synchronous logic function to allow easy unit testing.
 * 
 * @param {Object} member - The member object
 * @param {Object} currentSubscriptionTerm - The current memberSubscription object (if any)
 * @param {Array} todayAttendanceRecords - Array of attendance records for the member today
 * @param {Object} rulesConfig - The AttendanceRule config object from DB
 * 
 * @returns {Object} result
 * @returns {boolean} result.allowed - True if the check-in should proceed
 * @returns {string|null} result.rejectionReason - Rejection code if allowed is false
 * @returns {string|null} result.warning - Warning message if allowed is true but there's an issue
 * @returns {boolean} result.shouldAutoComplete - True if the scan should transition member to completed
 */
function evaluateAttendance(member, currentSubscriptionTerm, todayAttendanceRecords, rulesConfig) {
  // 1. Core state validations (hard blocks, ignore rules config)
  if (!member) {
    return { allowed: false, rejectionReason: 'NOT_FOUND', warning: null, shouldAutoComplete: false };
  }

  if (member.status === MEMBER_STATUS.SUSPENDED) {
    return { allowed: false, rejectionReason: 'SUSPENDED', warning: null, shouldAutoComplete: false };
  }

  if (member.status === MEMBER_STATUS.FROZEN) {
    return { allowed: false, rejectionReason: 'FROZEN', warning: null, shouldAutoComplete: false };
  }
  
  if (member.status === MEMBER_STATUS.DELETED) {
    return { allowed: false, rejectionReason: 'NOT_FOUND', warning: null, shouldAutoComplete: false };
  }

  // 2. Configurable state validations
  if (member.status === MEMBER_STATUS.EXPIRED && rulesConfig.blockExpiredMemberships) {
    return { allowed: false, rejectionReason: 'EXPIRED', warning: null, shouldAutoComplete: false };
  }

  if (member.status === MEMBER_STATUS.COMPLETED && rulesConfig.blockZeroRemainingSessions) {
    return { allowed: false, rejectionReason: 'COMPLETED_NO_SESSIONS', warning: null, shouldAutoComplete: false };
  }

  // 3. Subscription term validations
  if (!currentSubscriptionTerm) {
    // If they have no current term, but they aren't actively marked expired/completed, we still block them
    return { allowed: false, rejectionReason: 'NO_ACTIVE_SUBSCRIPTION', warning: null, shouldAutoComplete: false };
  }

  // Session-based check
  if (currentSubscriptionTerm.remainingSessions !== null) {
    if (currentSubscriptionTerm.remainingSessions <= 0 && rulesConfig.blockZeroRemainingSessions) {
      return { allowed: false, rejectionReason: 'COMPLETED_NO_SESSIONS', warning: null, shouldAutoComplete: false };
    }
  }

  // 4. Frequency validation
  // Get allowMultipleCheckinsPerDay from the current subscription, defaulting to false
  const allowMultipleCheckinsPerDay = currentSubscriptionTerm.subscription?.allowMultipleCheckinsPerDay || false;
  if (todayAttendanceRecords && todayAttendanceRecords.length > 0 && !allowMultipleCheckinsPerDay) {
    return { allowed: false, rejectionReason: 'ALREADY_CHECKED_IN_TODAY', warning: null, shouldAutoComplete: false };
  }

  // --- At this point, the check-in is ALLOWED. Now evaluate side-effects & warnings ---
  let warning = null;
  let shouldAutoComplete = false;

  // Check for auto-complete on zero sessions (this happens AFTER this scan completes, 
  // so if remaining is exactly 1, this scan will bring it to 0).
  if (currentSubscriptionTerm.remainingSessions === 1 && rulesConfig.autoCompleteOnZeroSessions) {
    shouldAutoComplete = true;
  }

  // Check expiring soon warning (for date-based plans)
  if (currentSubscriptionTerm.endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(currentSubscriptionTerm.endDate);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= rulesConfig.expiringSoonWindowDays) {
      warning = 'EXPIRING_SOON';
    } else if (diffDays < 0 && !rulesConfig.blockExpiredMemberships) {
       // Allowed but expired
       warning = 'EXPIRED_ALLOWED';
    }
  }

  // Check unpaid balance warning
  // Note: pending balance calculation is typically done outside this pure function,
  // but we assume `member.pendingBalance` might be populated by the caller.
  if (member.pendingBalance && member.pendingBalance > 0 && rulesConfig.warnOnUnpaidBalance) {
    warning = 'UNPAID_BALANCE';
  }

  return { allowed: true, rejectionReason: null, warning, shouldAutoComplete };
}

module.exports = { evaluateAttendance };
