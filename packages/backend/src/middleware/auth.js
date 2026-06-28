const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

/**
 * JWT authentication middleware.
 * Extracts token from Authorization header (Bearer) or cookie,
 * verifies it, loads the user, and attaches to req.user.
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fallback to cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        error: { message: 'Authentication required', code: 'NO_TOKEN' },
      });
    }

    // Verify JWT
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
      return res.status(401).json({
        error: { message, code: 'INVALID_TOKEN' },
      });
    }

    // Load user from DB (ensures account still exists and is active)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: { message: 'User not found', code: 'USER_NOT_FOUND' },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: { message: 'Account is deactivated', code: 'ACCOUNT_DEACTIVATED' },
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-based authorization middleware factory.
 * Must be used AFTER authenticate middleware.
 *
 * @param  {...string} allowedRoles - Roles that can access the route (e.g., 'admin', 'receptionist')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { message: 'Authentication required', code: 'NO_USER' },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: { message: 'Insufficient permissions', code: 'FORBIDDEN' },
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
