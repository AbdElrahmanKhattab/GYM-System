const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // 1. Create default admin user
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'admin' },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists — skipping.');
  } else {
    const passwordHash = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.create({
      data: {
        fullName: 'System Admin',
        email: 'admin@gym.com',
        passwordHash,
        role: 'admin',
        isActive: true,
      },
    });
    console.log(`✅ Admin user created: ${admin.email} (password: admin123)`);
  }

  // 2. Create singleton attendance rules row
  const existingRules = await prisma.attendanceRule.findFirst();

  if (existingRules) {
    console.log('✅ Attendance rules already exist — skipping.');
  } else {
    await prisma.attendanceRule.create({
      data: {
        blockExpiredMemberships: true,
        blockZeroRemainingSessions: true,
        warnOnUnpaidBalance: true,
        autoCompleteOnZeroSessions: true,
        expiringSoonWindowDays: 7,
      },
    });
    console.log('✅ Attendance rules created with defaults.');
  }

  // 3. Create singleton settings row
  const existingSettings = await prisma.setting.findFirst();

  if (existingSettings) {
    console.log('✅ Settings already exist — skipping.');
  } else {
    await prisma.setting.create({
      data: {
        gymName: 'My Gym',
        phoneNumbers: [],
        socialLinks: {
          facebook: '',
          instagram: '',
          whatsapp: '',
        },
        landingPageContent: {
          about: {
            title: 'Why Choose Us',
            items: [
              'Professional Trainers',
              'Modern Equipment',
              'Flexible Subscriptions',
              'Clean Environment',
              'Nutrition Guidance',
            ],
          },
          faq: [],
          testimonials: [],
          trainers: [],
          gallery: [],
        },
        theme: 'system',
      },
    });
    console.log('✅ Settings created with placeholder gym name.');
  }

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
