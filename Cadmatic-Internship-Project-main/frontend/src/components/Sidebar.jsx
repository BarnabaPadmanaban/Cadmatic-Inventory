import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ListChecks, PlusCircle, Upload,
  BarChart3, Boxes, Wrench, ShieldCheck, Users, Settings, ScrollText, PieChart, SlidersHorizontal, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ListChecks, label: 'Equipment List', path: '/equipment' },
  { icon: PlusCircle, label: 'Add Equipment', path: '/equipment/new', adminOnly: true },
  { icon: Wrench, label: 'Maintenance', path: '/maintenance' },
  { icon: Upload, label: 'Import / Export', path: '/import', adminOnly: true },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: PieChart, label: 'Visualization', path: '/visualization' },
];

const adminItems = [
  { icon: Users, label: 'User Management', path: '/admin/users' },
  { icon: SlidersHorizontal, label: 'Field Manager', path: '/admin/fields' },
  { icon: Settings, label: 'System Settings', path: '/admin/settings' },
  { icon: ScrollText, label: 'Activity Logs', path: '/admin/activity-logs' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { isAdmin, user, logout } = useAuth();
  const initials = user?.full_name
    ? user.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() || 'EM';

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-mobile-header">
        <div className="sidebar-user-avatar sidebar-user-avatar-mobile">{initials}</div>
        <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close navigation">
          ×
        </button>
      </div>

      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-icon">
            <Boxes size={21} color="var(--bg-secondary)" strokeWidth={2.4} />
          </div>
          <div className="sidebar-logo-text">
            <h1>Cadmatic EMS</h1>
            <p>Equipment Monitoring</p>
          </div>
        </div>
      </div>

      <div className="sidebar-user-card">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-details">
          <div className="sidebar-user-name">{user?.full_name || user?.username || 'Guest'}</div>
          <div className="sidebar-user-role">{user?.role || 'Viewer'}</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.filter((item) => !item.adminOnly || isAdmin).map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/' || path === '/equipment'}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </div>

      {isAdmin && (
        <div className="sidebar-section">
          <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldCheck size={11} /> Admin
          </div>
          {adminItems.map(({ icon: Icon, label, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      )}

      <div className="sidebar-section">
        <button type="button" className="sidebar-nav-item logout-button" onClick={() => { logout(); onClose?.(); }}>
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-nav-item" style={{ cursor: 'default' }}>
          <div className="status-dot" />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.62)' }}>System Online</span>
        </div>
        <div style={{ padding: '4px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.42)' }}>
          v1.0.0 - EMS
        </div>
      </div>
    </aside>
  );
}
