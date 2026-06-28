const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE, MEMBER_STATUS } = require('@gym-system/shared');
const ExcelJS = require('exceljs');

const router = express.Router();

// Only Admins can access reports
router.use(authenticate, authorize(USER_ROLE.ADMIN));

/**
 * Helper to fetch report data based on type
 */
async function getReportData(type, startDate, endDate) {
  let start, end;
  if (startDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
  }
  if (endDate) {
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  const dateFilter = {};
  if (start) dateFilter.gte = start;
  if (end) dateFilter.lte = end;
  const hasDateFilter = start || end;

  switch (type) {
    case 'attendance': {
      const records = await prisma.attendanceRecord.findMany({
        where: hasDateFilter ? { checkedInAt: dateFilter } : {},
        include: { member: { select: { fullName: true } } },
        orderBy: { checkedInAt: 'desc' }
      });
      return records.map(r => ({
        id: r.id,
        Date: r.checkedInAt.toLocaleDateString(),
        'Member Name': r.member?.fullName || 'Unknown',
        'Entry Method': r.entryMethod,
        Time: r.checkedInAt.toLocaleTimeString(),
        'Voided': r.isVoided ? 'Yes' : 'No'
      }));
    }

    case 'revenue': {
      const payments = await prisma.payment.findMany({
        where: hasDateFilter ? { paidAt: dateFilter } : {},
        include: { member: { select: { fullName: true } } },
        orderBy: { paidAt: 'desc' }
      });
      return payments.map(p => ({
        id: p.id,
        Date: p.paidAt.toLocaleDateString(),
        'Member Name': p.member?.fullName || 'Unknown',
        Amount: Number(p.amount),
        'Payment Method': p.paymentMethod,
        Notes: p.notes || ''
      }));
    }

    case 'memberships': {
      const subs = await prisma.memberSubscription.findMany({
        where: hasDateFilter ? { startDate: dateFilter } : {},
        include: {
          member: { select: { fullName: true, status: true } },
          subscription: { select: { name: true } }
        },
        orderBy: { startDate: 'desc' }
      });
      return subs.map(s => ({
        id: s.id,
        'Member Name': s.member?.fullName || 'Unknown',
        Subscription: s.subscription?.name || 'Unknown',
        'Start Date': s.startDate.toLocaleDateString(),
        'End Date': s.endDate ? s.endDate.toLocaleDateString() : 'N/A',
        Status: s.isCurrent ? 'Current' : 'Past',
        'Member Status': s.member?.status || 'Unknown'
      }));
    }

    case 'expired-members': {
      const members = await prisma.member.findMany({
        where: { status: MEMBER_STATUS.EXPIRED },
        orderBy: { updatedAt: 'desc' }
      });
      return members.map(m => ({
        id: m.id,
        'Member Name': m.fullName,
        Phone: m.phone,
        'Join Date': m.joinDate.toLocaleDateString(),
        Status: m.status
      }));
    }

    case 'active-members': {
      const members = await prisma.member.findMany({
        where: { status: MEMBER_STATUS.ACTIVE },
        orderBy: { fullName: 'asc' }
      });
      return members.map(m => ({
        id: m.id,
        'Member Name': m.fullName,
        Phone: m.phone,
        'Join Date': m.joinDate.toLocaleDateString(),
        Status: m.status
      }));
    }

    case 'outstanding-payments': {
      const currentTerms = await prisma.memberSubscription.findMany({
        where: { isCurrent: true },
        include: {
          member: { select: { fullName: true, phone: true } },
          subscription: { select: { price: true, name: true } },
          payments: { select: { amount: true } }
        }
      });

      const outstanding = [];
      for (const term of currentTerms) {
        const planPrice = Number(term.subscription?.price || 0);
        const totalPaid = term.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        if (planPrice > totalPaid) {
          outstanding.push({
            id: term.id,
            'Member Name': term.member?.fullName || 'Unknown',
            Phone: term.member?.phone || 'Unknown',
            Subscription: term.subscription?.name || 'Unknown',
            'Plan Price': planPrice,
            'Total Paid': totalPaid,
            Balance: planPrice - totalPaid
          });
        }
      }
      return outstanding;
    }

    default:
      throw new Error('Invalid report type');
  }
}

/**
 * GET /api/reports/preview
 */
router.get('/preview', async (req, res, next) => {
  try {
    const { type, startDate, endDate } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Report type is required' });
    }

    const data = await getReportData(type, startDate, endDate);
    res.json(data);
  } catch (error) {
    if (error.message === 'Invalid report type') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/reports/export
 */
router.get('/export', async (req, res, next) => {
  try {
    const { type, startDate, endDate, format } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Report type is required' });
    }
    if (format !== 'csv' && format !== 'xlsx') {
      return res.status(400).json({ error: 'Invalid format. Use csv or xlsx' });
    }

    const data = await getReportData(type, startDate, endDate);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    if (data.length > 0) {
      // Exclude 'id' column from export
      const columns = Object.keys(data[0]).filter(k => k !== 'id');
      worksheet.columns = columns.map(header => ({
        header,
        key: header,
        width: 20
      }));

      data.forEach(row => {
        worksheet.addRow(row);
      });
      
      // Style the header row
      worksheet.getRow(1).font = { bold: true };
    } else {
      worksheet.addRow(['No data available']);
    }

    const filename = `report-${type}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      await workbook.csv.write(res);
      res.end();
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    if (error.message === 'Invalid report type') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;
