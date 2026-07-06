const { sql, getPool } = require('../config/database');
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

const VALID_TYPES = ['text', 'number', 'date', 'select'];

const slugify = (label) => String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Fields fetched from the Equipment-table-backed FieldConfig table can be queried by
// equipmentController to build dynamic SQL for custom columns. Exported for reuse.
const getCustomFieldDefs = async (pool) => {
  try {
    const result = await pool.request().query('SELECT field_key, label, field_type, is_mandatory FROM FieldConfig WHERE is_custom = 1');
    return result.recordset;
  } catch {
    return [];
  }
};
exports.getCustomFieldDefs = getCustomFieldDefs;

// GET /api/fields — any authenticated user (needed to render the equipment form)
exports.getFields = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM FieldConfig ORDER BY display_order');
    const data = result.recordset.map((r) => ({ ...r, options: r.options ? JSON.parse(r.options) : undefined, is_mandatory: !!r.is_mandatory, is_custom: !!r.is_custom, locked: !!r.locked }));
    res.json({ success: true, data });
  } catch (err) {
    return handleDbError(res, err, () => {
      res.json({ success: true, data: devStore.getFieldConfigs() });
    });
  }
};

// PUT /api/fields/:key — Admin only. Toggle mandatory, relabel, edit select options.
exports.updateField = async (req, res) => {
  const key = req.params.key;
  const { label, is_mandatory, options } = req.body;

  try {
    const pool = await getPool();
    const existing = await pool.request().input('k', sql.NVarChar, key).query('SELECT * FROM FieldConfig WHERE field_key = @k');
    if (!existing.recordset.length) return res.status(404).json({ success: false, message: 'Field not found' });
    const row = existing.recordset[0];

    if (row.locked && is_mandatory === false) {
      return res.status(400).json({ success: false, message: `"${row.label}" is a key field and cannot be made optional.` });
    }

    await pool.request()
      .input('k', sql.NVarChar, key)
      .input('label', sql.NVarChar, label ?? row.label)
      .input('is_mandatory', sql.Bit, is_mandatory !== undefined ? !!is_mandatory : !!row.is_mandatory)
      .input('options', sql.NVarChar, options !== undefined ? JSON.stringify(options) : row.options)
      .query('UPDATE FieldConfig SET label = @label, is_mandatory = @is_mandatory, options = @options, updated_at = GETDATE() WHERE field_key = @k');

    await logActivity(req, { action: 'Field Updated', entity_type: 'FieldConfig', entity_id: key, details: `Updated field "${key}"` });
    res.json({ success: true, message: 'Field updated successfully' });
  } catch (err) {
    return handleDbError(res, err, () => {
      const updated = devStore.updateFieldConfig(key, { label, is_mandatory, options });
      if (!updated) return res.status(404).json({ success: false, message: 'Field not found' });
      logActivity(req, { action: 'Field Updated', entity_type: 'FieldConfig', entity_id: key, details: `Updated field "${key}"` });
      res.json({ success: true, message: 'Field updated successfully', data: updated });
    });
  }
};

// POST /api/fields — Admin only. Adds a new column to the Equipment table (ALTER TABLE)
// and registers it as a field the equipment form should render.
exports.createField = async (req, res) => {
  const { label, field_type, is_mandatory, options } = req.body;

  if (!label || !String(label).trim()) return res.status(400).json({ success: false, message: 'Field label is required' });
  if (field_type && !VALID_TYPES.includes(field_type)) return res.status(400).json({ success: false, message: `Field type must be one of: ${VALID_TYPES.join(', ')}` });

  const field_key = slugify(label);
  if (!field_key) return res.status(400).json({ success: false, message: 'Could not derive a valid field key from that label' });

  try {
    const pool = await getPool();
    const existing = await pool.request().input('k', sql.NVarChar, field_key).query('SELECT id FROM FieldConfig WHERE field_key = @k');
    if (existing.recordset.length) return res.status(409).json({ success: false, message: `A field with key "${field_key}" already exists` });

    // Physically modify the database schema — this is the "DB table also gets modified" requirement.
    // Custom columns are stored as NVARCHAR(MAX) so any field type (text/number/date/select) can be
    // saved safely; the field_type only governs how the form renders/validates the input.
    await pool.request().query(`ALTER TABLE Equipment ADD [${field_key}] NVARCHAR(MAX) NULL`);

    const maxOrder = await pool.request().query('SELECT ISNULL(MAX(display_order), 0) AS m FROM FieldConfig');
    const result = await pool.request()
      .input('field_key', sql.NVarChar, field_key)
      .input('label', sql.NVarChar, String(label).trim())
      .input('field_type', sql.NVarChar, field_type || 'text')
      .input('is_mandatory', sql.Bit, !!is_mandatory)
      .input('options', sql.NVarChar, field_type === 'select' && Array.isArray(options) ? JSON.stringify(options) : null)
      .input('display_order', sql.Int, (maxOrder.recordset[0].m || 0) + 1)
      .query(`
        INSERT INTO FieldConfig (field_key, label, field_type, is_mandatory, is_custom, locked, options, display_order)
        OUTPUT INSERTED.*
        VALUES (@field_key, @label, @field_type, @is_mandatory, 1, 0, @options, @display_order)
      `);

    await logActivity(req, { action: 'Field Created', entity_type: 'FieldConfig', entity_id: field_key, details: `Added column "${field_key}" (${field_type || 'text'}) to Equipment table` });
    res.status(201).json({ success: true, message: `Field "${label}" added. The Equipment table now has a "${field_key}" column.`, data: result.recordset[0] });
  } catch (err) {
    return handleDbError(res, err, () => {
      try {
        const field = devStore.addCustomField({ label, field_type, is_mandatory, options });
        logActivity(req, { action: 'Field Created', entity_type: 'FieldConfig', entity_id: field.field_key, details: `Added column "${field.field_key}" (${field.field_type}) to Equipment table` });
        res.status(201).json({ success: true, message: `Field "${label}" added. Every equipment record now has a "${field.field_key}" column.`, data: field });
      } catch (devErr) {
        res.status(409).json({ success: false, message: devErr.message });
      }
    });
  }
};

// DELETE /api/fields/:key — Admin only. Only custom (admin-added) fields are removable.
exports.deleteField = async (req, res) => {
  const key = req.params.key;

  try {
    const pool = await getPool();
    const existing = await pool.request().input('k', sql.NVarChar, key).query('SELECT * FROM FieldConfig WHERE field_key = @k');
    if (!existing.recordset.length) return res.status(404).json({ success: false, message: 'Field not found' });
    if (!existing.recordset[0].is_custom) return res.status(400).json({ success: false, message: 'Only admin-added custom fields can be removed.' });

    await pool.request().query(`ALTER TABLE Equipment DROP COLUMN [${key}]`);
    await pool.request().input('k', sql.NVarChar, key).query('DELETE FROM FieldConfig WHERE field_key = @k');

    await logActivity(req, { action: 'Field Deleted', entity_type: 'FieldConfig', entity_id: key, details: `Removed column "${key}" from Equipment table` });
    res.json({ success: true, message: 'Field removed successfully' });
  } catch (err) {
    return handleDbError(res, err, () => {
      const deleted = devStore.deleteCustomField(key);
      if (!deleted) return res.status(400).json({ success: false, message: 'Field not found or is not a removable custom field' });
      logActivity(req, { action: 'Field Deleted', entity_type: 'FieldConfig', entity_id: key, details: `Removed column "${key}" from Equipment table` });
      res.json({ success: true, message: 'Field removed successfully' });
    });
  }
};
