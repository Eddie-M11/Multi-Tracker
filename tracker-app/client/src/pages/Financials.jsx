import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Coins,
  CreditCard,
  LayoutDashboard,
  Landmark,
  LogOut,
  MessageSquare,
  Moon,
  PiggyBank,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
  Sun,
  Target,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import '../styles/banking.css';
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
  sharedToDashboard: false,
};

const initialCreditCardForm = {
  linkedBankingAccountId: '',
  linkedPlaidAccountId: '',
  linkedInstitutionName: '',
  linkedAccountMask: '',
  balanceSource: 'manual',
  balanceSyncedAt: '',
  sharedToDashboard: false,
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

function formatOptionalMoney(value) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  return formatMoney(value);
}

function formatDate(value) {
  if (!value) return 'No due date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatRelativeTime(value) {
  if (!value) return 'Not synced';

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDateDistance(value) {
  if (!value) return 'No date set';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(value);
  targetDate.setHours(0, 0, 0, 0);

  const days = Math.round((targetDate - today) / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  if (days === -1) return 'Yesterday';
  return `${Math.abs(days)} days ago`;
}

function getTaskReward(difficulty) {
  return taskRewards[difficulty] || taskRewards.easy;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatOptionalPercent(value) {
  if (value === null || value === undefined || value === '') return 'Manual entry';
  return formatPercent(value);
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

function getDateDay(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return String(date.getUTCDate());
}

function getCreditCardLabel(account) {
  const name = account.officialName || account.name || 'Credit card';
  const mask = account.mask ? `...${account.mask}` : '';
  return [name, mask].filter(Boolean).join(' ');
}

function formatAprType(value) {
  const labels = {
    balance_transfer_apr: 'Balance transfer',
    cash_apr: 'Cash advance',
    purchase_apr: 'Purchase',
    special: 'Special',
  };

  return labels[value] || 'APR';
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
  const [bankingAccounts, setBankingAccounts] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [selectedCreditCardPlanId, setSelectedCreditCardPlanId] = useState(null);
  const [focusedGoalId, setFocusedGoalId] = useState(() => localStorage.getItem('tracker:focused-goal-id') || '');
  const [focusedDebtPlanId, setFocusedDebtPlanId] = useState(() => localStorage.getItem('tracker:focused-debt-plan-id') || '');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreditCardOpen, setIsCreditCardOpen] = useState(false);
  const [goalForm, setGoalForm] = useState(initialGoalForm);
  const [creditCardForm, setCreditCardForm] = useState(initialCreditCardForm);
  const [tasks, setTasks] = useState(initialTasks);
  const [contributions, setContributions] = useState({});
  const [notes, setNotes] = useState({});
  const [newGoalTasks, setNewGoalTasks] = useState({});
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

  const bankingCreditCards = useMemo(() => {
    return bankingAccounts
      .filter((account) => account.accountCategory === 'credit-card' && account.status !== 'hidden')
      .sort((firstAccount, secondAccount) => (
        getCreditCardLabel(firstAccount).localeCompare(getCreditCardLabel(secondAccount))
      ));
  }, [bankingAccounts]);

  const selectedBankingCreditCard = useMemo(() => {
    return bankingCreditCards.find((account) => account.id === creditCardForm.linkedBankingAccountId) || null;
  }, [bankingCreditCards, creditCardForm.linkedBankingAccountId]);

  const overallGoalProgress = totals.target > 0
    ? Math.min(Math.round((totals.current / totals.target) * 100), 100)
    : 0;

  const nextGoalDue = useMemo(() => {
    return goals
      .filter((goal) => goal.dueDate && goal.status !== 'completed')
      .slice()
      .sort((firstGoal, secondGoal) => new Date(firstGoal.dueDate) - new Date(secondGoal.dueDate))[0] || null;
  }, [goals]);

  const automaticGoalFocus = useMemo(() => {
    return goals
      .slice()
      .sort((firstGoal, secondGoal) => {
        if (secondGoal.progress !== firstGoal.progress) return secondGoal.progress - firstGoal.progress;
        return new Date(firstGoal.dueDate || '9999-12-31') - new Date(secondGoal.dueDate || '9999-12-31');
      })[0] || null;
  }, [goals]);

  const automaticDebtFocus = useMemo(() => {
    return creditCardPlans
      .slice()
      .sort((firstPlan, secondPlan) => secondPlan.totalBalance - firstPlan.totalBalance)[0] || null;
  }, [creditCardPlans]);

  const goalFocus = useMemo(() => {
    return goals.find((goal) => goal.id === focusedGoalId) || automaticGoalFocus;
  }, [automaticGoalFocus, focusedGoalId, goals]);

  const debtFocus = useMemo(() => {
    return creditCardPlans.find((plan) => plan.id === focusedDebtPlanId) || automaticDebtFocus;
  }, [automaticDebtFocus, creditCardPlans, focusedDebtPlanId]);

  async function loadFinancials() {
    const [meResponse, goalsResponse, creditPlansResponse, bankingResponse] = await Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }),
      fetch('/api/goals', { credentials: 'include' }),
      fetch('/api/credit-card-plans', { credentials: 'include' }),
      fetch('/api/banking', { credentials: 'include' }),
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
    const bankingData = bankingResponse.ok ? await bankingResponse.json() : { profile: { accounts: [] } };

    setUser(meData.user);
    setGoals(goalsData.goals || []);
    setCreditCardPlans(creditPlansData.plans || []);
    setBankingAccounts(bankingData.profile?.accounts || []);
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
    if (focusedGoalId) {
      localStorage.setItem('tracker:focused-goal-id', focusedGoalId);
    } else {
      localStorage.removeItem('tracker:focused-goal-id');
    }
  }, [focusedGoalId]);

  useEffect(() => {
    if (focusedDebtPlanId) {
      localStorage.setItem('tracker:focused-debt-plan-id', focusedDebtPlanId);
    } else {
      localStorage.removeItem('tracker:focused-debt-plan-id');
    }
  }, [focusedDebtPlanId]);

  useEffect(() => {
    if (focusedGoalId && !goals.some((goal) => goal.id === focusedGoalId)) {
      setFocusedGoalId('');
    }
  }, [focusedGoalId, goals]);

  useEffect(() => {
    if (focusedDebtPlanId && !creditCardPlans.some((plan) => plan.id === focusedDebtPlanId)) {
      setFocusedDebtPlanId('');
    }
  }, [creditCardPlans, focusedDebtPlanId]);

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
    const { checked, name, type, value } = event.target;
    setGoalForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleCreditCardChange(event) {
    const { checked, name, type, value } = event.target;

    if (name === 'linkedBankingAccountId') {
      applyLinkedCreditCard(value);
      return;
    }

    setCreditCardForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function applyLinkedCreditCard(accountId) {
    const linkedAccount = bankingCreditCards.find((account) => account.id === accountId);

    if (!linkedAccount) {
      setCreditCardForm((currentForm) => ({
        ...currentForm,
        linkedBankingAccountId: '',
        linkedPlaidAccountId: '',
        linkedInstitutionName: '',
        linkedAccountMask: '',
        balanceSource: 'manual',
        balanceSyncedAt: '',
      }));
      return;
    }

    const balance = Math.max(0, toMoneyNumber(linkedAccount.currentBalance ?? linkedAccount.lastStatementBalance));
    const minimumPayment = linkedAccount.minimumPaymentAmount ?? '';
    const purchaseApr = linkedAccount.purchaseApr ?? '';

    setCreditCardForm((currentForm) => ({
      ...currentForm,
      linkedBankingAccountId: linkedAccount.id,
      linkedPlaidAccountId: linkedAccount.plaidAccountId || '',
      linkedInstitutionName: linkedAccount.institutionName || '',
      linkedAccountMask: linkedAccount.mask || '',
      balanceSource: 'banking',
      balanceSyncedAt: linkedAccount.lastSyncedAt || '',
      cardName: linkedAccount.officialName || linkedAccount.name || currentForm.cardName,
      bank: linkedAccount.institutionName || currentForm.bank,
      purchaseBalance: balance ? String(balance) : currentForm.purchaseBalance,
      minimumPayment: minimumPayment !== null && minimumPayment !== undefined && minimumPayment !== ''
        ? String(minimumPayment)
        : currentForm.minimumPayment,
      purchaseApr: purchaseApr !== null && purchaseApr !== undefined && purchaseApr !== ''
        ? String(purchaseApr)
        : currentForm.purchaseApr,
      monthlyDueDay: getDateDay(linkedAccount.nextPaymentDueDate) || currentForm.monthlyDueDay,
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
    setGoalForm((currentForm) => ({
      ...currentForm,
      visibility,
      sharedToDashboard: visibility === 'shared' ? true : currentForm.sharedToDashboard,
    }));
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

  function updateNewGoalTask(goalId, field, value) {
    setNewGoalTasks((currentTasks) => ({
      ...currentTasks,
      [goalId]: {
        title: '',
        difficulty: 'easy',
        ...currentTasks[goalId],
        [field]: value,
      },
    }));
  }

  function ownsItem(item) {
    return user?.id && item?.ownerId && String(item.ownerId) === String(user.id);
  }

  async function handleGoalDashboardShare(goal) {
    if (goal.visibility === 'shared') return;

    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/goals/${goal.id}/dashboard-share`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ sharedToDashboard: !goal.sharedToDashboard }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update dashboard sharing');
      }

      upsertGoal(data.goal);
      setMessage(data.goal.sharedToDashboard ? `${data.goal.title} is shared to the dashboard.` : `${data.goal.title} is private again.`);
    } catch (shareError) {
      setError(shareError.message);
    }
  }

  async function handlePlanDashboardShare(plan) {
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/credit-card-plans/${plan.id}/dashboard-share`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ sharedToDashboard: !plan.sharedToDashboard }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update dashboard sharing');
      }

      upsertCreditCardPlan(data.plan);
      setMessage(data.plan.sharedToDashboard ? `${data.plan.cardName} is shared to the dashboard.` : `${data.plan.cardName} is private again.`);
    } catch (shareError) {
      setError(shareError.message);
    }
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

  async function handleAddGoalTask(goalId) {
    const nextTask = newGoalTasks[goalId] || { title: '', difficulty: 'easy' };
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/goals/${goalId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(nextTask),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add task');
      }

      upsertGoal(data.goal);
      setNewGoalTasks((currentTasks) => ({
        ...currentTasks,
        [goalId]: { title: '', difficulty: nextTask.difficulty || 'easy' },
      }));
      setMessage('Task added.');
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

  async function handleDeleteGoal(goal) {
    if (!window.confirm(`Delete "${goal.title}"? This cannot be undone.`)) return;

    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete goal');
      }

      setGoals((currentGoals) => currentGoals.filter((currentGoal) => currentGoal.id !== goal.id));
      setSelectedGoalId(null);
      setFocusedGoalId((currentFocus) => (currentFocus === goal.id ? '' : currentFocus));
      setMessage(`Deleted ${goal.title}.`);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function handleDeleteCreditCardPlan(plan) {
    if (!window.confirm(`Delete "${plan.cardName}"? This cannot be undone.`)) return;

    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/credit-card-plans/${plan.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete payoff plan');
      }

      setCreditCardPlans((currentPlans) => currentPlans.filter((currentPlan) => currentPlan.id !== plan.id));
      setSelectedCreditCardPlanId(null);
      setFocusedDebtPlanId((currentFocus) => (currentFocus === plan.id ? '' : currentFocus));
      setMessage(`Deleted ${plan.cardName}.`);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <main className="dashboard-shell financials-shell">
      <aside className="dashboard-sidebar banking-sidebar" aria-label="Financial navigation">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span>Tracker</span>
          </div>

          <nav className="dashboard-nav banking-nav">
            <Link to="/dashboard" className="nav-item banking-nav-item">
              <LayoutDashboard size={18} />
              Overview
            </Link>
            <Link to="/financials" className="nav-item banking-nav-item active">
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

      <section className="dashboard-main financials-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">Financials</p>
            <h1>{user?.name ? `${user.name}'s money goals` : 'Money goals'}</h1>
          </div>
        </header>

        {!selectedGoal && !selectedCreditCardPlan && (
          <>
            <section className="finance-hero">
              <div className="finance-snapshot-grid" aria-label="Financial snapshot">
                <div className="finance-snapshot-card">
                  <span className="banking-snapshot-icon green"><PiggyBank size={22} /></span>
                  <div>
                    <small>Tracked</small>
                    <strong>{formatMoney(totals.current)}</strong>
                    <em>of {formatMoney(totals.target)}</em>
                  </div>
                </div>

                <div className="finance-snapshot-card">
                  <span className="banking-snapshot-icon blue"><Target size={22} /></span>
                  <div>
                    <small>Active goals</small>
                    <strong>{goals.length}</strong>
                    <em>{totals.shared} shared</em>
                  </div>
                </div>

                <div className="finance-snapshot-card">
                  <span className="banking-snapshot-icon green"><Coins size={22} /></span>
                  <div>
                    <small>Progress</small>
                    <strong>{overallGoalProgress}%</strong>
                    <em>Across goals</em>
                  </div>
                </div>

                <div className="finance-snapshot-card">
                  <span className="banking-snapshot-icon rose"><CreditCard size={22} /></span>
                  <div>
                    <small>Card plans</small>
                    <strong>{creditTotals.active}</strong>
                    <em>{formatMoney(creditTotals.balance)} owed</em>
                  </div>
                </div>

                <div className="finance-snapshot-card">
                  <span className="banking-snapshot-icon blue"><CalendarDays size={22} /></span>
                  <div>
                    <small>Next target</small>
                    <strong>{nextGoalDue ? formatDate(nextGoalDue.dueDate) : 'Not set'}</strong>
                    <em>{nextGoalDue?.title || 'No upcoming goal'}</em>
                  </div>
                </div>
              </div>

              <div className="finance-hero-actions">
                <button type="button" className="finance-primary-action" onClick={openCreateGoal}>
                  <Plus size={18} />
                  New goal
                </button>
                <button type="button" className="finance-secondary-action" onClick={openCreditCardPlan}>
                  <CreditCard size={18} />
                  Card plan
                </button>
              </div>
            </section>

            <section className="finance-focus-grid">
              <article className="finance-panel finance-focus-card">
                <div className="banking-panel-title">
                  <span className="banking-snapshot-icon green"><Target size={21} /></span>
                  <h3>Goal focus</h3>
                </div>

                {goalFocus ? (
                  <>
                    <div className="finance-focus-main">
                      <strong>{goalFocus.title}</strong>
                      <span>{formatMoney(goalFocus.currentAmount)} of {formatMoney(goalFocus.targetAmount)}</span>
                    </div>
                    <div className="goal-progress-track">
                      <span style={{ width: `${goalFocus.progress}%` }} />
                    </div>
                    <div className="detail-meta-row">
                      <span>{goalFocus.progress}% complete</span>
                      <span>{formatDate(goalFocus.dueDate)}</span>
                    </div>
                  </>
                ) : (
                  <p className="muted-text">No goals yet.</p>
                )}
              </article>

              <article className="finance-panel finance-focus-card">
                <div className="banking-panel-title">
                  <span className="banking-snapshot-icon rose"><CreditCard size={21} /></span>
                  <h3>Debt focus</h3>
                </div>

                {debtFocus ? (
                  <>
                    <div className="finance-focus-main">
                      <strong>{debtFocus.cardName}</strong>
                      <span>{formatMoney(debtFocus.totalBalance)} remaining</span>
                    </div>
                    <div className="goal-progress-track debt-track">
                      <span style={{ width: `${debtFocus.progress}%` }} />
                    </div>
                    <div className="detail-meta-row">
                      <span>{formatMoney(debtFocus.plannedMonthlyPayment)} monthly</span>
                      <span>{formatDate(debtFocus.targetPayoffDate)}</span>
                    </div>
                  </>
                ) : (
                  <p className="muted-text">No debt payoff plans yet.</p>
                )}
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
          <section className="finance-dashboard-grid">
            <article className="finance-panel finance-table-panel" id="goals" aria-label="Financial goals">
              <div className="banking-panel-title">
                <span className="banking-snapshot-icon green"><PiggyBank size={21} /></span>
                <h3>Financial goals</h3>
                <span className="banking-count-pill">{goals.length} goals</span>
                <button type="button" className="ghost-button" onClick={openCreateGoal}>
                  <Plus size={16} />
                  New goal
                </button>
              </div>

              <div className="finance-table-list finance-goal-list">
                {goals.length > 0 && (
                  <div className="finance-table-header finance-goal-row">
                    <span>Goal</span>
                    <span>Type</span>
                    <span>Current / Target</span>
                    <span>Progress</span>
                    <span>Due date</span>
                    <span>Focus</span>
                  </div>
                )}

                {goals.map((goal) => (
                  <article
                    className={goalFocus?.id === goal.id ? 'finance-data-row finance-goal-row is-focused' : 'finance-data-row finance-goal-row'}
                    key={goal.id}
                  >
                    <button type="button" className="finance-row-name-button" onClick={() => setSelectedGoalId(goal.id)}>
                      <span className={goal.visibility === 'shared' ? 'finance-row-icon shared' : 'finance-row-icon'}>
                        {goal.visibility === 'shared' ? <Users size={18} /> : <Target size={18} />}
                      </span>
                      <span className="finance-name-cell">
                        <strong>{goal.title}</strong>
                        <small>{goal.description || 'No description yet.'}</small>
                      </span>
                    </button>

                    <div className="finance-cell">
                      <span className={goal.visibility === 'shared' ? 'finance-type-label shared' : 'finance-type-label'}>
                        {goal.visibility === 'shared' ? 'Shared' : 'Personal'}
                      </span>
                    </div>

                    <div className="finance-cell finance-money-cell">
                      <strong>{formatMoney(goal.currentAmount)}</strong>
                      <span>of {formatMoney(goal.targetAmount)}</span>
                    </div>

                    <div className="finance-cell finance-progress-cell">
                      <strong>{goal.progress}%</strong>
                      <div className="finance-mini-progress">
                        <span style={{ width: `${goal.progress}%` }} />
                      </div>
                    </div>

                    <div className="finance-cell">
                      <strong>{formatDate(goal.dueDate)}</strong>
                      <span>{formatDateDistance(goal.dueDate)}</span>
                    </div>

                    <div className="finance-row-actions">
                      {goal.visibility === 'shared' ? (
                        <span className="finance-share-status active"><Share2 size={15} /> Shared</span>
                      ) : ownsItem(goal) && (
                        <button
                          type="button"
                          className={goal.sharedToDashboard ? 'finance-share-button active' : 'finance-share-button'}
                          onClick={() => handleGoalDashboardShare(goal)}
                        >
                          <Share2 size={15} />
                          {goal.sharedToDashboard ? 'Shared' : 'Share'}
                        </button>
                      )}
                      <button
                        type="button"
                        className={goalFocus?.id === goal.id ? 'finance-focus-button active' : 'finance-focus-button'}
                        onClick={() => setFocusedGoalId(goal.id)}
                      >
                        <Star size={15} />
                        {goalFocus?.id === goal.id ? 'Focused' : 'Focus'}
                      </button>
                      {ownsItem(goal) && (
                        <button
                          type="button"
                          className="finance-delete-button"
                          onClick={() => handleDeleteGoal(goal)}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      )}
                      <button type="button" className="banking-row-action" onClick={() => setSelectedGoalId(goal.id)} aria-label={`Open ${goal.title}`}>
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </article>
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
            </article>

            <article className="finance-panel finance-table-panel" aria-label="Credit card payoff plans">
              <div className="banking-panel-title">
                <span className="banking-snapshot-icon rose"><CreditCard size={21} /></span>
                <h3>Debt payoff plans</h3>
                <span className="banking-count-pill">{creditCardPlans.length} plans</span>
                <button type="button" className="ghost-button" onClick={openCreditCardPlan}>
                  <CreditCard size={16} />
                  New card plan
                </button>
              </div>

              <div className="finance-table-list finance-debt-list">
                {creditCardPlans.length > 0 && (
                  <div className="finance-table-header finance-debt-row">
                    <span>Card</span>
                    <span>Balance</span>
                    <span>APR</span>
                    <span>Payment</span>
                    <span>Target date</span>
                    <span>Progress</span>
                    <span>Focus</span>
                  </div>
                )}

                {creditCardPlans.map((plan) => (
                  <article
                    className={debtFocus?.id === plan.id ? 'finance-data-row finance-debt-row is-focused' : 'finance-data-row finance-debt-row'}
                    key={plan.id}
                  >
                    <button type="button" className="finance-row-name-button" onClick={() => setSelectedCreditCardPlanId(plan.id)}>
                      <span className="finance-row-icon debt">
                        <CreditCard size={18} />
                      </span>
                      <span className="finance-name-cell">
                        <strong>{plan.cardName}</strong>
                        <small>{plan.bank || 'No bank added yet.'}</small>
                      </span>
                    </button>

                    <div className="finance-cell finance-money-cell">
                      <strong>{formatMoney(plan.totalBalance)}</strong>
                      <span>remaining</span>
                    </div>

                    <div className="finance-cell finance-apr-cell">
                      <strong>{formatPercent(plan.purchaseApr)}</strong>
                      <span>APR</span>
                    </div>

                    <div className="finance-cell">
                      <strong>{formatMoney(plan.plannedMonthlyPayment)}</strong>
                      <span>Monthly</span>
                    </div>

                    <div className="finance-cell">
                      <strong>{formatDate(plan.targetPayoffDate)}</strong>
                      <span>{formatDateDistance(plan.targetPayoffDate)}</span>
                    </div>

                    <div className="finance-cell finance-progress-cell debt">
                      <strong>{plan.progress}%</strong>
                      <div className="finance-mini-progress debt">
                        <span style={{ width: `${plan.progress}%` }} />
                      </div>
                    </div>

                    <div className="finance-row-actions">
                      {ownsItem(plan) && (
                        <button
                          type="button"
                          className={plan.sharedToDashboard ? 'finance-share-button active debt' : 'finance-share-button debt'}
                          onClick={() => handlePlanDashboardShare(plan)}
                        >
                          <Share2 size={15} />
                          {plan.sharedToDashboard ? 'Shared' : 'Share'}
                        </button>
                      )}
                      <button
                        type="button"
                        className={debtFocus?.id === plan.id ? 'finance-focus-button active debt' : 'finance-focus-button debt'}
                        onClick={() => setFocusedDebtPlanId(plan.id)}
                      >
                        <Star size={15} />
                        {debtFocus?.id === plan.id ? 'Focused' : 'Focus'}
                      </button>
                      {ownsItem(plan) && (
                        <button
                          type="button"
                          className="finance-delete-button debt"
                          onClick={() => handleDeleteCreditCardPlan(plan)}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      )}
                      <button type="button" className="banking-row-action" onClick={() => setSelectedCreditCardPlanId(plan.id)} aria-label={`Open ${plan.cardName}`}>
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </article>
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
            </article>
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
                <div className="goal-detail-stat-row">
                  <span><strong>{selectedGoal.progress}%</strong><small>Complete</small></span>
                  <span><strong>{formatMoney(selectedGoal.currentAmount)}</strong><small>Saved</small></span>
                  <span><strong>{formatDateDistance(selectedGoal.dueDate)}</strong><small>Timeline</small></span>
                </div>
              </div>
              <div className="detail-hero-actions">
                {selectedGoal.visibility === 'shared' ? (
                  <span className="finance-share-status active"><Share2 size={15} /> Shared goal</span>
                ) : ownsItem(selectedGoal) && (
                  <button
                    type="button"
                    className={selectedGoal.sharedToDashboard ? 'finance-share-button active' : 'finance-share-button'}
                    onClick={() => handleGoalDashboardShare(selectedGoal)}
                  >
                    <Share2 size={15} />
                    {selectedGoal.sharedToDashboard ? 'Shared to dashboard' : 'Share to dashboard'}
                  </button>
                )}
                {ownsItem(selectedGoal) && (
                  <button
                    type="button"
                    className="finance-delete-button"
                    onClick={() => handleDeleteGoal(selectedGoal)}
                  >
                    <Trash2 size={15} />
                    Delete goal
                  </button>
                )}
                <VisualMeter goal={selectedGoal} />
              </div>
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

                <div className="progress-log">
                  <div className="progress-log-heading">
                    <h4>Progress log</h4>
                    <span>{(selectedGoal.contributions || []).length} entries</span>
                  </div>
                  {(selectedGoal.contributions || []).slice().reverse().map((entry) => (
                    <div className="progress-log-row" key={entry._id}>
                      <span>
                        <strong>{formatMoney(entry.amount)}</strong>
                        <small>{entry.authorName} · {formatDate(entry.createdAt)}</small>
                      </span>
                      <p>{entry.note || 'Progress added.'}</p>
                    </div>
                  ))}
                  {(selectedGoal.contributions || []).length === 0 && (
                    <p className="muted-text">Logged progress will show here.</p>
                  )}
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

                <div className="add-task-inline">
                  <input
                    value={newGoalTasks[selectedGoal.id]?.title || ''}
                    onChange={(event) => updateNewGoalTask(selectedGoal.id, 'title', event.target.value)}
                    placeholder="Add another task..."
                  />
                  <select
                    value={newGoalTasks[selectedGoal.id]?.difficulty || 'easy'}
                    onChange={(event) => updateNewGoalTask(selectedGoal.id, 'difficulty', event.target.value)}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <button type="button" onClick={() => handleAddGoalTask(selectedGoal.id)}>
                    <Plus size={16} />
                    Add task
                  </button>
                </div>
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
              <div className="detail-hero-actions">
                {ownsItem(selectedCreditCardPlan) && (
                  <button
                    type="button"
                    className={selectedCreditCardPlan.sharedToDashboard ? 'finance-share-button active debt' : 'finance-share-button debt'}
                    onClick={() => handlePlanDashboardShare(selectedCreditCardPlan)}
                  >
                    <Share2 size={15} />
                    {selectedCreditCardPlan.sharedToDashboard ? 'Shared to dashboard' : 'Share to dashboard'}
                  </button>
                )}
                {ownsItem(selectedCreditCardPlan) && (
                  <button
                    type="button"
                    className="finance-delete-button debt"
                    onClick={() => handleDeleteCreditCardPlan(selectedCreditCardPlan)}
                  >
                    <Trash2 size={15} />
                    Delete plan
                  </button>
                )}
                <div className="debt-detail-meter">
                  <strong>{selectedCreditCardPlan.progress}%</strong>
                  <span>paid down</span>
                </div>
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
                {goalForm.visibility === 'shared' ? (
                  <div className="dashboard-share-note">
                    <Share2 size={17} />
                    <div>
                      <strong>Shared goals go straight to the couple dashboard.</strong>
                      <span>Only summary progress is shown there.</span>
                    </div>
                  </div>
                ) : (
                  <label className="checkbox-row dashboard-share-toggle" htmlFor="goalSharedToDashboard">
                    <input
                      id="goalSharedToDashboard"
                      name="sharedToDashboard"
                      type="checkbox"
                      checked={goalForm.sharedToDashboard}
                      onChange={handleGoalChange}
                    />
                    <Share2 size={17} />
                    <span>Share summary to couple dashboard</span>
                  </label>
                )}

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
              <div className="banking-link-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Banking source</p>
                    <h4>Use a linked credit card</h4>
                  </div>
                  <span className="status-pill">{bankingCreditCards.length} available</span>
                </div>

                <label htmlFor="linkedBankingAccountId">Credit card from Banking</label>
                <select
                  id="linkedBankingAccountId"
                  name="linkedBankingAccountId"
                  value={creditCardForm.linkedBankingAccountId}
                  onChange={handleCreditCardChange}
                >
                  <option value="">Manual payoff plan</option>
                  {bankingCreditCards.map((account) => (
                    <option value={account.id} key={account.id}>
                      {getCreditCardLabel(account)} - {account.institutionName || 'Linked institution'} - {formatMoney(account.currentBalance)}
                    </option>
                  ))}
                </select>

                {selectedBankingCreditCard ? (
                  <>
                    <div className="linked-card-snapshot">
                      <div>
                        <span>Balance</span>
                        <strong>{formatMoney(selectedBankingCreditCard.currentBalance)}</strong>
                      </div>
                      <div>
                        <span>Minimum</span>
                        <strong>{formatOptionalMoney(selectedBankingCreditCard.minimumPaymentAmount)}</strong>
                      </div>
                      <div>
                        <span>Due date</span>
                        <strong>{formatDate(selectedBankingCreditCard.nextPaymentDueDate)}</strong>
                      </div>
                      <div>
                        <span>APR</span>
                        <strong>{formatOptionalPercent(selectedBankingCreditCard.purchaseApr)}</strong>
                      </div>
                      <div>
                        <span>Synced</span>
                        <strong>{formatRelativeTime(selectedBankingCreditCard.lastSyncedAt)}</strong>
                      </div>
                    </div>
                    {selectedBankingCreditCard.aprs?.length > 0 ? (
                      <div className="linked-apr-list">
                        {selectedBankingCreditCard.aprs.map((apr) => (
                          <span key={`${apr.aprType}-${apr.aprPercentage}`}>
                            {formatAprType(apr.aprType)}
                            <strong>{formatPercent(apr.aprPercentage)}</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="banking-link-hint">
                        This issuer did not provide APR data through Plaid, so enter the purchase APR manually.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="banking-link-hint">
                    Choose a card to fill the plan with its Banking balance, minimum payment, due day, and institution details.
                  </p>
                )}
              </div>

              <label className="checkbox-row dashboard-share-toggle debt" htmlFor="creditSharedToDashboard">
                <input
                  id="creditSharedToDashboard"
                  name="sharedToDashboard"
                  type="checkbox"
                  checked={creditCardForm.sharedToDashboard}
                  onChange={handleCreditCardChange}
                />
                <Share2 size={17} />
                <span>Share summary to couple dashboard</span>
              </label>

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
