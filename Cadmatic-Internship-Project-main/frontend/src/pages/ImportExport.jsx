import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Info } from 'lucide-react';
import Topbar from '../components/Topbar';
import { equipmentAPI } from '../services/api';

export default function ImportExport() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) { toast.error('Only .xlsx or .xls files allowed'); return; }
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await equipmentAPI.import(fd);
      setResult(res.data);
      toast.success(res.data.message);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Topbar title="Import / Export" subtitle="Manage equipment data via Excel" onRefresh={() => {}} />
      <div className="page-content">

        <div className="grid-2">
          {/* Import */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📥 Import from Excel</span>
            </div>

            <div style={{
              border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-md)',
              padding: '32px 24px', textAlign: 'center', marginBottom: 20, cursor: 'pointer',
              transition: 'var(--transition)', background: file ? 'rgba(14,165,233,0.05)' : undefined
            }} onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {file ? file.name : 'Click to select Excel file'}
              </p>
              <p className="text-sm text-muted">Supports .xlsx and .xls files</p>
              {file && <p className="text-xs text-muted mt-4">Size: {(file.size / 1024).toFixed(1)} KB</p>}
            </div>

            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />

            <div style={{
              background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)',
              borderRadius: 8, padding: 14, marginBottom: 20
            }}>
              <div className="flex gap-2 items-center mb-2">
                <Info size={14} color="var(--accent-primary)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)' }}>Expected Column Format</span>
              </div>
              {[
                'nam Position Id', 'Storage Number', 'EPC Purchase Order Number',
                'Sub Purchase Order Number', 'Sub PO Vendor Name', 'Equipment Status',
                'NPCIL Spec Number', 'NPCIL Spec Status', 'Drawing Number',
                'Drawing Status', 'Data Sheet Number', 'EPC Package Name', 'Equip Status'
              ].map(col => (
                <div key={col} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 0', fontFamily: 'Space Grotesk, monospace' }}>
                  • {col}
                </div>
              ))}
            </div>

            <button className="btn btn-primary w-full" onClick={handleImport} disabled={!file || importing}>
              {importing ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Importing...</>
                : <><Upload size={14} /> Import Records</>}
            </button>

            {result && (
              <div style={{
                marginTop: 16, padding: '14px 16px', borderRadius: 8,
                background: (result.imported + (result.updated || 0)) > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${(result.imported + (result.updated || 0)) > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={15} color={(result.imported + (result.updated || 0)) > 0 ? 'var(--success)' : 'var(--warning)'} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Import Complete</span>
                </div>
                <div className="text-sm text-secondary">{result.message}</div>
                <div className="flex gap-4 mt-2">
                  <span style={{ fontSize: 12, color: 'var(--success)' }}>Imported: {result.imported}</span>
                  <span style={{ fontSize: 12, color: 'var(--success)' }}>Updated: {result.updated || 0}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Skipped: {result.skipped}</span>
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📤 Export to Excel</span>
            </div>

            <div style={{ padding: '24px 0' }}>
              <p className="text-secondary text-sm" style={{ marginBottom: 20 }}>
                Export all active equipment records to an Excel spreadsheet. The file will include all fields including status, documentation status, and inspection dates.
              </p>

              <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Export Includes</div>
                {[
                  'Position ID & Storage Number',
                  'EPC / Sub PO Details',
                  'Vendor Information',
                  'Equipment Status (Code + Name)',
                  'Documentation Status',
                  'Location & Equipment Type',
                  'Inspection Dates',
                  'Last Updated Timestamp',
                ].map(item => (
                  <div key={item} className="flex gap-2 items-center" style={{ padding: '4px 0' }}>
                    <CheckCircle size={12} color="var(--success)" />
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>

              <button className="btn btn-success w-full btn-lg" onClick={() => equipmentAPI.export()}>
                <Download size={15} /> Download Equipment Report (.xlsx)
              </button>
            </div>

            <div className="divider" />

            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: 14 }}>
              <div className="flex gap-2 items-center mb-2">
                <AlertCircle size={14} color="var(--warning)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>Usage Notes</span>
              </div>
              <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 1.7 }}>
                <li>Each import replaces the current dataset with the uploaded workbook</li>
                <li>Duplicate Position IDs inside one workbook are collapsed to the last matching row</li>
                <li>Status codes are mapped from text (case-insensitive)</li>
                <li>Blank/template rows are ignored; incomplete equipment rows are skipped</li>
                <li>Max file size: 10 MB</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
