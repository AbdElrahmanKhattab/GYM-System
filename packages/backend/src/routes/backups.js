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
// Fetch list of all backups
router.get('/', async (req, res) => {
  try {
    const backups = await prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    // Convert BigInt to string for JSON serialization
    const serializedBackups = backups.map(b => ({
      ...b,
      sizeBytes: b.sizeBytes ? b.sizeBytes.toString() : null
    }));

    res.json(serializedBackups);
  } catch (err) {
    console.error('Failed to fetch backups:', err);
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
});

// POST /api/backups/manual
// Trigger manual backup and stream down to browser
router.post('/manual', async (req, res) => {
  try {
    const backupRecord = await backupService.createBackup('manual');
    
    // Check if client wants a direct download
    // E.g. via a query parameter ?download=true
    if (req.query.download === 'true') {
      const filePath = backupRecord.filePath;
      const filename = path.basename(filePath);
      
      // Ensure file exists before downloading
      if (fs.existsSync(filePath)) {
        return res.download(filePath, filename, (err) => {
          if (err) {
            console.error('Error downloading backup file:', err);
            // Headers might have been sent already
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to download backup file' });
            }
          }
        });
      } else {
        return res.status(404).json({ error: 'Backup file not found on server' });
      }
    }
    
    // Normal JSON response
    res.status(201).json({
      ...backupRecord,
      sizeBytes: backupRecord.sizeBytes ? backupRecord.sizeBytes.toString() : null
    });
  } catch (err) {
    console.error('Manual backup failed:', err);
    res.status(500).json({ error: err.message || 'Manual backup failed' });
  }
});

const multer = require('multer');
const upload = multer({ dest: 'uploads/temp/' });

// POST /api/backups/:id/restore
// Restore from a backup
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    await backupService.restoreBackup(id);
    res.json({ message: 'Database successfully restored from backup.' });
  } catch (err) {
    console.error('Restore failed:', err);
    res.status(500).json({ error: err.message || 'Restore failed' });
  }
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
