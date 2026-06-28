const crypto = require('crypto');
const prisma = require('./prisma');
const { MANUAL_CODE_CHARSET, MANUAL_CODE_LENGTH } = require('@gym-system/shared');

/**
 * Generates a cryptographically secure QR token.
 * 32 bytes → 64-character hex string.
 * Collision-checked against the database before returning.
 */
async function generateQrToken() {
  const MAX_ATTEMPTS = 10;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const token = crypto.randomBytes(32).toString('hex');

    const existing = await prisma.member.findUnique({
      where: { qrToken: token },
      select: { id: true },
    });

    if (!existing) return token;
  }

  throw new Error('Failed to generate a unique QR token after maximum attempts.');
}

/**
 * Generates a human-readable manual attendance code.
 * Uses the approved charset (no 0/O/1/I/L) at length 6.
 * Collision-checked against the database before returning.
 */
async function generateManualCode() {
  const MAX_ATTEMPTS = 10;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    let code = '';
    const randomBytes = crypto.randomBytes(MANUAL_CODE_LENGTH);

    for (let j = 0; j < MANUAL_CODE_LENGTH; j++) {
      code += MANUAL_CODE_CHARSET[randomBytes[j] % MANUAL_CODE_CHARSET.length];
    }

    const existing = await prisma.member.findUnique({
      where: { manualCode: code },
      select: { id: true },
    });

    if (!existing) return code;
  }

  throw new Error('Failed to generate a unique manual code after maximum attempts.');
}

module.exports = { generateQrToken, generateManualCode };
