const { sql, getPool } = require('../config/database');

const createTables = async () => {
  const pool = await getPool();

  // Create Equipment table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Equipment' AND xtype='U')
    CREATE TABLE Equipment (
      id INT IDENTITY(1,1) PRIMARY KEY,
      position_id NVARCHAR(50) NOT NULL,
      storage_number NVARCHAR(50),
      epc_po_number NVARCHAR(100),
      sub_po_number NVARCHAR(100),
      sub_po_vendor NVARCHAR(200),
      equipment_status_code INT DEFAULT 0,
      npcil_spec_number NVARCHAR(100),
      npcil_spec_status NVARCHAR(100),
      drawing_number NVARCHAR(100),
      drawing_status NVARCHAR(100),
      data_sheet_number NVARCHAR(100),
      data_sheet_status NVARCHAR(100),
      as_built_drawing_number NVARCHAR(100),
      epc_package_name NVARCHAR(100),
      equip_status NVARCHAR(100),
      location NVARCHAR(200),
      equipment_type NVARCHAR(100),
      last_inspection_date DATE,
      next_inspection_date DATE,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE(),
      created_by NVARCHAR(100) DEFAULT 'system',
      is_active BIT DEFAULT 1
    )
  `);

  // Position ID is the business identifier and must never be duplicated.
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Equipment_PositionId' AND object_id = OBJECT_ID('Equipment'))
      CREATE UNIQUE INDEX UX_Equipment_PositionId ON Equipment(position_id)
  `);

  // Create MaintenanceRecords table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MaintenanceRecords' AND xtype='U')
    CREATE TABLE MaintenanceRecords (
      id INT IDENTITY(1,1) PRIMARY KEY,
      equipment_id INT NOT NULL,
      maintenance_type NVARCHAR(100) NOT NULL,
      priority NVARCHAR(50) DEFAULT 'Medium',
      description NVARCHAR(MAX),
      engineer_name NVARCHAR(200),
      performed_by NVARCHAR(200),
      maintenance_date DATETIME2 DEFAULT GETDATE(),
      scheduled_date DATE,
      completion_date DATE,
      next_maintenance_date DATE,
      status NVARCHAR(50) DEFAULT 'Scheduled',
      remarks NVARCHAR(MAX),
      created_at DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (equipment_id) REFERENCES Equipment(id)
    )
  `);

  // Add new columns to existing MaintenanceRecords if they don't exist
  const maintCols = ['priority', 'engineer_name', 'scheduled_date', 'completion_date'];
  for (const col of maintCols) {
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='MaintenanceRecords' AND COLUMN_NAME='${col}')
        ALTER TABLE MaintenanceRecords ADD ${col} NVARCHAR(200)
      `);
    } catch (e) { /* column may already exist */ }
  }

  // Create MaintenanceDocuments table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MaintenanceDocuments' AND xtype='U')
    CREATE TABLE MaintenanceDocuments (
      id INT IDENTITY(1,1) PRIMARY KEY,
      maintenance_id INT,
      filename NVARCHAR(500) NOT NULL,
      original_name NVARCHAR(500),
      doc_type NVARCHAR(100) DEFAULT 'Other',
      uploaded_at DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (maintenance_id) REFERENCES MaintenanceRecords(id)
    )
  `);

  // Create StatusLookup table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StatusLookup' AND xtype='U')
    CREATE TABLE StatusLookup (
      id INT IDENTITY(1,1) PRIMARY KEY,
      status_code INT NOT NULL UNIQUE,
      status_name NVARCHAR(100) NOT NULL,
      status_color NVARCHAR(20),
      description NVARCHAR(200)
    )
  `);

  // Create AuditLog table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AuditLog' AND xtype='U')
    CREATE TABLE AuditLog (
      id INT IDENTITY(1,1) PRIMARY KEY,
      table_name NVARCHAR(100),
      record_id INT,
      action NVARCHAR(20),
      old_value NVARCHAR(MAX),
      new_value NVARCHAR(MAX),
      performed_by NVARCHAR(100),
      performed_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  // Seed StatusLookup
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM StatusLookup)
    BEGIN
      INSERT INTO StatusLookup (status_code, status_name, status_color, description) VALUES
      (0, 'Order Not Yet Placed', '#94a3b8', 'Purchase order has not been placed'),
      (1, 'Order Placed', '#3b82f6', 'Purchase order placed with vendor'),
      (2, 'Shipping Release Issued', '#8b5cf6', 'Shipping release has been issued'),
      (3, 'Received at Site', '#f59e0b', 'Equipment received at plant site'),
      (4, 'Erected at Location', '#06b6d4', 'Equipment installed at designated location'),
      (5, 'Hydro Tested', '#10b981', 'Hydraulic testing completed'),
      (6, 'CCC/STD Released', '#84cc16', 'Construction completion certificate released'),
      (7, 'Handover to O&M', '#f97316', 'Equipment handed over to Operations & Maintenance'),
      (8, 'Commissioned', '#22c55e', 'Equipment fully commissioned and operational')
    END
  `);

  // Create FieldConfig table — drives admin-managed mandatory fields & dynamic custom columns
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='FieldConfig' AND xtype='U')
    CREATE TABLE FieldConfig (
      id INT IDENTITY(1,1) PRIMARY KEY,
      field_key NVARCHAR(100) NOT NULL UNIQUE,
      label NVARCHAR(200) NOT NULL,
      field_type NVARCHAR(20) NOT NULL DEFAULT 'text',
      is_mandatory BIT NOT NULL DEFAULT 0,
      is_custom BIT NOT NULL DEFAULT 0,
      locked BIT NOT NULL DEFAULT 0,
      options NVARCHAR(MAX),
      display_order INT DEFAULT 0,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  // Seed FieldConfig with the core Equipment columns (Position ID is locked + mandatory)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM FieldConfig)
    BEGIN
      INSERT INTO FieldConfig (field_key, label, field_type, is_mandatory, is_custom, locked, options, display_order) VALUES
      ('position_id', 'Position ID', 'text', 1, 0, 1, NULL, 1),
      ('storage_number', 'Storage Number', 'text', 0, 0, 0, NULL, 2),
      ('epc_po_number', 'EPC PO Number', 'text', 0, 0, 0, NULL, 3),
      ('sub_po_number', 'Sub PO Number', 'text', 0, 0, 0, NULL, 4),
      ('sub_po_vendor', 'Sub PO Vendor', 'text', 0, 0, 0, NULL, 5),
      ('npcil_spec_number', 'NPCIL Spec Number', 'text', 0, 0, 0, NULL, 6),
      ('npcil_spec_status', 'NPCIL Spec Status', 'select', 0, 0, 0, '["Spec Not Issued","Spec Issued"]', 7),
      ('drawing_number', 'Drawing Number', 'text', 0, 0, 0, NULL, 8),
      ('drawing_status', 'Drawing Status', 'select', 0, 0, 0, '["Drawing Not Issued","Drawing Issued"]', 9),
      ('data_sheet_number', 'Data Sheet Number', 'text', 0, 0, 0, NULL, 10),
      ('data_sheet_status', 'Data Sheet Status', 'select', 0, 0, 0, '["Drawing Not Issued","Drawing Issued"]', 11),
      ('as_built_drawing_number', 'As-Built Drawing Number', 'text', 0, 0, 0, NULL, 12),
      ('epc_package_name', 'EPC Package Name', 'text', 0, 0, 0, NULL, 13),
      ('location', 'Location', 'text', 0, 0, 0, NULL, 14),
      ('equipment_type', 'Equipment Type', 'text', 0, 0, 0, NULL, 15),
      ('last_inspection_date', 'Last Inspection Date', 'date', 0, 0, 0, NULL, 16),
      ('next_inspection_date', 'Next Inspection Date', 'date', 0, 0, 0, NULL, 17)
    END
  `);

  // Create Users table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
    CREATE TABLE Users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      username NVARCHAR(100) NOT NULL UNIQUE,
      full_name NVARCHAR(200) NOT NULL,
      email NVARCHAR(200),
      password_hash NVARCHAR(255) NOT NULL,
      role NVARCHAR(20) NOT NULL DEFAULT 'Viewer',
      status NVARCHAR(20) NOT NULL DEFAULT 'Active',
      last_login DATETIME2,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  // Create ActivityLogs table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ActivityLogs' AND xtype='U')
    CREATE TABLE ActivityLogs (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT,
      username NVARCHAR(100),
      action NVARCHAR(100) NOT NULL,
      entity_type NVARCHAR(100),
      entity_id NVARCHAR(100),
      details NVARCHAR(MAX),
      ip_address NVARCHAR(50),
      created_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  // Seed default admin user if Users table is empty (password hashed at runtime, not hardcoded)
  const adminCheck = await pool.request().query('SELECT COUNT(*) AS count FROM Users');
  if (adminCheck.recordset[0].count === 0) {
    const bcrypt = require('bcryptjs');
    const defaultHash = await bcrypt.hash('Admin@123', 10);
    await pool.request()
      .input('hash', sql.NVarChar, defaultHash)
      .query(`
        INSERT INTO Users (username, full_name, email, password_hash, role, status)
        VALUES ('admin', 'System Administrator', 'admin@cadmatic-ems.local', @hash, 'Admin', 'Active')
      `);
    console.log('✅ Default admin user created (username: admin / password: Admin@123) — please change this password after first login.');
  }

  // Ensure the viewer demo account exists even when the Users table already has an admin.
  const viewerCheck = await pool.request()
    .input('username', sql.NVarChar, 'viewer')
    .query('SELECT id FROM Users WHERE username = @username');

  if (viewerCheck.recordset.length === 0) {
    const bcrypt = require('bcryptjs');
    const viewerHash = await bcrypt.hash('Viewer@123', 10);
    await pool.request()
      .input('hash', sql.NVarChar, viewerHash)
      .query(`
        INSERT INTO Users (username, full_name, email, password_hash, role, status)
        VALUES ('viewer', 'Demo Viewer', 'viewer@cadmatic-ems.local', @hash, 'Viewer', 'Active')
      `);
    console.log('✅ Default viewer user created (username: viewer / password: Viewer@123)');
  }

  console.log('✅ Database tables created/verified successfully');
};

const runMigrations = async () => {
  try {
    await createTables();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
};

runMigrations();
