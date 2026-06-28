require('dotenv').config();

const createApp = require('./app');
const prisma = require('./lib/prisma');
const backupService = require('./services/backupService');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Initialize scheduled tasks
    backupService.schedulePeriodicBackup();

    const app = createApp();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received — shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received — shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

start();
