const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

/**
 * GET /api/health
 * Health check endpoint — verifies the server is running and can reach the database.
 */
router.get('/health', async (req, res, next) => {
  try {
    // Quick DB connectivity check
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
