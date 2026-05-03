import { useEffect, useState } from 'react';
import { LogOut, Moon, Plus, ShieldCheck, Sparkles, Sun, UserRound, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import '../styles/adminDashboard.css';

const initialForm = {
  name: '',
  email: '',
  password: '',
  gender: '',
  pronouns: '',
  birthday: '',
  notes: '',
};

function AdminDashboard({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAdminData() {
    const [meResponse, usersResponse] = await Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }),
      fetch('/api/admin/users', { credentials: 'include' }),
    ]);

    if (!meResponse.ok) {
      throw new Error('Please sign in as admin');
    }

    if (!usersResponse.ok) {
      throw new Error('Admin access is required');
    }

    const meData = await meResponse.json();
    const usersData = await usersResponse.json();

    setAdmin(meData.user);
    setUsers(usersData.users || []);
  }

  useEffect(() => {
    loadAdminData().catch((loadError) => setError(loadError.message));
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    navigate('/login', { replace: true });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create user');
      }

      setUsers((currentUsers) => [...currentUsers, data.user]);
      setForm(initialForm);
      setMessage(`Created ${data.user.name}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>Tracker Admin</span>
        </div>

        <nav className="dashboard-nav">
          <a href="#overview" className="nav-item active">Overview</a>
          <a href="#create-user" className="nav-item">Create User</a>
          <a href="#users" className="nav-item">Users</a>
        </nav>
      </aside>

      <section className="admin-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">Admin console</p>
            <h1>{admin?.name || 'Admin Dashboard'}</h1>
          </div>

          <div className="topbar-actions">
            <button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle color theme">
              <span className={theme === 'light' ? 'theme-option active' : 'theme-option'}>
                <Sun size={16} />
                Light
              </span>
              <span className={theme === 'dark' ? 'theme-option active' : 'theme-option'}>
                <Moon size={16} />
                Dark
              </span>
            </button>

            <button type="button" className="logout-button" onClick={handleLogout}>
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </header>

        <section className="admin-hero" id="overview">
          <div>
            <p className="eyebrow">Closed workspace</p>
            <h2>Manage the two app users from one place.</h2>
            <p>Create the accounts, review profile details, and keep dev data separate from live data.</p>
          </div>
          <span className="admin-badge">
            <ShieldCheck size={18} />
            Admin
          </span>
        </section>

        <section className="admin-metrics" aria-label="Admin stats">
          <article className="metric-card">
            <span className="metric-icon blue"><UsersRound size={20} /></span>
            <p>Users</p>
            <strong>{users.length}/2</strong>
          </article>
          <article className="metric-card">
            <span className="metric-icon green"><Sparkles size={20} /></span>
            <p>Database</p>
            <strong>Dev</strong>
          </article>
        </section>

        <section className="admin-grid">
          <article className="admin-panel" id="create-user">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Create account</p>
                <h3>Add one of the two users</h3>
              </div>
              <span className="status-pill">{2 - users.length > 0 ? `${2 - users.length} slots` : 'Full'}</span>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label htmlFor="name">Name</label>
              <input id="name" name="name" value={form.name} onChange={handleChange} required />

              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />

              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" value={form.password} onChange={handleChange} required />

              <div className="form-row">
                <div>
                  <label htmlFor="gender">Gender</label>
                  <input id="gender" name="gender" value={form.gender} onChange={handleChange} />
                </div>
                <div>
                  <label htmlFor="pronouns">Pronouns</label>
                  <input id="pronouns" name="pronouns" value={form.pronouns} onChange={handleChange} />
                </div>
              </div>

              <label htmlFor="birthday">Birthday</label>
              <input id="birthday" name="birthday" type="date" value={form.birthday} onChange={handleChange} />

              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" rows="3" value={form.notes} onChange={handleChange} />

              {message && <p className="success-text">{message}</p>}
              {error && <p className="error-text">{error}</p>}

              <button type="submit" className="admin-submit" disabled={isSubmitting || users.length >= 2}>
                <Plus size={18} />
                {isSubmitting ? 'Creating...' : 'Create user'}
              </button>
            </form>
          </article>

          <article className="admin-panel" id="users">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Users</p>
                <h3>Tracked accounts</h3>
              </div>
            </div>

            <div className="user-list">
              {users.map((user) => (
                <section className="user-card" key={user.id}>
                  <span className="user-avatar"><UserRound size={20} /></span>
                  <div>
                    <h4>{user.name}</h4>
                    <p>{user.email}</p>
                    <p>{[user.gender, user.pronouns].filter(Boolean).join(' / ') || 'Profile details pending'}</p>
                  </div>
                  <div className="user-stats">
                    <span>Level {user.level}</span>
                    <span>{user.xp} XP</span>
                    <span>{user.coins} coins</span>
                  </div>
                </section>
              ))}

              {users.length === 0 && (
                <p className="empty-state">No regular users yet. Create the first account to start the app setup.</p>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

export default AdminDashboard;
