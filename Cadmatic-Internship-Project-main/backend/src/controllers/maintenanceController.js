const { sql, getPool } = require('../config/database');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const devStore = require('../devStore');
const { logActivity } = require('./authController');

const canUseDevFallback = () => process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_FALLBACK !== 'false';

const isConnectionError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('failed to connect') || message.includes('could not connect') ||
    message.includes('login failed') || message.includes('econnrefused') || message.includes('connection');
};

const handleDbError = (res, err, fallback) => {
  if (canUseDevFallback() && isConnectionError(err)) {
    console.warn(`Using development fallback data: ${err.message}`);
    return fallback();
  }
  return res.status(500).json({ success: false, message: err.message || 'Server error' });
};

// GET all maintenance records with filters
exports.getAllMaintenance = async (req, res) => {
  try {
    const pool = await getPool();
    const { equipment_id, vendor, maintenance_type, priority, status, date_from, date_to, search } = req.query;

    let whereClause = 'WHERE e.is_active = 1';
    const request = pool.request();

    if (equipment_id) { whereClause += ' AND m.equipment_id = @equipment_id'; request.input('equipment_id', sql.Int, parseInt(equipment_id)); }
    if (maintenance_type) { whereClause += ' AND m.maintenance_type = @maintenance_type'; request.input('maintenance_type', sql.NVarChar, maintenance_type); }
    if (priority) { whereClause += ' AND m.priority = @priority'; request.input('priority', sql.NVarChar, priority); }
    if (status) { whereClause += ' AND m.status = @status'; request.input('status', sql.NVarChar, status); }
    if (date_from) { whereClause += ' AND m.scheduled_date >= @date_from'; request.input('date_from', sql.Date, date_from); }
    if (date_to) { whereClause += ' AND m.scheduled_date <= @date_to'; request.input('date_to', sql.Date, date_to); }
    if (search) {
      whereClause += ' AND (e.position_id LIKE @search OR m.description LIKE @search OR m.engineer_name LIKE @search OR m.maintenance_type LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    if (vendor) {
      whereClause += ' AND e.sub_po_vendor LIKE @vendor';
      request.input('vendor', sql.NVarChar, `%${vendor}%`);
    }

    const result = await request.query(`
      SELECT m.*, e.position_id, e.sub_po_vendor, e.equipment_type, e.location, e.equipment_status_code
      FROM MaintenanceRecords m
      JOIN Equipment e ON m.equipment_id = e.id
      ${whereClause}
      ORDER BY m.created_at DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    return handleDbError(res, err, () => {
      const records = devStore.getAllMaintenance(req.query);
      res.json({ success: true, data: records });
    });
  }
};

// GET maintenance dashboard stats
exports.getMaintenanceDashboard = async (req, res) => {
  try {
    const pool = await getPool();
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const statsResult = await pool.request()
      .input('today', sql.Date, today)
      .input('in30', sql.Date, in30Days)
      .query(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed,
          COALESCE(SUM(CASE WHEN status IN ('Scheduled','Pending') THEN 1 ELSE 0 END), 0) AS scheduled,
          COALESCE(SUM(CASE WHEN status NOT IN ('Completed','Cancelled') AND scheduled_date < @today THEN 1 ELSE 0 END), 0) AS overdue,
          COALESCE(SUM(CASE WHEN status IN ('Scheduled','Pending') AND scheduled_date BETWEEN @today AND @in30 THEN 1 ELSE 0 END), 0) AS upcoming_30
        FROM MaintenanceRecords m
        JOIN Equipment e ON m.equipment_id = e.id AND e.is_active = 1
      `);

    const typeDistResult = await pool.request().query(`
      SELECT m.maintenance_type, COUNT(*) AS count
      FROM MaintenanceRecords m
      JOIN Equipment e ON m.equipment_id = e.id AND e.is_active = 1
      GROUP BY m.maintenance_type
    `);

    const monthlyResult = await pool.request().query(`
      SELECT FORMAT(m.maintenance_date, 'yyyy-MM') AS month, COUNT(*) AS count
      FROM MaintenanceRecords m
      JOIN Equipment e ON m.equipment_id = e.id AND e.is_active = 1
      WHERE m.maintenance_date >= DATEADD(month, -6, GETDATE())
      GROUP BY FORMAT(m.maintenance_date, 'yyyy-MM')
      ORDER BY month ASC
    `);

    const overdueResult = await pool.request()
      .input('today2', sql.Date, today)
      .query(`
        SELECT m.*, e.position_id, e.equipment_type, e.location
        FROM MaintenanceRecords m
        JOIN Equipment e ON m.equipment_id = e.id AND e.is_active = 1
        WHERE m.status NOT IN ('Completed','Cancelled') AND m.scheduled_date < @today2
        ORDER BY m.scheduled_date ASC
      `);

    const dueSoonResult = await pool.request()
      .input('today3', sql.Date, today)
      .input('in7', sql.Date, in7Days)
      .query(`
        SELECT m.*, e.position_id, e.equipment_type, e.location
        FROM MaintenanceRecords m
        JOIN Equipment e ON m.equipment_id = e.id AND e.is_active = 1
        WHERE m.status IN ('Scheduled','Pending') AND m.scheduled_date BETWEEN @today3 AND @in7
        ORDER BY m.scheduled_date ASC
      `);

    res.json({
      success: true,
      data: {
        stats: statsResult.recordset[0],
        typeDistribution: typeDistResult.recordset,
        monthlyTrend: monthlyResult.recordset,
        overdueList: overdueResult.recordset,
        dueSoonList: dueSoonResult.recordset,
      }
    });
  } catch (err) {
    return handleDbError(res, err, () => {
      res.json({ success: true, data: devStore.getMaintenanceDashboard() });
    });
  }
};

// GET maintenance by equipment ID (with health score)
exports.getEquipmentMaintenance = async (req, res) => {
  try {
    const pool = await getPool();
    const today = new Date().toISOString().split('T')[0];

    const records = await pool.request()
      .input('eid', sql.Int, req.params.id)
      .query('SELECT * FROM MaintenanceRecords WHERE equipment_id = @eid ORDER BY created_at DESC');

    const equipment = await pool.request()
      .input('eid2', sql.Int, req.params.id)
      .query('SELECT * FROM Equipment WHERE id = @eid2 AND is_active = 1');

    if (!equipment.recordset.length) return res.status(404).json({ success: false, message: 'Equipment not found' });

    const eq = equipment.recordset[0];
    const maint = records.recordset;
    const health = computeHealthScore(eq, maint, today);

    res.json({ success: true, data: { records: maint, health } });
  } catch (err) {
    return handleDbError(res, err, () => {
      const data = devStore.getEquipmentMaintenance(req.params.id);
      res.json({ success: true, data });
    });
  }
};

// POST create maintenance record
exports.createMaintenance = async (req, res) => {
  try {
    const pool = await getPool();
    const d = req.body;

    const result = await pool.request()
      .input('equipment_id', sql.Int, d.equipment_id)
      .input('maintenance_type', sql.NVarChar, d.maintenance_type)
      .input('priority', sql.NVarChar, d.priority || 'Medium')
      .input('description', sql.NVarChar, d.description || null)
      .input('engineer_name', sql.NVarChar, d.engineer_name || d.performed_by || null)
      .input('performed_by', sql.NVarChar, d.performed_by || d.engineer_name || null)
      .input('scheduled_date', sql.Date, d.scheduled_date || null)
      .input('completion_date', sql.Date, d.completion_date || null)
      .input('next_maintenance_date', sql.Date, d.next_maintenance_date || null)
      .input('status', sql.NVarChar, d.status || 'Scheduled')
      .input('remarks', sql.NVarChar, d.remarks || null)
      .query(`
        INSERT INTO MaintenanceRecords
          (equipment_id, maintenance_type, priority, description, engineer_name, performed_by,
           scheduled_date, completion_date, next_maintenance_date, status, remarks)
        OUTPUT INSERTED.id
        VALUES
          (@equipment_id, @maintenance_type, @priority, @description, @engineer_name, @performed_by,
           @scheduled_date, @completion_date, @next_maintenance_date, @status, @remarks)
      `);

    res.status(201).json({ success: true, message: 'Maintenance record created', id: result.recordset[0].id });
    logActivity(req, { action: 'Maintenance Created', entity_type: 'MaintenanceRecord', entity_id: result.recordset[0].id, details: `Created ${d.maintenance_type} record for equipment #${d.equipment_id}` });
  } catch (err) {
    return handleDbError(res, err, () => {
      const d = req.body;
      const id = devStore.createMaintenanceRecord(req.body);
      res.status(201).json({ success: true, message: 'Maintenance record created', id });
      logActivity(req, { action: 'Maintenance Created', entity_type: 'MaintenanceRecord', entity_id: id, details: `Created ${d.maintenance_type} record for equipment #${d.equipment_id}` });
    });
  }
};

// POST create maintenance for specific equipment (legacy compat)
exports.addMaintenanceToEquipment = async (req, res) => {
  req.body.equipment_id = req.params.id;
  return exports.createMaintenance(req, res);
};

// PUT update maintenance record
exports.updateMaintenance = async (req, res) => {
  try {
    const pool = await getPool();
    const d = req.body;

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('maintenance_type', sql.NVarChar, d.maintenance_type)
      .input('priority', sql.NVarChar, d.priority || 'Medium')
      .input('description', sql.NVarChar, d.description || null)
      .input('engineer_name', sql.NVarChar, d.engineer_name || null)
      .input('performed_by', sql.NVarChar, d.performed_by || null)
      .input('scheduled_date', sql.Date, d.scheduled_date || null)
      .input('completion_date', sql.Date, d.completion_date || null)
      .input('next_maintenance_date', sql.Date, d.next_maintenance_date || null)
      .input('status', sql.NVarChar, d.status || 'Scheduled')
      .input('remarks', sql.NVarChar, d.remarks || null)
      .query(`
        UPDATE MaintenanceRecords SET
          maintenance_type = @maintenance_type, priority = @priority, description = @description,
          engineer_name = @engineer_name, performed_by = @performed_by,
          scheduled_date = @scheduled_date, completion_date = @completion_date,
          next_maintenance_date = @next_maintenance_date, status = @status, remarks = @remarks
        WHERE id = @id
      `);

    res.json({ success: true, message: 'Maintenance record updated' });
    logActivity(req, { action: 'Maintenance Updated', entity_type: 'MaintenanceRecord', entity_id: req.params.id, details: `Updated maintenance record #${req.params.id}` });
  } catch (err) {
    return handleDbError(res, err, () => {
      devStore.updateMaintenanceRecord(req.params.id, req.body);
      res.json({ success: true, message: 'Maintenance record updated' });
      logActivity(req, { action: 'Maintenance Updated', entity_type: 'MaintenanceRecord', entity_id: req.params.id, details: `Updated maintenance record #${req.params.id}` });
    });
  }
};

// DELETE maintenance record
exports.deleteMaintenance = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM MaintenanceRecords WHERE id = @id');
    res.json({ success: true, message: 'Maintenance record deleted' });
    logActivity(req, { action: 'Maintenance Deleted', entity_type: 'MaintenanceRecord', entity_id: req.params.id, details: `Deleted maintenance record #${req.params.id}` });
  } catch (err) {
    return handleDbError(res, err, () => {
      devStore.deleteMaintenanceRecord(req.params.id);
      res.json({ success: true, message: 'Maintenance record deleted' });
      logActivity(req, { action: 'Maintenance Deleted', entity_type: 'MaintenanceRecord', entity_id: req.params.id, details: `Deleted maintenance record #${req.params.id}` });
    });
  }
};

const firstCell = (row, names) => {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') return row[name];
  }
  return null;
};

const excelDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

// POST import maintenance records from Excel. Existing matching records are updated.
exports.importMaintenance = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No Excel file uploaded' });

  try {
    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
    const pool = await getPool();
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const positionId = String(firstCell(row, ['Position ID', 'Equipment Tag No', 'Equipment Tag', 'position_id']) || '').trim();
      const maintenanceType = String(firstCell(row, ['Maintenance Type', 'Type', 'maintenance_type']) || '').trim();
      if (!positionId || !maintenanceType) {
        if (Object.values(row).some((value) => value !== null && String(value).trim() !== '')) skipped++;
        continue;
      }

      const equipment = await pool.request()
        .input('position_id', sql.NVarChar, positionId)
        .query('SELECT id FROM Equipment WHERE LOWER(LTRIM(RTRIM(position_id))) = LOWER(@position_id) AND is_active = 1');
      if (!equipment.recordset.length) { skipped++; continue; }

      const data = {
        equipment_id: equipment.recordset[0].id,
        maintenance_type: maintenanceType,
        priority: String(firstCell(row, ['Priority', 'priority']) || 'Medium').trim(),
        description: firstCell(row, ['Description', 'description']),
        engineer_name: firstCell(row, ['Engineer Name', 'Engineer', 'engineer_name']),
        performed_by: firstCell(row, ['Performed By', 'performed_by']),
        scheduled_date: excelDate(firstCell(row, ['Scheduled Date', 'scheduled_date'])),
        completion_date: excelDate(firstCell(row, ['Completion Date', 'completion_date'])),
        next_maintenance_date: excelDate(firstCell(row, ['Next Maintenance Date', 'next_maintenance_date'])),
        status: String(firstCell(row, ['Status', 'status']) || 'Scheduled').trim(),
        remarks: firstCell(row, ['Remarks', 'remarks']),
      };

      const existing = await pool.request()
        .input('equipment_id', sql.Int, data.equipment_id)
        .input('maintenance_type', sql.NVarChar, data.maintenance_type)
        .input('scheduled_date', sql.Date, data.scheduled_date)
        .query(`SELECT TOP 1 id FROM MaintenanceRecords
                WHERE equipment_id = @equipment_id AND maintenance_type = @maintenance_type
                  AND ((scheduled_date = @scheduled_date) OR (scheduled_date IS NULL AND @scheduled_date IS NULL))`);

      const request = pool.request()
        .input('equipment_id', sql.Int, data.equipment_id)
        .input('maintenance_type', sql.NVarChar, data.maintenance_type)
        .input('priority', sql.NVarChar, data.priority)
        .input('description', sql.NVarChar, data.description)
        .input('engineer_name', sql.NVarChar, data.engineer_name)
        .input('performed_by', sql.NVarChar, data.performed_by)
        .input('scheduled_date', sql.Date, data.scheduled_date)
        .input('completion_date', sql.Date, data.completion_date)
        .input('next_maintenance_date', sql.Date, data.next_maintenance_date)
        .input('status', sql.NVarChar, data.status)
        .input('remarks', sql.NVarChar, data.remarks);

      if (existing.recordset.length) {
        await request.input('id', sql.Int, existing.recordset[0].id).query(`UPDATE MaintenanceRecords SET
          priority=@priority, description=@description, engineer_name=@engineer_name, performed_by=@performed_by,
          scheduled_date=@scheduled_date, completion_date=@completion_date,
          next_maintenance_date=@next_maintenance_date, status=@status, remarks=@remarks WHERE id=@id`);
        updated++;
      } else {
        await request.query(`INSERT INTO MaintenanceRecords
          (equipment_id, maintenance_type, priority, description, engineer_name, performed_by,
           scheduled_date, completion_date, next_maintenance_date, status, remarks)
          VALUES (@equipment_id, @maintenance_type, @priority, @description, @engineer_name, @performed_by,
           @scheduled_date, @completion_date, @next_maintenance_date, @status, @remarks)`);
        imported++;
      }
    }

    fs.unlink(req.file.path, () => {});
    res.json({ success: true, message: `Maintenance import complete. ${imported} imported, ${updated} updated, ${skipped} skipped.`, imported, updated, skipped });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ success: false, message: err.message || 'Maintenance import failed' });
  }
};

// GET export maintenance records to Excel.
exports.exportMaintenance = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT
      e.position_id AS [Position ID], m.maintenance_type AS [Maintenance Type], m.priority AS [Priority],
      m.description AS [Description], m.engineer_name AS [Engineer Name], m.performed_by AS [Performed By],
      CONVERT(varchar, m.scheduled_date, 23) AS [Scheduled Date],
      CONVERT(varchar, m.completion_date, 23) AS [Completion Date],
      CONVERT(varchar, m.next_maintenance_date, 23) AS [Next Maintenance Date],
      m.status AS [Status], m.remarks AS [Remarks]
      FROM MaintenanceRecords m JOIN Equipment e ON e.id = m.equipment_id
      ORDER BY m.created_at DESC`);
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(result.recordset);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Maintenance');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="maintenance_records.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    return handleDbError(res, err, () => res.status(503).json({ success: false, message: 'Maintenance export requires the database connection' }));
  }
};

// POST upload maintenance document
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    };

    // If maintenance_id provided, store reference
    if (req.params.maintenance_id && req.params.maintenance_id !== 'undefined') {
      try {
        const pool = await getPool();
        await pool.request()
          .input('mid', sql.Int, parseInt(req.params.maintenance_id))
          .input('filename', sql.NVarChar, req.file.filename)
          .input('originalname', sql.NVarChar, req.file.originalname)
          .input('doc_type', sql.NVarChar, req.body.doc_type || 'Other')
          .query(`
            INSERT INTO MaintenanceDocuments (maintenance_id, filename, original_name, doc_type)
            VALUES (@mid, @filename, @originalname, @doc_type)
          `);
      } catch (dbErr) {
        // DB might not have this table yet - just return file info
      }
    }

    res.json({ success: true, message: 'File uploaded successfully', file: fileInfo });
    logActivity(req, { action: 'Document Uploaded', entity_type: 'MaintenanceDocument', entity_id: req.params.maintenance_id || null, details: `Uploaded "${req.file.originalname}" (${req.body.doc_type || 'Other'})` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper: compute health score from equipment + maintenance data
function computeHealthScore(equipment, maintenanceRecords, today) {
  let score = 100;

  const todayDate = new Date(today);
  const overdueCount = maintenanceRecords.filter(m =>
    !['Completed', 'Cancelled'].includes(m.status) &&
    m.scheduled_date && new Date(m.scheduled_date) < todayDate
  ).length;

  // Deduct for overdue
  score -= overdueCount * 15;

  // Deduct for last maintenance date being old
  const completed = maintenanceRecords.filter(m => m.status === 'Completed');
  if (completed.length === 0) {
    score -= 20;
  } else {
    const lastDate = new Date(Math.max(...completed.map(m => new Date(m.maintenance_date || m.completion_date || m.created_at))));
    const daysSince = (todayDate - lastDate) / 86400000;
    if (daysSince > 365) score -= 25;
    else if (daysSince > 180) score -= 15;
    else if (daysSince > 90) score -= 5;
  }

  // Deduct for critical/high priority overdue
  const criticalOverdue = maintenanceRecords.filter(m =>
    !['Completed', 'Cancelled'].includes(m.status) &&
    ['Critical', 'High'].includes(m.priority) &&
    m.scheduled_date && new Date(m.scheduled_date) < todayDate
  ).length;
  score -= criticalOverdue * 10;

  // Equipment status bonus
  if ([7, 8].includes(equipment.equipment_status_code)) score = Math.min(score + 5, 100);

  score = Math.max(0, Math.min(100, score));

  let level, color;
  if (score >= 85) { level = 'Excellent'; color = '#17833b'; }
  else if (score >= 70) { level = 'Good'; color = '#5f8f00'; }
  else if (score >= 50) { level = 'Warning'; color = '#c77700'; }
  else { level = 'Critical'; color = '#d93025'; }

  return { score, level, color, overdueCount, totalRecords: maintenanceRecords.length };
}
