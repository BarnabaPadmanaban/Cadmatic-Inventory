import React from 'react';
import { Bell, Search, RefreshCw } from 'lucide-react';

export default function Topbar({ title, subtitle, onRefresh }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="topbar-right">
        <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Refresh">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-secondary btn-sm" title="Notifications">
          <Bell size={14} />
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: 4,
          background: 'var(--accent-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 800, color: '#141414', cursor: 'pointer'
        }}>A</div>
      </div>
    </header>
  );
}
