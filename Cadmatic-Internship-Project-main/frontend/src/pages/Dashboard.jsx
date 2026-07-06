import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import {
  Package, CheckCircle, Clock, AlertTriangle, Activity,
  TrendingUp, ArrowRight
} from 'lucide-react';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import FullscreenChart from '../components/FullscreenChart';
import { equipmentAPI } from '../services/api';
import { formatDate } from '../utils/statusUtils';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
        borderRadius: 8, padding: '10px 14px', fontSize: 13
      }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.fill }}>{p.name}: <strong>{p.value}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await equipmentAPI.getDashboard();
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <>
      <Topbar title="Dashboard" subtitle="Nuclear Power Plant Equipment Overview" onRefresh={fetchData} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /><span>Loading dashboard...</span></div></div>
    </>
  );

  const stats = data?.stats || {};
  const statusBreakdown = data?.statusBreakdown || [];
  const recentActivity = data?.recentActivity || [];

  const statCards = [
    { label: 'Total Equipment', value: stats.total_equipment || 0, icon: Package, color: '#141414', iconBg: 'rgba(20,20,20,0.08)' },
    { label: 'Commissioned', value: stats.commissioned || 0, icon: CheckCircle, color: '#17833b', iconBg: 'rgba(23,131,59,0.12)' },
    { label: 'In Progress', value: stats.in_progress || 0, icon: Clock, color: '#ff7700', iconBg: 'rgba(255,119,0,0.14)' },
    { label: 'Order Not Placed', value: stats.order_not_placed || 0, icon: AlertTriangle, color: '#64748b', iconBg: 'rgba(100,116,139,0.12)' },
    { label: 'Testing Phase', value: stats.testing_phase || 0, icon: Activity, color: '#007b8a', iconBg: 'rgba(0,123,138,0.12)' },
    { label: 'Handover O&M', value: stats.handover_om || 0, icon: TrendingUp, color: '#d96300', iconBg: 'rgba(217,99,0,0.12)' },
  ];

  const chartData = statusBreakdown.map(s => ({ name: s.status_name.split(' ').slice(0, 2).join(' '), count: s.count, color: s.status_color }));

  const renderStatusBarChart = (height = 240) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 0, right: 10, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="count"
          name="Equipment"
          radius={[4, 4, 0, 0]}
          cursor="pointer"
          onClick={(entry) => navigate('/visualization', { state: { groupKey: 'equipment_status_code', drillLabel: entry.name } })}
        >
          {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const renderStatusPieChart = (height = 240) => {
    const nonZeroData = chartData.filter(d => d.count > 0);
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={nonZeroData} dataKey="count" nameKey="name"
            cx="40%" cy="50%" outerRadius={height > 300 ? 150 : 85} paddingAngle={2}
            cursor="pointer"
            onClick={(entry) => navigate('/visualization', { state: { groupKey: 'equipment_status_code', drillLabel: entry.name } })}
          >
            {nonZeroData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <>
      <Topbar title="Dashboard" subtitle="Nuclear Power Plant Equipment Overview" onRefresh={fetchData} />
      <div className="page-content">

        {/* Stats Grid */}
        <div className="stats-grid">
          {statCards.map(({ label, value, icon: Icon, color, iconBg }) => (
            <div className="stat-card" key={label} style={{ '--accent-color': color }}>
              <div className="stat-card-icon" style={{ background: iconBg }}>
                <Icon size={18} color={color} />
              </div>
              <div className="stat-card-value">{value}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid-2 mb-6">
          <div className="card">
            <FullscreenChart title="Equipment by Status" fullscreenChildren={renderStatusBarChart('100%')}>
              {renderStatusBarChart()}
            </FullscreenChart>
          </div>

          <div className="card">
            <FullscreenChart title="Status Distribution" fullscreenChildren={renderStatusPieChart('100%')}>
              {renderStatusPieChart()}
            </FullscreenChart>
          </div>
        </div>

        {/* Recent Activity + Status Progress */}
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Updates</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/equipment')}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div>
              {recentActivity.length === 0 ? (
                <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '20px 0' }}>No recent activity</p>
              ) : (
                recentActivity.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                  }}>
                    <div>
                      <div className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.position_id}</div>
                      <div className="text-xs text-muted">{item.location || '—'} · {formatDate(item.updated_at)}</div>
                    </div>
                    <StatusBadge code={0} name={item.equip_status} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Status Progress Pipeline</span>
            </div>
            <div>
              {statusBreakdown.map((s) => {
                const pct = stats.total_equipment ? Math.round((s.count / stats.total_equipment) * 100) : 0;
                return (
                  <div key={s.status_code} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.status_name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: s.status_color }}>{s.count}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: s.status_color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
