import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EquipmentList from './pages/EquipmentList';
import EquipmentDetail from './pages/EquipmentDetail';
import EquipmentForm from './pages/EquipmentForm';
import ImportExport from './pages/ImportExport';
import Reports from './pages/Reports';
import Maintenance from './pages/Maintenance';
import UserManagement from './pages/UserManagement';
import SystemSettings from './pages/SystemSettings';
import ActivityLogs from './pages/ActivityLogs';
import Visualization from './pages/Visualization';
import FieldManager from './pages/FieldManager';
import './App.css';

// All authenticated internal pages share this shell (sidebar + main content area)
function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
        <Menu size={18} />
      </button>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes — Admin & Viewer */}
          <Route path="/" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
          <Route path="/equipment" element={<ProtectedRoute><AppShell><EquipmentList /></AppShell></ProtectedRoute>} />
          <Route path="/equipment/:id" element={<ProtectedRoute><AppShell><EquipmentDetail /></AppShell></ProtectedRoute>} />
          <Route path="/maintenance" element={<ProtectedRoute><AppShell><Maintenance /></AppShell></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><AppShell><Reports /></AppShell></ProtectedRoute>} />
          <Route path="/visualization" element={<ProtectedRoute><AppShell><Visualization /></AppShell></ProtectedRoute>} />

          {/* Protected routes — Admin only (write/management actions) */}
          <Route path="/equipment/new" element={<ProtectedRoute adminOnly><AppShell><EquipmentForm /></AppShell></ProtectedRoute>} />
          <Route path="/equipment/:id/edit" element={<ProtectedRoute adminOnly><AppShell><EquipmentForm /></AppShell></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute adminOnly><AppShell><ImportExport /></AppShell></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AppShell><UserManagement /></AppShell></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AppShell><SystemSettings /></AppShell></ProtectedRoute>} />
          <Route path="/admin/fields" element={<ProtectedRoute adminOnly><AppShell><FieldManager /></AppShell></ProtectedRoute>} />
          <Route path="/admin/activity-logs" element={<ProtectedRoute adminOnly><AppShell><ActivityLogs /></AppShell></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '13.5px',
              boxShadow: 'var(--shadow-lg)',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
            duration: 3500,
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
