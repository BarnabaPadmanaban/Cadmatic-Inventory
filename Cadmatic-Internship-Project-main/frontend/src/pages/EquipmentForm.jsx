import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';
import Topbar from '../components/Topbar';
import { equipmentAPI, fieldConfigAPI } from '../services/api';
import { STATUS_MAP } from '../utils/statusUtils';

const initialForm = {
  position_id: '', storage_number: '', epc_po_number: '', sub_po_number: '',
  sub_po_vendor: '', equipment_status_code: 0, npcil_spec_number: '', npcil_spec_status: '',
  drawing_number: '', drawing_status: '', data_sheet_number: '', data_sheet_status: '',
  as_built_drawing_number: '', epc_package_name: '', equip_status: 'Order Not Yet Placed',
  location: '', equipment_type: '', last_inspection_date: '', next_inspection_date: '',
};

const specStatusOptions = ['Spec Not Issued', 'Spec Issued'];
const drawingStatusOptions = ['Drawing Not Issued', 'Drawing Issued'];

const FormInput = ({ label, field, type = 'text', required, form, onChange, isMandatory }) => (
  <div className="form-group">
    <label className="form-label">{label}{(required || isMandatory(field)) && ' *'}</label>
    <input type={type} className="form-control" value={form[field] ?? ''}
      onChange={(event) => onChange(field, event.target.value)} />
  </div>
);

const FormSelect = ({ label, field, options, required, form, onChange, isMandatory }) => (
  <div className="form-group">
    <label className="form-label">{label}{(required || isMandatory(field)) && ' *'}</label>
    <select className="form-control" value={form[field] ?? ''}
      onChange={(event) => onChange(field, event.target.value)}>
      <option value="">— Select —</option>
      {options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
    </select>
  </div>
);

export default function EquipmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'new';
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    fieldConfigAPI.getAll()
      .then((res) => setFieldConfigs(res.data.data || []))
      .catch(() => { /* form still works with hardcoded defaults if this fails */ });
  }, []);

  useEffect(() => {
    if (isEdit) return;
    equipmentAPI.getAll({ limit: 500 })
      .then((res) => setTemplates(res.data.data || []))
      .catch(() => setTemplates([]));
  }, [isEdit]);

  const customFields = fieldConfigs.filter((f) => f.is_custom);
  const isMandatory = (key, fallback = false) => {
    const cfg = fieldConfigs.find((f) => f.field_key === key);
    return cfg ? !!cfg.is_mandatory : fallback;
  };

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    equipmentAPI.getById(id)
      .then(res => {
        const d = res.data.data;
        setForm({
          ...initialForm, ...d,
          last_inspection_date: d.last_inspection_date ? d.last_inspection_date.split('T')[0] : '',
          next_inspection_date: d.next_inspection_date ? d.next_inspection_date.split('T')[0] : '',
        });
      })
      .catch(() => toast.error('Failed to load equipment'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleChange = (key, value) => {
    setForm(f => {
      const updated = { ...f, [key]: value };
      // Auto-sync status name from code
      if (key === 'equipment_status_code') {
        updated.equip_status = STATUS_MAP[value]?.name || '';
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!form.position_id.trim()) { toast.error('Position ID is required'); return; }

    const missing = fieldConfigs
      .filter((f) => f.is_mandatory && !String(form[f.field_key] ?? '').trim())
      .map((f) => f.label);
    if (missing.length) {
      toast.error(`Missing required field(s): ${missing.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await equipmentAPI.update(id, form);
        toast.success('Equipment updated successfully');
        navigate(`/equipment/${id}`);
      } else {
        const res = await equipmentAPI.create(form);
        toast.success('Equipment created successfully');
        navigate(`/equipment/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = { form, onChange: handleChange, isMandatory };

  const applyTemplate = (selectedId) => {
    setTemplateId(selectedId);
    const template = templates.find((item) => String(item.id) === String(selectedId));
    if (!template) return;
    const prefill = { ...template };
    ['id', 'position_id', 'created_at', 'updated_at', 'maintenance_history'].forEach((key) => delete prefill[key]);
    setForm((current) => ({
      ...initialForm,
      ...prefill,
      position_id: current.position_id,
      last_inspection_date: prefill.last_inspection_date?.split?.('T')[0] || '',
      next_inspection_date: prefill.next_inspection_date?.split?.('T')[0] || '',
    }));
  };

  if (loading) return (
    <>
      <Topbar title={isEdit ? 'Edit Equipment' : 'Add Equipment'} onRefresh={() => {}} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /></div></div>
    </>
  );

  return (
    <>
      <Topbar title={isEdit ? `Edit: ${form.position_id}` : 'Add New Equipment'} subtitle={isEdit ? 'Update equipment details' : 'Register a new equipment'} onRefresh={() => {}} />
      <div className="page-content">

        <div className="flex items-center justify-between mb-6">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(isEdit ? `/equipment/${id}` : '/equipment')}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Saving...</> : <><Save size={14} /> {isEdit ? 'Update Equipment' : 'Create Equipment'}</>}
          </button>
        </div>

        {!isEdit && templates.length > 0 && (
          <div className="card mb-4">
            <div className="card-header"><span className="card-title">Prefill from Existing Equipment</span></div>
            <p className="text-sm text-muted" style={{ marginBottom: 10 }}>
              Select an existing equipment record to copy its details. Position ID is intentionally not copied.
            </p>
            <select className="form-control" value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">— Select equipment template —</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>{item.position_id} — {item.equipment_type || item.epc_package_name || 'Equipment'}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid-2 mb-4">
          {/* Basic Info */}
          <div className="card">
            <div className="card-header"><span className="card-title">📋 Basic Information</span></div>
            <FormInput {...fieldProps} label="Position ID" field="position_id" required />
            <FormInput {...fieldProps} label="Storage Number" field="storage_number" />
            <FormInput {...fieldProps} label="EPC Package Name" field="epc_package_name" />
            <FormInput {...fieldProps} label="Equipment Type" field="equipment_type" />
            <FormInput {...fieldProps} label="Location" field="location" />
          </div>

          {/* PO Info */}
          <div className="card">
            <div className="card-header"><span className="card-title">📦 Purchase Order</span></div>
            <FormInput {...fieldProps} label="EPC PO Number" field="epc_po_number" />
            <FormInput {...fieldProps} label="Sub PO Number" field="sub_po_number" />
            <FormInput {...fieldProps} label="Sub PO Vendor" field="sub_po_vendor" />
            <FormInput {...fieldProps} label="Last Inspection Date" field="last_inspection_date" type="date" />
            <FormInput {...fieldProps} label="Next Inspection Date" field="next_inspection_date" type="date" />
          </div>
        </div>

        <div className="grid-2 mb-4">
          {/* Status */}
          <div className="card">
            <div className="card-header"><span className="card-title">🚦 Equipment Status</span></div>
            <div className="form-group">
              <label className="form-label">Status Code *</label>
              <select className="form-control" value={form.equipment_status_code}
                onChange={e => handleChange('equipment_status_code', parseInt(e.target.value))}>
                {Object.entries(STATUS_MAP).map(([code, info]) => (
                  <option key={code} value={code}>{code} — {info.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status Label</label>
              <input className="form-control" value={form.equip_status || ''}
                onChange={e => handleChange('equip_status', e.target.value)} />
            </div>
          </div>

          {/* Documentation */}
          <div className="card">
            <div className="card-header"><span className="card-title">📄 Documentation</span></div>
            <div className="grid-2">
              <FormInput {...fieldProps} label="NPCIL Spec Number" field="npcil_spec_number" />
              <FormSelect {...fieldProps} label="Spec Status" field="npcil_spec_status" options={specStatusOptions} />
              <FormInput {...fieldProps} label="Drawing Number" field="drawing_number" />
              <FormSelect {...fieldProps} label="Drawing Status" field="drawing_status" options={drawingStatusOptions} />
              <FormInput {...fieldProps} label="Data Sheet Number" field="data_sheet_number" />
              <FormSelect {...fieldProps} label="Data Sheet Status" field="data_sheet_status" options={drawingStatusOptions} />
            </div>
            <FormInput {...fieldProps} label="As-Built Drawing Number" field="as_built_drawing_number" />
          </div>
        </div>

        {/* Admin-defined Custom Fields */}
        {customFields.length > 0 && (
          <div className="card mb-4">
            <div className="card-header"><span className="card-title">🧩 Custom Fields</span></div>
            <div className="grid-2">
              {customFields.map((f) => (
                f.field_type === 'select' ? (
                  <FormSelect {...fieldProps} key={f.field_key} label={f.label} field={f.field_key} options={f.options || []} required={f.is_mandatory} />
                ) : (
                  <FormInput {...fieldProps} key={f.field_key} label={f.label} field={f.field_key}
                    type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                    required={f.is_mandatory} />
                )
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button className="btn btn-secondary" onClick={() => navigate(isEdit ? `/equipment/${id}` : '/equipment')}>
            Cancel
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Equipment' : 'Create Equipment'}
          </button>
        </div>
      </div>
    </>
  );
}
