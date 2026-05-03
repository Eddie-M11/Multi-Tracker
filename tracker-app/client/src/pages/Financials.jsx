import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Coins,
  Heart,
  LogOut,
  MessageSquare,
  Moon,
  PiggyBank,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Target,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import '../styles/financials.css';

const initialGoalForm = {
  title: '',
  description: '',
  visibility: '',
  targetAmount: '',
  currentAmount: '',
  dueDate: '',
  visualType: 'ring',
  note: '',
};

const initialTasks = [
  { title: '', difficulty: 'easy', xp: 20, coins: 5 },
  { title: '', difficulty: 'medium', xp: 35, coins: 8 },
  { title: '', difficulty: 'hard', xp: 60, coins: 15 },
];

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) return 'No due date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function VisualMeter({ goal }) {
  const progress = goal.progress || 0;

  if (goal.visualType === 'loveMeter') {
    return (
      <div className="love-meter" aria-label={`${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
        <strong>{progress}%</strong>
      </div>
    );
  }

  if (goal.visualType === 'vault') {
    return (
      <div className="vault-meter" aria-label={`${progress}% complete`}>
        <div className="vault-fill" style={{ height: `${progress}%` }} />
        <Wallet aria-hidden="true" size={30} />
      </div>
    );
  }

  return (
    <div
      className="progress-ring"
      style={{ '--progress': `${progress * 3.6}deg` }}
      aria-label={`${progress}% complete`}
    >
      <span>{progress}%</span>
    </div>
  );
}

function Financials({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [goalForm, setGoalForm] = useState(initialGoalForm);
  const [tasks, setTasks] = useState(initialTasks);
  const [contributions, setContributions] = useState({});
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) || null,
    [goals, selectedGoalId]
  );

  const totals = useMemo(() => {
    return goals.reduce(
      (summary, goal) => ({
        target: summary.target + goal.targetAmount,
        current: summary.current + goal.currentAmount,
        shared: summary.shared + (goal.visibility === 'shared' ? 1 : 0),
      }),
      { target: 0, current: 0, shared: 0 }
    );
  }, [goals]);

  async function loadFinancials() {
    const [meResponse, goalsResponse] = await Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }),
      fetch('/api/goals', { credentials: 'include' }),
    ]);

    if (!meResponse.ok) {
      navigate('/login', { replace: true });
      return;
    }

    if (!goalsResponse.ok) {
      throw new Error('Could not load financial goals');
    }

    const meData = await meResponse.json();
    const goalsData = await goalsResponse.json();

    setUser(meData.user);
    setGoals(goalsData.goals || []);
  }

  useEffect(() => {
    loadFinancials().catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    if (selectedGoalId && !selectedGoal) {
      setSelectedGoalId(null);
    }
  }, [selectedGoal, selectedGoalId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeCreateGoal();
      }
    }

    document.body.style.overflow = isCreateOpen ? 'hidden' : '';

    if (isCreateOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateOpen]);

  function handleGoalChange(event) {
    const { name, value } = event.target;
    setGoalForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function handleTaskChange(index, field, value) {
    setTasks((currentTasks) => currentTasks.map((task, taskIndex) => (
      taskIndex === index ? { ...task, [field]: value } : task
    )));
  }

  function openCreateGoal() {
    setSelectedGoalId(null);
    setIsCreateOpen(true);
    setGoalForm(initialGoalForm);
    setTasks(initialTasks);
    setMessage('');
    setError('');
  }

  function closeCreateGoal() {
    setIsCreateOpen(false);
    setGoalForm(initialGoalForm);
    setTasks(initialTasks);
  }

  function chooseGoalType(visibility) {
    setGoalForm((currentForm) => ({ ...currentForm, visibility }));
  }

  function upsertGoal(updatedGoal) {
    setGoals((currentGoals) => currentGoals.map((goal) => (
      goal.id === updatedGoal.id ? updatedGoal : goal
    )));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    navigate('/login', { replace: true });
  }

  async function handleCreateGoal(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...goalForm,
          targetAmount: Number(goalForm.targetAmount),
          currentAmount: Number(goalForm.currentAmount || 0),
          tasks: tasks.map((task) => ({
            ...task,
            xp: Number(task.xp || 0),
            coins: Number(task.coins || 0),
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create financial goal');
      }

      setGoals((currentGoals) => [data.goal, ...currentGoals]);
      setGoalForm(initialGoalForm);
      setTasks(initialTasks);
      setIsCreateOpen(false);
      setSelectedGoalId(data.goal.id);
      setMessage(`Created ${data.goal.title}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteTask(goalId, taskId) {
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/goals/${goalId}/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to complete task');
      }

      upsertGoal(data.goal);
      setMessage(`+${data.rewards.xp} XP and +${data.rewards.coins} coins. Nice work.`);
    } catch (taskError) {
      setError(taskError.message);
    }
  }

  async function handleUndoTask(goalId, taskId) {
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/goals/${goalId}/tasks/${taskId}/undo`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to undo task');
      }

      upsertGoal(data.goal);
      setMessage('Task moved back to active.');
    } catch (taskError) {
      setError(taskError.message);
    }
  }

  async function handleContribution(goalId) {
    const contribution = contributions[goalId] || {};
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/goals/${goalId}/contributions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: Number(contribution.amount || 0),
          note: contribution.note || '',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to log contribution');
      }

      upsertGoal(data.goal);
      setContributions((current) => ({ ...current, [goalId]: { amount: '', note: '' } }));
      setMessage(`Logged progress for ${data.goal.title}. +${data.rewards.xp} XP.`);
    } catch (contributionError) {
      setError(contributionError.message);
    }
  }

  async function handleAddNote(goalId) {
    const text = notes[goalId] || '';
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/goals/${goalId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add note');
      }

      upsertGoal(data.goal);
      setNotes((current) => ({ ...current, [goalId]: '' }));
      setMessage(selectedGoal?.visibility === 'shared' ? 'Chat sent.' : 'Note added.');
    } catch (noteError) {
      setError(noteError.message);
    }
  }

  return (
    <main className="dashboard-shell financials-shell">
      <aside className="dashboard-sidebar" aria-label="Financial navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>Tracker</span>
        </div>

        <nav className="dashboard-nav">
          <Link to="/dashboard" className="nav-item">Overview</Link>
          <Link to="/financials" className="nav-item active">Financials</Link>
          <button type="button" className="nav-item nav-button" onClick={() => setSelectedGoalId(null)}>Goals</button>
          <button type="button" className="nav-item nav-button" onClick={openCreateGoal}>Create</button>
        </nav>
      </aside>

      <section className="dashboard-main financials-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">Financials</p>
            <h1>{user?.name ? `${user.name}'s money goals` : 'Money goals'}</h1>
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

        {!selectedGoal && (
          <>
            <section className="finance-hero">
              <div>
                <p className="eyebrow">Overview</p>
                <h2>Track the goal first. Work the details inside it.</h2>
                <p>Create personal goals for solo progress or shared goals with notes, chat, tasks, and team XP in one place.</p>
                <button type="button" className="finance-primary-action" onClick={openCreateGoal}>
                  <Plus size={18} />
                  New goal
                </button>
              </div>

              <div className="finance-hero-stat">
                <PiggyBank size={26} />
                <span>{formatMoney(totals.current)}</span>
                <p>tracked toward {formatMoney(totals.target)}</p>
              </div>
            </section>

            <section className="finance-summary">
              <article className="metric-card">
                <span className="metric-icon blue"><Target size={20} /></span>
                <p>Active goals</p>
                <strong>{goals.length}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-icon green"><Heart size={20} /></span>
                <p>Shared goals</p>
                <strong>{totals.shared}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-icon amber"><Coins size={20} /></span>
                <p>Progress</p>
                <strong>{totals.target ? Math.round((totals.current / totals.target) * 100) : 0}%</strong>
              </article>
            </section>
          </>
        )}

        {(message || error) && (
          <div className="finance-alerts">
            {message && <p className="success-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}
          </div>
        )}

        {!selectedGoal && (
          <section className="goal-board" id="goals" aria-label="Financial goals">
            {goals.map((goal) => (
              <button type="button" className="goal-card goal-summary-card" key={goal.id} onClick={() => setSelectedGoalId(goal.id)}>
                <div className="goal-card-top">
                  <div>
                    <span className={goal.visibility === 'shared' ? 'goal-type shared' : 'goal-type'}>
                      {goal.visibility === 'shared' ? 'Shared' : 'Personal'}
                    </span>
                    <h3>{goal.title}</h3>
                    <p>{goal.description || 'No description yet.'}</p>
                  </div>
                  <VisualMeter goal={goal} />
                </div>

                <div className="goal-money-row">
                  <strong>{formatMoney(goal.currentAmount)}</strong>
                  <span>of {formatMoney(goal.targetAmount)}</span>
                </div>

                <div className="goal-progress-track">
                  <span style={{ width: `${goal.progress}%` }} />
                </div>

                <div className="goal-card-footer">
                  <span><CalendarDays size={16} /> {formatDate(goal.dueDate)}</span>
                  <strong>Open goal</strong>
                </div>
              </button>
            ))}

            {goals.length === 0 && (
              <article className="empty-goals">
                <Target size={30} />
                <h3>No financial goals yet</h3>
                <p>Create your first goal and start stacking XP for every little money win.</p>
                <button type="button" className="finance-primary-action" onClick={openCreateGoal}>
                  <Plus size={18} />
                  New goal
                </button>
              </article>
            )}
          </section>
        )}

        {selectedGoal && (
          <section className="goal-detail">
            <button type="button" className="back-button" onClick={() => setSelectedGoalId(null)}>
              <ArrowLeft size={18} />
              Back to overview
            </button>

            <article className="goal-detail-hero">
              <div>
                <span className={selectedGoal.visibility === 'shared' ? 'goal-type shared' : 'goal-type'}>
                  {selectedGoal.visibility === 'shared' ? 'Shared' : 'Personal'}
                </span>
                <h2>{selectedGoal.title}</h2>
                <p>{selectedGoal.description || 'No description yet.'}</p>
              </div>
              <VisualMeter goal={selectedGoal} />
            </article>

            <section className="goal-detail-grid">
              <article className="finance-panel progress-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Progress</p>
                    <h3>{formatMoney(selectedGoal.currentAmount)}</h3>
                  </div>
                  <span className="status-pill">of {formatMoney(selectedGoal.targetAmount)}</span>
                </div>

                <div className="goal-progress-track large">
                  <span style={{ width: `${selectedGoal.progress}%` }} />
                </div>

                <div className="detail-meta-row">
                  <span><CalendarDays size={16} /> {formatDate(selectedGoal.dueDate)}</span>
                  {selectedGoal.visibility === 'shared' && <span><Sparkles size={16} /> Level {selectedGoal.sharedLevel}</span>}
                </div>

                <div className="goal-actions">
                  <input
                    type="number"
                    min="0"
                    placeholder="$ progress"
                    value={contributions[selectedGoal.id]?.amount || ''}
                    onChange={(event) => setContributions((current) => ({
                      ...current,
                      [selectedGoal.id]: { ...current[selectedGoal.id], amount: event.target.value },
                    }))}
                  />
                  <input
                    placeholder="Optional note"
                    value={contributions[selectedGoal.id]?.note || ''}
                    onChange={(event) => setContributions((current) => ({
                      ...current,
                      [selectedGoal.id]: { ...current[selectedGoal.id], note: event.target.value },
                    }))}
                  />
                  <button type="button" onClick={() => handleContribution(selectedGoal.id)}>Log progress</button>
                </div>
              </article>

              <article className="finance-panel goal-task-list">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Tasks</p>
                    <h3>At hand</h3>
                  </div>
                  <span className="status-pill">{selectedGoal.tasks.filter((task) => task.completed).length}/{selectedGoal.tasks.length} done</span>
                </div>

                {selectedGoal.tasks.length === 0 && <p className="muted-text">No tasks yet.</p>}
                {selectedGoal.tasks.map((task) => (
                  <div className={task.completed ? 'goal-task complete' : 'goal-task'} key={task._id}>
                    <span>{task.completed ? <CheckCircle2 size={18} /> : <Target size={18} />}</span>
                    <strong>{task.title}</strong>
                    <small>{task.xp} XP / {task.coins} coins</small>
                    {task.completed ? (
                      <button type="button" className="task-undo-button" onClick={() => handleUndoTask(selectedGoal.id, task._id)} aria-label={`Undo ${task.title}`}>
                        <RotateCcw size={16} />
                        Undo
                      </button>
                    ) : (
                      <button type="button" className="task-complete-button" onClick={() => handleCompleteTask(selectedGoal.id, task._id)}>
                        Complete
                      </button>
                    )}
                  </div>
                ))}
              </article>

              <article className="finance-panel goal-notes">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{selectedGoal.visibility === 'shared' ? 'Chat' : 'Notes'}</p>
                    <h3>{selectedGoal.visibility === 'shared' ? 'Goal conversation' : 'Goal notes'}</h3>
                  </div>
                  <MessageSquare size={21} />
                </div>

                <div className="note-list">
                  {selectedGoal.notes.map((note) => (
                    <p key={note._id}><strong>{note.authorName}:</strong> {note.text}</p>
                  ))}
                  {selectedGoal.notes.length === 0 && <p className="muted-text">No notes yet.</p>}
                </div>

                <div className="note-action">
                  <input
                    placeholder={selectedGoal.visibility === 'shared' ? 'Send a chat message...' : 'Add a note...'}
                    value={notes[selectedGoal.id] || ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [selectedGoal.id]: event.target.value }))}
                  />
                  <button type="button" onClick={() => handleAddNote(selectedGoal.id)}>
                    {selectedGoal.visibility === 'shared' ? 'Send' : 'Add'}
                  </button>
                </div>
              </article>
            </section>
          </section>
        )}
      </section>

      {isCreateOpen && (
        <div className="create-goal-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && closeCreateGoal()}>
          <section
            className="finance-panel create-goal-panel create-goal-modal"
            id="create-goal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-goal-title"
          >
            <div className="panel-heading modal-heading">
              <div>
                <p className="eyebrow">Create goal</p>
                <h3 id="create-goal-title">New financial goal</h3>
              </div>
              <button type="button" className="icon-button" onClick={closeCreateGoal} aria-label="Close create goal modal">
                <X size={18} />
              </button>
            </div>

            <div className="goal-type-picker" aria-label="Choose goal type">
              <button
                type="button"
                className={goalForm.visibility === 'personal' ? 'type-option selected' : 'type-option'}
                onClick={() => chooseGoalType('personal')}
              >
                <Target size={22} />
                <span>Personal</span>
                <small>Only your progress and notes.</small>
              </button>
              <button
                type="button"
                className={goalForm.visibility === 'shared' ? 'type-option selected' : 'type-option'}
                onClick={() => chooseGoalType('shared')}
              >
                <Users size={22} />
                <span>Shared</span>
                <small>Team notes, chat, tasks, and XP.</small>
              </button>
            </div>

            {goalForm.visibility && (
              <form className="finance-form" onSubmit={handleCreateGoal}>
                <label htmlFor="title">Goal title</label>
                <input id="title" name="title" value={goalForm.title} onChange={handleGoalChange} placeholder="Save $1,000 emergency fund" required />

                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" value={goalForm.description} onChange={handleGoalChange} rows="3" placeholder="Why this goal matters..." />

                <div className="form-row">
                  <div>
                    <label htmlFor="visualType">Visual</label>
                    <select id="visualType" name="visualType" value={goalForm.visualType} onChange={handleGoalChange}>
                      <option value="ring">Progress ring</option>
                      <option value="loveMeter">Love meter</option>
                      <option value="vault">Vault fill</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="dueDate">Due date</label>
                    <input id="dueDate" name="dueDate" type="date" value={goalForm.dueDate} onChange={handleGoalChange} />
                  </div>
                </div>

                <div className="form-row">
                  <div>
                    <label htmlFor="targetAmount">Target amount</label>
                    <input id="targetAmount" name="targetAmount" type="number" min="0" value={goalForm.targetAmount} onChange={handleGoalChange} required />
                  </div>
                  <div>
                    <label htmlFor="currentAmount">Current amount</label>
                    <input id="currentAmount" name="currentAmount" type="number" min="0" value={goalForm.currentAmount} onChange={handleGoalChange} />
                  </div>
                </div>

                <label htmlFor="note">Opening note</label>
                <textarea id="note" name="note" value={goalForm.note} onChange={handleGoalChange} rows="2" placeholder="Leave yourself or the team a note..." />

                <div className="task-builder">
                  <div className="panel-heading">
                    <h4>Starter tasks</h4>
                    <span>Optional launch list</span>
                  </div>

                  {tasks.map((task, index) => (
                    <div className="task-builder-row" key={`task-${index + 1}`}>
                      <input
                        value={task.title}
                        onChange={(event) => handleTaskChange(index, 'title', event.target.value)}
                        placeholder={`Task ${index + 1}`}
                      />
                      <select value={task.difficulty} onChange={(event) => handleTaskChange(index, 'difficulty', event.target.value)}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <input type="number" min="0" value={task.xp} onChange={(event) => handleTaskChange(index, 'xp', event.target.value)} aria-label="XP reward" />
                      <input type="number" min="0" value={task.coins} onChange={(event) => handleTaskChange(index, 'coins', event.target.value)} aria-label="Coin reward" />
                    </div>
                  ))}
                </div>

                <button type="submit" className="finance-submit" disabled={isSubmitting}>
                  <Plus size={18} />
                  {isSubmitting ? 'Creating...' : 'Create goal'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default Financials;
