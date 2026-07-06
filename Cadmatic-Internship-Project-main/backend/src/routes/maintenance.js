const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/maintenanceController');
const { authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createMaintenanceSchema, updateMaintenanceSchema, uploadDocumentSchema } = require('../validators/maintenanceValidators');

// Multer for document uploads
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/maintenance');
    const fs = require('fs');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `maint_${Date.now()}${ext}`);
  }
});

const uploadDoc = multer({
  storage: docStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.docx', '.doc'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

const uploadExcel = multer({
  dest: path.join(__dirname, '../../uploads'),
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only Excel files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Read access — Admin & Viewer
router.get('/dashboard', ctrl.getMaintenanceDashboard);
router.get('/export', ctrl.exportMaintenance);
router.get('/', ctrl.getAllMaintenance);

// Write access — Admin only
router.post('/', authorize('Admin'), ctrl.createMaintenance);
router.post('/import', authorize('Admin'), uploadExcel.single('file'), ctrl.importMaintenance);
router.put('/:id', authorize('Admin'), ctrl.updateMaintenance);
router.delete('/:id', authorize('Admin'), ctrl.deleteMaintenance);
router.post('/:maintenance_id/documents', authorize('Admin'), uploadDoc.single('file'), ctrl.uploadDocument);
router.post('/documents/upload', authorize('Admin'), uploadDoc.single('file'), ctrl.uploadDocument);

module.exports = router;
