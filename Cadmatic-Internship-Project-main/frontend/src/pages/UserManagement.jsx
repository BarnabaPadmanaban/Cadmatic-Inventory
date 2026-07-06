import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Power, Trash2, Search, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import Topbar from '../components/Topbar';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROLE_CFG = {
  Admin:  { color: 'var(--accent-primary-dark)', bg: 'rgba(255,119,0,0.12)' },
  Viewer: { color: 'var(--info)', bg: 'rgba(0,123,138,0.1)' },
};
const STATUS_CFG = {
  Active:   { color: 'var(--success)', bg: 'rgba(23,131,59,0.1)' },
  Inactive: { color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' },
};

const EMPTY_FORM = { username: '', full_name: '', email: '', password: '', role: 'Viewer', status: 'Active' };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const res = await authAPI.getUsers();
      setUsers(res.data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditUser(null); setShowModal(true); };
  const openEdit = (u) => {
    setForm({ username: u.username, full_name: u.full_name, email: u.email || '', password: '', role: u.role, status: u.status });
    setEditUser(u);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.full_name.trim()) {
      toast.error('Username and full name are required'); return;
    }
    if (!editUser && !form.password) {
      toast.error('Password is required for new users'); return;
    }
    setSaving(true);
    try {
      if (editUser) {
        const payload = { full_name: form.full_name, email: form.email, role: form.role, status: form.status };
        if (form.password) payload.password = form.password;
        await authAPI.updateUser(editUser.id, payload);
        toast.success('User updated successfully');
      } else {
        await authAPI.createUser(form);
        toast.success('User created successfully');
      }
      setShowModal(false);
      fetchUsers(true);
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    if (u.id === currentUser.id && newStatus === 'Inactive') {
      toast.error('You cannot deactivate your own account'); return;
    }
    try {
      await authAPI.setUserStatus(u.id, newStatus);
      toast.success(`User ${newStatus === 'Active' ? 'activated' : 'deactivated'}`);
      fetchUsers(true);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser.id) { toast.error('You cannot delete your own account'); return; }
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try {
      await authAPI.deleteUser(u.id);
      toast.success('User deleted');
      fetchUsers(true);
    } catch (err) { toast.error(err.message); }
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const term = search.toLowerCase();
    return u.username.toLowerCase().includes(term) || u.full_name.toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term);
  });

  if (loading) return (
    <>
      <Topbar title="User Management" subtitle="Admin Panel" onRefresh={() => {}} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /></div></div>
    </>
  );

  return (
    <>
      <Topbar title="User Management" subtitle="Create, edit, and manage system users" onRefresh={() => fetchUsers(true)} refreshing={refreshing} />
      <div className="page-content">

        <div className="flex items-center justify-between mb-6">
          <div className="search-box" style={{ maxWidth: 320 }}>
            <Search size={15} />
            <input className="form-control" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Add User
          </button>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          {[
            { label: 'Total Users', value: users.length, color: 'var(--accent-primary)' },
            { label: 'Admins', value: users.filter(u => u.role === 'Admin').length, color: 'var(--accent-primary-dark)' },
            { label: 'Active Accounts', value: users.filter(u => u.status === 'Active').length, color: 'var(--success)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card" style={{ '--accent-color': color }}>
              <div className="stat-card-value">{value}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Username</th><th>Full Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const roleCfg = ROLE_CFG[u.role] || ROLE_CFG.Viewer;
                  const statusCfg = STATUS_CFG[u.status] || STATUS_CFG.Inactive;
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'Space Grotesk, monospace', fontWeight: 700 }}>
                        {u.username}{isSelf && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(you)</span>}
                      </td>
                      <td>{u.full_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: roleCfg.color, background: roleCfg.bg, border: `1px solid ${roleCfg.color}33` }}>
                          {u.role === 'Admin' && <ShieldCheck size={10} />} {u.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.color}33` }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} title="Edit" onClick={() => openEdit(u)}>
                            <Pencil size={12} />
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} title={u.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(u)} disabled={isSelf}>
                            <Power size={12} />
                          </button>
                          <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} title="Delete" onClick={() => handleDelete(u)} disabled={isSelf}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editUser ? '✏️ Edit User' : '➕ Create New User'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Username {editUser && '(read-only)'}</label>
                <input className="form-control" value={form.username} disabled={!!editUser}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. jdoe" />
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Jane Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. jane@company.com" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="Viewer">Viewer</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{editUser ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ paddingRight: 38 }}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editUser ? '••••••••' : 'Set a strong password'}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
