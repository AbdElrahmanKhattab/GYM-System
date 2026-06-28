const { PrismaClient } = require('@prisma/client');

// Singleton Prisma client instance.
// Prevents multiple client instances in development with hot-reload.
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;
