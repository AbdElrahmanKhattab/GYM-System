const prisma = require('../lib/prisma');

/**
 * Member session authentication middleware for self check-in.
 * Validates the session token from the x-session-token header.
 * Attaches req.memberSession and req.member on success.
 */
async function authenticateMemberSession(req, res, next) {
  try {
    const sessionToken = req.headers['x-session-token'];

    if (!sessionToken) {
      return res.status(401).json({
        error: { message: 'Session token required.', code: 'NO_SESSION' },
      });
    }

    const now = new Date();

    const session = await prisma.memberSession.findUnique({
      where: { sessionToken },
      include: { member: true },
    });

    if (!session) {
      return res.status(401).json({
        error: { message: 'Invalid session.', code: 'INVALID_SESSION' },
      });
    }

    if (session.revokedAt) {
      return res.status(401).json({
        error: { message: 'Session revoked.', code: 'SESSION_REVOKED' },
      });
    }

    if (session.expiresAt && session.expiresAt < now) {
      return res.status(401).json({
        error: { message: 'Session expired.', code: 'SESSION_EXPIRED' },
      });
    }

    if (session.member.deletedAt) {
      return res.status(401).json({
        error: { message: 'Member account not found.', code: 'MEMBER_NOT_FOUND' },
      });
    }

    req.memberSession = session;
    req.member = session.member;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticateMemberSession };
