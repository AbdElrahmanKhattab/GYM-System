const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const backupService = require('../services/backupService');
const fs = require('fs');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('@gym-system/shared');

// Require admin access for all backup routes
router.use(authenticate, authorize(USER_ROLE.ADMIN));

// GET /api/backups
// Fetch list of all backups (returns empty since serverless environment stores backups locally)
router.get('/', async (req, res) => {
  res.json([]);
});

// POST /api/backups/manual
// Trigger manual backup and stream down to browser in-memory
router.post('/manual', async (req, res) => {
  try {
    // 1. Fetch all data directly
    const data = {
      users: await prisma.user.findMany(),
      subscriptions: await prisma.subscription.findMany(),
      settings: await prisma.setting.findMany(),
      attendanceRules: await prisma.attendanceRule.findMany(),
      members: await prisma.member.findMany(),
      newCustomers: await prisma.newCustomer.findMany(),
      memberSubscriptions: await prisma.memberSubscription.findMany(),
      attendanceRecords: await prisma.attendanceRecord.findMany(),
      freezes: await prisma.freeze.findMany(),
      payments: await prisma.payment.findMany(),
      expenses: await prisma.expense.findMany(),
      activityLogs: await prisma.activityLog.findMany(),
    };

    // Custom JSON replacer to handle BigInt
    const jsonReplacer = (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };

    const jsonString = JSON.stringify(data, jsonReplacer, 2);
    
    // Create a timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(jsonString);
  } catch (err) {
    console.error('Manual backup failed:', err);
    res.status(500).json({ error: err.message || 'Manual backup failed' });
  }
});

const multer = require('multer');
const upload = multer({ dest: '/tmp/' });

// POST /api/backups/:id/restore
// Restore from a backup (Disabled or legacy, since Vercel is read-only)
router.post('/:id/restore', async (req, res) => {
  res.status(400).json({ error: 'Direct server restores are disabled in serverless mode. Please use Import Backup instead.' });
});

// POST /api/backups/import
// Import a backup file (.json or .sql)
router.post('/import', upload.single('backupFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const result = await backupService.importBackup(req.file.path, req.file.originalname);
    
    // Clean up temp file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    res.json(result);
  } catch (err) {
    console.error('Import failed:', err);
    
    // Clean up temp file
    fs.unlink(req.file.path, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete temp file:', unlinkErr);
    });

    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

module.exports = router;
