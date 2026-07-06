import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Search, LogIn, LogOut, PlusCircle, Pencil, Trash2, Upload,
  UserPlus, UserCog, UserX, Power, Activity as ActivityIcon
} from 'lucide-react';
import Topbar from '../components/Topbar';
import { authAPI } from '../services/api';

const ACTION_CFG = {
  'User Login':          { icon: LogIn, color: 'var(--success)', bg: 'rgba(23,131,59,0.1)' },
  'User Logout':         { icon: LogOut, color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' },
  'Equipment Created':   { icon: PlusCircle, color: 'var(--info)', bg: 'rgba(0,123,138,0.1)' },
  'Equipment Updated':   { icon: Pencil, color: '#7c3aed', bg: 'rgba(124,58,222,0.1)' },
  'Equipment Deleted':   { icon: Trash2, color: 'var(--danger)', bg: 'rgba(217,48,37,0.1)' },
  'Maintenance Created': { icon: PlusCircle, color: 'var(--info)', bg: 'rgba(0,123,138,0.1)' },
  'Maintenance Updated': { icon: Pencil, color: '#7c3aed', bg: 'rgba(124,58,222,0.1)' },
  'Maintenance Deleted': { icon: Trash2, color: 'var(--danger)', bg: 'rgba(217,48,37,0.1)' },
  'Document Uploaded':   { icon: Upload, color: 'var(--accent-primary-dark)', bg: 'rgba(255,119,0,0.1)' },
  'User Created':        { icon: UserPlus, color: 'var(--success)', bg: 'rgba(23,131,59,0.1)' },
  'User Updated':        { icon: UserCog, color: '#7c3aed', bg: 'rgba(124,58,222,0.1)' },
  'User Deleted':        { icon: UserX, color: 'var(--danger)', bg: 'rgba(217,48,37,0.1)' },
  'User Activated':      { icon: Power, color: 'var(--success)', bg: 'rgba(23,131,59,0.1)' },
  'User Deactivated':    { icon: Power, color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' },
};
const DEFAULT_CFG = { icon: ActivityIcon, color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' };

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const res = await authAPI.getActivityLogs({ limit: 200 });
      setLogs(res.data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionTypes = [...new Set(logs.map(l => l.action))].sort();

  const filtered = logs.filter(l => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      return (l.username || '').toLowerCase().includes(term) ||
        (l.details || '').toLowerCase().includes(term) ||
        (l.action || '').toLowerCase().includes(term);
    }
    return true;
  });

  if (loading) return (
    <>
      <Topbar title="Activity Logs" subtitle="Admin Panel" onRefresh={() => {}} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /></div></div>
    </>
  );

  return (
    <>
      <Topbar title="Activity Logs" subtitle="Audit trail of important system actions" onRefresh={() => fetchLogs(true)} refreshing={refreshing} />
      <div className="page-content">

        <div className="filters-row mb-6">
          <div className="search-box" style={{ flex: 2 }}>
            <Search size={15} />
            <input className="form-control" placeholder="Search by user, action, or details..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ maxWidth: 220 }} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          {filtered.length} log entr{filtered.length !== 1 ? 'ies' : 'y'} (most recent first)
        </div>

        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <ActivityIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p className="text-muted">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <ul style={{ margin: 0, padding: 0 }}>
              {filtered.map((log) => {
                const cfg = ACTION_CFG[log.action] || DEFAULT_CFG;
                const Icon = cfg.icon;
                return (
                  <li key={log.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                      background: cfg.bg, border: `1px solid ${cfg.color}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={14} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{log.action}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>by <strong>{log.username || 'system'}</strong></span>
                      </div>
                      {log.details && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.details}</div>}
                      {log.ip_address && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>IP: {log.ip_address}</div>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
