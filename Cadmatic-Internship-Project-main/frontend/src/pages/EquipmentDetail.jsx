import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, Plus, FileText, MapPin, Calendar, User } from 'lucide-react';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import { equipmentAPI } from '../services/api';
import { formatDate, getProgressPercent, STATUS_MAP } from '../utils/statusUtils';

const Field = ({ label, value, mono }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13.5, color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: mono ? 'Space Grotesk, monospace' : undefined }}>
      {value || '—'}
    </div>
  </div>
);

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eq, setEq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState({ maintenance_type: '', description: '', performed_by: '', next_maintenance_date: '', status: 'Completed', remarks: '' });

  useEffect(() => {
    equipmentAPI.getById(id)
      .then(res => setEq(res.data.data))
      .catch(() => toast.error('Failed to load equipment'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddMaintenance = async () => {
    try {
      await equipmentAPI.addMaintenance(id, maintForm);
      toast.success('Maintenance record added');
      setShowMaintModal(false);
      const res = await equipmentAPI.getById(id);
      setEq(res.data.data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return (
    <>
      <Topbar title="Equipment Detail" onRefresh={() => {}} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /></div></div>
    </>
  );

  if (!eq) return (
    <>
      <Topbar title="Not Found" onRefresh={() => {}} />
      <div className="page-content"><p className="text-muted">Equipment not found.</p></div>
    </>
  );

  const progress = getProgressPercent(eq.equipment_status_code);
  const statusSteps = Object.entries(STATUS_MAP);

  return (
    <>
      <Topbar title={`Equipment: ${eq.position_id}`} subtitle={eq.equip_status} onRefresh={() => {}} />
      <div className="page-content">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/equipment')}>
            <ArrowLeft size={14} /> Back to List
          </button>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowMaintModal(true)}>
              <Plus size={14} /> Add Maintenance
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/equipment/${id}/edit`)}>
              <Pencil size={14} /> Edit
            </button>
          </div>
        </div>

        {/* Status Progress */}
        <div className="card mb-6">
          <div className="card-header">
            <span className="card-title">Equipment Status Pipeline</span>
            <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>{progress}% Complete</span>
          </div>
          <div className="progress-track" style={{ height: 8, marginBottom: 20 }}>
            <div className="progress-fill" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-teal))' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {statusSteps.map(([code, info]) => {
              const done = parseInt(code) <= eq.equipment_status_code;
              const current = parseInt(code) === eq.equipment_status_code;
              return (
                <div key={code} style={{
                  flex: '1', minWidth: 80, padding: '6px 10px', borderRadius: 6, textAlign: 'center',
                  background: done ? (current ? info.bg : 'rgba(255,255,255,0.04)') : 'transparent',
                  border: `1px solid ${current ? info.color : done ? info.color + '44' : 'var(--border-subtle)'}`,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: done ? info.text : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Step {code}
                  </div>
                  <div style={{ fontSize: 10, color: done ? info.text : 'var(--text-muted)', marginTop: 2 }}>
                    {info.name.split(' ').slice(0, 2).join(' ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-header"><span className="card-title">📋 Equipment Information</span></div>
            <div className="grid-2">
              <Field label="Position ID" value={eq.position_id} mono />
              <Field label="Storage Number" value={eq.storage_number} mono />
              <Field label="EPC PO Number" value={eq.epc_po_number} />
              <Field label="Sub PO Number" value={eq.sub_po_number} />
              <Field label="Vendor" value={eq.sub_po_vendor} />
              <Field label="Package Name" value={eq.epc_package_name} />
              <Field label="Equipment Type" value={eq.equipment_type} />
              <Field label="Location" value={eq.location} />
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">📄 Documentation Status</span></div>
            <div>
              {[
                { label: 'NPCIL Spec Number', val: eq.npcil_spec_number },
                { label: 'Spec Status', val: eq.npcil_spec_status, color: eq.npcil_spec_status?.includes('Not') ? 'var(--danger)' : 'var(--success)' },
                { label: 'Drawing Number', val: eq.drawing_number },
                { label: 'Drawing Status', val: eq.drawing_status, color: eq.drawing_status?.includes('Not') ? 'var(--danger)' : 'var(--success)' },
                { label: 'Data Sheet Number', val: eq.data_sheet_number },
                { label: 'Data Sheet Status', val: eq.data_sheet_status, color: eq.data_sheet_status?.includes('Not') ? 'var(--danger)' : 'var(--success)' },
                { label: 'As-Built Drawing', val: eq.as_built_drawing_number },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: color || 'var(--text-primary)' }}>{val || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Status + Inspection */}
        <div className="grid-3 mb-6">
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Status</div>
            <StatusBadge code={eq.equipment_status_code} name={eq.equip_status} />
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Inspection</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(eq.last_inspection_date)}</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Inspection</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(eq.next_inspection_date)}</div>
          </div>
        </div>

        {/* Maintenance History */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔧 Maintenance History</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowMaintModal(true)}>
              <Plus size={13} /> Add Record
            </button>
          </div>
          {!eq.maintenance_history?.length ? (
            <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '20px 0' }}>No maintenance records yet</p>
          ) : (
            <ul className="timeline">
              {eq.maintenance_history.map((m, i) => (
                <li key={m.id} className="timeline-item">
                  <div className="timeline-dot" style={{ background: 'var(--accent-primary)', color: 'white', fontSize: 10, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 2 }}>{m.maintenance_type}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>{m.description}</div>
                    <div className="flex gap-3 text-xs text-muted">
                      <span><User size={10} style={{ display: 'inline' }} /> {m.performed_by}</span>
                      <span><Calendar size={10} style={{ display: 'inline' }} /> {formatDate(m.maintenance_date)}</span>
                      <span style={{ color: m.status === 'Completed' ? 'var(--success)' : 'var(--warning)' }}>{m.status}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>

      {/* Maintenance Modal */}
      {showMaintModal && (
        <div className="modal-backdrop" onClick={() => setShowMaintModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Maintenance Record</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMaintModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Maintenance Type *</label>
                <input className="form-control" value={maintForm.maintenance_type}
                  onChange={e => setMaintForm(f => ({ ...f, maintenance_type: e.target.value }))}
                  placeholder="e.g. Preventive, Corrective, Inspection" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={3} value={maintForm.description}
                  onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Performed By</label>
                  <input className="form-control" value={maintForm.performed_by}
                    onChange={e => setMaintForm(f => ({ ...f, performed_by: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={maintForm.status}
                    onChange={e => setMaintForm(f => ({ ...f, status: e.target.value }))}>
                    <option>Completed</option>
                    <option>Pending</option>
                    <option>In Progress</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Next Maintenance Date</label>
                <input type="date" className="form-control" value={maintForm.next_maintenance_date}
                  onChange={e => setMaintForm(f => ({ ...f, next_maintenance_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Remarks</label>
                <textarea className="form-control" rows={2} value={maintForm.remarks}
                  onChange={e => setMaintForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMaintModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddMaintenance}>Save Record</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
