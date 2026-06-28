const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');
const { USER_ROLE } = require('@gym-system/shared');

const router = express.Router();

// All setting modifications require admin access
router.use(authenticate, authorize(USER_ROLE.ADMIN));

/**
 * GET /api/settings
 * Retrieve the global gym settings.
 */
router.get('/', async (req, res, next) => {
  try {
    let settings = await prisma.setting.findFirst();
    
    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          gymName: 'HERO GYM',
          address: '842 Athletic Ave, New York, NY 10013',
          phoneNumbers: ['+1 (555) 842-HERO'],
          socialLinks: {
            email: 'hello@herogym.club',
            instagram: '',
            facebook: '',
            twitter: ''
          },
          landingPageContent: {
            about: "Founded in 2014, HERO GYM was born from a simple obsession — that fitness should feel like craftsmanship, not consumption. Every detail, from the calibrations of our equipment to the credentials of our coaches, has been refined over a decade.\n\nWe don't sell memberships. We architect transformations. Our members don't just work out — they are mentored, measured, and pushed past what they thought possible."
          },
          theme: 'dark'
        }
      });
    }

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/settings
 * Update the global gym settings.
 */
router.patch('/', async (req, res, next) => {
  try {
    const {
      gymName,
      logoUrl,
      address,
      phoneNumbers,
      socialLinks,
      landingPageContent,
      theme
    } = req.body;

    let settings = await prisma.setting.findFirst();
    if (!settings) {
      settings = await prisma.setting.create({ data: {} });
    }

    const updatedSettings = await prisma.setting.update({
      where: { id: settings.id },
      data: {
        ...(gymName !== undefined && { gymName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(address !== undefined && { address }),
        ...(phoneNumbers !== undefined && { phoneNumbers }),
        ...(socialLinks !== undefined && { socialLinks }),
        ...(landingPageContent !== undefined && { landingPageContent }),
        ...(theme !== undefined && { theme }),
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'settings_updated',
      metadata: { 
        updatedFields: Object.keys(req.body)
      }
    });

    res.json({ settings: updatedSettings });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
