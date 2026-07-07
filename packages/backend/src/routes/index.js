const express = require('express');
const router = express.Router();

const healthRoutes = require('./health');
const authRoutes = require('./auth');
const usersRoutes = require('./users');
const subscriptionsRoutes = require('./subscriptions');
const newCustomersRoutes = require('./newCustomers');
const membersRoutes = require('./members');
const attendanceRulesRoutes = require('./attendanceRules');
const attendanceRoutes = require('./attendance');
const publicRoutes = require('./public');
const checkinRoutes = require('./checkin');
const paymentsRoutes = require('./payments');
const expensesRoutes = require('./expenses');
const dashboardRoutes = require('./dashboard');
const reportsRoutes = require('./reports');
const activityLogRoutes = require('./activityLog');
const settingsRoutes = require('./settings');
const backupsRoutes = require('./backups');

// Mount route modules
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/new-customers', newCustomersRoutes);
router.use('/members', membersRoutes);
router.use('/attendance-rules', attendanceRulesRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/public', publicRoutes);
router.use('/public/checkin', checkinRoutes);
router.use('/payments', paymentsRoutes);
router.use('/expenses', expensesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/activity-log', activityLogRoutes);
router.use('/settings', settingsRoutes);
router.use('/backups', backupsRoutes);

module.exports = router;
