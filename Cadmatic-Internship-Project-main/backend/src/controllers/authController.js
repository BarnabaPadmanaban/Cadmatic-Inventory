const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/database');
const devStore = require('../devStore');
const env = require('../config/env');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

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

const sanitize = (u) => {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
};

const signToken = (user) => jwt.sign(
  { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
  env.JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);

const getClientIp = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;

const logActivity = async (pool, { user_id, username, action, entity_type, entity_id, details, ip_address }) => {
  try {
    if (pool) {
      await pool.request()
        .input('user_id', sql.Int, user_id || null)
        .input('username', sql.NVarChar, username || 'system')
        .input('action', sql.NVarChar, action)
        .input('entity_type', sql.NVarChar, entity_type || null)
        .input('entity_id', sql.NVarChar, entity_id != null ? String(entity_id) : null)
        .input('details', sql.NVarChar, details || null)
        .input('ip_address', sql.NVarChar, ip_address || null)
        .query(`
          INSERT INTO ActivityLogs (user_id, username, action, entity_type, entity_id, details, ip_address)
          VALUES (@user_id, @username, @action, @entity_type, @entity_id, @details, @ip_address)
        `);
    } else {
      devStore.createActivityLog({ user_id, username, action, entity_type, entity_id, details, ip_address });
    }
  } catch (err) {
    console.warn('Failed to record activity log:', err.message);
  }
};

// Exported so other controllers (equipment, maintenance) can log activity consistently
exports.logActivity = async (req, { action, entity_type, entity_id, details }) => {
  let pool = null;
  try { pool = await getPool(); } catch { pool = null; }
  await logActivity(pool, {
    user_id: req.user?.id,
    username: req.user?.username,
    action,
    entity_type,
    entity_id,
    details,
    ip_address: getClientIp(req),
  });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM Users WHERE username = @username');

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    if (user.status !== 'Active') return res.status(403).json({ success: false, message: 'This account has been deactivated. Contact an administrator.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid username or password.' });

    await pool.request().input('id', sql.Int, user.id).query('UPDATE Users SET last_login = GETDATE() WHERE id = @id');
    await logActivity(pool, { user_id: user.id, username: user.username, action: 'User Login', entity_type: 'User', entity_id: user.id, ip_address: getClientIp(req) });

    const token = signToken(user);
    res.json({ success: true, message: 'Login successful', token, user: sanitize(user) });
  } catch (err) {
    return handleDbError(res, err, async () => {
      const user = devStore.findUserByUsername(username);
      if (!user) return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      if (user.status !== 'Active') return res.status(403).json({ success: false, message: 'This account has been deactivated. Contact an administrator.' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ success: false, message: 'Invalid username or password.' });

      devStore.touchLastLogin(user.id);
      devStore.createActivityLog({ user_id: user.id, username: user.username, action: 'User Login', entity_type: 'User', entity_id: user.id, ip_address: getClientIp(req) });

      const token = signToken(user);
      res.json({ success: true, message: 'Login successful', token, user: sanitize(user) });
    });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    let pool = null;
    try { pool = await getPool(); } catch { pool = null; }
    await logActivity(pool, { user_id: req.user?.id, username: req.user?.username, action: 'User Logout', entity_type: 'User', entity_id: req.user?.id, ip_address: getClientIp(req) });
  } catch (err) {
    console.warn('Logout activity log failed:', err.message);
  }
  // JWTs are stateless; client discards the token. Server just acknowledges + logs the event.
  res.json({ success: true, message: 'Logged out successfully' });
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.Int, req.user.id).query('SELECT * FROM Users WHERE id = @id');
    const user = result.recordset[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: sanitize(user) });
  } catch (err) {
    return handleDbError(res, err, () => {
      const user = devStore.findUserById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: devStore.sanitizeUser(user) });
    });
  }
};

// ─── User Management (Admin only) ──────────────────────────────

// GET /api/auth/users
exports.getAllUsers = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Users ORDER BY created_at DESC');
    res.json({ success: true, data: result.recordset.map(sanitize) });
  } catch (err) {
    return handleDbError(res, err, () => {
      res.json({ success: true, data: devStore.getAllUsers() });
    });
  }
};

// POST /api/auth/users
exports.createUser = async (req, res) => {
  const { username, full_name, email, password, role, status } = req.body;
  if (!username || !full_name || !password) {
    return res.status(400).json({ success: false, message: 'Username, full name, and password are required.' });
  }
  if (!['Admin', 'Viewer'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be Admin or Viewer.' });
  }

  try {
    const pool = await getPool();
    const existing = await pool.request().input('u', sql.NVarChar, username).query('SELECT id FROM Users WHERE username = @u');
    if (existing.recordset.length) return res.status(409).json({ success: false, message: 'Username already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('full_name', sql.NVarChar, full_name)
      .input('email', sql.NVarChar, email || null)
      .input('password_hash', sql.NVarChar, hash)
      .input('role', sql.NVarChar, role)
      .input('status', sql.NVarChar, status || 'Active')
      .query(`
        INSERT INTO Users (username, full_name, email, password_hash, role, status)
        OUTPUT INSERTED.*
        VALUES (@username, @full_name, @email, @password_hash, @role, @status)
      `);

    await logActivity(pool, { user_id: req.user.id, username: req.user.username, action: 'User Created', entity_type: 'User', entity_id: result.recordset[0].id, details: `Created user "${username}" with role ${role}`, ip_address: getClientIp(req) });

    res.status(201).json({ success: true, message: 'User created successfully', data: sanitize(result.recordset[0]) });
  } catch (err) {
    return handleDbError(res, err, async () => {
      if (devStore.findUserByUsername(username)) return res.status(409).json({ success: false, message: 'Username already exists.' });
      const hash = await bcrypt.hash(password, 10);
      const user = devStore.createUser({ username, full_name, email, password_hash: hash, role, status });
      devStore.createActivityLog({ user_id: req.user.id, username: req.user.username, action: 'User Created', entity_type: 'User', entity_id: user.id, details: `Created user "${username}" with role ${role}`, ip_address: getClientIp(req) });
      res.status(201).json({ success: true, message: 'User created successfully', data: user });
    });
  }
};

// PUT /api/auth/users/:id
exports.updateUser = async (req, res) => {
  const { full_name, email, role, status, password } = req.body;
  const id = req.params.id;

  if (role && !['Admin', 'Viewer'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be Admin or Viewer.' });
  }

  try {
    const pool = await getPool();
    const existing = await pool.request().input('id', sql.Int, id).query('SELECT * FROM Users WHERE id = @id');
    if (!existing.recordset.length) return res.status(404).json({ success: false, message: 'User not found.' });

    let passwordClause = '';
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('full_name', sql.NVarChar, full_name ?? existing.recordset[0].full_name)
      .input('email', sql.NVarChar, email ?? existing.recordset[0].email)
      .input('role', sql.NVarChar, role ?? existing.recordset[0].role)
      .input('status', sql.NVarChar, status ?? existing.recordset[0].status);

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      request.input('password_hash', sql.NVarChar, hash);
      passwordClause = ', password_hash = @password_hash';
    }

    await request.query(`
      UPDATE Users SET full_name = @full_name, email = @email, role = @role, status = @status, updated_at = GETDATE() ${passwordClause}
      WHERE id = @id
    `);

    await logActivity(pool, { user_id: req.user.id, username: req.user.username, action: 'User Updated', entity_type: 'User', entity_id: id, details: `Updated user "${existing.recordset[0].username}"`, ip_address: getClientIp(req) });

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    return handleDbError(res, err, () => {
      const existing = devStore.findUserById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });
      const updateData = { full_name, email, role, status };
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
      if (password) updateData.password_hash = bcrypt.hashSync(password, 10);
      devStore.updateUser(id, updateData);
      devStore.createActivityLog({ user_id: req.user.id, username: req.user.username, action: 'User Updated', entity_type: 'User', entity_id: id, details: `Updated user "${existing.username}"`, ip_address: getClientIp(req) });
      res.json({ success: true, message: 'User updated successfully' });
    });
  }
};

// PATCH /api/auth/users/:id/status — quick activate/deactivate
exports.setUserStatus = async (req, res) => {
  const { status } = req.body;
  const id = req.params.id;
  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be Active or Inactive.' });
  }
  if (Number(id) === req.user.id && status === 'Inactive') {
    return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
  }

  try {
    const pool = await getPool();
    const existing = await pool.request().input('id', sql.Int, id).query('SELECT username FROM Users WHERE id = @id');
    if (!existing.recordset.length) return res.status(404).json({ success: false, message: 'User not found.' });

    await pool.request().input('id', sql.Int, id).input('status', sql.NVarChar, status)
      .query('UPDATE Users SET status = @status, updated_at = GETDATE() WHERE id = @id');

    await logActivity(pool, { user_id: req.user.id, username: req.user.username, action: status === 'Active' ? 'User Activated' : 'User Deactivated', entity_type: 'User', entity_id: id, details: `${status === 'Active' ? 'Activated' : 'Deactivated'} user "${existing.recordset[0].username}"`, ip_address: getClientIp(req) });

    res.json({ success: true, message: `User ${status === 'Active' ? 'activated' : 'deactivated'} successfully` });
  } catch (err) {
    return handleDbError(res, err, () => {
      const existing = devStore.findUserById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });
      devStore.updateUser(id, { status });
      devStore.createActivityLog({ user_id: req.user.id, username: req.user.username, action: status === 'Active' ? 'User Activated' : 'User Deactivated', entity_type: 'User', entity_id: id, details: `${status === 'Active' ? 'Activated' : 'Deactivated'} user "${existing.username}"`, ip_address: getClientIp(req) });
      res.json({ success: true, message: `User ${status === 'Active' ? 'activated' : 'deactivated'} successfully` });
    });
  }
};

// DELETE /api/auth/users/:id
exports.deleteUser = async (req, res) => {
  const id = req.params.id;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }

  try {
    const pool = await getPool();
    const existing = await pool.request().input('id', sql.Int, id).query('SELECT username FROM Users WHERE id = @id');
    if (!existing.recordset.length) return res.status(404).json({ success: false, message: 'User not found.' });

    await pool.request().input('id', sql.Int, id).query('DELETE FROM Users WHERE id = @id');

    await logActivity(pool, { user_id: req.user.id, username: req.user.username, action: 'User Deleted', entity_type: 'User', entity_id: id, details: `Deleted user "${existing.recordset[0].username}"`, ip_address: getClientIp(req) });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    return handleDbError(res, err, () => {
      const existing = devStore.findUserById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });
      devStore.deleteUser(id);
      devStore.createActivityLog({ user_id: req.user.id, username: req.user.username, action: 'User Deleted', entity_type: 'User', entity_id: id, details: `Deleted user "${existing.username}"`, ip_address: getClientIp(req) });
      res.json({ success: true, message: 'User deleted successfully' });
    });
  }
};

// ─── Activity Logs ──────────────────────────────────────────────

// GET /api/auth/activity-logs
exports.getActivityLogs = async (req, res) => {
  const { limit = 100, action, username } = req.query;
  try {
    const pool = await getPool();
    let whereClause = 'WHERE 1=1';
    const request = pool.request();
    if (action) { whereClause += ' AND action = @action'; request.input('action', sql.NVarChar, action); }
    if (username) { whereClause += ' AND username LIKE @username'; request.input('username', sql.NVarChar, `%${username}%`); }
    request.input('limit', sql.Int, parseInt(limit) || 100);

    const result = await request.query(`
      SELECT TOP (@limit) * FROM ActivityLogs ${whereClause} ORDER BY created_at DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    return handleDbError(res, err, () => {
      res.json({ success: true, data: devStore.getActivityLogs({ limit, action, username }) });
    });
  }
};
