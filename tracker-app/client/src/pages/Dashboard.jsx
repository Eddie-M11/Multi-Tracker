import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Coins,
  CreditCard,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  MessageSquare,
  Share2,
  Send,
  Sparkles,
  Sun,
  Target,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import '../styles/dashboard.css';
import '../styles/banking.css';

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) return 'No date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatRelativeTime(value) {
  if (!value) return 'Just now';

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function activityLabel(activity) {
  const labels = {
    goal_contribution: 'Progress logged',
    goal_task: 'Task completed',
    goal_task_undo: 'Task reopened',
    debt_payment: 'Debt payment',
    plan_note: 'Plan note',
    share_goal: 'Goal shared',
    share_plan: 'Plan shared',
  };

  return labels[activity.type] || 'Shared update';
}

function CosmicCompanion({ avatar }) {
  const stage = Math.min(Math.max(Number(avatar?.stage || 1), 1), 5);

  return (
    <div className={`cosmic-companion stage-${stage}`} aria-label={`Cosmic Companion stage ${stage}`}>
      <svg viewBox="0 0 260 260" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="companionCore" cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor="#f8fdff" />
            <stop offset="46%" stopColor="#9ed0ff" />
            <stop offset="100%" stopColor="#5ee0bd" />
          </radialGradient>
          <linearGradient id="companionOrbit" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <circle className="companion-aura outer" cx="130" cy="130" r="104" />
        <circle className="companion-aura inner" cx="130" cy="130" r="74" />
        {stage >= 2 && <ellipse className="companion-orbit orbit-one" cx="130" cy="130" rx="106" ry="38" />}
        {stage >= 3 && <ellipse className="companion-orbit orbit-two" cx="130" cy="130" rx="42" ry="106" />}
        {stage >= 4 && <path className="companion-wings" d="M77 135C41 124 30 91 42 65c35 7 57 29 63 61M183 135c36-11 47-44 35-70-35 7-57 29-63 61" />}
        <path className="companion-body" d="M130 51c43 0 76 36 76 82 0 48-35 80-76 80s-76-32-76-80c0-46 33-82 76-82Z" />
        <circle className="companion-eye" cx="104" cy="125" r="8" />
        <circle className="companion-eye" cx="156" cy="125" r="8" />
        <path className="companion-smile" d="M109 153c12 12 30 12 42 0" />
        {stage >= 5 && <path className="companion-crown" d="M93 65l19-31 18 27 18-27 19 31c-22 13-52 13-74 0Z" />}
        <circle className="companion-star star-one" cx="49" cy="106" r="5" />
        <circle className="companion-star star-two" cx="211" cy="91" r="4" />
        {stage >= 3 && <circle className="companion-star star-three" cx="196" cy="188" r="5" />}
      </svg>
    </div>
  );
}

function Dashboard({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [planModalError, setPlanModalError] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [isAddingPlanNote, setIsAddingPlanNote] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard/shared', { credentials: 'include' });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          navigate('/login', { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || 'Could not load shared dashboard');
        }

        if (isMounted) {
          setDashboard(data);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!selectedPlan) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeSharedPlan();
      }
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPlan]);

  const relationship = dashboard?.relationship;
  const partners = dashboard?.partners || [];
  const goals = dashboard?.goals || [];
  const plans = dashboard?.plans || [];
  const activity = dashboard?.activity || [];
  const summary = dashboard?.summary || {};
  const coupleTitle = partners.length > 1
    ? `${partners.map((partner) => partner.name.split(' ')[0]).join(' + ')}`
    : 'Couple dashboard';

  const totalSharedItems = useMemo(() => goals.length + plans.length, [goals.length, plans.length]);
  const selectedPlanPaidDown = selectedPlan
    ? Math.max(0, Number(selectedPlan.originalBalance || 0) - Number(selectedPlan.totalBalance || 0))
    : 0;
  const selectedPlanNotes = selectedPlan?.notes || [];
  const selectedPlanCheckpoints = selectedPlan?.nextCheckpoints || [];

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    navigate('/login', { replace: true });
  }

  async function openSharedPlan(plan) {
    setSelectedPlan(plan);
    setPlanNote('');
    setPlanModalError('');
    setIsPlanLoading(true);

    try {
      const response = await fetch(`/api/dashboard/shared/plans/${plan.id}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Could not load payoff plan');
      }

      setSelectedPlan(data.plan);
    } catch (loadError) {
      setPlanModalError(loadError.message);
    } finally {
      setIsPlanLoading(false);
    }
  }

  function closeSharedPlan() {
    setSelectedPlan(null);
    setPlanNote('');
    setPlanModalError('');
    setIsPlanLoading(false);
    setIsAddingPlanNote(false);
  }

  async function handleAddPlanNote(event) {
    event.preventDefault();

    if (!selectedPlan || !planNote.trim()) return;

    setIsAddingPlanNote(true);
    setPlanModalError('');

    try {
      const response = await fetch(`/api/dashboard/shared/plans/${selectedPlan.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text: planNote }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Could not add note');
      }

      setSelectedPlan(data.plan);
      setPlanNote('');
      setDashboard((currentDashboard) => {
        if (!currentDashboard) return currentDashboard;

        return {
          ...currentDashboard,
          plans: currentDashboard.plans.map((plan) => (
            plan.id === data.plan.id
              ? {
                  ...plan,
                  noteCount: data.plan.noteCount,
                  lastNoteAt: data.plan.lastNoteAt,
                  updatedAt: data.plan.updatedAt,
                }
              : plan
          )),
        };
      });
    } catch (noteError) {
      setPlanModalError(noteError.message);
    } finally {
      setIsAddingPlanNote(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar banking-sidebar" aria-label="Dashboard navigation">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span>Tracker</span>
          </div>

          <nav className="dashboard-nav banking-nav">
            <Link to="/dashboard" className="nav-item banking-nav-item active">
              <LayoutDashboard size={18} />
              Overview
            </Link>
            <Link to="/financials" className="nav-item banking-nav-item">
              <CircleDollarSign size={18} />
              Financials
            </Link>
            <Link to="/banking" className="nav-item banking-nav-item">
              <Landmark size={18} />
              Banking
            </Link>
          </nav>
        </div>

        <div className="banking-sidebar-bottom">
          <button type="button" className="banking-sidebar-action" onClick={onToggleTheme} aria-label="Toggle color theme">
            {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'light' ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" className="banking-sidebar-action" onClick={handleLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <section className="dashboard-main couple-dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">Shared dashboard</p>
            <h1>{coupleTitle}</h1>
          </div>
        </header>

        {isLoading && (
          <article className="couple-empty-panel">
            <Sparkles size={24} />
            <p>Loading shared progress...</p>
          </article>
        )}

        {!isLoading && error && (
          <article className="couple-empty-panel">
            <HeartHandshake size={24} />
            <h3>Shared dashboard unavailable</h3>
            <p>{error}</p>
          </article>
        )}

        {!isLoading && !error && dashboard && (
          <>
            <section className="couple-hero">
              <div className="couple-hero-copy">
                <p className="eyebrow">Cosmic Companion</p>
                <h2>Level {relationship.sharedLevel} guardian</h2>
                <p>
                  Shared goals and dashboard-shared payoff plans power this companion. Every shared win moves the two of you closer to the next evolution.
                </p>
                <div className="couple-xp-track" aria-label={`${relationship.levelProgress.percent}% to next level`}>
                  <span style={{ width: `${relationship.levelProgress.percent}%` }} />
                </div>
                <div className="couple-hero-meta">
                  <span>{relationship.sharedXp} shared XP</span>
                  <span>{relationship.xpToNextEvolution ? `${relationship.xpToNextEvolution} XP to next evolution` : 'Final evolution unlocked'}</span>
                </div>
              </div>

              <CosmicCompanion avatar={relationship.avatar} />
            </section>

            <section className="metric-grid couple-metric-grid" aria-label="Couple metrics">
              <article className="metric-card">
                <span className="metric-icon blue"><Trophy size={20} /></span>
                <p>Couple level</p>
                <strong>{relationship.sharedLevel}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-icon green"><Share2 size={20} /></span>
                <p>Shared items</p>
                <strong>{totalSharedItems}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-icon amber"><Coins size={20} /></span>
                <p>Couple coins</p>
                <strong>{relationship.coins}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-icon rose"><CreditCard size={20} /></span>
                <p>Shared debt</p>
                <strong>{formatMoney(summary.totalDebtRemaining)}</strong>
              </article>
            </section>

            <section className="partner-grid" aria-label="Partner stats">
              {partners.map((partner) => (
                <article className="partner-stat-card" key={partner.id}>
                  <span className="partner-avatar"><UserRound size={21} /></span>
                  <div>
                    <h3>{partner.name}</h3>
                    <p>Level {partner.level} · {partner.xp} XP · {partner.coins} coins</p>
                  </div>
                  <span className="status-pill">{partner.recentContributionCount} recent wins</span>
                </article>
              ))}
            </section>

            <section className="couple-content-grid">
              <article className="couple-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Shared goals</p>
                    <h3>Financial goals</h3>
                  </div>
                  <span className="status-pill">{goals.length} goals</span>
                </div>

                <div className="couple-list">
                  {goals.map((goal) => (
                    <Link to="/financials" className="couple-list-row" key={goal.id}>
                      <span className="row-icon green"><Target size={18} /></span>
                      <div>
                        <strong>{goal.title}</strong>
                        <small>{goal.ownerName} · {formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}</small>
                      </div>
                      <div className="row-progress">
                        <strong>{goal.progress}%</strong>
                        <span><i style={{ width: `${goal.progress}%` }} /></span>
                      </div>
                      <span>{formatDate(goal.dueDate)}</span>
                      <ChevronRight size={18} />
                    </Link>
                  ))}

                  {goals.length === 0 && (
                    <div className="couple-panel-empty">
                      <Target size={22} />
                      <p>Shared goals will show here once you create one or share a personal goal.</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="couple-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Shared payoff plans</p>
                    <h3>Debt focus</h3>
                  </div>
                  <span className="status-pill">{plans.length} plans</span>
                </div>

                <div className="couple-list">
                  {plans.map((plan) => (
                    <button
                      type="button"
                      className="couple-list-row couple-list-button"
                      key={plan.id}
                      onClick={() => openSharedPlan(plan)}
                    >
                      <span className="row-icon rose"><CreditCard size={18} /></span>
                      <div>
                        <strong>{plan.cardName}</strong>
                        <small>
                          {plan.ownerName} · {formatMoney(plan.totalBalance)} remaining
                          {plan.noteCount ? ` · ${plan.noteCount} notes` : ''}
                        </small>
                      </div>
                      <div className="row-progress debt">
                        <strong>{plan.progress}%</strong>
                        <span><i style={{ width: `${plan.progress}%` }} /></span>
                      </div>
                      <span>{formatDate(plan.targetPayoffDate)}</span>
                      <ChevronRight size={18} />
                    </button>
                  ))}

                  {plans.length === 0 && (
                    <div className="couple-panel-empty">
                      <CreditCard size={22} />
                      <p>Shared payoff plans will show here when someone shares a card plan.</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="couple-panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Recent wins</p>
                    <h3>Activity feed</h3>
                  </div>
                  <Activity size={21} />
                </div>

                <div className="activity-list">
                  {activity.map((item) => (
                    <div className="activity-row" key={item.id}>
                      <span className="row-icon blue"><CheckCircle2 size={18} /></span>
                      <div>
                        <strong>{activityLabel(item)}</strong>
                        <small>{item.actorName} · {item.title}</small>
                      </div>
                      <span>{item.xp > 0 ? `+${item.xp} XP` : `${item.xp} XP`}</span>
                      <em>{formatRelativeTime(item.createdAt)}</em>
                    </div>
                  ))}

                  {activity.length === 0 && (
                    <div className="couple-panel-empty">
                      <Sparkles size={22} />
                      <p>Shared progress will create the first activity entries.</p>
                    </div>
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </section>

      {selectedPlan && (
        <div
          className="shared-plan-modal-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && closeSharedPlan()}
        >
          <section
            className="shared-plan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-plan-title"
          >
            <div className="shared-plan-modal-header">
              <div>
                <p className="eyebrow">Shared payoff plan</p>
                <h2 id="shared-plan-title">{selectedPlan.cardName}</h2>
                <p>{selectedPlan.ownerName} · {selectedPlan.bank || 'Shared card plan'}</p>
              </div>
              <button type="button" className="shared-plan-close" onClick={closeSharedPlan} aria-label="Close payoff plan details">
                <X size={20} />
              </button>
            </div>

            {planModalError && <p className="shared-plan-error">{planModalError}</p>}

            {isPlanLoading ? (
              <div className="shared-plan-loading">
                <Sparkles size={22} />
                <p>Loading payoff details...</p>
              </div>
            ) : (
              <div className="shared-plan-modal-body">
                <section className="shared-plan-progress-card">
                  <div className="shared-plan-progress-header">
                    <div>
                      <span>Overall progress</span>
                      <strong>{selectedPlan.progress}% paid down</strong>
                    </div>
                    <CreditCard size={24} />
                  </div>
                  <div className="shared-plan-large-progress" aria-label={`${selectedPlan.progress}% paid down`}>
                    <i style={{ width: `${selectedPlan.progress}%` }} />
                  </div>
                  <p>
                    {formatMoney(selectedPlanPaidDown)} paid down from {formatMoney(selectedPlan.originalBalance)}.
                    {selectedPlan.totalBalance > 0 ? ` ${formatMoney(selectedPlan.totalBalance)} remaining.` : ' Balance cleared.'}
                  </p>
                </section>

                <section className="shared-plan-metrics" aria-label="Payoff plan summary">
                  <article>
                    <span>Remaining</span>
                    <strong>{formatMoney(selectedPlan.totalBalance)}</strong>
                  </article>
                  <article>
                    <span>Monthly target</span>
                    <strong>{formatMoney(selectedPlan.plannedMonthlyPayment)}</strong>
                  </article>
                  <article>
                    <span>Minimum</span>
                    <strong>{formatMoney(selectedPlan.minimumPayment)}</strong>
                  </article>
                  <article>
                    <span>Target date</span>
                    <strong>{formatDate(selectedPlan.targetPayoffDate)}</strong>
                  </article>
                  <article>
                    <span>Estimated payoff</span>
                    <strong>{formatDate(selectedPlan.estimatedPayoffDate)}</strong>
                  </article>
                  <article>
                    <span>Shared notes</span>
                    <strong>{selectedPlan.noteCount || 0}</strong>
                  </article>
                </section>

                <section className="shared-plan-split">
                  <article className="shared-plan-section">
                    <div className="shared-plan-section-heading">
                      <div>
                        <p className="eyebrow">Next checkpoints</p>
                        <h3>Payment path</h3>
                      </div>
                      <CalendarDays size={20} />
                    </div>

                    <div className="shared-checkpoint-list">
                      {selectedPlanCheckpoints.map((checkpoint) => (
                        <div className="shared-checkpoint-row" key={`${selectedPlan.id}-${checkpoint.month}`}>
                          <span>{formatDate(checkpoint.dueDate)}</span>
                          <strong>{formatMoney(checkpoint.payment)}</strong>
                          <small>{formatMoney(checkpoint.totalBalance)} left</small>
                        </div>
                      ))}

                      {selectedPlanCheckpoints.length === 0 && (
                        <p className="shared-plan-muted">No checkpoints are available yet.</p>
                      )}
                    </div>
                  </article>

                  <article className="shared-plan-section">
                    <div className="shared-plan-section-heading">
                      <div>
                        <p className="eyebrow">Couple notes</p>
                        <h3>Plan discussion</h3>
                      </div>
                      <MessageSquare size={20} />
                    </div>

                    <form className="shared-note-form" onSubmit={handleAddPlanNote}>
                      <label htmlFor="sharedPlanNote">Add a shared note</label>
                      <div>
                        <textarea
                          id="sharedPlanNote"
                          value={planNote}
                          onChange={(event) => setPlanNote(event.target.value)}
                          rows="3"
                          maxLength="1200"
                          placeholder="Add a quick update, reminder, or encouragement..."
                        />
                        <button type="submit" disabled={isAddingPlanNote || !planNote.trim()}>
                          <Send size={17} />
                          {isAddingPlanNote ? 'Adding...' : 'Add note'}
                        </button>
                      </div>
                    </form>

                    <div className="shared-note-list">
                      {selectedPlanNotes.map((note) => (
                        <div className="shared-note-row" key={note.id}>
                          <div>
                            <strong>{note.authorName}</strong>
                            <span>{formatRelativeTime(note.createdAt)}</span>
                          </div>
                          <p>{note.text}</p>
                        </div>
                      ))}

                      {selectedPlanNotes.length === 0 && (
                        <p className="shared-plan-muted">No shared notes yet.</p>
                      )}
                    </div>
                  </article>
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default Dashboard;
