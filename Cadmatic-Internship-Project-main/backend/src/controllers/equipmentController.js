const { sql, getPool } = require('../config/database');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const devStore = require('../devStore');
const { logActivity } = require('./authController');

const canUseDevFallback = () => process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_FALLBACK !== 'false';

const isConnectionError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('failed to connect') ||
    message.includes('could not connect') ||
    message.includes('login failed') ||
    message.includes('econnrefused') ||
    message.includes('connection');
};

const handleDbError = (res, err, fallback) => {
  if (canUseDevFallback() && isConnectionError(err)) {
    console.warn(`Using development fallback data: ${err.message}`);
    return fallback();
  }
  return res.status(500).json({ success: false, message: err.message || 'Server error' });
};

const removeUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

const firstValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
};

const excelDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const hasEquipmentDataWithoutPosition = (row) => Object.entries(row).some(([key, value]) => {
  if (value === undefined || value === null || String(value).trim() === '') return false;
  const normalizedKey = String(key).trim().toLowerCase();
  return normalizedKey !== 'equipment status' && normalizedKey !== 'equip status';
});

const statusCodeFor = (value) => {
  const numeric = Number(String(value || '').trim());
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 8) return numeric;

  const statusMap = {
    'order not yet placed': 0,
    'order not yer placed': 0,
    open: 0,
    'order placed': 1,
    'order placed yes': 1,
    'in progress': 1,
    'shipping release issued': 2,
    'received at site': 3,
    'erected at location': 4,
    'erected at location.': 4,
    'hydro tested': 5,
    'ccc/std released': 6,
    'ccc/std released.': 6,
    'handover to o&m': 7,
    commissioned: 8,
    commisioned: 8,
    closed: 8,
  };
  return statusMap[String(value || '').trim().toLowerCase()] ?? 0;
};

const equipmentDataFromImportRow = (row) => {
  const equipStatus = firstValue(row, ['Equip Status', 'Equipment Status', 'equip_status']);
  const statusSource = firstValue(row, [
    'Equipment Status Code',
    'Status Code',
    'equipment_status_code',
    'Equipment Status',
    'Status',
    'Equip Status',
    'equip_status',
  ]);

  return {
    storage_number: firstValue(row, ['Storage Number', 'storage_number']),
    epc_po_number: firstValue(row, ['EPC Purchase Order Number', 'EPC PO Number', 'epc_po_number']),
    sub_po_number: firstValue(row, ['Sub Purchase Order Number', 'Sub PO Number', 'sub_po_number']),
    sub_po_vendor: firstValue(row, ['Sub PO Vendor Name', 'Vendor', 'sub_po_vendor']),
    equipment_status_code: statusCodeFor(statusSource),
    npcil_spec_number: firstValue(row, ['NPCIL Spec Number', 'NPCIL Spec', 'npcil_spec_number']),
    npcil_spec_status: firstValue(row, ['NPCIL Spec Status', 'Spec Status', 'npcil_spec_status']),
    drawing_number: firstValue(row, ['Drawing Number', 'Drawing No', 'drawing_number']),
    drawing_status: firstValue(row, ['Drawing Status', 'drawing_status']),
    data_sheet_number: firstValue(row, ['Data Sheet Number', 'Data Sheet', 'data_sheet_number']),
    data_sheet_status: firstValue(row, ['Data Sheet Status', 'data_sheet_status']),
    as_built_drawing_number: firstValue(row, ['As - Built Drawing Number', 'As Built Drawing Number', 'as_built_drawing_number']),
    epc_package_name: firstValue(row, ['EPC Package Name', 'Package', 'epc_package_name']),
    equip_status: equipStatus,
    location: firstValue(row, ['Location', 'location']),
    equipment_type: firstValue(row, ['Equipment Type', 'Type', 'equipment_type']),
    last_inspection_date: excelDate(firstValue(row, ['Last Inspection', 'Last Inspection Date', 'last_inspection_date'])),
    next_inspection_date: excelDate(firstValue(row, ['Next Inspection', 'Next Inspection Date', 'next_inspection_date'])),
  };
};

const parseEquipmentImportRows = (rows) => {
  const rowMap = new Map();
  let skipped = 0;

  for (const row of rows) {
    const posId = firstValue(row, ['nam Position Id', 'Position ID', 'Position Id', 'position_id']);
    const positionId = String(posId || '').trim();
    if (!positionId || positionId === 'NaN') {
      if (hasEquipmentDataWithoutPosition(row)) skipped++;
      continue;
    }

    rowMap.set(positionId.toLowerCase(), {
      position_id: positionId,
      ...equipmentDataFromImportRow(row),
    });
  }

  return { rows: [...rowMap.values()], skipped };
};

const bindEquipmentImportInputs = (request, data) => request
  .input('storage_number', sql.NVarChar, data.storage_number)
  .input('epc_po_number', sql.NVarChar, data.epc_po_number)
  .input('sub_po_number', sql.NVarChar, data.sub_po_number)
  .input('sub_po_vendor', sql.NVarChar, data.sub_po_vendor)
  .input('equipment_status_code', sql.Int, data.equipment_status_code)
  .input('npcil_spec_number', sql.NVarChar, data.npcil_spec_number)
  .input('npcil_spec_status', sql.NVarChar, data.npcil_spec_status)
  .input('drawing_number', sql.NVarChar, data.drawing_number)
  .input('drawing_status', sql.NVarChar, data.drawing_status)
  .input('data_sheet_number', sql.NVarChar, data.data_sheet_number)
  .input('data_sheet_status', sql.NVarChar, data.data_sheet_status)
  .input('as_built_drawing_number', sql.NVarChar, data.as_built_drawing_number)
  .input('epc_package_name', sql.NVarChar, data.epc_package_name)
  .input('equip_status', sql.NVarChar, data.equip_status)
  .input('location', sql.NVarChar, data.location)
  .input('equipment_type', sql.NVarChar, data.equipment_type)
  .input('last_inspection_date', sql.Date, data.last_inspection_date)
  .input('next_inspection_date', sql.Date, data.next_inspection_date);

// ─── Dynamic field-config helpers (admin-managed mandatory fields & custom columns) ───

const getFieldDefsForValidation = async () => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT field_key, label, is_mandatory FROM FieldConfig');
    if (result.recordset.length) return result.recordset.map(r => ({ ...r, is_mandatory: !!r.is_mandatory }));
  } catch (e) { /* fall through to dev fallback config */ }
  return devStore.getFieldConfigs();
};

const validateMandatoryFields = (fieldDefs, body) => {
  return fieldDefs
    .filter((f) => f.is_mandatory && !String(body[f.field_key] ?? '').trim())
    .map((f) => f.label || f.field_key);
};

const getCustomFieldDefs = async (pool) => {
  try {
    const result = await pool.request().query('SELECT field_key, label, field_type FROM FieldConfig WHERE is_custom = 1');
    return result.recordset;
  } catch {
    return [];
  }
};

// Persists any admin-added custom field values onto a row (SQL mode only — the dev
// fallback store already carries custom keys through via object spread).
const applyCustomFieldValues = async (pool, equipmentId, body) => {
  const customFields = await getCustomFieldDefs(pool);
  const present = customFields.filter((f) => body[f.field_key] !== undefined);
  if (!present.length) return;
  const request = pool.request().input('id', sql.Int, equipmentId);
  const setClauses = present.map((f, idx) => {
    const param = `cf_${idx}`;
    request.input(param, sql.NVarChar, body[f.field_key] != null ? String(body[f.field_key]) : null);
    return `[${f.field_key}] = @${param}`;
  });
  await request.query(`UPDATE Equipment SET ${setClauses.join(', ')} WHERE id = @id`);
};

// GET all equipment with filters
exports.getAllEquipment = async (req, res) => {
  try {
    const pool = await getPool();
    const { search, status, package_name, type, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE e.is_active = 1';
    const request = pool.request();

    if (search) {
      whereClause += ' AND (e.position_id LIKE @search OR e.equip_status LIKE @search OR e.location LIKE @search OR e.sub_po_vendor LIKE @search OR e.epc_package_name LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    if (status !== undefined && status !== '') {
      whereClause += ' AND e.equipment_status_code = @status';
      request.input('status', sql.Int, parseInt(status));
    }
    if (package_name) {
      whereClause += ' AND e.epc_package_name = @package_name';
      request.input('package_name', sql.NVarChar, package_name);
    }
    if (type) {
      whereClause += ' AND e.equipment_type = @type';
      request.input('type', sql.NVarChar, type);
    }

    // Count query with same filters
    const countReq = pool.request();
    if (search) countReq.input('search', sql.NVarChar, `%${search}%`);
    if (status !== undefined && status !== '') countReq.input('status', sql.Int, parseInt(status));
    if (package_name) countReq.input('package_name', sql.NVarChar, package_name);
    if (type) countReq.input('type', sql.NVarChar, type);
    const totalResult = await countReq.query(`SELECT COUNT(*) AS total FROM Equipment e ${whereClause}`);
    const total = totalResult.recordset[0].total;

    request.input('limit', sql.Int, parseInt(limit));
    request.input('offset', sql.Int, offset);

    const result = await request.query(`
      SELECT 
        e.id, e.position_id, e.storage_number, e.epc_po_number, e.sub_po_number,
        e.sub_po_vendor, e.equipment_status_code, e.npcil_spec_number, e.npcil_spec_status,
        e.drawing_number, e.drawing_status, e.data_sheet_number, e.data_sheet_status,
        e.as_built_drawing_number, e.epc_package_name, e.equip_status, e.location,
        e.equipment_type, e.last_inspection_date, e.next_inspection_date,
        e.created_at, e.updated_at,
        s.status_name, s.status_color
      FROM Equipment e
      LEFT JOIN StatusLookup s ON e.equipment_status_code = s.status_code
      ${whereClause}
      ORDER BY e.equipment_status_code ASC, e.position_id ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({
      success: true,
      data: result.recordset,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('getAllEquipment error:', err);
    return handleDbError(res, err, () => {
      const result = devStore.getAllEquipment(req.query);
      res.json({ success: true, ...result });
    });
  }
};

// GET single equipment by ID
exports.getEquipmentById = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT e.*, s.status_name, s.status_color, s.description AS status_description
        FROM Equipment e
        LEFT JOIN StatusLookup s ON e.equipment_status_code = s.status_code
        WHERE e.id = @id AND e.is_active = 1
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: 'Equipment not found' });

    const maintenance = await pool.request()
      .input('eid', sql.Int, req.params.id)
      .query('SELECT * FROM MaintenanceRecords WHERE equipment_id = @eid ORDER BY maintenance_date DESC');

    res.json({ success: true, data: { ...result.recordset[0], maintenance_history: maintenance.recordset } });
  } catch (err) {
    return handleDbError(res, err, () => {
      const item = devStore.getEquipmentById(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Equipment not found' });
      res.json({ success: true, data: item });
    });
  }
};

// CREATE equipment
exports.createEquipment = async (req, res) => {
  const d = req.body;

  const fieldDefs = await getFieldDefsForValidation();
  const missing = validateMandatoryFields(fieldDefs, d);
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
  }

  try {
    const pool = await getPool();

    const normalizedPositionId = d.position_id.trim();
    const duplicate = await pool.request()
      .input('position_id', sql.NVarChar, normalizedPositionId)
      .query('SELECT id FROM Equipment WHERE LOWER(LTRIM(RTRIM(position_id))) = LOWER(@position_id)');
    if (duplicate.recordset.length) {
      return res.status(409).json({ success: false, message: `Equipment with Position ID "${normalizedPositionId}" already exists.` });
    }

    const result = await pool.request()
      .input('position_id', sql.NVarChar, normalizedPositionId)
      .input('storage_number', sql.NVarChar, d.storage_number || null)
      .input('epc_po_number', sql.NVarChar, d.epc_po_number || null)
      .input('sub_po_number', sql.NVarChar, d.sub_po_number || null)
      .input('sub_po_vendor', sql.NVarChar, d.sub_po_vendor || null)
      .input('equipment_status_code', sql.Int, d.equipment_status_code || 0)
      .input('npcil_spec_number', sql.NVarChar, d.npcil_spec_number || null)
      .input('npcil_spec_status', sql.NVarChar, d.npcil_spec_status || null)
      .input('drawing_number', sql.NVarChar, d.drawing_number || null)
      .input('drawing_status', sql.NVarChar, d.drawing_status || null)
      .input('data_sheet_number', sql.NVarChar, d.data_sheet_number || null)
      .input('data_sheet_status', sql.NVarChar, d.data_sheet_status || null)
      .input('as_built_drawing_number', sql.NVarChar, d.as_built_drawing_number || null)
      .input('epc_package_name', sql.NVarChar, d.epc_package_name || null)
      .input('equip_status', sql.NVarChar, d.equip_status || null)
      .input('location', sql.NVarChar, d.location || null)
      .input('equipment_type', sql.NVarChar, d.equipment_type || null)
      .input('last_inspection_date', sql.Date, d.last_inspection_date || null)
      .input('next_inspection_date', sql.Date, d.next_inspection_date || null)
      .query(`
        INSERT INTO Equipment (position_id, storage_number, epc_po_number, sub_po_number, sub_po_vendor, equipment_status_code, npcil_spec_number, npcil_spec_status, drawing_number, drawing_status, data_sheet_number, data_sheet_status, as_built_drawing_number, epc_package_name, equip_status, location, equipment_type, last_inspection_date, next_inspection_date)
        OUTPUT INSERTED.id
        VALUES (@position_id, @storage_number, @epc_po_number, @sub_po_number, @sub_po_vendor, @equipment_status_code, @npcil_spec_number, @npcil_spec_status, @drawing_number, @drawing_status, @data_sheet_number, @data_sheet_status, @as_built_drawing_number, @epc_package_name, @equip_status, @location, @equipment_type, @last_inspection_date, @next_inspection_date)
      `);

      const newId = result.recordset[0].id;
      await applyCustomFieldValues(pool, newId, d); // persist any admin-added custom field values

      res.status(201).json({ success: true, message: 'Equipment created', id: newId });
      logActivity(req, { action: 'Equipment Created', entity_type: 'Equipment', entity_id: newId, details: `Created equipment "${d.position_id}"` });
  } catch (err) {
    return handleDbError(res, err, () => {
      const id = devStore.createEquipment(req.body);
      if (!id) return res.status(409).json({ success: false, message: `Equipment with Position ID "${d.position_id.trim()}" already exists.` });
      res.status(201).json({ success: true, message: 'Equipment created', id });
      logActivity(req, { action: 'Equipment Created', entity_type: 'Equipment', entity_id: id, details: `Created equipment "${d.position_id}"` });
    });
  }
};

// UPDATE equipment
exports.updateEquipment = async (req, res) => {
  const d = req.body;

  const fieldDefs = await getFieldDefsForValidation();
  const missing = validateMandatoryFields(fieldDefs, d);
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
  }

  try {
    const pool = await getPool();

    const normalizedPositionId = d.position_id.trim();
    const duplicate = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('position_id', sql.NVarChar, normalizedPositionId)
      .query('SELECT id FROM Equipment WHERE id <> @id AND LOWER(LTRIM(RTRIM(position_id))) = LOWER(@position_id)');
    if (duplicate.recordset.length) {
      return res.status(409).json({ success: false, message: `Equipment with Position ID "${normalizedPositionId}" already exists.` });
    }

    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('position_id', sql.NVarChar, normalizedPositionId)
      .input('storage_number', sql.NVarChar, d.storage_number || null)
      .input('epc_po_number', sql.NVarChar, d.epc_po_number || null)
      .input('sub_po_number', sql.NVarChar, d.sub_po_number || null)
      .input('npcil_spec_number', sql.NVarChar, d.npcil_spec_number || null)
      .input('drawing_number', sql.NVarChar, d.drawing_number || null)
      .input('data_sheet_number', sql.NVarChar, d.data_sheet_number || null)
      .input('as_built_drawing_number', sql.NVarChar, d.as_built_drawing_number || null)
      .input('epc_package_name', sql.NVarChar, d.epc_package_name || null)
      .input('equipment_status_code', sql.Int, d.equipment_status_code)
      .input('equip_status', sql.NVarChar, d.equip_status || null)
      .input('location', sql.NVarChar, d.location || null)
      .input('equipment_type', sql.NVarChar, d.equipment_type || null)
      .input('npcil_spec_status', sql.NVarChar, d.npcil_spec_status || null)
      .input('drawing_status', sql.NVarChar, d.drawing_status || null)
      .input('data_sheet_status', sql.NVarChar, d.data_sheet_status || null)
      .input('last_inspection_date', sql.Date, d.last_inspection_date || null)
      .input('next_inspection_date', sql.Date, d.next_inspection_date || null)
      .input('sub_po_vendor', sql.NVarChar, d.sub_po_vendor || null)
      .query(`
        UPDATE Equipment SET
          position_id = @position_id,
          storage_number = @storage_number,
          epc_po_number = @epc_po_number,
          sub_po_number = @sub_po_number,
          sub_po_vendor = @sub_po_vendor,
          equipment_status_code = @equipment_status_code,
          equip_status = @equip_status,
          location = @location,
          equipment_type = @equipment_type,
          npcil_spec_number = @npcil_spec_number,
          npcil_spec_status = @npcil_spec_status,
          drawing_number = @drawing_number,
          drawing_status = @drawing_status,
          data_sheet_number = @data_sheet_number,
          data_sheet_status = @data_sheet_status,
          as_built_drawing_number = @as_built_drawing_number,
          epc_package_name = @epc_package_name,
          last_inspection_date = @last_inspection_date,
          next_inspection_date = @next_inspection_date,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    if (!result.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Equipment not found' });

    await applyCustomFieldValues(pool, req.params.id, d); // persist any admin-added custom field values

    res.json({ success: true, message: 'Equipment updated successfully' });
    logActivity(req, { action: 'Equipment Updated', entity_type: 'Equipment', entity_id: req.params.id, details: `Updated equipment #${req.params.id}` });
  } catch (err) {
    return handleDbError(res, err, () => {
      const updated = devStore.updateEquipment(req.params.id, req.body);
      if (updated === 'duplicate') return res.status(409).json({ success: false, message: `Equipment with Position ID "${d.position_id.trim()}" already exists.` });
      if (!updated) return res.status(404).json({ success: false, message: 'Equipment not found' });
      res.json({ success: true, message: 'Equipment updated successfully' });
      logActivity(req, { action: 'Equipment Updated', entity_type: 'Equipment', entity_id: req.params.id, details: `Updated equipment #${req.params.id}` });
    });
  }
};

// DELETE (soft) equipment
exports.deleteEquipment = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE Equipment SET is_active = 0, updated_at = GETDATE() WHERE id = @id');
    res.json({ success: true, message: 'Equipment deleted' });
    logActivity(req, { action: 'Equipment Deleted', entity_type: 'Equipment', entity_id: req.params.id, details: `Deleted equipment #${req.params.id}` });
  } catch (err) {
    return handleDbError(res, err, () => {
      const deleted = devStore.deleteEquipment(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Equipment not found' });
      res.json({ success: true, message: 'Equipment deleted' });
      logActivity(req, { action: 'Equipment Deleted', entity_type: 'Equipment', entity_id: req.params.id, details: `Deleted equipment #${req.params.id}` });
    });
  }
};

// GET dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const pool = await getPool();

    const statsResult = await pool.request().query(`
      SELECT 
        COUNT(*) AS total_equipment,
        COALESCE(SUM(CASE WHEN equipment_status_code = 8 THEN 1 ELSE 0 END), 0) AS commissioned,
        COALESCE(SUM(CASE WHEN equipment_status_code = 7 THEN 1 ELSE 0 END), 0) AS handover_om,
        COALESCE(SUM(CASE WHEN equipment_status_code = 0 THEN 1 ELSE 0 END), 0) AS order_not_placed,
        COALESCE(SUM(CASE WHEN equipment_status_code BETWEEN 1 AND 4 THEN 1 ELSE 0 END), 0) AS in_progress,
        COALESCE(SUM(CASE WHEN equipment_status_code IN (5, 6) THEN 1 ELSE 0 END), 0) AS testing_phase
      FROM Equipment WHERE is_active = 1
    `);

    const statusBreakdown = await pool.request().query(`
      SELECT s.status_code, s.status_name, s.status_color, COUNT(e.id) AS count
      FROM StatusLookup s
      LEFT JOIN Equipment e ON s.status_code = e.equipment_status_code AND e.is_active = 1
      GROUP BY s.status_code, s.status_name, s.status_color
      ORDER BY s.status_code
    `);

    const packageBreakdown = await pool.request().query(`
      SELECT epc_package_name, COUNT(*) AS count
      FROM Equipment WHERE is_active = 1 AND epc_package_name IS NOT NULL
      GROUP BY epc_package_name
      ORDER BY count DESC
    `);

    const recentActivity = await pool.request().query(`
      SELECT TOP 10 position_id, equip_status, location, updated_at
      FROM Equipment WHERE is_active = 1
      ORDER BY updated_at DESC
    `);

    res.json({
      success: true,
      data: {
        stats: statsResult.recordset[0],
        statusBreakdown: statusBreakdown.recordset,
        packageBreakdown: packageBreakdown.recordset,
        recentActivity: recentActivity.recordset
      }
    });
  } catch (err) {
    return handleDbError(res, err, () => {
      res.json({ success: true, data: devStore.getDashboardStats() });
    });
  }
};

// IMPORT from Excel
exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const pool = await getPool();

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet);
    const { rows, skipped } = parseEquipmentImportRows(rawRows);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction).query(`
        IF OBJECT_ID('MaintenanceDocuments', 'U') IS NOT NULL
          DELETE FROM MaintenanceDocuments
          WHERE maintenance_id IN (SELECT id FROM MaintenanceRecords);
        DELETE FROM MaintenanceRecords;
        DELETE FROM Equipment;
      `);

      for (const data of rows) {
        await bindEquipmentImportInputs(new sql.Request(transaction), data)
          .input('position_id', sql.NVarChar, data.position_id)
          .query(`INSERT INTO Equipment (position_id, storage_number, epc_po_number, sub_po_number, sub_po_vendor, equipment_status_code, npcil_spec_number, npcil_spec_status, drawing_number, drawing_status, data_sheet_number, data_sheet_status, as_built_drawing_number, epc_package_name, equip_status, location, equipment_type, last_inspection_date, next_inspection_date)
                  VALUES (@position_id, @storage_number, @epc_po_number, @sub_po_number, @sub_po_vendor, @equipment_status_code, @npcil_spec_number, @npcil_spec_status, @drawing_number, @drawing_status, @data_sheet_number, @data_sheet_status, @as_built_drawing_number, @epc_package_name, @equip_status, @location, @equipment_type, @last_inspection_date, @next_inspection_date)`);
      }

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    removeUploadedFile(req.file.path);

    res.json({
      success: true,
      message: `Dataset replaced. ${rows.length} records loaded, 0 updated, ${skipped} skipped.`,
      imported: rows.length,
      updated: 0,
      skipped,
      replaced: true,
    });
    logActivity(req, { action: 'Dataset Replaced', entity_type: 'Equipment', details: `Loaded ${rows.length} equipment records from Excel import` });
  } catch (err) {
    return handleDbError(res, err, () => {
      const workbook = xlsx.readFile(req.file.path, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);
      const { imported, updated = 0, skipped, replaced = true } = devStore.importRows(rows);
      removeUploadedFile(req.file.path);
      res.json({ success: true, message: `Dataset replaced. ${imported} records loaded, ${updated} updated, ${skipped} skipped.`, imported, updated, skipped, replaced });
      logActivity(req, { action: 'Dataset Replaced', entity_type: 'Equipment', details: `Loaded ${imported} equipment records from Excel import` });
    });
  }
};

// EXPORT to Excel
exports.exportToExcel = async (req, res) => {
  try {
    const pool = await getPool();
    const { search, status, package_name, type } = req.query;

    let whereClause = 'WHERE e.is_active = 1';
    const request = pool.request();
    if (search) {
      whereClause += ' AND (e.position_id LIKE @search OR e.equip_status LIKE @search OR e.location LIKE @search OR e.sub_po_vendor LIKE @search OR e.epc_package_name LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    if (status !== undefined && status !== '') {
      whereClause += ' AND e.equipment_status_code = @status';
      request.input('status', sql.Int, parseInt(status));
    }
    if (package_name) {
      whereClause += ' AND e.epc_package_name = @package_name';
      request.input('package_name', sql.NVarChar, package_name);
    }
    if (type) {
      whereClause += ' AND e.equipment_type = @type';
      request.input('type', sql.NVarChar, type);
    }

    const customFields = await getCustomFieldDefs(pool);
    const customSelect = customFields.map((f) => `, e.[${f.field_key}] AS [${f.field_key}]`).join('');

    const result = await request.query(`
      SELECT e.position_id AS "Position ID", e.storage_number AS "Storage Number",
        e.epc_po_number AS "EPC PO Number", e.sub_po_number AS "Sub PO Number",
        e.sub_po_vendor AS "Vendor", s.status_name AS "Status",
        e.npcil_spec_number AS "NPCIL Spec", e.npcil_spec_status AS "Spec Status",
        e.drawing_number AS "Drawing No", e.drawing_status AS "Drawing Status",
        e.data_sheet_number AS "Data Sheet", e.data_sheet_status AS "Data Sheet Status",
        e.epc_package_name AS "Package", e.equip_status AS "Equipment Status",
        e.location AS "Location", e.equipment_type AS "Type",
        CONVERT(VARCHAR, e.last_inspection_date, 103) AS "Last Inspection",
        CONVERT(VARCHAR, e.updated_at, 103) AS "Last Updated"
        ${customSelect}
      FROM Equipment e
      LEFT JOIN StatusLookup s ON e.equipment_status_code = s.status_code
      ${whereClause}
      ORDER BY e.position_id
    `);

    // Re-key custom columns from field_key to their human-readable label for the export sheet
    const rows = result.recordset.map((row) => {
      const out = { ...row };
      customFields.forEach((f) => {
        if (f.field_key in out) {
          out[f.label] = out[f.field_key];
          delete out[f.field_key];
        }
      });
      return out;
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, 'Equipment Status');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="equipment_status_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    return handleDbError(res, err, () => {
      const buffer = devStore.exportWorkbook(req.query);
      res.setHeader('Content-Disposition', 'attachment; filename="equipment_status_export.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    });
  }
};

// GET status lookup
exports.getStatusLookup = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM StatusLookup ORDER BY status_code');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    return handleDbError(res, err, () => {
      res.json({ success: true, data: devStore.statuses });
    });
  }
};

// ADD maintenance record
exports.addMaintenanceRecord = async (req, res) => {
  try {
    const pool = await getPool();
    const d = req.body;
    await pool.request()
      .input('equipment_id', sql.Int, req.params.id)
      .input('maintenance_type', sql.NVarChar, d.maintenance_type)
      .input('description', sql.NVarChar, d.description)
      .input('performed_by', sql.NVarChar, d.performed_by)
      .input('next_maintenance_date', sql.Date, d.next_maintenance_date || null)
      .input('status', sql.NVarChar, d.status || 'Completed')
      .input('remarks', sql.NVarChar, d.remarks || null)
      .query(`INSERT INTO MaintenanceRecords (equipment_id, maintenance_type, description, performed_by, next_maintenance_date, status, remarks)
              VALUES (@equipment_id, @maintenance_type, @description, @performed_by, @next_maintenance_date, @status, @remarks)`);
    res.status(201).json({ success: true, message: 'Maintenance record added' });
  } catch (err) {
    return handleDbError(res, err, () => {
      const item = devStore.getEquipmentById(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Equipment not found' });
      devStore.addMaintenanceRecord(req.params.id, req.body);
      res.status(201).json({ success: true, message: 'Maintenance record added' });
    });
  }
};
