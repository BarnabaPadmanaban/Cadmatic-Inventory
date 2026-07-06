const xlsx = require('xlsx');

const statuses = [
  { status_code: 0, status_name: 'Order Not Yet Placed', status_color: '#64748b', description: 'Purchase order has not been placed' },
  { status_code: 1, status_name: 'Order Placed', status_color: '#2563eb', description: 'Purchase order placed with vendor' },
  { status_code: 2, status_name: 'Shipping Release Issued', status_color: '#7c3aed', description: 'Shipping release has been issued' },
  { status_code: 3, status_name: 'Received at Site', status_color: '#c77700', description: 'Equipment received at plant site' },
  { status_code: 4, status_name: 'Erected at Location', status_color: '#008aa0', description: 'Equipment installed at designated location' },
  { status_code: 5, status_name: 'Hydro Tested', status_color: '#05805d', description: 'Hydraulic testing completed' },
  { status_code: 6, status_name: 'CCC/STD Released', status_color: '#5f8f00', description: 'Construction completion certificate released' },
  { status_code: 7, status_name: 'Handover to O&M', status_color: '#ff7700', description: 'Equipment handed over to Operations & Maintenance' },
  { status_code: 8, status_name: 'Commissioned', status_color: '#17833b', description: 'Equipment fully commissioned and operational' },
];

let nextEquipmentId = 1;
let nextMaintenanceId = 1;

const now = () => new Date().toISOString();

// Equipment starts empty. Records are created by Excel import or explicit user input.
const equipment = [];

const maintenance = [];

const statusFor = (code) => statuses.find((status) => status.status_code === Number(code)) || statuses[0];
const activeEquipment = () => equipment.filter((item) => item.is_active);
const withStatus = (item) => ({ ...item, status_name: statusFor(item.equipment_status_code).status_name, status_color: statusFor(item.equipment_status_code).status_color });

const statusCodeFor = (value) => {
  const numeric = Number(String(value || '').trim());
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 8) return numeric;

  const statusMap = {
    'order not yet placed': 0,
    'order not yer placed': 0,
    'order placed': 1,
    'order placed yes': 1,
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
  };
  return statusMap[String(value || '').trim().toLowerCase()] ?? 0;
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

const equipmentDataFromImportRow = (row) => {
  const equipStatus = firstValue(row, ['Equip Status', 'Equipment Status', 'equip_status']);
  return {
    storage_number: firstValue(row, ['Storage Number', 'storage_number']),
    epc_po_number: firstValue(row, ['EPC Purchase Order Number', 'EPC PO Number', 'epc_po_number']),
    sub_po_number: firstValue(row, ['Sub Purchase Order Number', 'Sub PO Number', 'sub_po_number']),
    sub_po_vendor: firstValue(row, ['Sub PO Vendor Name', 'Vendor', 'sub_po_vendor']),
    equipment_status_code: statusCodeFor(equipStatus),
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

const filterEquipment = ({ search, status, package_name, type } = {}) => {
  let rows = activeEquipment();
  if (search) {
    const term = search.toLowerCase();
    rows = rows.filter((item) => [
      item.position_id,
      item.equip_status,
      item.location,
      item.sub_po_vendor,
      item.epc_package_name,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }
  if (status !== undefined && status !== '') rows = rows.filter((item) => item.equipment_status_code === Number(status));
  if (package_name) rows = rows.filter((item) => item.epc_package_name === package_name);
  if (type) rows = rows.filter((item) => item.equipment_type === type);
  return rows.sort((a, b) => a.equipment_status_code - b.equipment_status_code || a.position_id.localeCompare(b.position_id));
};

const getAllEquipment = (query) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 50);
  const rows = filterEquipment(query).map(withStatus);
  const offset = (page - 1) * limit;

  return {
    data: rows.slice(offset, offset + limit),
    pagination: { page, limit, total: rows.length, pages: Math.ceil(rows.length / limit) || 1 },
  };
};

const getDashboardStats = () => {
  const rows = activeEquipment();
  const stats = {
    total_equipment: rows.length,
    commissioned: rows.filter((item) => item.equipment_status_code === 8).length,
    handover_om: rows.filter((item) => item.equipment_status_code === 7).length,
    order_not_placed: rows.filter((item) => item.equipment_status_code === 0).length,
    in_progress: rows.filter((item) => item.equipment_status_code >= 1 && item.equipment_status_code <= 4).length,
    testing_phase: rows.filter((item) => [5, 6].includes(item.equipment_status_code)).length,
  };

  const statusBreakdown = statuses.map((status) => ({
    ...status,
    count: rows.filter((item) => item.equipment_status_code === status.status_code).length,
  }));

  const packageBreakdown = Object.values(rows.reduce((acc, item) => {
    if (!item.epc_package_name) return acc;
    acc[item.epc_package_name] ||= { epc_package_name: item.epc_package_name, count: 0 };
    acc[item.epc_package_name].count += 1;
    return acc;
  }, {})).sort((a, b) => b.count - a.count);

  const recentActivity = [...rows]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10)
    .map(({ position_id, equip_status, location, updated_at }) => ({ position_id, equip_status, location, updated_at }));

  return { stats, statusBreakdown, packageBreakdown, recentActivity };
};

const getEquipmentById = (id) => {
  const item = activeEquipment().find((row) => row.id === Number(id));
  if (!item) return null;
  return {
    ...withStatus(item),
    status_description: statusFor(item.equipment_status_code).description,
    maintenance_history: maintenance.filter((row) => row.equipment_id === Number(id)),
  };
};

const createEquipment = (data) => {
  const normalizedPositionId = String(data.position_id || '').trim();
  const duplicate = equipment.some((item) =>
    String(item.position_id || '').trim().toLowerCase() === normalizedPositionId.toLowerCase()
  );
  if (duplicate) return null;

  const id = nextEquipmentId++;
  const item = {
    ...data,
    position_id: normalizedPositionId,
    id,
    equipment_status_code: Number(data.equipment_status_code || 0),
    created_at: now(),
    updated_at: now(),
    is_active: true,
  };
  equipment.push(item);
  return id;
};

const updateEquipment = (id, data) => {
  const index = equipment.findIndex((item) => item.id === Number(id) && item.is_active);
  if (index === -1) return false;
  const normalizedPositionId = String(data.position_id || '').trim();
  const duplicate = equipment.some((item) =>
    item.id !== Number(id) && String(item.position_id || '').trim().toLowerCase() === normalizedPositionId.toLowerCase()
  );
  if (duplicate) return 'duplicate';
  equipment[index] = { ...equipment[index], ...data, position_id: normalizedPositionId, equipment_status_code: Number(data.equipment_status_code), updated_at: now() };
  return true;
};

const deleteEquipment = (id) => {
  const item = equipment.find((row) => row.id === Number(id));
  if (!item) return false;
  item.is_active = false;
  item.updated_at = now();
  return true;
};

const addMaintenanceRecord = (equipmentId, data) => {
  const record = {
    id: nextMaintenanceId++,
    equipment_id: Number(equipmentId),
    maintenance_type: data.maintenance_type,
    description: data.description,
    performed_by: data.performed_by,
    maintenance_date: now(),
    next_maintenance_date: data.next_maintenance_date || null,
    status: data.status || 'Completed',
    remarks: data.remarks || null,
    created_at: now(),
  };
  maintenance.push(record);
};

const parseImportRows = (rows) => {
  const rowMap = new Map();
  let skipped = 0;

  for (const row of rows) {
    const posId = firstValue(row, ['nam Position Id', 'Position ID', 'Position Id', 'position_id']);
    const positionId = String(posId || '').trim();
    if (!positionId || positionId === 'NaN') {
      if (hasEquipmentDataWithoutPosition(row)) skipped++;
      continue;
    }

    const key = positionId.toLowerCase();
    rowMap.set(key, {
      position_id: positionId,
      ...equipmentDataFromImportRow(row),
    });
  }

  return { parsedRows: [...rowMap.values()], skipped };
};

const importRows = (rows) => {
  const { parsedRows, skipped } = parseImportRows(rows);
  let imported = 0;

  equipment.splice(0, equipment.length);
  maintenance.splice(0, maintenance.length);
  maintenanceRecords.splice(0, maintenanceRecords.length);
  nextEquipmentId = 1;
  nextMaintenanceId = 1;
  nextMaintId = 1;

  parsedRows.forEach((data) => {
    equipment.push({
      id: nextEquipmentId++,
      ...data,
      created_at: now(),
      updated_at: now(),
      is_active: true,
    });
    imported++;
  });

  return { imported, replaced: true, updated: 0, skipped };
};

const exportWorkbook = (filters = {}) => {
  const customFields = fieldConfigs.filter((f) => f.is_custom);
  const rows = filterEquipment(filters).map((item) => {
    const row = {
      'Position ID': item.position_id,
      'Storage Number': item.storage_number,
      'EPC PO Number': item.epc_po_number,
      'Sub PO Number': item.sub_po_number,
      Vendor: item.sub_po_vendor,
      Status: statusFor(item.equipment_status_code).status_name,
      'NPCIL Spec': item.npcil_spec_number,
      'Spec Status': item.npcil_spec_status,
      'Drawing No': item.drawing_number,
      'Drawing Status': item.drawing_status,
      'Data Sheet': item.data_sheet_number,
      'Data Sheet Status': item.data_sheet_status,
      Package: item.epc_package_name,
      'Equipment Status': item.equip_status,
      Location: item.location,
      Type: item.equipment_type,
      'Last Inspection': item.last_inspection_date,
      'Last Updated': item.updated_at,
    };
    customFields.forEach((f) => { row[f.label] = item[f.field_key] ?? ''; });
    return row;
  });
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, 'Equipment Status');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

// ============================================================
// MAINTENANCE MODULE - Enhanced devStore additions
// ============================================================

const maintenanceRecords = [];

let nextMaintId = maintenanceRecords.length + 1;

const getAllMaintenance = (query = {}) => {
  const { equipment_id, vendor, maintenance_type, priority, status, date_from, date_to, search } = query;
  let records = [...maintenanceRecords];

  if (equipment_id) records = records.filter(m => m.equipment_id === Number(equipment_id));
  if (maintenance_type) records = records.filter(m => m.maintenance_type === maintenance_type);
  if (priority) records = records.filter(m => m.priority === priority);
  if (status) records = records.filter(m => m.status === status);
  if (date_from) records = records.filter(m => m.scheduled_date && m.scheduled_date >= date_from);
  if (date_to) records = records.filter(m => m.scheduled_date && m.scheduled_date <= date_to);
  if (search) {
    const term = search.toLowerCase();
    records = records.filter(m =>
      String(m.description || '').toLowerCase().includes(term) ||
      String(m.engineer_name || '').toLowerCase().includes(term) ||
      String(m.maintenance_type || '').toLowerCase().includes(term)
    );
  }
  if (vendor) {
    const term = vendor.toLowerCase();
    const eqIds = equipment.filter(e => String(e.sub_po_vendor || '').toLowerCase().includes(term)).map(e => e.id);
    records = records.filter(m => eqIds.includes(m.equipment_id));
  }

  return records.map(m => {
    const eq = equipment.find(e => e.id === m.equipment_id);
    return {
      ...m,
      position_id: eq?.position_id,
      sub_po_vendor: eq?.sub_po_vendor,
      equipment_type: eq?.equipment_type,
      location: eq?.location,
      equipment_status_code: eq?.equipment_status_code,
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const getMaintenanceDashboard = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today.getTime() + 30 * 86400000);
  const in7Days = new Date(today.getTime() + 7 * 86400000);

  const total = maintenanceRecords.length;
  const completed = maintenanceRecords.filter(m => m.status === 'Completed').length;
  const scheduled = maintenanceRecords.filter(m => ['Scheduled', 'Pending'].includes(m.status)).length;
  const overdue = maintenanceRecords.filter(m => !['Completed', 'Cancelled'].includes(m.status) && m.scheduled_date && new Date(m.scheduled_date) < today).length;
  const upcoming_30 = maintenanceRecords.filter(m => ['Scheduled', 'Pending'].includes(m.status) && m.scheduled_date && new Date(m.scheduled_date) >= today && new Date(m.scheduled_date) <= in30Days).length;

  // Type distribution
  const typeCounts = {};
  maintenanceRecords.forEach(m => { typeCounts[m.maintenance_type] = (typeCounts[m.maintenance_type] || 0) + 1; });
  const typeDistribution = Object.entries(typeCounts).map(([maintenance_type, count]) => ({ maintenance_type, count }));

  // Monthly trend (last 6 months)
  const monthlyMap = {};
  maintenanceRecords.forEach(m => {
    if (m.maintenance_date || m.completion_date) {
      const d = new Date(m.maintenance_date || m.completion_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    }
  });
  const monthlyTrend = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));

  const overdueList = maintenanceRecords.filter(m => !['Completed', 'Cancelled'].includes(m.status) && m.scheduled_date && new Date(m.scheduled_date) < today).map(m => {
    const eq = equipment.find(e => e.id === m.equipment_id);
    return { ...m, position_id: eq?.position_id, equipment_type: eq?.equipment_type, location: eq?.location };
  }).sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

  const dueSoonList = maintenanceRecords.filter(m => ['Scheduled', 'Pending'].includes(m.status) && m.scheduled_date && new Date(m.scheduled_date) >= today && new Date(m.scheduled_date) <= in7Days).map(m => {
    const eq = equipment.find(e => e.id === m.equipment_id);
    return { ...m, position_id: eq?.position_id, equipment_type: eq?.equipment_type, location: eq?.location };
  }).sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

  return { stats: { total, completed, scheduled, overdue, upcoming_30 }, typeDistribution, monthlyTrend, overdueList, dueSoonList };
};

const getEquipmentMaintenance = (id) => {
  const today = new Date().toISOString().split('T')[0];
  const eq = equipment.find(e => e.id === Number(id));
  const records = maintenanceRecords.filter(m => m.equipment_id === Number(id));

  // Compute health score
  let score = 100;
  const todayDate = new Date(today);
  const overdueCount = records.filter(m => !['Completed', 'Cancelled'].includes(m.status) && m.scheduled_date && new Date(m.scheduled_date) < todayDate).length;
  score -= overdueCount * 15;
  const completedRecs = records.filter(m => m.status === 'Completed');
  if (completedRecs.length === 0) { score -= 20; }
  else {
    const lastDate = new Date(Math.max(...completedRecs.map(m => new Date(m.maintenance_date || m.created_at))));
    const daysSince = (todayDate - lastDate) / 86400000;
    if (daysSince > 365) score -= 25; else if (daysSince > 180) score -= 15; else if (daysSince > 90) score -= 5;
  }
  const criticalOverdue = records.filter(m => !['Completed', 'Cancelled'].includes(m.status) && ['Critical', 'High'].includes(m.priority) && m.scheduled_date && new Date(m.scheduled_date) < todayDate).length;
  score -= criticalOverdue * 10;
  if (eq && [7, 8].includes(eq.equipment_status_code)) score = Math.min(score + 5, 100);
  score = Math.max(0, Math.min(100, score));

  let level, color;
  if (score >= 85) { level = 'Excellent'; color = '#17833b'; }
  else if (score >= 70) { level = 'Good'; color = '#5f8f00'; }
  else if (score >= 50) { level = 'Warning'; color = '#c77700'; }
  else { level = 'Critical'; color = '#d93025'; }

  return { records, health: { score, level, color, overdueCount, totalRecords: records.length } };
};

const createMaintenanceRecord = (data) => {
  const id = nextMaintId++;
  const record = { id, ...data, equipment_id: Number(data.equipment_id), created_at: now() };
  maintenanceRecords.push(record);
  return id;
};

const updateMaintenanceRecord = (id, data) => {
  const idx = maintenanceRecords.findIndex(m => m.id === Number(id));
  if (idx === -1) return false;
  maintenanceRecords[idx] = { ...maintenanceRecords[idx], ...data };
  return true;
};

const deleteMaintenanceRecord = (id) => {
  const idx = maintenanceRecords.findIndex(m => m.id === Number(id));
  if (idx === -1) return false;
  maintenanceRecords.splice(idx, 1);
  return true;
};

module.exports = {
  statuses,
  getAllEquipment,
  getDashboardStats,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  addMaintenanceRecord,
  importRows,
  exportWorkbook,
  getAllMaintenance,
  getMaintenanceDashboard,
  getEquipmentMaintenance,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
};

// ============================================================
// FIELD CONFIGURATION MODULE - Admin-controlled schema & mandatory fields
// ============================================================

let nextFieldId = 100;

const CORE_FIELDS = [
  { field_key: 'position_id', label: 'Position ID', field_type: 'text', is_mandatory: true, is_custom: false, locked: true, display_order: 1 },
  { field_key: 'storage_number', label: 'Storage Number', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 2 },
  { field_key: 'epc_po_number', label: 'EPC PO Number', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 3 },
  { field_key: 'sub_po_number', label: 'Sub PO Number', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 4 },
  { field_key: 'sub_po_vendor', label: 'Sub PO Vendor', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 5 },
  { field_key: 'npcil_spec_number', label: 'NPCIL Spec Number', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 6 },
  { field_key: 'npcil_spec_status', label: 'NPCIL Spec Status', field_type: 'select', options: ['Spec Not Issued', 'Spec Issued'], is_mandatory: false, is_custom: false, locked: false, display_order: 7 },
  { field_key: 'drawing_number', label: 'Drawing Number', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 8 },
  { field_key: 'drawing_status', label: 'Drawing Status', field_type: 'select', options: ['Drawing Not Issued', 'Drawing Issued'], is_mandatory: false, is_custom: false, locked: false, display_order: 9 },
  { field_key: 'data_sheet_number', label: 'Data Sheet Number', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 10 },
  { field_key: 'data_sheet_status', label: 'Data Sheet Status', field_type: 'select', options: ['Drawing Not Issued', 'Drawing Issued'], is_mandatory: false, is_custom: false, locked: false, display_order: 11 },
  { field_key: 'as_built_drawing_number', label: 'As-Built Drawing Number', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 12 },
  { field_key: 'epc_package_name', label: 'EPC Package Name', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 13 },
  { field_key: 'location', label: 'Location', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 14 },
  { field_key: 'equipment_type', label: 'Equipment Type', field_type: 'text', is_mandatory: false, is_custom: false, locked: false, display_order: 15 },
  { field_key: 'last_inspection_date', label: 'Last Inspection Date', field_type: 'date', is_mandatory: false, is_custom: false, locked: false, display_order: 16 },
  { field_key: 'next_inspection_date', label: 'Next Inspection Date', field_type: 'date', is_mandatory: false, is_custom: false, locked: false, display_order: 17 },
];

const fieldConfigs = CORE_FIELDS.map((f, i) => ({ id: i + 1, created_at: now(), updated_at: now(), ...f }));

const slugifyFieldKey = (label) =>
  String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const getFieldConfigs = () => [...fieldConfigs].sort((a, b) => a.display_order - b.display_order);

const getFieldConfigByKey = (key) => fieldConfigs.find((f) => f.field_key === key);

const getMandatoryFieldKeys = () => fieldConfigs.filter((f) => f.is_mandatory).map((f) => f.field_key);

const updateFieldConfig = (key, data = {}) => {
  const field = getFieldConfigByKey(key);
  if (!field) return null;
  const patch = { ...data };
  if (field.locked && patch.is_mandatory === false) delete patch.is_mandatory; // can't make the key field optional
  delete patch.field_key; // immutable
  delete patch.is_custom;
  delete patch.locked;
  Object.assign(field, patch, { updated_at: now() });
  return field;
};

// Admin adds a new column. In the real SQL-backed deployment this triggers an
// ALTER TABLE Equipment ADD [field_key] ...; here (dev fallback) we register the
// field in the schema and backfill every existing equipment row with a default value
// so the "table" (our in-memory rows) is consistently shaped going forward.
const addCustomField = ({ label, field_type, is_mandatory, options, default_value }) => {
  if (!label || !String(label).trim()) throw new Error('Field label is required');
  const field_key = slugifyFieldKey(label);
  if (!field_key) throw new Error('Could not derive a valid field key from that label');
  if (getFieldConfigByKey(field_key)) throw new Error(`A field with key "${field_key}" already exists`);

  const field = {
    id: nextFieldId++,
    field_key,
    label: String(label).trim(),
    field_type: ['text', 'number', 'date', 'select'].includes(field_type) ? field_type : 'text',
    is_mandatory: !!is_mandatory,
    is_custom: true,
    locked: false,
    options: field_type === 'select' ? (Array.isArray(options) ? options : []) : undefined,
    display_order: fieldConfigs.length + 1,
    created_at: now(),
    updated_at: now(),
  };
  fieldConfigs.push(field);

  // Backfill: every existing row in the "table" now gets this column
  const fallback = default_value !== undefined ? default_value : null;
  equipment.forEach((item) => { if (!(field_key in item)) item[field_key] = fallback; });

  return field;
};

// Admin removes a custom column (mirrors ALTER TABLE ... DROP COLUMN in SQL mode)
const deleteCustomField = (key) => {
  const idx = fieldConfigs.findIndex((f) => f.field_key === key && f.is_custom);
  if (idx === -1) return false;
  fieldConfigs.splice(idx, 1);
  equipment.forEach((item) => { delete item[key]; });
  return true;
};

module.exports = {
  ...module.exports,
  getFieldConfigs,
  getFieldConfigByKey,
  getMandatoryFieldKeys,
  updateFieldConfig,
  addCustomField,
  deleteCustomField,
};

// ============================================================
// AUTH MODULE - Users & Activity Logs (dev fallback store)
// ============================================================

const bcrypt = require('bcryptjs');

let nextUserId = 3;
let nextLogId = 1;

// Passwords hashed once at module load: admin/Admin@123, viewer/Viewer@123
const users = [
  {
    id: 1, username: 'admin', full_name: 'System Administrator', email: 'admin@cadmatic-ems.local',
    password_hash: bcrypt.hashSync('Admin@123', 10), role: 'Admin', status: 'Active',
    last_login: null, created_at: now(), updated_at: now(),
  },
  {
    id: 2, username: 'viewer', full_name: 'Demo Viewer', email: 'viewer@cadmatic-ems.local',
    password_hash: bcrypt.hashSync('Viewer@123', 10), role: 'Viewer', status: 'Active',
    last_login: null, created_at: now(), updated_at: now(),
  },
];

const activityLogs = [];

const sanitizeUser = (u) => {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
};

const findUserByUsername = (username) => users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
const findUserById = (id) => users.find(u => u.id === Number(id));

const getAllUsers = () => users.map(sanitizeUser).sort((a, b) => a.id - b.id);

const createUser = ({ username, full_name, email, password_hash, role, status }) => {
  const id = nextUserId++;
  const user = {
    id, username, full_name, email: email || null, password_hash,
    role: role || 'Viewer', status: status || 'Active',
    last_login: null, created_at: now(), updated_at: now(),
  };
  users.push(user);
  return sanitizeUser(user);
};

const updateUser = (id, data) => {
  const idx = users.findIndex(u => u.id === Number(id));
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...data, updated_at: now() };
  return sanitizeUser(users[idx]);
};

const deleteUser = (id) => {
  const idx = users.findIndex(u => u.id === Number(id));
  if (idx === -1) return false;
  users.splice(idx, 1);
  return true;
};

const touchLastLogin = (id) => {
  const idx = users.findIndex(u => u.id === Number(id));
  if (idx === -1) return;
  users[idx].last_login = now();
};

const createActivityLog = ({ user_id, username, action, entity_type, entity_id, details, ip_address }) => {
  const id = nextLogId++;
  const log = {
    id, user_id: user_id || null, username: username || 'system', action,
    entity_type: entity_type || null, entity_id: entity_id != null ? String(entity_id) : null,
    details: details || null, ip_address: ip_address || null, created_at: now(),
  };
  activityLogs.unshift(log); // reverse chronological
  return log;
};

const getActivityLogs = ({ limit = 100, action, username } = {}) => {
  let logs = [...activityLogs];
  if (action) logs = logs.filter(l => l.action === action);
  if (username) logs = logs.filter(l => l.username?.toLowerCase().includes(String(username).toLowerCase()));
  return logs.slice(0, Number(limit) || 100);
};

module.exports = {
  ...module.exports,
  findUserByUsername,
  findUserById,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  touchLastLogin,
  sanitizeUser,
  createActivityLog,
  getActivityLogs,
};
