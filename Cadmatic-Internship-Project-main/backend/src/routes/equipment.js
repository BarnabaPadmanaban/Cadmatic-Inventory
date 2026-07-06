const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/equipmentController');
const maintCtrl = require('../controllers/maintenanceController');
const { authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createEquipmentSchema, updateEquipmentSchema, idParamSchema } = require('../validators/equipmentValidators');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `import_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only Excel files allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Read access — Admin & Viewer
router.get('/', ctrl.getAllEquipment);
router.get('/stats/dashboard', ctrl.getDashboardStats);
router.get('/status-lookup', ctrl.getStatusLookup);
router.get('/export', authorize('Admin'), ctrl.exportToExcel);
router.get('/:id', ctrl.getEquipmentById);
router.get('/:id/maintenance', maintCtrl.getEquipmentMaintenance);

// Write access — Admin only
router.post('/', authorize('Admin'), validate(createEquipmentSchema), ctrl.createEquipment);
router.put('/:id', authorize('Admin'), validate(updateEquipmentSchema), ctrl.updateEquipment);
router.delete('/:id', authorize('Admin'), ctrl.deleteEquipment);
router.post('/import/excel', authorize('Admin'), upload.single('file'), ctrl.importFromExcel);
router.post('/:id/maintenance', authorize('Admin'), maintCtrl.addMaintenanceToEquipment);

module.exports = router;
