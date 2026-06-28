const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

/**
 * GET /api/users
 * List all staff users. Admin only.
 */
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * Create a new staff user (admin or receptionist). Admin only.
 */
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        error: { message: 'Full name, email, password, and role are required', code: 'VALIDATION_ERROR' },
      });
    }

    // Validate role
    if (!['admin', 'receptionist'].includes(role)) {
      return res.status(400).json({
        error: { message: 'Role must be either "admin" or "receptionist"', code: 'VALIDATION_ERROR' },
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: { message: 'Password must be at least 6 characters', code: 'VALIDATION_ERROR' },
      });
    }

    // Check for existing email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({
        error: { message: 'A user with this email already exists', code: 'DUPLICATE_EMAIL' },
      });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Log the action
    await logActivity({
      userId: req.user.id,
      action: 'user_created',
      entityType: 'user',
      entityId: user.id,
      metadata: { role: user.role, email: user.email },
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/users/:id
 * Update a staff user (name, email, role, active status). Admin only.
 * Password update is handled separately.
 */
router.patch('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, isActive, password } = req.body;

    // Build update data dynamically (only include provided fields)
    const updateData = {};

    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (email !== undefined) {
      // Check for email uniqueness
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase().trim(), id: { not: id } },
      });
      if (existing) {
        return res.status(409).json({
          error: { message: 'A user with this email already exists', code: 'DUPLICATE_EMAIL' },
        });
      }
      updateData.email = email.toLowerCase().trim();
    }
    if (role !== undefined) {
      if (!['admin', 'receptionist'].includes(role)) {
        return res.status(400).json({
          error: { message: 'Role must be either "admin" or "receptionist"', code: 'VALIDATION_ERROR' },
        });
      }
      updateData.role = role;
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({
          error: { message: 'Password must be at least 6 characters', code: 'VALIDATION_ERROR' },
        });
      }
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: { message: 'No fields to update', code: 'VALIDATION_ERROR' },
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: req.user.id,
      action: 'user_updated',
      entityType: 'user',
      entityId: user.id,
      metadata: { updatedFields: Object.keys(updateData) },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
