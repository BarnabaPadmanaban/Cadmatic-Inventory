import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wrench, AlertTriangle, CheckCircle, Clock, Calendar, TrendingUp,
  Filter, Search, Plus, RefreshCw, Upload, X, ChevronDown, ChevronUp,
  AlertCircle, Shield, Zap, FileText, User, MapPin, Activity, Bell, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import Topbar from '../components/Topbar';
import { maintenanceAPI, equipmentAPI } from '../services/api';
import { formatDate } from '../utils/statusUtils';
import { useAuth } from '../context/AuthContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  Critical: { color: '#d93025', bg: 'rgba(217,48,37,0.1)', icon: Zap },
  High:     { color: '#c77700', bg: 'rgba(199,119,0,0.1)', icon: AlertTriangle },
  Medium:   { color: '#007b8a', bg: 'rgba(0,123,138,0.1)', icon: Activity },
  Low:      { color: '#17833b', bg: 'rgba(23,131,59,0.1)', icon: CheckCircle },
};

const STATUS_CONFIG = {
  Completed:   { color: '#17833b', bg: 'rgba(23,131,59,0.1)' },
  Scheduled:   { color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  Pending:     { color: '#c77700', bg: 'rgba(199,119,0,0.1)' },
  'In Progress': { color: '#7c3aed', bg: 'rgba(124,58,222,0.1)' },
  Cancelled:   { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

const TYPE_COLORS = {
  Preventive:  '#2563eb',
  Corrective:  '#d93025',
  Inspection:  '#007b8a',
  Calibration: '#7c3aed',
  Overhaul:    '#c77700',
  Emergency:   '#d93025',
  Other:       '#64748b',
};

const HEALTH_CONFIG = {
  Excellent: { color: '#17833b', bg: 'rgba(23,131,59,0.1)' },
  Good:      { color: '#5f8f00', bg: 'rgba(95,143,0,0.1)' },
  Warning:   { color: '#c77700', bg: 'rgba(199,119,0,0.1)' },
  Critical:  { color: '#d93025', bg: 'rgba(217,48,37,0.1)' },
};

const PrioBadge = ({ priority }) => {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Medium;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 9px', borderRadius:999,
      fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.color}33` }}>
      {priority}
    </span>
  );
};

const StatusBadgeMaint = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 9px', borderRadius:999,
      fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.color}33` }}>
      {status}
    </span>
  );
};

const HealthBadge = ({ health }) => {
  if (!health) return null;
  const cfg = HEALTH_CONFIG[health.level] || HEALTH_CONFIG.Warning;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:52, height:52, borderRadius:'50%', border:`3px solid ${cfg.color}`,
        display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column',
        background:cfg.bg, flexShrink:0 }}>
        <span style={{ fontSize:14, fontWeight:800, color:cfg.color, lineHeight:1 }}>{health.score}</span>
        <span style={{ fontSize:8, color:cfg.color, fontWeight:700 }}>%</span>
      </div>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:cfg.color }}>{health.level}</div>
        <div style={{ fontSize:10.5, color:'var(--text-muted)' }}>{health.overdueCount} overdue</div>
      </div>
    </div>
  );
};

const isOverdue = (record) =>
  !['Completed','Cancelled'].includes(record.status) &&
  record.scheduled_date && new Date(record.scheduled_date) < new Date(new Date().setHours(0,0,0,0));

const daysDiff = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.round((new Date(dateStr) - new Date()) / 86400000);
  return diff;
};

// ─── Simple chart components (no external lib needed) ────────────────────────

const DonutChart = ({ data, size = 120 }) => {
  if (!data || !data.length) return <div style={{width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',fontSize:12}}>No data</div>;
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return null;
  let offset = 0;
  const r = 45, cx = size/2, cy = size/2;
  const circumference = 2 * Math.PI * r;
  const slices = data.map((d, i) => {
    const pct = d.count / total;
    const len = pct * circumference;
    const gap = 1;
    const slice = { ...d, offset, len: Math.max(len - gap, 0), pct };
    offset += len;
    return slice;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={14} />
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color || Object.values(TYPE_COLORS)[i % Object.keys(TYPE_COLORS).length]}
          strokeWidth={14}
          strokeDasharray={`${s.len} ${circumference - s.len}`}
          strokeDashoffset={circumference * 0.25 - s.offset}
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      ))}
      <text x={cx} y={cy+5} textAnchor="middle" fill="var(--text-primary)" fontSize="15" fontWeight="700">{total}</text>
    </svg>
  );
};

const BarChart = ({ data, height = 100 }) => {
  if (!data || !data.length) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',fontSize:12}}>No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, width:'100%', paddingBottom:24 }}>
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * (height - 30), 4);
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:9.5, color:'var(--text-muted)', fontWeight:700 }}>{d.count}</span>
            <div style={{ width:'100%', height:barH, background:'var(--accent-primary)', borderRadius:'2px 2px 0 0',
              opacity: 0.75 + (i / data.length) * 0.25, transition:'height 0.5s ease' }} />
            <span style={{ fontSize:9, color:'var(--text-muted)', textAlign:'center', lineHeight:1.2 }}>
              {(d.month || d.maintenance_type || '').replace(/\d{4}-/,'')}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  equipment_id: '', maintenance_type: 'Preventive', priority: 'Medium',
  description: '', engineer_name: '', performed_by: '',
  scheduled_date: '', completion_date: '', next_maintenance_date: '',
  status: 'Scheduled', remarks: '',
};

export default function Maintenance() {
  const { isAdmin } = useAuth();
  const [dashboard, setDashboard]   = useState(null);
  const [records, setRecords]       = useState([]);
  const [equipment, setEquipment]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState('dashboard'); // dashboard | records | alerts
  const [showModal, setShowModal]   = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [uploading, setUploading]   = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const maintenanceImportRef = useRef(null);

  const [filters, setFilters] = useState({
    search:'', equipment_id:'', vendor:'', maintenance_type:'',
    priority:'', status:'', date_from:'', date_to:''
  });

  const fetchAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [dashRes, recRes, eqRes] = await Promise.all([
        maintenanceAPI.getDashboard(),
        maintenanceAPI.getAll(filters),
        equipmentAPI.getAll({ limit: 200 }),
      ]);
      setDashboard(dashRes.data.data);
      setRecords(recRes.data.data || []);
      setEquipment(eqRes.data.data || []);
    } catch {
      toast.error('Failed to load maintenance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => { fetchAll(); }, [filters]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditRecord(null); setShowModal(true); };
  const openEdit = (rec) => {
    setForm({
      equipment_id: rec.equipment_id || '',
      maintenance_type: rec.maintenance_type || 'Preventive',
      priority: rec.priority || 'Medium',
      description: rec.description || '',
      engineer_name: rec.engineer_name || '',
      performed_by: rec.performed_by || '',
      scheduled_date: rec.scheduled_date?.split('T')[0] || '',
      completion_date: rec.completion_date?.split('T')[0] || '',
      next_maintenance_date: rec.next_maintenance_date?.split('T')[0] || '',
      status: rec.status || 'Scheduled',
      remarks: rec.remarks || '',
    });
    setEditRecord(rec);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.equipment_id || !form.maintenance_type) {
      toast.error('Equipment and Maintenance Type are required'); return;
    }
    try {
      if (editRecord) {
        await maintenanceAPI.update(editRecord.id, form);
        toast.success('Record updated successfully');
      } else {
        await maintenanceAPI.create(form);
        toast.success('Maintenance record created');
      }
      setShowModal(false);
      fetchAll(true);
    } catch (err) {
      toast.error(err.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this maintenance record?')) return;
    try {
      await maintenanceAPI.delete(id);
      toast.success('Record deleted');
      fetchAll(true);
    } catch { toast.error('Delete failed'); }
  };

  const handleUpload = async (recordId) => {
    if (!uploadFile) { toast.error('Select a file first'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('doc_type', 'Maintenance Report');
    try {
      await maintenanceAPI.uploadDocument(recordId, fd);
      toast.success('Document uploaded');
      setUploadFile(null);
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const handleMaintenanceImport = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const response = await maintenanceAPI.import(formData);
      toast.success(response.data.message);
      fetchAll(true);
    } catch (err) {
      toast.error(err.message || 'Maintenance import failed');
    } finally {
      event.target.value = '';
    }
  };

  const clearFilters = () => setFilters({ search:'', equipment_id:'', vendor:'', maintenance_type:'', priority:'', status:'', date_from:'', date_to:'' });
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const overdue = records.filter(isOverdue);
  const dueSoon = records.filter(r => {
    const d = daysDiff(r.scheduled_date);
    return d !== null && d >= 0 && d <= 7 && !['Completed','Cancelled'].includes(r.status);
  });

  if (loading) return (
    <>
      <Topbar title="Maintenance Module" subtitle="Asset Maintenance Management" onRefresh={() => {}} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /><span className="text-muted">Loading maintenance data...</span></div></div>
    </>
  );

  return (
    <>
      <Topbar
        title="Maintenance Module"
        subtitle="Enterprise Asset Maintenance Management"
        onRefresh={() => fetchAll(true)}
        refreshing={refreshing}
      />
      <div className="page-content">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {['dashboard','records','alerts'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform:'capitalize' }}>
                {tab === 'alerts' ? `Alerts${overdue.length + dueSoon.length > 0 ? ` (${overdue.length + dueSoon.length})` : ''}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => maintenanceAPI.export().catch((err) => toast.error(err.message))}>
              <Download size={14} /> Export Excel
            </button>
            {isAdmin && (
              <>
                <input ref={maintenanceImportRef} type="file" accept=".xlsx,.xls" hidden onChange={handleMaintenanceImport} />
                <button className="btn btn-secondary btn-sm" onClick={() => maintenanceImportRef.current?.click()}>
                  <Upload size={14} /> Import Excel
                </button>
                <button className="btn btn-primary btn-sm" onClick={openCreate}>
                  <Plus size={14} /> Add Maintenance
                </button>
              </>
            )}
          </div>
        </div>

        {/* ═══════════════════ DASHBOARD TAB ═══════════════════ */}
        {activeTab === 'dashboard' && dashboard && (
          <>
            {/* Stats Grid */}
            <div className="stats-grid" style={{ gridTemplateColumns:'repeat(5, 1fr)', marginBottom:24 }}>
              {[
                { label:'Total Records', value:dashboard.stats?.total, color:'var(--accent-primary)', icon:Wrench, iconBg:'rgba(255,119,0,0.12)' },
                { label:'Scheduled', value:dashboard.stats?.scheduled, color:'#2563eb', icon:Calendar, iconBg:'rgba(37,99,235,0.1)' },
                { label:'Completed', value:dashboard.stats?.completed, color:'#17833b', icon:CheckCircle, iconBg:'rgba(23,131,59,0.1)' },
                { label:'Overdue', value:dashboard.stats?.overdue, color:'#d93025', icon:AlertTriangle, iconBg:'rgba(217,48,37,0.1)' },
                { label:'Upcoming (30d)', value:dashboard.stats?.upcoming_30, color:'#7c3aed', icon:Clock, iconBg:'rgba(124,58,222,0.1)' },
              ].map(({ label, value, color, icon:Icon, iconBg }) => (
                <div key={label} className="stat-card" style={{ '--accent-color': color, '--icon-bg': iconBg }}>
                  <div className="stat-card-icon"><Icon size={18} color={color} /></div>
                  <div className="stat-card-value">{value ?? 0}</div>
                  <div className="stat-card-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Analytics Row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:24 }}>

              {/* Type Distribution */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Maintenance Type Distribution</span>
                </div>
                <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <DonutChart
                    data={(dashboard.typeDistribution || []).map((d, i) => ({
                      ...d,
                      color: Object.values(TYPE_COLORS)[i % Object.values(TYPE_COLORS).length]
                    }))}
                    size={110}
                  />
                  <div style={{ flex:1 }}>
                    {(dashboard.typeDistribution || []).map((d, i) => (
                      <div key={d.maintenance_type} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:8, height:8, borderRadius:2,
                            background: Object.values(TYPE_COLORS)[i % Object.values(TYPE_COLORS).length] }} />
                          <span style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{d.maintenance_type}</span>
                        </div>
                        <span style={{ fontSize:11.5, fontWeight:700, color:'var(--text-primary)' }}>{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Trend */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Monthly Maintenance Trend</span>
                </div>
                <BarChart data={dashboard.monthlyTrend || []} height={120} />
              </div>

              {/* Completed vs Pending */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Completion Status</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12, padding:'8px 0' }}>
                  {[
                    { label:'Completed', value:dashboard.stats?.completed, total:dashboard.stats?.total, color:'#17833b' },
                    { label:'Pending / Scheduled', value:dashboard.stats?.scheduled, total:dashboard.stats?.total, color:'#2563eb' },
                    { label:'Overdue', value:dashboard.stats?.overdue, total:dashboard.stats?.total, color:'#d93025' },
                  ].map(({ label, value, total, color }) => {
                    const pct = total > 0 ? Math.round((value/total)*100) : 0;
                    return (
                      <div key={label}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{label}</span>
                          <span style={{ fontSize:11.5, fontWeight:700, color }}>{value ?? 0} <span style={{ color:'var(--text-muted)', fontWeight:400 }}>({pct}%)</span></span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width:`${pct}%`, background:color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Equipment Health Scores */}
            <div className="card mb-6">
              <div className="card-header">
                <span className="card-title">⚡ Equipment Health Scores</span>
                <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>Based on maintenance history & overdue records</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
                {equipment.slice(0, 8).map(eq => {
                  const eqRecords = records.filter(r => r.equipment_id === eq.id);
                  const overdueCount = eqRecords.filter(isOverdue).length;
                  const completed = eqRecords.filter(r => r.status === 'Completed');
                  let score = 100 - overdueCount * 15;
                  if (completed.length === 0) score -= 20;
                  score = Math.max(0, Math.min(100, score));
                  let level;
                  if (score >= 85) level = 'Excellent';
                  else if (score >= 70) level = 'Good';
                  else if (score >= 50) level = 'Warning';
                  else level = 'Critical';
                  const cfg = HEALTH_CONFIG[level];
                  return (
                    <div key={eq.id} style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', border:'1px solid var(--border-default)', borderRadius:6,
                      background:'var(--bg-card)', borderLeft:`3px solid ${cfg.color}` }}>
                      <HealthBadge health={{ score, level, overdueCount }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:'Space Grotesk, monospace', fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>{eq.position_id}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{eq.equipment_type || 'Equipment'} · {eq.location || '—'}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{eqRecords.length} records · {completed.length} completed</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overdue Table Preview */}
            {dashboard.overdueList?.length > 0 && (
              <div className="card" style={{ borderLeft:'3px solid var(--danger)' }}>
                <div className="card-header">
                  <span className="card-title" style={{ color:'var(--danger)' }}>🚨 Overdue Maintenance ({dashboard.overdueList.length})</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('alerts')}>View All Alerts</button>
                </div>
                <div className="table-container">
                  <table>
                    <thead><tr>
                      <th>Equipment</th><th>Type</th><th>Priority</th><th>Scheduled</th><th>Days Overdue</th><th>Engineer</th>
                    </tr></thead>
                    <tbody>
                      {dashboard.overdueList.slice(0, 5).map(m => {
                        const days = Math.abs(daysDiff(m.scheduled_date));
                        return (
                          <tr key={m.id}>
                            <td><span className="position-id">{m.position_id}</span></td>
                            <td><span style={{ color:TYPE_COLORS[m.maintenance_type], fontWeight:600 }}>{m.maintenance_type}</span></td>
                            <td><PrioBadge priority={m.priority} /></td>
                            <td style={{ color:'var(--danger)', fontWeight:600 }}>{formatDate(m.scheduled_date)}</td>
                            <td><span style={{ color:'var(--danger)', fontWeight:700 }}>{days}d overdue</span></td>
                            <td>{m.engineer_name || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════ RECORDS TAB ═══════════════════ */}
        {activeTab === 'records' && (
          <>
            {/* Filters Row */}
            <div style={{ marginBottom:16 }}>
              <div className="filters-row">
                <div className="search-box" style={{ flex:2 }}>
                  <Search size={15} />
                  <input className="form-control" placeholder="Search by equipment, engineer, description..."
                    value={filters.search} onChange={e => setFilters(f => ({ ...f, search:e.target.value }))} />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(s => !s)}
                  style={{ position:'relative' }}>
                  <Filter size={13} /> Filters
                  {activeFilterCount > 0 && (
                    <span style={{ position:'absolute', top:-5, right:-5, width:16, height:16, borderRadius:999,
                      background:'var(--accent-primary)', color:'#fff', fontSize:9, fontWeight:700,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>{activeFilterCount}</span>
                  )}
                </button>
                {activeFilterCount > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={clearFilters}><X size={13} /> Clear</button>
                )}
              </div>

              {showFilters && (
                <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-default)',
                  borderRadius:6, padding:16, marginTop:8,
                  display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
                  <div>
                    <label className="form-label">Equipment ID</label>
                    <select className="form-control" value={filters.equipment_id}
                      onChange={e => setFilters(f => ({ ...f, equipment_id:e.target.value }))}>
                      <option value="">All Equipment</option>
                      {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.position_id}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Maintenance Type</label>
                    <select className="form-control" value={filters.maintenance_type}
                      onChange={e => setFilters(f => ({ ...f, maintenance_type:e.target.value }))}>
                      <option value="">All Types</option>
                      {['Preventive','Corrective','Inspection','Calibration','Overhaul','Emergency'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Priority</label>
                    <select className="form-control" value={filters.priority}
                      onChange={e => setFilters(f => ({ ...f, priority:e.target.value }))}>
                      <option value="">All Priorities</option>
                      {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-control" value={filters.status}
                      onChange={e => setFilters(f => ({ ...f, status:e.target.value }))}>
                      <option value="">All Statuses</option>
                      {['Completed','Scheduled','Pending','In Progress','Cancelled'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Date From</label>
                    <input type="date" className="form-control" value={filters.date_from}
                      onChange={e => setFilters(f => ({ ...f, date_from:e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Date To</label>
                    <input type="date" className="form-control" value={filters.date_to}
                      onChange={e => setFilters(f => ({ ...f, date_to:e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            {/* Records count */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                {records.length} record{records.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Timeline View */}
            {records.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:40 }}>
                <Wrench size={36} style={{ color:'var(--text-muted)', marginBottom:12 }} />
                <p className="text-muted">No maintenance records found. Adjust filters or add a new record.</p>
              </div>
            ) : (
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', background:'var(--bg-surface)', borderBottom:'1px solid var(--border-default)',
                  display:'flex', gap:12, fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  <span style={{ flex:'0 0 30px' }}></span>
                  <span style={{ flex:'0 0 130px' }}>Equipment</span>
                  <span style={{ flex:'0 0 110px' }}>Type</span>
                  <span style={{ flex:'0 0 90px' }}>Priority</span>
                  <span style={{ flex:'0 0 90px' }}>Status</span>
                  <span style={{ flex:'0 0 110px' }}>Scheduled</span>
                  <span style={{ flex:1 }}>Engineer</span>
                  <span style={{ flex:'0 0 90px' }}>Actions</span>
                </div>

                <ul className="timeline" style={{ padding:'8px 0', margin:0 }}>
                  {records.map((m) => {
                    const overdueSelf = isOverdue(m);
                    const expanded = expandedRow === m.id;
                    const typeColor = TYPE_COLORS[m.maintenance_type] || '#64748b';

                    return (
                      <li key={m.id} style={{ display:'block', borderBottom:'1px solid var(--border-subtle)', transition:'background 0.15s' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
                          background: overdueSelf ? 'rgba(217,48,37,0.03)' : 'transparent',
                          cursor:'pointer' }}
                          onClick={() => setExpandedRow(expanded ? null : m.id)}>

                          {/* Timeline dot */}
                          <div style={{ flex:'0 0 30px', display:'flex', justifyContent:'center' }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background: typeColor + '22',
                              border:`2px solid ${typeColor}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:typeColor }} />
                            </div>
                          </div>

                          <span style={{ flex:'0 0 130px', fontFamily:'Space Grotesk, monospace', fontWeight:700, fontSize:12.5, color:'var(--text-primary)' }}>
                            {m.position_id || `Eq #${m.equipment_id}`}
                          </span>
                          <span style={{ flex:'0 0 110px', color:typeColor, fontWeight:600, fontSize:12.5 }}>{m.maintenance_type}</span>
                          <span style={{ flex:'0 0 90px' }}><PrioBadge priority={m.priority} /></span>
                          <span style={{ flex:'0 0 90px' }}><StatusBadgeMaint status={m.status} /></span>
                          <span style={{ flex:'0 0 110px', fontSize:12.5, color: overdueSelf ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: overdueSelf ? 600 : 400 }}>
                            {overdueSelf && <AlertTriangle size={11} style={{ display:'inline', marginRight:3 }} />}
                            {formatDate(m.scheduled_date) || '—'}
                          </span>
                          <span style={{ flex:1, fontSize:12.5, color:'var(--text-secondary)' }}>
                            {m.engineer_name || m.performed_by || '—'}
                          </span>
                          <div style={{ flex:'0 0 90px', display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                            {isAdmin && (
                              <>
                                <button className="btn btn-secondary btn-sm" style={{ padding:'4px 8px', fontSize:11 }}
                                  onClick={() => openEdit(m)}>Edit</button>
                                <button className="btn btn-danger btn-sm" style={{ padding:'4px 8px', fontSize:11 }}
                                  onClick={() => handleDelete(m.id)}>✕</button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail row */}
                        {expanded && (
                          <div style={{ padding:'12px 62px 16px', background:'var(--bg-surface)',
                            borderTop:'1px solid var(--border-subtle)' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:12 }}>
                              <div>
                                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>Description</div>
                                <div style={{ fontSize:12.5, color:'var(--text-primary)' }}>{m.description || '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>Completion Date</div>
                                <div style={{ fontSize:12.5, color:'var(--text-primary)' }}>{formatDate(m.completion_date) || '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>Next Maintenance</div>
                                <div style={{ fontSize:12.5, color:'var(--text-primary)' }}>{formatDate(m.next_maintenance_date) || '—'}</div>
                              </div>
                              <div style={{ gridColumn:'1/-1' }}>
                                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>Remarks</div>
                                <div style={{ fontSize:12.5, color:'var(--text-secondary)' }}>{m.remarks || 'No remarks'}</div>
                              </div>
                            </div>

                            {/* Document Upload */}
                            {isAdmin && (
                              <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:10, borderTop:'1px solid var(--border-subtle)' }}>
                                <Upload size={13} style={{ color:'var(--text-muted)' }} />
                                <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>Attach Document:</span>
                                <input type="file" style={{ fontSize:11.5 }}
                                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
                                  onChange={e => setUploadFile(e.target.files[0])} />
                                <button className="btn btn-secondary btn-sm" disabled={uploading}
                                  onClick={() => handleUpload(m.id)}>
                                  {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════ ALERTS TAB ═══════════════════ */}
        {activeTab === 'alerts' && (
          <>
            {/* Overdue Section */}
            <div className="card mb-4" style={{ borderLeft:'3px solid var(--danger)' }}>
              <div className="card-header">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <AlertTriangle size={16} color="var(--danger)" />
                  <span className="card-title" style={{ color:'var(--danger)' }}>Overdue Maintenance</span>
                </div>
                <span className="tag" style={{ background:'rgba(217,48,37,0.1)', color:'var(--danger)', border:'1px solid rgba(217,48,37,0.3)' }}>
                  {overdue.length} item{overdue.length !== 1 ? 's' : ''}
                </span>
              </div>
              {overdue.length === 0 ? (
                <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'16px 0' }}>
                  ✅ No overdue maintenance records. Great work!
                </p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {overdue.map(m => {
                    const days = Math.abs(daysDiff(m.scheduled_date));
                    return (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12,
                        padding:'12px 14px', background:'rgba(217,48,37,0.04)', borderRadius:6,
                        border:'1px solid rgba(217,48,37,0.15)' }}>
                        <Zap size={16} color="var(--danger)" style={{ flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                            <span style={{ fontFamily:'Space Grotesk, monospace', fontWeight:700, fontSize:13 }}>{m.position_id || `Equipment #${m.equipment_id}`}</span>
                            <PrioBadge priority={m.priority} />
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                            {m.maintenance_type} · {m.description || 'No description'} · Eng: {m.engineer_name || '—'}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--danger)' }}>{days}d overdue</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>Scheduled: {formatDate(m.scheduled_date)}</div>
                        </div>
                        {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>Resolve</button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Due Soon Section */}
            <div className="card mb-4" style={{ borderLeft:'3px solid var(--warning)' }}>
              <div className="card-header">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Clock size={16} color="var(--warning)" />
                  <span className="card-title" style={{ color:'var(--warning)' }}>Due Within 7 Days</span>
                </div>
                <span className="tag" style={{ background:'rgba(199,119,0,0.1)', color:'var(--warning)', border:'1px solid rgba(199,119,0,0.3)' }}>
                  {dueSoon.length} item{dueSoon.length !== 1 ? 's' : ''}
                </span>
              </div>
              {dueSoon.length === 0 ? (
                <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'16px 0' }}>
                  No maintenance due in the next 7 days.
                </p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {dueSoon.map(m => {
                    const days = daysDiff(m.scheduled_date);
                    return (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12,
                        padding:'12px 14px', background:'rgba(199,119,0,0.04)', borderRadius:6,
                        border:'1px solid rgba(199,119,0,0.15)' }}>
                        <Bell size={16} color="var(--warning)" style={{ flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                            <span style={{ fontFamily:'Space Grotesk, monospace', fontWeight:700, fontSize:13 }}>{m.position_id || `Equipment #${m.equipment_id}`}</span>
                            <PrioBadge priority={m.priority} />
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                            {m.maintenance_type} · {m.description || 'No description'} · Eng: {m.engineer_name || '—'}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--warning)' }}>
                            {days === 0 ? 'Due Today' : `${days}d remaining`}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>Scheduled: {formatDate(m.scheduled_date)}</div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>View</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Critical Health Equipment */}
            <div className="card" style={{ borderLeft:'3px solid var(--accent-primary)' }}>
              <div className="card-header">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Shield size={16} color="var(--accent-primary)" />
                  <span className="card-title">Critical Equipment Health</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:10 }}>
                {equipment.map(eq => {
                  const eqRecords = records.filter(r => r.equipment_id === eq.id);
                  const overdueCount = eqRecords.filter(isOverdue).length;
                  const completed = eqRecords.filter(r => r.status === 'Completed');
                  let score = 100 - overdueCount * 15;
                  if (completed.length === 0) score -= 20;
                  score = Math.max(0, Math.min(100, score));
                  let level;
                  if (score >= 85) level = 'Excellent';
                  else if (score >= 70) level = 'Good';
                  else if (score >= 50) level = 'Warning';
                  else level = 'Critical';

                  if (level === 'Excellent' || level === 'Good') return null;
                  const cfg = HEALTH_CONFIG[level];
                  return (
                    <div key={eq.id} style={{ display:'flex', alignItems:'center', gap:10,
                      padding:'10px 12px', border:`1px solid ${cfg.color}33`,
                      borderLeft:`3px solid ${cfg.color}`, borderRadius:6, background:cfg.bg + '44' }}>
                      <HealthBadge health={{ score, level, overdueCount }} />
                      <div>
                        <div style={{ fontFamily:'Space Grotesk, monospace', fontWeight:700, fontSize:12.5 }}>{eq.position_id}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{eq.location || '—'}</div>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
                {equipment.every(eq => {
                  const eqRecords = records.filter(r => r.equipment_id === eq.id);
                  const overdueCount = eqRecords.filter(isOverdue).length;
                  const completed = eqRecords.filter(r => r.status === 'Completed');
                  let score = 100 - overdueCount * 15;
                  if (completed.length === 0) score -= 20;
                  score = Math.max(0, Math.min(100, score));
                  return score >= 70;
                }) && (
                  <p style={{ color:'var(--text-muted)', fontSize:13, gridColumn:'1/-1', textAlign:'center', padding:'16px 0' }}>
                    ✅ All equipment health scores are Good or above.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ═══════════════════ ADD/EDIT MODAL ═══════════════════ */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth:720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editRecord ? '✏️ Edit Maintenance Record' : '➕ New Maintenance Record'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Equipment *</label>
                  <select className="form-control" value={form.equipment_id}
                    onChange={e => setForm(f => ({ ...f, equipment_id:e.target.value }))}>
                    <option value="">Select Equipment</option>
                    {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.position_id} — {eq.equipment_type || 'Equipment'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Maintenance Type *</label>
                  <select className="form-control" value={form.maintenance_type}
                    onChange={e => setForm(f => ({ ...f, maintenance_type:e.target.value }))}>
                    {['Preventive','Corrective','Inspection','Calibration','Overhaul','Emergency','Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority:e.target.value }))}>
                    {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status}
                    onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>
                    {['Scheduled','Pending','In Progress','Completed','Cancelled'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Engineer Name</label>
                  <input className="form-control" value={form.engineer_name}
                    onChange={e => setForm(f => ({ ...f, engineer_name:e.target.value, performed_by:e.target.value }))}
                    placeholder="Assigned engineer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Scheduled Date</label>
                  <input type="date" className="form-control" value={form.scheduled_date}
                    onChange={e => setForm(f => ({ ...f, scheduled_date:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Completion Date</label>
                  <input type="date" className="form-control" value={form.completion_date}
                    onChange={e => setForm(f => ({ ...f, completion_date:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Maintenance Date</label>
                  <input type="date" className="form-control" value={form.next_maintenance_date}
                    onChange={e => setForm(f => ({ ...f, next_maintenance_date:e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={3} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description:e.target.value }))}
                  placeholder="Detailed description of maintenance work..." />
              </div>
              <div className="form-group">
                <label className="form-label">Remarks / Notes</label>
                <textarea className="form-control" rows={2} value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks:e.target.value }))}
                  placeholder="Additional notes, observations, or follow-ups..." />
              </div>

              {/* Document Upload Section */}
              <div style={{ background:'var(--bg-surface)', border:'1px dashed var(--border-strong)',
                borderRadius:6, padding:14, marginTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <Upload size={14} color="var(--text-muted)" />
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    Attach Document
                  </span>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>(PDF, Images, Excel, Word — max 20MB)</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                  <select className="form-control" style={{ fontSize:12 }}>
                    <option>Maintenance Report</option>
                    <option>Inspection Report</option>
                    <option>Calibration Certificate</option>
                    <option>Equipment Photo</option>
                    <option>Other</option>
                  </select>
                  <input type="file" style={{ fontSize:12, padding:'8px 4px', background:'transparent', border:'none' }}
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
                    onChange={e => setUploadFile(e.target.files[0])} />
                </div>
                {uploadFile && (
                  <div style={{ marginTop:6, fontSize:11.5, color:'var(--accent-primary)' }}>
                    📎 {uploadFile.name} ({(uploadFile.size/1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editRecord ? 'Update Record' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
