import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Coins,
  CreditCard,
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
  Trash2,
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

const initialCreditCardForm = {
  cardName: '',
  bank: '',
  openDate: '',
  targetPayoffDate: '',
  purchaseBalance: '',
  purchaseApr: '',
  minimumPayment: '',
  plannedMonthlyPayment: '',
  monthlyDueDay: '',
  hasCashAdvance: false,
  cashAdvanceBalance: '',
  cashAdvanceApr: '',
  cashAdvanceDate: '',
  cashAdvanceFee: '',
};

const taskRewards = {
  easy: { xp: 20, coins: 5 },
  medium: { xp: 35, coins: 8 },
  hard: { xp: 60, coins: 15 },
};

const initialTasks = [
  { title: '', difficulty: 'easy' },
  { title: '', difficulty: 'medium' },
  { title: '', difficulty: 'hard' },
];

const dueDayOptions = Array.from({ length: 31 }, (_, index) => index + 1);

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

function getTaskReward(difficulty) {
  return taskRewards[difficulty] || taskRewards.easy;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatOrdinal(number) {
  const value = Number(number);
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const lastTwo = value % 100;
  const suffix = suffixes[(lastTwo - 20) % 10] || suffixes[lastTwo] || suffixes[0];
  return `${value}${suffix}`;
}

function toMoneyNumber(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.round(numberValue * 100) / 100);
}

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function dueDateForMonth(startDate, dueDay, monthOffset) {
  const dueDate = addMonths(startDate, monthOffset);
  const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
  dueDate.setDate(Math.min(Number(dueDay || 1), lastDay));
  return dueDate;
}

function monthsUntilTarget(targetPayoffDate, dueDay) {
  if (!targetPayoffDate) return 0;

  const today = new Date();
  const targetDate = new Date(targetPayoffDate);
  let months = 1;

  while (months < 360 && dueDateForMonth(today, dueDay || 1, months - 1) < targetDate) {
    months += 1;
  }

  return months;
}

function canPayoffInMonths({ purchaseBalance, cashAdvanceBalance, purchaseApr, cashAdvanceApr, monthlyPayment, months }) {
  let purchase = toMoneyNumber(purchaseBalance);
  let cashAdvance = toMoneyNumber(cashAdvanceBalance);
  const payment = toMoneyNumber(monthlyPayment);
  const purchaseMonthlyRate = Number(purchaseApr || 0) / 100 / 12;
  const cashAdvanceMonthlyRate = Number(cashAdvanceApr || 0) / 100 / 12;

  if (payment <= 0 || months <= 0) return false;

  for (let month = 0; month < months; month += 1) {
    purchase = toMoneyNumber(purchase + (purchase * purchaseMonthlyRate));
    cashAdvance = toMoneyNumber(cashAdvance + (cashAdvance * cashAdvanceMonthlyRate));

    let remainingPayment = Math.min(payment, purchase + cashAdvance);
    const cashFirst = Number(cashAdvanceApr || 0) >= Number(purchaseApr || 0);

    if (cashFirst) {
      const cashPaid = Math.min(cashAdvance, remainingPayment);
      cashAdvance = toMoneyNumber(cashAdvance - cashPaid);
      remainingPayment = toMoneyNumber(remainingPayment - cashPaid);
      purchase = toMoneyNumber(purchase - Math.min(purchase, remainingPayment));
    } else {
      const purchasePaid = Math.min(purchase, remainingPayment);
      purchase = toMoneyNumber(purchase - purchasePaid);
      remainingPayment = toMoneyNumber(remainingPayment - purchasePaid);
      cashAdvance = toMoneyNumber(cashAdvance - Math.min(cashAdvance, remainingPayment));
    }

    if (purchase + cashAdvance <= 0) return true;
  }

  return purchase + cashAdvance <= 0;
}

function calculateRequiredCreditPayment(form) {
  const hasCashAdvance = Boolean(form.hasCashAdvance);
  const purchaseBalance = toMoneyNumber(form.purchaseBalance);
  const cashAdvanceBalance = hasCashAdvance
    ? toMoneyNumber(Number(form.cashAdvanceBalance || 0) + Number(form.cashAdvanceFee || 0))
    : 0;
  const totalBalance = toMoneyNumber(purchaseBalance + cashAdvanceBalance);
  const months = monthsUntilTarget(form.targetPayoffDate, form.monthlyDueDay);

  if (!totalBalance || !months || !form.purchaseApr) {
    return { amount: 0, months, totalBalance };
  }

  let low = 1;
  let high = Math.max(totalBalance * 1.5, Number(form.minimumPayment || 0), 50);
  const input = {
    purchaseBalance,
    cashAdvanceBalance,
    purchaseApr: Number(form.purchaseApr || 0),
    cashAdvanceApr: hasCashAdvance ? Number(form.cashAdvanceApr || 0) : 0,
    months,
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (canPayoffInMonths({ ...input, monthlyPayment: high })) break;
    high *= 1.5;
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const mid = (low + high) / 2;
    if (canPayoffInMonths({ ...input, monthlyPayment: mid })) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return {
    amount: toMoneyNumber(Math.max(high, Number(form.minimumPayment || 0))),
    months,
    totalBalance,
  };
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
  const [creditCardPlans, setCreditCardPlans] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [selectedCreditCardPlanId, setSelectedCreditCardPlanId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreditCardOpen, setIsCreditCardOpen] = useState(false);
  const [goalForm, setGoalForm] = useState(initialGoalForm);
  const [creditCardForm, setCreditCardForm] = useState(initialCreditCardForm);
  const [tasks, setTasks] = useState(initialTasks);
  const [contributions, setContributions] = useState({});
  const [notes, setNotes] = useState({});
  const [creditPayments, setCreditPayments] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) || null,
    [goals, selectedGoalId]
  );

  const selectedCreditCardPlan = useMemo(
    () => creditCardPlans.find((plan) => plan.id === selectedCreditCardPlanId) || null,
    [creditCardPlans, selectedCreditCardPlanId]
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

  const creditTotals = useMemo(() => {
    return creditCardPlans.reduce(
      (summary, plan) => ({
        balance: summary.balance + plan.totalBalance,
        original: summary.original + plan.originalBalance,
        active: summary.active + (plan.status === 'active' ? 1 : 0),
      }),
      { balance: 0, original: 0, active: 0 }
    );
  }, [creditCardPlans]);

  const creditPaymentPreview = useMemo(
    () => calculateRequiredCreditPayment(creditCardForm),
    [creditCardForm]
  );

  async function loadFinancials() {
    const [meResponse, goalsResponse, creditPlansResponse] = await Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }),
      fetch('/api/goals', { credentials: 'include' }),
      fetch('/api/credit-card-plans', { credentials: 'include' }),
    ]);

    if (!meResponse.ok) {
      navigate('/login', { replace: true });
      return;
    }

    if (!goalsResponse.ok) {
      throw new Error('Could not load financial goals');
    }

    if (!creditPlansResponse.ok) {
      throw new Error('Could not load credit card plans');
    }

    const meData = await meResponse.json();
    const goalsData = await goalsResponse.json();
    const creditPlansData = await creditPlansResponse.json();

    setUser(meData.user);
    setGoals(goalsData.goals || []);
    setCreditCardPlans(creditPlansData.plans || []);
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
    if (selectedCreditCardPlanId && !selectedCreditCardPlan) {
      setSelectedCreditCardPlanId(null);
    }
  }, [selectedCreditCardPlan, selectedCreditCardPlanId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeCreateGoal();
        closeCreditCardPlan();
      }
    }

    document.body.style.overflow = isCreateOpen || isCreditCardOpen ? 'hidden' : '';

    if (isCreateOpen || isCreditCardOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateOpen, isCreditCardOpen]);

  function handleGoalChange(event) {
    const { name, value } = event.target;
    setGoalForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function handleCreditCardChange(event) {
    const { checked, name, type, value } = event.target;
    setCreditCardForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleTaskChange(index, field, value) {
    setTasks((currentTasks) => currentTasks.map((task, taskIndex) => (
      taskIndex === index ? { ...task, [field]: value } : task
    )));
  }

  function addTaskRow() {
    setTasks((currentTasks) => [...currentTasks, { title: '', difficulty: 'easy' }]);
  }

  function deleteTaskRow(index) {
    setTasks((currentTasks) => currentTasks.filter((_, taskIndex) => taskIndex !== index));
  }

  function openCreateGoal() {
    setSelectedGoalId(null);
    setSelectedCreditCardPlanId(null);
    setIsCreateOpen(true);
    setIsCreditCardOpen(false);
    setGoalForm(initialGoalForm);
    setTasks(initialTasks);
    setMessage('');
    setError('');
  }

  function openCreditCardPlan() {
    setSelectedGoalId(null);
    setSelectedCreditCardPlanId(null);
    setIsCreateOpen(false);
    setIsCreditCardOpen(true);
    setCreditCardForm(initialCreditCardForm);
    setMessage('');
    setError('');
  }

  function closeCreditCardPlan() {
    setIsCreditCardOpen(false);
    setCreditCardForm(initialCreditCardForm);
  }

  function closeCreateGoal() {
    setIsCreateOpen(false);
    setGoalForm(initialGoalForm);
    setTasks(initialTasks);
    setIsGeneratingTasks(false);
  }

  function chooseGoalType(visibility) {
    setGoalForm((currentForm) => ({ ...currentForm, visibility }));
  }

  function upsertGoal(updatedGoal) {
    setGoals((currentGoals) => currentGoals.map((goal) => (
      goal.id === updatedGoal.id ? updatedGoal : goal
    )));
  }

  function upsertCreditCardPlan(updatedPlan) {
    setCreditCardPlans((currentPlans) => currentPlans.map((plan) => (
      plan.id === updatedPlan.id ? updatedPlan : plan
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
            xp: getTaskReward(task.difficulty).xp,
            coins: getTaskReward(task.difficulty).coins,
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

  async function handleSuggestTasks() {
    setError('');
    setMessage('');

    if (!goalForm.visibility || !goalForm.title.trim()) {
      setError('Choose a goal type and add a title before generating tasks.');
      return;
    }

    setIsGeneratingTasks(true);

    try {
      const response = await fetch('/api/goals/suggest-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: goalForm.title,
          description: goalForm.description,
          visibility: goalForm.visibility,
          targetAmount: Number(goalForm.targetAmount || 0),
          currentAmount: Number(goalForm.currentAmount || 0),
          dueDate: goalForm.dueDate,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate task suggestions');
      }

      setTasks((data.tasks || []).map((task) => ({
        title: task.title,
        description: task.description || '',
        difficulty: task.difficulty,
      })));
      setMessage('Task suggestions added. Keep what works and delete the rest.');
    } catch (suggestError) {
      setError(suggestError.message);
    } finally {
      setIsGeneratingTasks(false);
    }
  }

  async function handleCreateCreditCardPlan(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/credit-card-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...creditCardForm,
          purchaseBalance: Number(creditCardForm.purchaseBalance || 0),
          purchaseApr: Number(creditCardForm.purchaseApr || 0),
          minimumPayment: Number(creditCardForm.minimumPayment || 0),
          plannedMonthlyPayment: creditPaymentPreview.amount,
          monthlyDueDay: Number(creditCardForm.monthlyDueDay || 1),
          cashAdvanceBalance: Number(creditCardForm.cashAdvanceBalance || 0),
          cashAdvanceApr: Number(creditCardForm.cashAdvanceApr || 0),
          cashAdvanceFee: Number(creditCardForm.cashAdvanceFee || 0),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create credit card plan');
      }

      setCreditCardPlans((currentPlans) => [data.plan, ...currentPlans]);
      setCreditCardForm(initialCreditCardForm);
      setIsCreditCardOpen(false);
      setSelectedCreditCardPlanId(data.plan.id);
      setMessage(`Created payoff plan for ${data.plan.cardName}.`);
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

  async function handleCreditPayment(planId) {
    const payment = creditPayments[planId] || {};
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/credit-card-plans/${planId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: Number(payment.amount || selectedCreditCardPlan?.plannedMonthlyPayment || 0),
          note: payment.note || '',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to log payment');
      }

      upsertCreditCardPlan(data.plan);
      setCreditPayments((current) => ({ ...current, [planId]: { amount: '', note: '' } }));
      setMessage(`Great job. You paid ${formatMoney(payment.amount || selectedCreditCardPlan?.plannedMonthlyPayment)} toward ${data.plan.cardName}.`);
    } catch (paymentError) {
      setError(paymentError.message);
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
          <button type="button" className="nav-item nav-button" onClick={() => {
            setSelectedGoalId(null);
            setSelectedCreditCardPlanId(null);
          }}>Goals</button>
          <button type="button" className="nav-item nav-button" onClick={openCreateGoal}>Create</button>
          <button type="button" className="nav-item nav-button" onClick={openCreditCardPlan}>Card plan</button>
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

        {!selectedGoal && !selectedCreditCardPlan && (
          <>
            <section className="finance-hero">
              <div>
                <p className="eyebrow">Overview</p>
                <h2>Track goals and payoff plans without mixing them up.</h2>
                <p>Create savings goals, shared goals, and dedicated credit card payoff plans with clear next steps.</p>
                <div className="hero-action-row">
                  <button type="button" className="finance-primary-action" onClick={openCreateGoal}>
                    <Plus size={18} />
                    New goal
                  </button>
                  <button type="button" className="finance-secondary-action" onClick={openCreditCardPlan}>
                    <CreditCard size={18} />
                    Credit card plan
                  </button>
                </div>
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
              <article className="metric-card">
                <span className="metric-icon rose"><CreditCard size={20} /></span>
                <p>Card plans</p>
                <strong>{creditTotals.active}</strong>
              </article>
            </section>
          </>
        )}

        {!isCreateOpen && !isCreditCardOpen && (message || error) && (
          <div className="finance-alerts">
            {message && <p className="success-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}
          </div>
        )}

        {!selectedGoal && !selectedCreditCardPlan && (
          <>
            <section className="finance-section" id="goals" aria-label="Financial goals">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Goals created</p>
                  <h2>Financial goals</h2>
                </div>
                <button type="button" className="ghost-button" onClick={openCreateGoal}>
                  <Plus size={16} />
                  New goal
                </button>
              </div>

              <div className="goal-board">
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
              </div>
            </section>

            <section className="finance-section" aria-label="Credit card payoff plans">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Credit card plans</p>
                  <h2>Debt payoff plans</h2>
                </div>
                <button type="button" className="ghost-button" onClick={openCreditCardPlan}>
                  <CreditCard size={16} />
                  New card plan
                </button>
              </div>

              <div className="goal-board credit-plan-board">
                {creditCardPlans.map((plan) => (
                  <button type="button" className="goal-card goal-summary-card credit-plan-card" key={plan.id} onClick={() => setSelectedCreditCardPlanId(plan.id)}>
                    <div className="goal-card-top">
                      <div>
                        <span className="goal-type debt">Credit card</span>
                        <h3>{plan.cardName}</h3>
                        <p>{plan.bank || 'No bank added yet.'}</p>
                      </div>
                      <div className="debt-meter" aria-label={`${plan.progress}% paid down`}>
                        <span>{plan.progress}%</span>
                      </div>
                    </div>

                    <div className="goal-money-row">
                      <strong>{formatMoney(plan.totalBalance)}</strong>
                      <span>remaining</span>
                    </div>

                    <div className="goal-progress-track debt-track">
                      <span style={{ width: `${plan.progress}%` }} />
                    </div>

                    <div className="credit-card-mini-grid">
                      <span>APR <strong>{formatPercent(plan.purchaseApr)}</strong></span>
                      <span>Calculated <strong>{formatMoney(plan.plannedMonthlyPayment)}</strong></span>
                      <span>Target <strong>{formatDate(plan.targetPayoffDate)}</strong></span>
                    </div>

                    <div className="goal-card-footer">
                      <span><CalendarDays size={16} /> Due {formatOrdinal(plan.monthlyDueDay)}</span>
                      <strong>Open plan</strong>
                    </div>
                  </button>
                ))}

                {creditCardPlans.length === 0 && (
                  <article className="empty-goals">
                    <CreditCard size={30} />
                    <h3>No credit card plans yet</h3>
                    <p>Create a payoff plan with a target date, APR, and monthly payment strategy.</p>
                    <button type="button" className="finance-primary-action" onClick={openCreditCardPlan}>
                      <CreditCard size={18} />
                      Credit card plan
                    </button>
                  </article>
                )}
              </div>
            </section>
          </>
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

        {selectedCreditCardPlan && (
          <section className="goal-detail">
            <button type="button" className="back-button" onClick={() => setSelectedCreditCardPlanId(null)}>
              <ArrowLeft size={18} />
              Back to overview
            </button>

            <article className="goal-detail-hero debt-detail-hero">
              <div>
                <span className="goal-type debt">Credit card payoff</span>
                <h2>{selectedCreditCardPlan.cardName}</h2>
                <p>{selectedCreditCardPlan.bank || 'Credit card payoff plan'}</p>
              </div>
              <div className="debt-detail-meter">
                <strong>{selectedCreditCardPlan.progress}%</strong>
                <span>paid down</span>
              </div>
            </article>

            <section className="goal-detail-grid">
              <article className="finance-panel progress-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Remaining balance</p>
                    <h3>{formatMoney(selectedCreditCardPlan.totalBalance)}</h3>
                  </div>
                  <span className="status-pill">Target {formatDate(selectedCreditCardPlan.targetPayoffDate)}</span>
                </div>

                <div className="goal-progress-track large debt-track">
                  <span style={{ width: `${selectedCreditCardPlan.progress}%` }} />
                </div>

                <div className="debt-breakdown">
                  <span>Purchase balance <strong>{formatMoney(selectedCreditCardPlan.purchaseBalance)}</strong></span>
                  {selectedCreditCardPlan.hasCashAdvance && (
                    <span>Cash advance <strong>{formatMoney(selectedCreditCardPlan.cashAdvanceBalance)}</strong></span>
                  )}
                  <span>Purchase APR <strong>{formatPercent(selectedCreditCardPlan.purchaseApr)}</strong></span>
                  {selectedCreditCardPlan.hasCashAdvance && (
                    <span>Cash advance APR <strong>{formatPercent(selectedCreditCardPlan.cashAdvanceApr)}</strong></span>
                  )}
                </div>

                <div className="goal-actions credit-payment-actions">
                  <input
                    type="number"
                    min="0"
                    placeholder={formatMoney(selectedCreditCardPlan.plannedMonthlyPayment)}
                    value={creditPayments[selectedCreditCardPlan.id]?.amount || ''}
                    onChange={(event) => setCreditPayments((current) => ({
                      ...current,
                      [selectedCreditCardPlan.id]: { ...current[selectedCreditCardPlan.id], amount: event.target.value },
                    }))}
                  />
                  <input
                    placeholder="Optional note"
                    value={creditPayments[selectedCreditCardPlan.id]?.note || ''}
                    onChange={(event) => setCreditPayments((current) => ({
                      ...current,
                      [selectedCreditCardPlan.id]: { ...current[selectedCreditCardPlan.id], note: event.target.value },
                    }))}
                  />
                  <button type="button" onClick={() => handleCreditPayment(selectedCreditCardPlan.id)}>Payment made</button>
                </div>
              </article>

              <article className="finance-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Plan math</p>
                    <h3>Payment target</h3>
                  </div>
                  <span className="status-pill">Due {formatOrdinal(selectedCreditCardPlan.monthlyDueDay)}</span>
                </div>

                <div className="debt-stat-grid">
                  <span>Calculated payment <strong>{formatMoney(selectedCreditCardPlan.plannedMonthlyPayment)}</strong></span>
                  <span>Required by target <strong>{formatMoney(selectedCreditCardPlan.requiredMonthlyPayment)}</strong></span>
                  <span>Estimated interest <strong>{formatMoney(selectedCreditCardPlan.estimatedInterest)}</strong></span>
                  <span>Estimated payoff <strong>{formatDate(selectedCreditCardPlan.estimatedPayoffDate)}</strong></span>
                </div>

                {selectedCreditCardPlan.aiTips.length > 0 && (
                  <div className="ai-tip-list">
                    <p className="eyebrow">AI habits</p>
                    {selectedCreditCardPlan.aiTips.map((tip) => (
                      <p key={tip}>{tip}</p>
                    ))}
                  </div>
                )}
              </article>

              <article className="finance-panel goal-notes">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Payment schedule</p>
                    <h3>Next checkpoints</h3>
                  </div>
                  <CalendarDays size={21} />
                </div>

                <div className="schedule-list">
                  {selectedCreditCardPlan.schedule.slice(0, 6).map((item) => (
                    <div className="schedule-row" key={`${selectedCreditCardPlan.id}-${item.month}`}>
                      <span>{formatDate(item.dueDate)}</span>
                      <strong>{formatMoney(item.payment)}</strong>
                      <small>{formatMoney(item.totalBalance)} left</small>
                    </div>
                  ))}
                  {selectedCreditCardPlan.schedule.length === 0 && <p className="muted-text">No schedule available yet.</p>}
                </div>
              </article>

              <article className="finance-panel goal-notes">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Payment history</p>
                    <h3>Completed payments</h3>
                  </div>
                  <CheckCircle2 size={21} />
                </div>

                <div className="schedule-list">
                  {selectedCreditCardPlan.payments.slice().reverse().map((payment) => (
                    <div className="schedule-row" key={payment._id}>
                      <span>{formatDate(payment.paidAt)}</span>
                      <strong>{formatMoney(payment.amount)}</strong>
                      <small>{formatMoney(payment.balanceAfter)} left</small>
                    </div>
                  ))}
                  {selectedCreditCardPlan.payments.length === 0 && <p className="muted-text">No payments logged yet.</p>}
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

            {(message || error) && (
              <div className="finance-alerts modal-alerts">
                {message && <p className="success-text">{message}</p>}
                {error && <p className="error-text">{error}</p>}
              </div>
            )}

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
                    <div className="task-builder-actions">
                      <button type="button" className="task-generate-button" onClick={handleSuggestTasks} disabled={isGeneratingTasks}>
                        <Sparkles size={15} />
                        {isGeneratingTasks ? 'Generating...' : 'Generate tasks'}
                      </button>
                      <button type="button" className="task-add-button" onClick={addTaskRow}>
                        <Plus size={15} />
                        Add task
                      </button>
                    </div>
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
                      <span className="reward-pill" aria-label={`${getTaskReward(task.difficulty).xp} XP`}>
                        <strong>{getTaskReward(task.difficulty).xp}</strong>
                        XP
                      </span>
                      <span className="reward-pill" aria-label={`${getTaskReward(task.difficulty).coins} coins`}>
                        <strong>{getTaskReward(task.difficulty).coins}</strong>
                        coins
                      </span>
                      <button type="button" className="task-delete-button" onClick={() => deleteTaskRow(index)} aria-label={`Delete task ${index + 1}`}>
                        <Trash2 size={16} />
                      </button>
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

      {isCreditCardOpen && (
        <div className="create-goal-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && closeCreditCardPlan()}>
          <section
            className="finance-panel create-goal-panel create-goal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-credit-plan-title"
          >
            <div className="panel-heading modal-heading">
              <div>
                <p className="eyebrow">Credit card plan</p>
                <h3 id="create-credit-plan-title">New payoff plan</h3>
              </div>
              <button type="button" className="icon-button" onClick={closeCreditCardPlan} aria-label="Close credit card plan modal">
                <X size={18} />
              </button>
            </div>

            {(message || error) && (
              <div className="finance-alerts modal-alerts">
                {message && <p className="success-text">{message}</p>}
                {error && <p className="error-text">{error}</p>}
              </div>
            )}

            <form className="finance-form" onSubmit={handleCreateCreditCardPlan}>
              <div className="form-row">
                <div>
                  <label htmlFor="cardName">Card name</label>
                  <input id="cardName" name="cardName" value={creditCardForm.cardName} onChange={handleCreditCardChange} placeholder="Everyday rewards card" required />
                </div>
                <div>
                  <label htmlFor="bank">Bank</label>
                  <input id="bank" name="bank" value={creditCardForm.bank} onChange={handleCreditCardChange} placeholder="Chase, Capital One, local credit union..." />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label htmlFor="openDate">Open date</label>
                  <input id="openDate" name="openDate" type="date" value={creditCardForm.openDate} onChange={handleCreditCardChange} />
                </div>
                <div>
                  <label htmlFor="targetPayoffDate">Target payoff date</label>
                  <input id="targetPayoffDate" name="targetPayoffDate" type="date" value={creditCardForm.targetPayoffDate} onChange={handleCreditCardChange} required />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label htmlFor="purchaseBalance">Current balance</label>
                  <div className="adorned-input">
                    <span>$</span>
                    <input id="purchaseBalance" name="purchaseBalance" type="number" min="0" step="0.01" value={creditCardForm.purchaseBalance} onChange={handleCreditCardChange} placeholder="0.00" required />
                  </div>
                </div>
                <div>
                  <label htmlFor="purchaseApr">Purchase APR</label>
                  <div className="adorned-input suffix">
                    <input id="purchaseApr" name="purchaseApr" type="number" min="0" step="0.01" value={creditCardForm.purchaseApr} onChange={handleCreditCardChange} placeholder="0.00" required />
                    <span>%</span>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label htmlFor="minimumPayment">Minimum monthly payment</label>
                  <div className="adorned-input">
                    <span>$</span>
                    <input id="minimumPayment" name="minimumPayment" type="number" min="0" step="0.01" value={creditCardForm.minimumPayment} onChange={handleCreditCardChange} placeholder="0.00" required />
                  </div>
                </div>
                <div>
                  <label>Calculated monthly payment</label>
                  <div className="calculated-payment-card">
                    <strong>{formatMoney(creditPaymentPreview.amount)}</strong>
                    <span>{creditPaymentPreview.months ? `${creditPaymentPreview.months} monthly payments` : 'Choose a payoff date'}</span>
                  </div>
                </div>
              </div>

              <label htmlFor="monthlyDueDay">Monthly payment due day</label>
              <select id="monthlyDueDay" name="monthlyDueDay" value={creditCardForm.monthlyDueDay} onChange={handleCreditCardChange} required>
                <option value="">Choose due day</option>
                {dueDayOptions.map((day) => (
                  <option value={day} key={day}>{formatOrdinal(day)}</option>
                ))}
              </select>

              <label className="checkbox-row" htmlFor="hasCashAdvance">
                <input id="hasCashAdvance" name="hasCashAdvance" type="checkbox" checked={creditCardForm.hasCashAdvance} onChange={handleCreditCardChange} />
                Is there a cash advance balance?
              </label>

              {creditCardForm.hasCashAdvance && (
                <div className="cash-advance-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Cash advance</p>
                      <h4>Separate APR bucket</h4>
                    </div>
                    <span className="status-pill">Estimated monthly interest</span>
                  </div>

                  <div className="form-row">
                    <div>
                      <label htmlFor="cashAdvanceBalance">Cash advance balance</label>
                      <div className="adorned-input">
                        <span>$</span>
                        <input id="cashAdvanceBalance" name="cashAdvanceBalance" type="number" min="0" step="0.01" value={creditCardForm.cashAdvanceBalance} onChange={handleCreditCardChange} placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="cashAdvanceApr">Cash advance APR</label>
                      <div className="adorned-input suffix">
                        <input id="cashAdvanceApr" name="cashAdvanceApr" type="number" min="0" step="0.01" value={creditCardForm.cashAdvanceApr} onChange={handleCreditCardChange} placeholder="0.00" />
                        <span>%</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div>
                      <label htmlFor="cashAdvanceDate">Cash advance date</label>
                      <input id="cashAdvanceDate" name="cashAdvanceDate" type="date" value={creditCardForm.cashAdvanceDate} onChange={handleCreditCardChange} />
                    </div>
                    <div>
                      <label htmlFor="cashAdvanceFee">Cash advance fee</label>
                      <div className="adorned-input">
                        <span>$</span>
                        <input id="cashAdvanceFee" name="cashAdvanceFee" type="number" min="0" step="0.01" value={creditCardForm.cashAdvanceFee} onChange={handleCreditCardChange} placeholder="0.00" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" className="finance-submit" disabled={isSubmitting}>
                <CreditCard size={18} />
                {isSubmitting ? 'Creating...' : 'Create payoff plan'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Financials;
