const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');

// Connect database
prisma.$connect()
  .then(() => console.log('✅ Database connected in Serverless Function'))
  .catch(err => console.error('❌ Failed to connect database in Serverless:', err));

const app = createApp();

module.exports = app;
