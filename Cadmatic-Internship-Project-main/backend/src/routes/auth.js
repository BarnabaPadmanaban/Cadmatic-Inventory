const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginSchema, createUserSchema, updateUserSchema } = require('../validators/authValidators');

// Public
router.post('/login', validate(loginSchema), ctrl.login);

// Authenticated (any logged-in user)
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.getMe);

// Admin only — User Management
router.get('/users', authenticate, authorize('Admin'), ctrl.getAllUsers);
router.post('/users', authenticate, authorize('Admin'), ctrl.createUser);
router.put('/users/:id', authenticate, authorize('Admin'), ctrl.updateUser);
router.patch('/users/:id/status', authenticate, authorize('Admin'), ctrl.setUserStatus);
router.delete('/users/:id', authenticate, authorize('Admin'), ctrl.deleteUser);
router.patch('/users/:id/status', authenticate, authorize('Admin'), ctrl.setUserStatus);
router.delete('/users/:id', authenticate, authorize('Admin'), ctrl.deleteUser);

// Admin only — Activity Logs
router.get('/activity-logs', authenticate, authorize('Admin'), ctrl.getActivityLogs);

module.exports = router;
