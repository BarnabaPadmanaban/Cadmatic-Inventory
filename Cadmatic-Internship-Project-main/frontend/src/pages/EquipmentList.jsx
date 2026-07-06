import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Plus, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Filter, FileSpreadsheet } from 'lucide-react';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import { equipmentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, STATUS_MAP } from '../utils/statusUtils';

export default function EquipmentList() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '', package_name: '' });
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchEquipment = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(k => params[k] === '' && delete params[k]);
      const res = await equipmentAPI.getAll(params);
      setEquipment(res.data.data);
      setPagination(p => ({ ...p, ...res.data.pagination }));
    } catch (err) {
      toast.error('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => { fetchEquipment(1); }, [filters]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') setFilters(f => ({ ...f, search: searchInput }));
  };

  const handleDelete = async (id, posId) => {
    if (!window.confirm(`Delete equipment ${posId}?`)) return;
    try {
      await equipmentAPI.delete(id);
      toast.success('Equipment deleted');
      fetchEquipment(pagination.page);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExport = async () => {
    try {
      await equipmentAPI.export(filters);
      toast.success('Export started');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    }
  };

  const columns = [
    'Position ID', 'Package', 'Storage No.', 'EPC PO', 'Vendor',
    'Spec Status', 'Drawing Status', 'Equipment Status', 'Last Updated', 'Actions'
  ];

  return (
    <>
      <Topbar title="Equipment List" subtitle={`${pagination.total} records total`} onRefresh={() => fetchEquipment(pagination.page)} />
      <div className="page-content">

        <div className="filters-row">
          <div className="search-box">
            <Search size={14} />
            <input
              className="form-control"
              placeholder="Search by position, status, vendor... (Enter)"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
          <select className="form-control" style={{ width: 'auto', minWidth: 180 }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_MAP).map(([code, info]) => (
              <option key={code} value={code}>{info.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilters({ search: '', status: '', package_name: '' }); setSearchInput(''); }}>
            <Filter size={13} /> Clear
          </button>
          {isAdmin && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={handleExport}>
                <FileSpreadsheet size={13} /> Export to Excel
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/equipment/new')}>
                <Plus size={14} /> Add Equipment
              </button>
            </>
          )}
        </div>

        <div className="table-container">
          {loading ? (
            <div className="page-loader"><div className="loading-spinner" /><span>Loading...</span></div>
          ) : (
            <table>
              <thead>
                <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {equipment.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No equipment found</td></tr>
                ) : equipment.map(eq => (
                  <tr key={eq.id}>
                    <td><span className="position-id">{eq.position_id}</span></td>
                    <td><span className="tag">{eq.epc_package_name || '—'}</span></td>
                    <td className="text-secondary text-sm">{eq.storage_number || '—'}</td>
                    <td className="text-secondary text-sm">{eq.epc_po_number || '—'}</td>
                    <td className="text-secondary text-sm">{eq.sub_po_vendor || '—'}</td>
                    <td>
                      <span style={{ fontSize: 12, color: eq.npcil_spec_status?.includes('Not') ? 'var(--danger)' : 'var(--success)' }}>
                        {eq.npcil_spec_status || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: eq.drawing_status?.includes('Not') ? 'var(--danger)' : 'var(--success)' }}>
                        {eq.drawing_status || '—'}
                      </span>
                    </td>
                    <td><StatusBadge code={eq.equipment_status_code} name={eq.equip_status} /></td>
                    <td className="text-xs text-muted">{formatDate(eq.updated_at)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/equipment/${eq.id}`)}>
                          <Eye size={12} />
                        </button>
                        {isAdmin && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/equipment/${eq.id}/edit`)}>
                              <Pencil size={12} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(eq.id, eq.position_id)}>
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm"
                disabled={pagination.page === 1}
                onClick={() => fetchEquipment(pagination.page - 1)}>
                <ChevronLeft size={14} />
              </button>
              {[...Array(Math.min(pagination.pages, 7))].map((_, i) => {
                const page = i + 1;
                return (
                  <button key={page}
                    className={`btn btn-sm ${pagination.page === page ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => fetchEquipment(page)}>{page}</button>
                );
              })}
              <button className="btn btn-secondary btn-sm"
                disabled={pagination.page === pagination.pages}
                onClick={() => fetchEquipment(pagination.page + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
