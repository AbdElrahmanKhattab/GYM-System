const prisma = require('./prisma');
const { DURATION_TYPE } = require('@gym-system/shared');

/**
 * Creates a new member_subscription term based on the subscription plan's rules.
 * Handles months-based, days-based, and session-based plans.
 *
 * @param {Object} params
 * @param {string} params.memberId
 * @param {string} params.subscriptionId
 * @param {Date}   [params.startDate] - defaults to today
 * @returns {Promise<Object>} the created MemberSubscription record
 */
async function createSubscriptionTerm({ memberId, subscriptionId, startDate = new Date() }) {
  // Load the plan details
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw Object.assign(new Error('Subscription plan not found.'), { status: 404 });
  }

  // Mark any existing current terms as not current
  await prisma.memberSubscription.updateMany({
    where: { memberId, isCurrent: true },
    data: { isCurrent: false },
  });

  // Compute end date and remaining sessions based on duration type
  let endDate = null;
  let remainingSessions = null;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0); // normalize to start of day

  switch (subscription.durationType) {
    case DURATION_TYPE.MONTHS: {
      endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + subscription.durationValue);
      break;
    }
    case DURATION_TYPE.DAYS: {
      endDate = new Date(start);
      endDate.setDate(endDate.getDate() + subscription.durationValue);
      break;
    }
    case DURATION_TYPE.SESSIONS: {
      // Session-based plans don't have an end date — they expire when sessions run out
      remainingSessions = subscription.durationValue;
      break;
    }
    default:
      throw new Error(`Unknown duration type: ${subscription.durationType}`);
  }

  const term = await prisma.memberSubscription.create({
    data: {
      memberId,
      subscriptionId,
      startDate: start,
      endDate,
      remainingSessions,
      isCurrent: true,
    },
    include: {
      subscription: {
        select: { name: true, durationType: true, durationValue: true, price: true }
      }
    }
  });

  return term;
}

module.exports = { createSubscriptionTerm };
