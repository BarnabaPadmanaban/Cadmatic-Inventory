const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fieldConfigController');
const { authorize } = require('../middleware/auth');

// Read access — Admin & Viewer (the equipment form needs this to know which fields are mandatory)
router.get('/', ctrl.getFields);

// Write access — Admin only
router.post('/', authorize('Admin'), ctrl.createField);
router.put('/:key', authorize('Admin'), ctrl.updateField);
router.delete('/:key', authorize('Admin'), ctrl.deleteField);

module.exports = router;
