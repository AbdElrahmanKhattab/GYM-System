const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { MEMBER_STATUS, NEW_CUSTOMER_STATUS } = require('@gym-system/shared');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Aggregates data for the Dashboard Home page.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // ─── Attendance Today ───
    const todayAttendanceCount = await prisma.attendanceRecord.count({
      where: {
        checkedInAt: { gte: todayStart, lte: todayEnd },
        isVoided: false,
      }
    });

    // ─── Member Counts (Active vs Expired) ───
    const activeMembersCount = await prisma.member.count({
      where: { status: MEMBER_STATUS.ACTIVE }
    });

    const expiredMembersCount = await prisma.member.count({
      where: { status: MEMBER_STATUS.EXPIRED }
    });

    // ─── Pending Registrations ───
    const pendingRegistrationsCount = await prisma.newCustomer.count({
      where: { status: NEW_CUSTOMER_STATUS.PENDING }
    });

    // ─── Monthly Revenue ───
    const monthlyRevenueAggregate = await prisma.payment.aggregate({
      where: { paidAt: { gte: firstDayOfMonth } },
      _sum: { amount: true }
    });
    const monthlyRevenue = Number(monthlyRevenueAggregate._sum.amount || 0);

    // ─── Expiring Soon ───
    let rulesConfig = await prisma.attendanceRule.findFirst();
    const windowDays = rulesConfig?.expiringSoonWindowDays || 7;
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + windowDays);
    futureDate.setHours(23, 59, 59, 999);

    const expiringSoonCount = await prisma.memberSubscription.count({
      where: {
        isCurrent: true,
        endDate: { gte: todayStart, lte: futureDate },
        member: { status: MEMBER_STATUS.ACTIVE }
      }
    });

    // ─── Outstanding Payments ───
    // Calculate global outstanding balance across all current subscriptions
    const currentTerms = await prisma.memberSubscription.findMany({
      where: { isCurrent: true },
      include: {
        subscription: { select: { price: true } },
        payments: { select: { amount: true } }
      }
    });

    let outstandingPaymentsTotal = 0;
    for (const term of currentTerms) {
      const planPrice = Number(term.subscription.price) || 0;
      const totalPaid = term.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      if (planPrice > totalPaid) {
        outstandingPaymentsTotal += (planPrice - totalPaid);
      }
    }

    // ─── Weekly Attendance Chart (Last 7 Days) ───
    const attendanceChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);

      const count = await prisma.attendanceRecord.count({
        where: { checkedInAt: { gte: start, lte: end }, isVoided: false }
      });

      attendanceChart.push({
        date: start.toLocaleDateString(undefined, { weekday: 'short' }),
        count
      });
    }

    // ─── Monthly Revenue Chart (Last 6 Months) ───
    const revenueChart = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const start = new Date(d);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      end.setHours(23, 59, 59, 999);

      const agg = await prisma.payment.aggregate({
        where: { paidAt: { gte: start, lte: end } },
        _sum: { amount: true }
      });

      revenueChart.push({
        month: start.toLocaleDateString(undefined, { month: 'short' }),
        revenue: Number(agg._sum.amount || 0)
      });
    }

    res.json({
      todayAttendanceCount,
      activeMembersCount,
      expiredMembersCount,
      pendingRegistrationsCount,
      monthlyRevenue,
      expiringSoonCount,
      outstandingPaymentsTotal,
      attendanceChart,
      revenueChart
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
