const express = require('express');
const prisma = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

/**
 * GET /api/public/settings
 * Exposes global gym settings (name, contact info, theme) for the landing page.
 */
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await prisma.setting.findFirst({
      select: {
        gymName: true,
        logoUrl: true,
        address: true,
        phoneNumbers: true,
        socialLinks: true,
        landingPageContent: true,
        theme: true,
      }
    });

    if (!settings) {
      settings = {
        gymName: 'HERO GYM',
        address: '842 Athletic Ave, New York, NY 10013',
        phoneNumbers: ['+1 (555) 842-HERO'],
        socialLinks: {
          email: 'hello@herogym.club',
        },
        landingPageContent: {
          about: "Founded in 2014, HERO GYM was born from a simple obsession — that fitness should feel like craftsmanship, not consumption. Every detail, from the calibrations of our equipment to the credentials of our coaches, has been refined over a decade.\n\nWe don't sell memberships. We architect transformations. Our members don't just work out — they are mentored, measured, and pushed past what they thought possible."
        },
        theme: 'dark'
      };
    }

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public/subscriptions
 * Returns only active subscriptions, ordered by displayOrder.
 * Specifically designed for the landing page to consume.
 * No authentication required.
 */
router.get('/subscriptions', async (req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationType: true,
        durationValue: true,
        freezeAllowed: true,
        displayOrder: true,
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/public/register
 * Public endpoint for the landing page registration form.
 */
router.post('/register', async (req, res, next) => {
  try {
    const {
      fullName,
      phone,
      age,
      gender,
      fitnessGoal,
      heightCm,
      weightKg,
      preferredSubscriptionId,
      notes
    } = req.body;

    // Basic required field validation
    if (!fullName || !phone || !age || !gender || !fitnessGoal) {
      return res.status(400).json({
        error: { message: 'Full name, phone, age, gender, and fitness goal are required.', code: 'VALIDATION_ERROR' },
      });
    }

    // Validate gender enum
    if (!['male', 'female', 'other'].includes(gender)) {
      return res.status(400).json({
        error: { message: 'Gender must be male, female, or other.', code: 'VALIDATION_ERROR' },
      });
    }

    // Very basic phone validation (numbers and maybe + sign)
    const phoneRegex = /^[+]?[\d\s-]{8,20}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        error: { message: 'Invalid phone number format.', code: 'VALIDATION_ERROR' },
      });
    }

    const customer = await prisma.newCustomer.create({
      data: {
        fullName: fullName.trim(),
        phone: phone.replace(/[\s-]/g, ''), // clean phone format
        age: parseInt(age, 10),
        gender,
        fitnessGoal: fitnessGoal.trim(),
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        preferredSubscriptionId: preferredSubscriptionId || null,
        notes: notes?.trim() || null,
        status: 'pending' // default status
      }
    });

    await logActivity({
      userId: null,
      action: 'public_registration_submitted',
      entityType: 'new_customer',
      entityId: customer.id,
      metadata: { fullName: customer.fullName, phone: customer.phone }
    });

    res.status(201).json({ 
      message: 'Registration submitted successfully. Awaiting approval.',
      customerId: customer.id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
