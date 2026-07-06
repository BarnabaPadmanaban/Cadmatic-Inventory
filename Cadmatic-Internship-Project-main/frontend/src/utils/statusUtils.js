export const STATUS_MAP = {
  0: { name: 'Order Not Yet Placed', color: '#64748b', bg: 'rgba(100,116,139,0.12)', text: '#475569' },
  1: { name: 'Order Placed', color: '#2563eb', bg: 'rgba(37,99,235,0.1)', text: '#1d4ed8' },
  2: { name: 'Shipping Release Issued', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', text: '#6d28d9' },
  3: { name: 'Received at Site', color: '#c77700', bg: 'rgba(199,119,0,0.12)', text: '#a15c00' },
  4: { name: 'Erected at Location', color: '#008aa0', bg: 'rgba(0,138,160,0.1)', text: '#007282' },
  5: { name: 'Hydro Tested', color: '#05805d', bg: 'rgba(5,128,93,0.1)', text: '#04714f' },
  6: { name: 'CCC/STD Released', color: '#5f8f00', bg: 'rgba(95,143,0,0.12)', text: '#4d7600' },
  7: { name: 'Handover to O&M', color: '#ff7700', bg: 'rgba(255,119,0,0.14)', text: '#d96300' },
  8: { name: 'Commissioned', color: '#17833b', bg: 'rgba(23,131,59,0.12)', text: '#126d30' },
};

export const getStatusInfo = (code) => STATUS_MAP[code] ?? STATUS_MAP[0];

export const getProgressPercent = (code) => Math.round((parseInt(code) / 8) * 100);

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};
