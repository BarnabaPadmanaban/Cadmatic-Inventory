import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Lock, Database, Info, Asterisk } from 'lucide-react';
import Topbar from '../components/Topbar';
import { fieldConfigAPI } from '../services/api';

const TYPE_LABELS = { text: 'Text', number: 'Number', date: 'Date', select: 'Dropdown' };

const EMPTY_FORM = { label: '', field_type: 'text', is_mandatory: false, optionsText: '' };

export default function FieldManager() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(null);

  const fetchFields = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const res = await fieldConfigAPI.getAll();
      setFields((res.data.data || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    } catch (err) {
      toast.error(err.message || 'Failed to load field configuration');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  const toggleMandatory = async (field) => {
    if (field.locked && field.is_mandatory) {
      toast.error(`"${field.label}" is a key field and must always be mandatory.`);
      return;
    }
    setSavingKey(field.field_key);
    try {
      await fieldConfigAPI.update(field.field_key, { is_mandatory: !field.is_mandatory });
      toast.success(`"${field.label}" is now ${!field.is_mandatory ? 'mandatory' : 'optional'}`);
      fetchFields(true);
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreate = async () => {
    if (!form.label.trim()) { toast.error('Field label is required'); return; }
    setSaving(true);
    try {
      const options = form.field_type === 'select'
        ? form.optionsText.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined;
      const res = await fieldConfigAPI.create({
        label: form.label.trim(),
        field_type: form.field_type,
        is_mandatory: form.is_mandatory,
        options,
      });
      toast.success(res.data.message || 'Field added');
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchFields(true);
    } catch (err) {
      toast.error(err.message || 'Failed to add field');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field) => {
    if (!window.confirm(`Remove the "${field.label}" field? This deletes the column from every equipment record.`)) return;
    try {
      await fieldConfigAPI.remove(field.field_key);
      toast.success('Field removed');
      fetchFields(true);
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  if (loading) return (
    <>
      <Topbar title="Field Manager" subtitle="Admin Panel" onRefresh={() => {}} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /></div></div>
    </>
  );

  const coreFields = fields.filter((f) => !f.is_custom);
  const customFields = fields.filter((f) => f.is_custom);

  return (
    <>
      <Topbar title="Field Manager" subtitle="Control mandatory fields and extend the Equipment schema" onRefresh={() => fetchFields(true)} refreshing={refreshing} />
      <div className="page-content">

        <div className="card mb-6" style={{ borderLeft: '3px solid var(--accent-primary)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Database size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Toggle which fields are <strong>required</strong> on the Add/Edit Equipment form. Adding a new field below
            physically adds a column to the Equipment table (or, on this dev environment without SQL Server connected,
            registers it on every in-memory equipment record) — it will then appear on the equipment form automatically.
          </p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="card-title" style={{ fontSize: 15 }}>Field Configuration</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Add Custom Field
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Source</th><th>Mandatory</th><th></th></tr>
              </thead>
              <tbody>
                {coreFields.map((f) => (
                  <tr key={f.field_key}>
                    <td style={{ fontWeight: 600 }}>{f.label}</td>
                    <td className="text-secondary text-sm">{TYPE_LABELS[f.field_type] || f.field_type}</td>
                    <td>
                      <span className="tag">{f.locked ? <><Lock size={10} style={{ marginRight: 3 }} />Key Field</> : 'Core'}</span>
                    </td>
                    <td>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: f.locked && f.is_mandatory ? 'not-allowed' : 'pointer', opacity: savingKey === f.field_key ? 0.5 : 1 }}>
                        <input
                          type="checkbox"
                          checked={!!f.is_mandatory}
                          disabled={(f.locked && f.is_mandatory) || savingKey === f.field_key}
                          onChange={() => toggleMandatory(f)}
                        />
                        <span style={{ fontSize: 12, color: f.is_mandatory ? 'var(--accent-primary-dark)' : 'var(--text-muted)' }}>
                          {f.is_mandatory ? 'Required' : 'Optional'}
                        </span>
                      </label>
                    </td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="card-title" style={{ fontSize: 15 }}>Custom Fields ({customFields.length})</span>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Column Key</th><th>Mandatory</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {customFields.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    No custom fields yet. Click "Add Custom Field" to extend the Equipment table.
                  </td></tr>
                ) : customFields.map((f) => (
                  <tr key={f.field_key}>
                    <td style={{ fontWeight: 600 }}>{f.label}</td>
                    <td className="text-secondary text-sm">{TYPE_LABELS[f.field_type] || f.field_type}</td>
                    <td className="font-mono text-xs text-muted">{f.field_key}</td>
                    <td>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: savingKey === f.field_key ? 0.5 : 1 }}>
                        <input type="checkbox" checked={!!f.is_mandatory} disabled={savingKey === f.field_key} onChange={() => toggleMandatory(f)} />
                        <span style={{ fontSize: 12, color: f.is_mandatory ? 'var(--accent-primary-dark)' : 'var(--text-muted)' }}>
                          {f.is_mandatory ? 'Required' : 'Optional'}
                        </span>
                      </label>
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} title="Remove field" onClick={() => handleDelete(f)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Add Custom Field</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Field Label</label>
                <input className="form-control" value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Manufacturer Country" />
              </div>
              <div className="form-group">
                <label className="form-label">Field Type</label>
                <select className="form-control" value={form.field_type}
                  onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value }))}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown (Select)</option>
                </select>
              </div>
              {form.field_type === 'select' && (
                <div className="form-group">
                  <label className="form-label">Dropdown Options (comma-separated)</label>
                  <input className="form-control" value={form.optionsText}
                    onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                    placeholder="e.g. India, Germany, Japan" />
                </div>
              )}
              <div className="form-group">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_mandatory}
                    onChange={(e) => setForm((f) => ({ ...f, is_mandatory: e.target.checked }))} />
                  <span className="form-label" style={{ margin: 0 }}>
                    <Asterisk size={10} style={{ display: 'inline', marginRight: 3, color: 'var(--danger)' }} />
                    Make this field mandatory
                  </span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: 6, padding: '8px 10px' }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>This will add a real column (<code>{form.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field_key'}</code>) to the Equipment table and appear on the Add/Edit Equipment form immediately.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Adding...' : 'Add Field'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
