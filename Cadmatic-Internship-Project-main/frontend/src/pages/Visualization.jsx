import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, FunnelChart, Funnel, LabelList,
} from 'recharts';
import {
  BarChart3, PieChart as PieIcon, X, Eye, FileSpreadsheet, TrendingUp,
  AreaChart as AreaIcon, Layers, Target, Activity, Filter, Database,
  ChevronRight, ChevronDown, Search, RefreshCw,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import FullscreenChart from '../components/FullscreenChart';
import { equipmentAPI, fieldConfigAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { STATUS_MAP, formatDate } from '../utils/statusUtils';

const PALETTE = ['#ff7700','#007b8a','#7c3aed','#17833b','#c77700','#2563eb','#d93025','#5f8f00','#008aa0','#64748b'];
const colorForIndex = (i) => PALETTE[i % PALETTE.length];

const BASE_GROUP_FIELDS = [
  { key: 'equipment_status_code', label: 'Status', exportFilter: 'status' },
  { key: 'epc_package_name',      label: 'EPC Package',    exportFilter: 'package_name' },
  { key: 'equipment_type',        label: 'Equipment Type', exportFilter: 'type' },
  { key: 'sub_po_vendor',         label: 'Vendor',         exportFilter: 'search' },
  { key: 'location',              label: 'Location',       exportFilter: 'search' },
  { key: 'npcil_spec_status',     label: 'Spec Status',    exportFilter: 'search' },
  { key: 'drawing_status',        label: 'Drawing Status', exportFilter: 'search' },
];

// All chart types mirroring Power BI visual gallery
const CHART_TYPES = [
  { id: 'bar',         label: 'Clustered Bar',    Icon: BarChart3 },
  { id: 'bar_h',       label: 'Horizontal Bar',   Icon: BarChart3 },
  { id: 'pie',         label: 'Pie Chart',        Icon: PieIcon },
  { id: 'donut',       label: 'Donut Chart',      Icon: PieIcon },
  { id: 'line',        label: 'Line Chart',       Icon: TrendingUp },
  { id: 'area',        label: 'Area Chart',       Icon: AreaIcon },
  { id: 'scatter',     label: 'Scatter Plot',     Icon: Activity },
  { id: 'radar',       label: 'Radar Chart',      Icon: Target },
  { id: 'funnel',      label: 'Funnel Chart',     Icon: Layers },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-default)', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
        <p style={{ color:'var(--text-muted)', marginBottom:4 }}>{label || payload[0]?.name}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.fill || p.payload?.color }}>
            {p.name || 'Count'}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/* ─── Left panel: Data fields pane ─────────────────────────── */
function DataPane({ groupFields, groupKey, setGroupKey, setDrill, allEquipment }) {
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({ dimensions: true, measures: true });

  const toggle = (s) => setExpandedSections(p => ({ ...p, [s]: !p[s] }));
  const filtered = groupFields.filter(f => f.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid var(--border-subtle)' }}>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.04em', textTransform:'uppercase' }}>Data</span>
      </div>

      {/* Search */}
      <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)' }}>
        <div style={{ position:'relative' }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search fields…"
            style={{ width:'100%', fontSize:11, padding:'5px 6px 5px 24px', border:'1px solid var(--border-default)', borderRadius:4, background:'var(--bg-surface)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }}
          />
        </div>
      </div>

      {/* Dimensions section */}
      <div>
        <div
          onClick={() => toggle('dimensions')}
          style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 12px', cursor:'pointer', userSelect:'none', fontSize:11, fontWeight:600, color:'var(--text-secondary)' }}
        >
          {expandedSections.dimensions ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
          DIMENSIONS
        </div>
        {expandedSections.dimensions && (
          <div>
            {filtered.map(f => (
              <div
                key={f.key}
                onClick={() => { setGroupKey(f.key); setDrill(null); }}
                style={{
                  display:'flex', alignItems:'center', gap:8, padding:'6px 12px 6px 22px',
                  cursor:'pointer', fontSize:12,
                  background: groupKey === f.key ? 'rgba(255,119,0,0.08)' : 'transparent',
                  color: groupKey === f.key ? 'var(--accent-primary)' : 'var(--text-primary)',
                  borderLeft: groupKey === f.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition:'all 0.12s',
                }}
              >
                <Database size={11} style={{ flexShrink:0, color: groupKey === f.key ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                {f.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Measures section */}
      <div style={{ marginTop:4 }}>
        <div
          onClick={() => toggle('measures')}
          style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 12px', cursor:'pointer', userSelect:'none', fontSize:11, fontWeight:600, color:'var(--text-secondary)' }}
        >
          {expandedSections.measures ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
          MEASURES
        </div>
        {expandedSections.measures && (
          <div style={{ padding:'2px 12px 8px 22px', fontSize:12, color:'var(--text-muted)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderLeft:'2px solid transparent' }}>
              <Activity size={11} />
              Total Equipment ({allEquipment.length})
            </div>
          </div>
        )}
      </div>

      {/* Filters hint */}
      <div style={{ marginTop:'auto', borderTop:'1px solid var(--border-subtle)', padding:'10px 12px' }}>
        <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5 }}>
          <Filter size={11} /> Click a field to group chart
        </div>
      </div>
    </div>
  );
}

/* ─── Right panel: Visualizations pane ─────────────────────── */
function VisualizationsPane({ chartType, setChartType }) {
  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid var(--border-subtle)' }}>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.04em', textTransform:'uppercase' }}>Visualizations</span>
      </div>

      {/* Build visual label */}
      <div style={{ padding:'8px 12px 4px', fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Build visual</div>

      {/* Chart type grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, padding:'4px 8px 12px' }}>
        {CHART_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            title={label}
            onClick={() => setChartType(id)}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:3, padding:'8px 4px', border:'1px solid',
              borderColor: chartType === id ? 'var(--accent-primary)' : 'var(--border-default)',
              borderRadius:4, cursor:'pointer',
              background: chartType === id ? 'rgba(255,119,0,0.08)' : 'var(--bg-card)',
              color: chartType === id ? 'var(--accent-primary)' : 'var(--text-muted)',
              transition:'all 0.12s',
            }}
          >
            <Icon size={16} />
            <span style={{ fontSize:8, lineHeight:1.2, textAlign:'center' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height:1, background:'var(--border-subtle)', margin:'0 8px 10px' }} />

      {/* Values / Axis fields */}
      <div style={{ padding:'0 10px' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Values</div>
        <div style={{ border:'1px dashed var(--border-default)', borderRadius:4, padding:'10px 8px', fontSize:11, color:'var(--text-muted)', textAlign:'center', marginBottom:10 }}>
          Count of Equipment
        </div>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Axis / Legend</div>
        <div style={{ border:'1px dashed var(--border-default)', borderRadius:4, padding:'10px 8px', fontSize:11, color:'var(--text-muted)', textAlign:'center' }}>
          Selected field
        </div>
      </div>
    </div>
  );
}

const panelStyle = {
  width: 180,
  flexShrink: 0,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  fontSize: 12,
  overflow: 'hidden',
  maxHeight: 'calc(100vh - var(--topbar-height) - 40px)',
  position: 'sticky',
  top: 20,
  alignSelf: 'flex-start',
};

/* ─── Chart renderer ────────────────────────────────────────── */
function ChartCanvas({ chartType, chartData, drill, handleChartClick, height = 340 }) {
  const isHorizontal = chartType === 'bar_h';

  if (chartType === 'bar' || chartType === 'bar_h') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top:10, right:20, bottom: isHorizontal ? 10 : 60, left: isHorizontal ? 90 : 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fill:'var(--text-muted)', fontSize:10 }} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:10 }} angle={-30} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} allowDecimals={false} />
            </>
          )}
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Equipment" radius={[4,4,0,0]} cursor="pointer" onClick={handleChartClick}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color}
                stroke={drill?.label === entry.name ? 'var(--text-primary)' : 'none'}
                strokeWidth={drill?.label === entry.name ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'pie' || chartType === 'donut') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="name"
            cx="40%" cy="50%"
            outerRadius={120}
            innerRadius={chartType === 'donut' ? 60 : 0}
            paddingAngle={2} cursor="pointer" onClick={handleChartClick}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color}
                stroke={drill?.label === entry.name ? 'var(--text-primary)' : 'none'}
                strokeWidth={drill?.label === entry.name ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend iconSize={10} wrapperStyle={{ fontSize:11, color:'var(--text-secondary)' }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top:10, right:20, bottom:60, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:10 }} angle={-30} textAnchor="end" interval={0} height={70} />
          <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={2} dot={{ fill:'var(--accent-primary)', r:4 }} cursor="pointer" onClick={handleChartClick} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top:10, right:20, bottom:60, left:0 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:10 }} angle={-30} textAnchor="end" interval={0} height={70} />
          <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="count" stroke="var(--accent-primary)" fill="url(#areaGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'scatter') {
    const scatterData = chartData.map((d, i) => ({ x: i + 1, y: d.count, name: d.name, color: d.color }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top:10, right:20, bottom:20, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis type="number" dataKey="x" name="Index" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
          <YAxis type="number" dataKey="y" name="Count" tick={{ fill:'var(--text-muted)', fontSize:11 }} allowDecimals={false} />
          <Tooltip cursor={{ strokeDasharray:'3 3' }} content={({ active, payload }) => {
            if (active && payload?.length) {
              const d = payload[0]?.payload;
              return (
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-default)', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
                  <p style={{ color:'var(--text-secondary)' }}>{d?.name}</p>
                  <p>Count: <strong>{d?.y}</strong></p>
                </div>
              );
            }
            return null;
          }} />
          <Scatter data={scatterData} cursor="pointer" onClick={(e) => handleChartClick({ payload: { name: e.name } })}>
            {scatterData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'radar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="var(--border-subtle)" />
          <PolarAngleAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:10 }} />
          <Radar dataKey="count" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.25} />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'funnel') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <FunnelChart>
          <Tooltip content={<CustomTooltip />} />
          <Funnel dataKey="count" data={chartData} isAnimationActive cursor="pointer" onClick={handleChartClick}>
            {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            <LabelList position="right" fill="var(--text-secondary)" stroke="none" dataKey="name" style={{ fontSize:11 }} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function Visualization() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [allEquipment, setAllEquipment] = useState([]);
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupKey,   setGroupKey]   = useState(location.state?.groupKey || 'equipment_status_code');
  const [chartType,  setChartType]  = useState('bar');
  const [drill,      setDrill]      = useState(location.state?.drillLabel ? { label: location.state.drillLabel } : null);
  const { isAdmin } = useAuth();

  const fetchData = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const [eqRes, fieldRes] = await Promise.all([
        equipmentAPI.getAll({ limit: 2000 }),
        fieldConfigAPI.getAll().catch(() => ({ data: { data: [] } })),
      ]);
      setAllEquipment(eqRes.data.data || []);
      setFieldConfigs(fieldRes.data.data || []);
    } catch {
      toast.error('Failed to load visualization data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupFields = useMemo(() => {
    const customSelectFields = fieldConfigs
      .filter(f => f.is_custom && f.field_type === 'select')
      .map(f => ({ key: f.field_key, label: f.label, exportFilter: 'search' }));
    return [...BASE_GROUP_FIELDS, ...customSelectFields];
  }, [fieldConfigs]);

  const activeGroupField = groupFields.find(g => g.key === groupKey) || groupFields[0];

  const groupValueLabel = useCallback((row) => {
    if (!activeGroupField) return '(Not set)';
    const raw = row[activeGroupField.key];
    if (activeGroupField.key === 'equipment_status_code') return STATUS_MAP[raw]?.name || `Status ${raw}`;
    if (raw === null || raw === undefined || String(raw).trim() === '') return '(Not set)';
    return String(raw);
  }, [activeGroupField]);

  const chartData = useMemo(() => {
    const counts = {};
    allEquipment.forEach(row => {
      const name = groupValueLabel(row);
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count], i) => {
        let color = colorForIndex(i);
        if (activeGroupField?.key === 'equipment_status_code') {
          const entry = Object.values(STATUS_MAP).find(s => s.name === name);
          if (entry) color = entry.color;
        }
        return { name, count, color };
      })
      .sort((a, b) => b.count - a.count);
  }, [allEquipment, groupValueLabel, activeGroupField]);

  const drilledRows = useMemo(() => {
    if (!drill) return [];
    return allEquipment.filter(row => groupValueLabel(row) === drill.label);
  }, [allEquipment, drill, groupValueLabel]);

  const handleChartClick = (entry) => {
    const payload = entry?.payload || entry;
    if (!payload?.name) return;
    setDrill({ label: payload.name });
  };

  const handleExportDrill = async () => {
    if (!drill) return;
    try {
      const params = {};
      if (activeGroupField?.exportFilter === 'status') {
        const code = Object.entries(STATUS_MAP).find(([, v]) => v.name === drill.label)?.[0];
        if (code !== undefined) params.status = code;
      } else if (activeGroupField?.exportFilter === 'package_name') {
        params.package_name = drill.label;
      } else if (activeGroupField?.exportFilter === 'type') {
        params.type = drill.label;
      } else {
        params.search = drill.label;
      }
      await equipmentAPI.export(params);
      toast.success('Export started');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    }
  };

  const handleExportAll = async () => {
    try {
      await equipmentAPI.export({});
      toast.success('Export started');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    }
  };

  if (loading) return (
    <>
      <Topbar title="Visualization" subtitle="Power BI-style analytics" onRefresh={() => fetchData()} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /><span>Loading…</span></div></div>
    </>
  );

  const displayRows = drill ? drilledRows : allEquipment;

  return (
    <>
      <Topbar
        title="Visualization"
        subtitle="Select a field from the Data pane · Pick a chart type · Click any bar or slice to drill down"
        onRefresh={() => fetchData(true)}
        refreshing={refreshing}
      />

      {/* Three-column Power BI layout */}
      <div className="page-content" style={{ display:'flex', gap:16, alignItems:'flex-start' }}>

        {/* LEFT: Data pane */}
        <DataPane
          groupFields={groupFields}
          groupKey={groupKey}
          setGroupKey={setGroupKey}
          setDrill={setDrill}
          allEquipment={allEquipment}
        />

        {/* CENTER: Canvas */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Toolbar row */}
          <div className="card" style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                {activeGroupField?.label} - Equipment Breakdown
              </span>
              <span className="tag" style={{ fontSize:11 }}>{allEquipment.length} total</span>
              {refreshing && <RefreshCw size={13} style={{ color:'var(--accent-primary)', animation:'spin 1s linear infinite' }} />}
            </div>
            {isAdmin && (
              <div style={{ display:'flex', gap:8 }}>
                {drill && (
                  <button className="btn btn-secondary btn-sm" onClick={handleExportDrill}>
                    <FileSpreadsheet size={13} /> Export Selection
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={handleExportAll}>
                  <FileSpreadsheet size={13} /> Export All to Excel
                </button>
              </div>
            )}
          </div>

          {/* Chart canvas */}
          <div className="card" style={{ padding:'20px 16px 12px' }}>
            {chartData.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)', fontSize:13 }}>
                No data to display for the selected field.
              </div>
            ) : (
              <FullscreenChart
                title={`${activeGroupField?.label} - Equipment Breakdown`}
                fullscreenChildren={(
                  <ChartCanvas
                    chartType={chartType}
                    chartData={chartData}
                    drill={drill}
                    handleChartClick={handleChartClick}
                    height="100%"
                  />
                )}
              >
                <ChartCanvas
                  chartType={chartType}
                  chartData={chartData}
                  drill={drill}
                  handleChartClick={handleChartClick}
                />
              </FullscreenChart>
            )}
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, paddingLeft:2 }}>
              Click any element to drill into the matching equipment records below.
            </div>
          </div>

          {/* Drill-down table */}
          <div className="card">
            <div className="card-header">
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span className="card-title">
                  {drill ? `${activeGroupField?.label}: ${drill.label}` : 'All Equipment'}
                </span>
                <span className="tag">{displayRows.length} records</span>
                {drill && (
                  <button className="btn btn-secondary btn-sm" style={{ padding:'2px 8px' }} onClick={() => setDrill(null)}>
                    <X size={11} /> Clear filter
                  </button>
                )}
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Position ID</th><th>Package</th><th>Vendor</th><th>Status</th><th>Location</th><th>Last Updated</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.slice(0, 200).map(eq => (
                    <tr key={eq.id}>
                      <td><span className="position-id">{eq.position_id}</span></td>
                      <td><span className="tag">{eq.epc_package_name || '—'}</span></td>
                      <td className="text-secondary text-sm">{eq.sub_po_vendor || '—'}</td>
                      <td><StatusBadge code={eq.equipment_status_code} name={eq.equip_status} /></td>
                      <td className="text-secondary text-sm">{eq.location || '—'}</td>
                      <td className="text-xs text-muted">{formatDate(eq.updated_at)}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" style={{ padding:'4px 8px' }} onClick={() => navigate(`/equipment/${eq.id}`)}>
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayRows.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>No matching records</td></tr>
                  )}
                </tbody>
              </table>
              {displayRows.length > 200 && (
                <p className="text-xs text-muted" style={{ padding:'10px 4px' }}>
                  Showing first 200 of {displayRows.length} records. Use Export to download the full set.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Visualizations pane */}
        <VisualizationsPane chartType={chartType} setChartType={setChartType} />

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
