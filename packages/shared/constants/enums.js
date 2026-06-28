/**
 * Shared enum constants for the Gym Management System.
 * Single source of truth — imported by backend, dashboard, and landing.
 * Values must match the Prisma schema enum definitions exactly.
 */

const USER_ROLE = Object.freeze({
  ADMIN: 'admin',
  RECEPTIONIST: 'receptionist',
});

const GENDER = Object.freeze({
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
});

const NEW_CUSTOMER_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const MEMBER_STATUS = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  FROZEN: 'frozen',
  EXPIRED: 'expired',
  COMPLETED: 'completed',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
});

const DURATION_TYPE = Object.freeze({
  MONTHS: 'months',
  DAYS: 'days',
  SESSIONS: 'sessions',
});

const PAYMENT_METHOD = Object.freeze({
  CASH: 'cash',
  VISA: 'visa',
  INSTAPAY: 'instapay',
  VODAFONE_CASH: 'vodafone_cash',
});

const ENTRY_METHOD = Object.freeze({
  QR: 'qr',
  MANUAL_CODE: 'manual_code',
  SEARCH_NAME: 'search_name',
  SEARCH_PHONE: 'search_phone',
});

const BACKUP_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
});

const BACKUP_TRIGGER = Object.freeze({
  SCHEDULED: 'scheduled',
  MANUAL: 'manual',
});

const THEME = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
});

// Manual attendance code generation config
// Charset excludes ambiguous characters: 0/O, 1/I/L
const MANUAL_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MANUAL_CODE_LENGTH = 6;

module.exports = {
  USER_ROLE,
  GENDER,
  NEW_CUSTOMER_STATUS,
  MEMBER_STATUS,
  DURATION_TYPE,
  PAYMENT_METHOD,
  ENTRY_METHOD,
  BACKUP_STATUS,
  BACKUP_TRIGGER,
  THEME,
  MANUAL_CODE_CHARSET,
  MANUAL_CODE_LENGTH,
};
