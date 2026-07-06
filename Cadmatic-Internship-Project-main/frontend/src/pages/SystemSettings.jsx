import React from 'react';
import { Settings, ShieldCheck, Database, Bell, Info } from 'lucide-react';
import Topbar from '../components/Topbar';
import { useAuth } from '../context/AuthContext';

export default function SystemSettings() {
  const { user } = useAuth();

  const settingGroups = [
    {
      title: 'Authentication & Security',
      icon: ShieldCheck,
      items: [
        { label: 'JWT Session Duration', value: '8 hours' },
        { label: 'Password Hashing', value: 'bcrypt (10 rounds)' },
        { label: 'Role-Based Access Control', value: 'Enabled (Admin / Viewer)' },
        { label: 'Failed Login Lockout', value: 'Rate-limited (500 req / 15 min)' },
      ],
    },
    {
      title: 'Database',
      icon: Database,
      items: [
        { label: 'Database Engine', value: 'Microsoft SQL Server' },
        { label: 'Connection Mode', value: 'Pooled (with dev fallback)' },
        { label: 'Activity Logging', value: 'Enabled — all admin actions tracked' },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { label: 'Overdue Maintenance Alerts', value: 'Enabled' },
        { label: 'Due-Soon Reminders (7 days)', value: 'Enabled' },
        { label: 'Critical Equipment Health Alerts', value: 'Enabled' },
      ],
    },
  ];

  return (
    <>
      <Topbar title="System Settings" subtitle="Admin Panel" onRefresh={() => {}} />
      <div className="page-content">

        <div className="card mb-6" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8, background: 'rgba(255,119,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Settings size={20} color="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>System Configuration</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Logged in as <strong>{user?.full_name}</strong> ({user?.role}). Configuration changes require backend deployment.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {settingGroups.map(({ title, icon: Icon, items }) => (
            <div key={title} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={15} color="var(--accent-primary)" />
                  <span className="card-title">{title}</span>
                </div>
              </div>
              <div>
                {items.map(({ label, value }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card mt-6" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-surface)' }}>
          <Info size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            These settings reflect the current backend configuration (environment variables, middleware, and database setup).
            To change JWT expiry, rate limits, or database connection details, update the corresponding values in the backend's
            <code style={{ background: 'var(--bg-card)', padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>.env</code> file and restart the server.
          </p>
        </div>
      </div>
    </>
  );
}
