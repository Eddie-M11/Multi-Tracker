import { useEffect, useState } from 'react';
import { CheckCircle2, HeartHandshake, LogOut, Moon, Sun, Trophy, UserRound, WalletCards } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import '../styles/dashboard.css';

const todayTasks = [
  'Send a check-in',
  'Log one shared win',
  'Plan the next reward',
];

function Dashboard({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (isMounted) {
          setUser(data.user);
        }
      } catch (error) {
        if (isMounted) {
          setUser(null);
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = user?.name || 'Welcome back';
  const level = user?.level || 1;
  const xp = user?.xp || 0;
  const coins = user?.coins || 0;

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    navigate('/login', { replace: true });
  }

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>Tracker</span>
        </div>

        <nav className="dashboard-nav">
          <Link to="/dashboard" className="nav-item active">Overview</Link>
          <Link to="/financials" className="nav-item">💸 Financials</Link>
          <a href="#partner" className="nav-item">Partner</a>
          <a href="#rewards" className="nav-item">Rewards</a>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>{displayName}</h1>
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

        <section className="hero-panel" id="overview">
          <div className="hero-copy">
            <p className="eyebrow">Relationship progress</p>
            <h2>Build momentum together.</h2>
            <p>
              Track shared habits, earn rewards, and keep the next partner action close.
            </p>
          </div>

          <a href="#partner" className="hero-action">
            <UserRound size={18} />
            View setup
          </a>
        </section>

        <section className="metric-grid" aria-label="Progress metrics">
          <article className="metric-card">
            <span className="metric-icon blue"><Trophy size={20} /></span>
            <p>Level</p>
            <strong>{level}</strong>
          </article>

          <article className="metric-card">
            <span className="metric-icon green"><CheckCircle2 size={20} /></span>
            <p>XP</p>
            <strong>{xp}</strong>
          </article>

          <article className="metric-card">
            <span className="metric-icon amber"><WalletCards size={20} /></span>
            <p>Coins</p>
            <strong>{coins}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="work-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Today</p>
                <h3>Quick starts</h3>
              </div>
              <span className="status-pill">3 open</span>
            </div>

            <div className="task-list">
              {todayTasks.map((task) => (
                <label className="task-row" key={task}>
                  <input type="checkbox" />
                  <span>{task}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="partner-panel" id="partner">
            <span className="partner-icon"><HeartHandshake size={24} /></span>
            <p className="eyebrow">Partner setup</p>
            <h3>Managed by admin</h3>
            <p>No invite code needed. Your two-user workspace is created from the admin console.</p>
          </article>
        </section>
      </section>
    </main>
  );
}

export default Dashboard;
