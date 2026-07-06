import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Boxes, Lock, User, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    const dest = location.state?.from?.pathname || '/';
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(username.trim(), password, rememberMe);
      toast.success(`Welcome back, ${user.full_name || user.username}`);
      const dest = location.state?.from?.pathname || '/';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 20% 20%, rgba(255,119,0,0.08), transparent 45%), radial-gradient(circle at 80% 80%, rgba(0,123,138,0.08), transparent 45%), var(--bg-secondary)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
      }}>
        {/* Header band */}
        <div style={{
          background: 'var(--bg-secondary)',
          color: 'var(--text-on-dark)',
          padding: '32px 32px 28px',
          textAlign: 'center',
          borderBottom: '3px solid var(--accent-primary)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 8, background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <Boxes size={28} color="var(--bg-secondary)" strokeWidth={2.4} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
            color: 'inherit', marginBottom: 4,
          }}>Cadmatic EMS</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-on-dark-muted)', letterSpacing: '0.3px' }}>
            Equipment Monitoring System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '32px 32px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <ShieldCheck size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Sign in to your account
            </span>
          </div>

          {error && (
            <div style={{
              background: 'rgba(217,48,37,0.08)', border: '1px solid rgba(217,48,37,0.25)',
              color: 'var(--danger)', borderRadius: 6, padding: '10px 14px',
              fontSize: 12.5, marginBottom: 18,
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }} />
              <input
                className="form-control"
                style={{ paddingLeft: 36 }}
                type="text"
                autoFocus
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }} />
              <input
                className="form-control"
                style={{ paddingLeft: 36, paddingRight: 38 }}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', padding: 2,
                }}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              Remember me
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>

          <div style={{
            marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-subtle)',
            fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7,
          }}>
            Demo credentials — Admin: <strong style={{ color: 'var(--text-secondary)' }}>admin / Admin@123</strong><br />
            Viewer: <strong style={{ color: 'var(--text-secondary)' }}>viewer / Viewer@123</strong>
          </div>
        </form>
      </div>
    </div>
  );
}
