import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import Topbar from '../components/Topbar';
import { equipmentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Brand palette used consistently across the PDF report
const BRAND = {
  primary: [255, 119, 0],     // accent orange
  dark: [20, 20, 20],
  muted: [100, 116, 139],
  border: [217, 222, 228],
  surface: [245, 247, 249],
};

export default function Reports() {
  const [data, setData] = useState(null);
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { isAdmin } = useAuth();

  // Refs used to snapshot the on-screen charts for embedding into the PDF
  const barChartRef = useRef(null);
  const pieChartRef = useRef(null);

  useEffect(() => {
    Promise.all([equipmentAPI.getDashboard(), equipmentAPI.getAll({ limit: 10000 })])
      .then(([dashboardResponse, equipmentResponse]) => {
        setData(dashboardResponse.data.data);
        setEquipmentRows(equipmentResponse.data.data || []);
      })
      .catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Topbar title="Reports" subtitle="Analytics & Insights" onRefresh={() => {}} />
      <div className="page-content"><div className="page-loader"><div className="loading-spinner" /></div></div>
    </>
  );

  const statusData = (data?.statusBreakdown || []).map(s => ({
    name: s.status_name.split(' ').slice(0, 2).join(' '),
    fullName: s.status_name,
    count: s.count,
    color: s.status_color,
    pct: data?.stats?.total_equipment ? ((s.count / data.stats.total_equipment) * 100).toFixed(1) : 0
  }));

  const stats = data?.stats || {};

  const completionRate = stats.total_equipment
    ? Math.round(((stats.commissioned + stats.handover_om) / stats.total_equipment) * 100)
    : 0;

  const countBy = (key) => Object.entries(equipmentRows.reduce((counts, item) => {
    const value = item[key] || 'Not specified';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);

  const packageSummary = countBy('epc_package_name');
  const vendorSummary = countBy('sub_po_vendor');
  const typeSummary = countBy('equipment_type');
  const leadingStatus = [...statusData].sort((a, b) => b.count - a.count)[0];
  const summarySentences = stats.total_equipment ? [
    `The uploaded dataset contains ${stats.total_equipment} equipment record${stats.total_equipment === 1 ? '' : 's'} across ${packageSummary.length} EPC package${packageSummary.length === 1 ? '' : 's'}.`,
    `${stats.commissioned || 0} equipment item${stats.commissioned === 1 ? ' is' : 's are'} commissioned and ${stats.handover_om || 0} ${stats.handover_om === 1 ? 'has' : 'have'} reached handover to O&M, producing an overall completion rate of ${completionRate}%.`,
    leadingStatus ? `The largest status group is "${leadingStatus.fullName}" with ${leadingStatus.count} record${leadingStatus.count === 1 ? '' : 's'} (${leadingStatus.pct}% of the dataset).` : '',
    packageSummary[0] ? `The largest EPC package is "${packageSummary[0][0]}" with ${packageSummary[0][1]} equipment record${packageSummary[0][1] === 1 ? '' : 's'}.` : '',
    vendorSummary[0] ? `The most represented vendor is "${vendorSummary[0][0]}" with ${vendorSummary[0][1]} associated record${vendorSummary[0][1] === 1 ? '' : 's'}.` : '',
    typeSummary[0] ? `The most common equipment type is "${typeSummary[0][0]}" (${typeSummary[0][1]} record${typeSummary[0][1] === 1 ? '' : 's'}).` : '',
    `${stats.order_not_placed || 0} order${stats.order_not_placed === 1 ? '' : 's'} remain not placed, while ${stats.in_progress || 0} equipment item${stats.in_progress === 1 ? ' is' : 's are'} currently in progress and ${stats.testing_phase || 0} ${stats.testing_phase === 1 ? 'is' : 'are'} in the testing phase.`,
  ].filter(Boolean) : ['No equipment data is currently available. Import an equipment workbook to generate the full analytical summary.'];

  // ── PDF generation ──────────────────────────────────────────────
  // Produces a structured, client-facing document: cover page, executive
  // summary with KPI tiles, real chart snapshots, and formatted data tables
  // (rather than plain lines of text) so it reads like a proper report.
  const downloadPdf = async () => {
    setGenerating(true);
    const toastId = toast.loading('Building PDF report…');
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const generatedAt = new Date();

      // Snapshot the live charts so the PDF shows the exact same visuals as the screen
      let barImg = null, pieImg = null, barRatio = 1, pieRatio = 1;
      if (barChartRef.current) {
        const canvas = await html2canvas(barChartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        barImg = canvas.toDataURL('image/png');
        barRatio = canvas.height / canvas.width;
      }
      if (pieChartRef.current) {
        const canvas = await html2canvas(pieChartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        pieImg = canvas.toDataURL('image/png');
        pieRatio = canvas.height / canvas.width;
      }

      // ── Section heading helper ──
      const sectionHeading = (doc, text, y) => {
        doc.setFillColor(...BRAND.primary);
        doc.rect(margin, y - 4.5, 3, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13.5);
        doc.setTextColor(...BRAND.dark);
        doc.text(text, margin + 6, y);
        return y + 7;
      };

      // ── Footer (page number + brand) drawn after content is finalized ──
      const drawFooter = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 2; i <= pageCount; i++) { // skip the cover page
          doc.setPage(i);
          doc.setDrawColor(...BRAND.border);
          doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...BRAND.muted);
          doc.text('Cadmatic EMS — Equipment Summary Report', margin, pageHeight - 7);
          doc.text(`Page ${i - 1} of ${pageCount - 1}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
        }
      };

      // ── COVER PAGE ──────────────────────────────────────────────
      pdf.setFillColor(...BRAND.dark);
      pdf.rect(0, 0, pageWidth, 70, 'F');
      pdf.setFillColor(...BRAND.primary);
      pdf.rect(0, 70, pageWidth, 3, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text('CADMATIC EMS', margin, 22);

      pdf.setFontSize(24);
      pdf.text('Equipment Status Report', margin, 38);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(230, 230, 230);
      pdf.text('Nuclear Power Plant Equipment — Analytics & Progress Summary', margin, 48);

      pdf.setFontSize(9.5);
      pdf.setTextColor(200, 200, 200);
      pdf.text(`Generated: ${generatedAt.toLocaleString()}`, margin, 58);

      // Cover KPI tiles
      const tiles = [
        { label: 'Completion Rate', value: `${completionRate}%` },
        { label: 'Total Equipment', value: `${stats.total_equipment || 0}` },
        { label: 'Active Packages', value: `${data?.packageBreakdown?.length || 0}` },
        { label: 'Pending Orders', value: `${stats.order_not_placed || 0}` },
      ];
      const tileW = (contentWidth - 3 * 6) / 4;
      let tx = margin;
      const tileY = 90;
      tiles.forEach((t) => {
        pdf.setDrawColor(...BRAND.border);
        pdf.setFillColor(...BRAND.surface);
        pdf.roundedRect(tx, tileY, tileW, 30, 2, 2, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.setTextColor(...BRAND.primary);
        pdf.text(t.value, tx + tileW / 2, tileY + 15, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(...BRAND.muted);
        pdf.text(t.label, tx + tileW / 2, tileY + 23, { align: 'center' });
        tx += tileW + 6;
      });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...BRAND.muted);
      const coverNote = pdf.splitTextToSize(
        'This report is generated dynamically from the equipment dataset currently loaded in Cadmatic EMS, reflecting the latest Excel import and all subsequent status updates.',
        contentWidth
      );
      pdf.text(coverNote, margin, tileY + 44);

      pdf.setFontSize(8.5);
      pdf.setTextColor(...BRAND.muted);
      pdf.text('Contents: Executive Summary · Visual Analysis · Status Breakdown · Package & Vendor Summary · Full Equipment Inventory', margin, pageHeight - 16);

      // ── PAGE 2: EXECUTIVE SUMMARY ───────────────────────────────
      pdf.addPage();
      let y = 20;
      y = sectionHeading(pdf, 'Executive Summary', y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      summarySentences.forEach((sentence) => {
        const lines = pdf.splitTextToSize(sentence, contentWidth);
        pdf.text(lines, margin, y);
        y += lines.length * 5 + 3;
      });

      y += 4;
      y = sectionHeading(pdf, 'Key Performance Indicators', y);
      const kpis = [
        { label: 'Completion Rate', value: `${completionRate}%`, color: [34, 197, 94] },
        { label: 'Total Equipment', value: `${stats.total_equipment || 0}`, color: BRAND.dark },
        { label: 'Active Packages', value: `${data?.packageBreakdown?.length || 0}`, color: [0, 123, 138] },
        { label: 'Pending Orders', value: `${stats.order_not_placed || 0}`, color: [255, 119, 0] },
      ];
      const kpiW = (contentWidth - 3 * 6) / 4;
      let kx = margin;
      kpis.forEach((k) => {
        pdf.setDrawColor(...BRAND.border);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(kx, y, kpiW, 26, 2, 2, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(...k.color);
        pdf.text(k.value, kx + kpiW / 2, y + 13, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...BRAND.muted);
        pdf.text(k.label, kx + kpiW / 2, y + 20, { align: 'center' });
        kx += kpiW + 6;
      });
      y += 26 + 10;

      // ── VISUAL ANALYSIS (real chart snapshots) ──────────────────
      if (y > pageHeight - 90) { pdf.addPage(); y = 20; }
      y = sectionHeading(pdf, 'Visual Analysis', y);

      if (barImg) {
        const w = contentWidth;
        const h = Math.min(w * barRatio, 95);
        if (y + h > pageHeight - 16) { pdf.addPage(); y = 20; }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...BRAND.dark);
        pdf.text('Equipment Count by Status', margin, y);
        y += 4;
        pdf.addImage(barImg, 'PNG', margin, y, w, h);
        y += h + 8;
      }

      if (pieImg) {
        const w = contentWidth * 0.65;
        const h = Math.min(w * pieRatio, 85);
        if (y + h > pageHeight - 16) { pdf.addPage(); y = 20; }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...BRAND.dark);
        pdf.text('Distribution Breakdown', margin, y);
        y += 4;
        pdf.addImage(pieImg, 'PNG', margin, y, w, h);
        y += h + 8;
      }

      // ── STATUS BREAKDOWN TABLE ───────────────────────────────────
      if (y > pageHeight - 40) { pdf.addPage(); y = 20; }
      y = sectionHeading(pdf, 'Status Breakdown', y);
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Status', 'Count', '% of Total']],
        body: statusData.map(s => [s.fullName, String(s.count), `${s.pct}%`]),
        theme: 'striped',
        headStyles: { fillColor: BRAND.dark, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: BRAND.surface },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 0) {
            const row = statusData[hookData.row.index];
            if (row) hookData.cell.styles.textColor = hexToRgb(row.color) || [50, 50, 50];
          }
        },
      });
      y = pdf.lastAutoTable.finalY + 10;

      // ── PACKAGE / VENDOR / TYPE SUMMARY TABLES ───────────────────
      if (y > pageHeight - 40) { pdf.addPage(); y = 20; }
      y = sectionHeading(pdf, 'Package, Vendor & Type Summary', y);

      const summaryTable = (title, rows) => {
        if (y > pageHeight - 30) { pdf.addPage(); y = 20; }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...BRAND.dark);
        pdf.text(title, margin, y);
        y += 3;
        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [[title.replace(' Summary', ''), 'Records']],
          body: (rows.length ? rows : [['No data', 0]]).slice(0, 12).map(([name, count]) => [name, String(count)]),
          theme: 'grid',
          headStyles: { fillColor: [230, 232, 235], textColor: BRAND.dark, fontSize: 8.5 },
          bodyStyles: { fontSize: 8, textColor: [60, 60, 60] },
          styles: { cellPadding: 2 },
        });
        y = pdf.lastAutoTable.finalY + 8;
      };

      summaryTable('EPC Package Summary', packageSummary);
      summaryTable('Vendor Summary', vendorSummary);
      summaryTable('Equipment Type Summary', typeSummary);

      // ── FULL EQUIPMENT INVENTORY ──────────────────────────────────
      pdf.addPage();
      y = 20;
      y = sectionHeading(pdf, `Full Equipment Inventory (${equipmentRows.length} records)`, y);
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Position ID', 'Equipment Type', 'EPC Package', 'Status', 'Location']],
        body: equipmentRows.map(item => [
          item.position_id || '—',
          item.equipment_type || 'Not specified',
          item.epc_package_name || 'Not specified',
          item.status_name || item.equip_status || 'Not specified',
          item.location || 'Not specified',
        ]),
        theme: 'striped',
        headStyles: { fillColor: BRAND.dark, textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: BRAND.surface },
        styles: { cellPadding: 1.6, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 34 }, 2: { cellWidth: 40 }, 3: { cellWidth: 40 } },
      });

      drawFooter(pdf);
      pdf.save(`cadmatic-equipment-report-${generatedAt.toISOString().slice(0, 10)}.pdf`);
      toast.success('Report downloaded', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF report', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Topbar title="Reports & Analytics" subtitle="Equipment status insights" onRefresh={() => {}} />
      <div className="page-content">

        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-muted">Report generated dynamically from the current uploaded dataset.</div>
          <button className="btn btn-primary" onClick={downloadPdf} disabled={generating}>
            {generating ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Building PDF…</> : <><Download size={15} /> Download PDF Report</>}
          </button>
        </div>

        {/* KPI Row */}
        <div className="stats-grid mb-6">
          {[
            { label: 'Completion Rate', value: `${completionRate}%`, color: '#22c55e' },
            { label: 'Total Equipment', value: stats.total_equipment || 0, color: '#141414' },
            { label: 'Active Packages', value: data?.packageBreakdown?.length || 0, color: '#007b8a' },
            { label: 'Pending Orders', value: stats.order_not_placed || 0, color: '#ff7700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card" style={{ '--accent-color': color }}>
              <div className="stat-card-value" style={{ color }}>{value}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="card mb-6">
          <div className="card-header"><span className="card-title">Executive Data Summary</span></div>
          <div style={{ display: 'grid', gap: 10 }}>
            {summarySentences.map((sentence, index) => (
              <p key={index} style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>{sentence}</p>
            ))}
          </div>
        </div>

        <div className="grid-2 mb-6">
          {/* Status Bar Chart */}
          <div className="card" ref={barChartRef}>
            <div className="card-header"><span className="card-title">Equipment Count by Status</span></div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} width={80} />
                <Tooltip
                  formatter={(v, n, p) => [v, p.payload.fullName]}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie + table */}
          <div className="card" ref={pieChartRef}>
            <div className="card-header"><span className="card-title">Distribution Breakdown</span></div>
            <div style={{ display: 'flex', gap: 16 }}>
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={statusData.filter(d => d.count > 0)} dataKey="count" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {statusData.filter(d => d.count > 0).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [v, p.payload.fullName]}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {statusData.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{s.fullName}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Status Summary Report</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => equipmentAPI.export()}>Export to Excel</button>}
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status Code</th>
                  <th>Status Name</th>
                  <th>Equipment Count</th>
                  <th>% of Total</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {statusData.map(s => (
                  <tr key={s.name}>
                    <td><span className="tag">{(data?.statusBreakdown || []).find(sb => sb.status_name === s.fullName)?.status_code ?? '—'}</span></td>
                    <td style={{ color: s.color, fontWeight: 500 }}>{s.fullName}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.pct}%</td>
                    <td style={{ width: 160 }}>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}

// Converts a CSS hex color (e.g. "#ff7700") to an [r, g, b] array for jsPDF, or null if invalid.
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return null;
  return m.slice(0, 3).map(x => parseInt(x, 16));
}
