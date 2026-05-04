import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  Landmark,
  Link as LinkIcon,
  LogOut,
  Moon,
  Pencil,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import '../styles/dashboard.css';
import '../styles/financials.css';
import '../styles/banking.css';

const initialPayForm = {
  incomeName: 'Primary pay',
  payerName: '',
  netPayAmount: '',
  frequency: 'biweekly',
  nextPayDate: '',
  payDayOne: '',
  payDayTwo: '',
  notes: '',
};

const frequencyLabels = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: 'Twice monthly',
  monthly: 'Monthly',
};

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPreciseMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '0%';
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatApr(account) {
  if (account.purchaseApr === null || account.purchaseApr === undefined || account.purchaseApr === '') {
    return 'APR unavailable';
  }

  return formatPercent(account.purchaseApr);
}

function formatDate(value) {
  if (!value) return 'Not set';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function dateInputValue(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
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

function daysUntil(value) {
  if (!value) return '';
  const today = new Date();
  const target = new Date(value);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `In ${days} days`;
}

function accountLabel(account) {
  const institution = account.institutionName || 'Linked account';
  return account.mask ? `${institution} - ${account.mask}` : institution;
}

function allocationLabel(account) {
  if (account.allocationType === 'fixed') return formatPreciseMoney(account.allocationValue);
  if (account.allocationType === 'remaining') return 'Remainder';
  if (account.allocationType === 'none') return 'None';
  return formatPercent(account.allocationValue);
}

function loadPlaidScript() {
  if (window.Plaid) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-plaid-link]');

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.async = true;
    script.dataset.plaidLink = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function Banking({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [payForm, setPayForm] = useState(initialPayForm);
  const [isPayEditing, setIsPayEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSavingPay, setIsSavingPay] = useState(false);
  const [isConnectingPlaid, setIsConnectingPlaid] = useState(false);
  const [isSyncingPlaid, setIsSyncingPlaid] = useState(false);

  const payConfigured = Boolean(profile?.paySchedule?.configured);

  const activeAccounts = useMemo(
    () => (profile?.accounts || []).filter((account) => account.status === 'active'),
    [profile]
  );
  const cashAccounts = useMemo(
    () => activeAccounts.filter((account) => ['checking', 'savings'].includes(account.accountCategory)),
    [activeAccounts]
  );
  const creditAccounts = useMemo(
    () => activeAccounts.filter((account) => account.accountCategory === 'credit-card'),
    [activeAccounts]
  );
  const lastSyncedAt = useMemo(() => {
    const syncedDates = activeAccounts
      .map((account) => account.lastSyncedAt)
      .filter(Boolean)
      .map((value) => new Date(value).getTime());

    if (syncedDates.length === 0) return null;
    return new Date(Math.max(...syncedDates));
  }, [activeAccounts]);

  function syncPayForm(nextProfile) {
    setPayForm({
      incomeName: nextProfile.paySchedule.incomeName || 'Primary pay',
      payerName: nextProfile.paySchedule.payerName || '',
      netPayAmount: nextProfile.paySchedule.netPayAmount || '',
      frequency: nextProfile.paySchedule.frequency || 'biweekly',
      nextPayDate: dateInputValue(nextProfile.paySchedule.nextPayDate),
      payDayOne: nextProfile.paySchedule.payDayOne || '',
      payDayTwo: nextProfile.paySchedule.payDayTwo || '',
      notes: nextProfile.paySchedule.notes || '',
    });
  }

  async function loadBanking() {
    const [meResponse, bankingResponse] = await Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }),
      fetch('/api/banking', { credentials: 'include' }),
    ]);

    if (!meResponse.ok) {
      navigate('/login', { replace: true });
      return;
    }

    if (!bankingResponse.ok) {
      throw new Error('Could not load banking workspace');
    }

    const meData = await meResponse.json();
    const bankingData = await bankingResponse.json();
    const nextProfile = bankingData.profile;

    setUser(meData.user);
    setProfile(nextProfile);
    syncPayForm(nextProfile);
  }

  useEffect(() => {
    loadBanking().catch((loadError) => setError(loadError.message));
  }, []);

  function handlePayChange(event) {
    const { name, value } = event.target;
    setPayForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function cancelPayEdit() {
    if (profile) syncPayForm(profile);
    setIsPayEditing(false);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    navigate('/login', { replace: true });
  }

  async function handleSavePaySchedule(event) {
    event.preventDefault();
    setIsSavingPay(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/banking/pay-schedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...payForm,
          netPayAmount: Number(payForm.netPayAmount || 0),
          payDayOne: payForm.payDayOne ? Number(payForm.payDayOne) : '',
          payDayTwo: payForm.payDayTwo ? Number(payForm.payDayTwo) : '',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save pay schedule');
      }

      setProfile(data.profile);
      syncPayForm(data.profile);
      setIsPayEditing(false);
      setMessage('Pay schedule saved.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingPay(false);
    }
  }

  async function handleConnectPlaid() {
    setIsConnectingPlaid(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/banking/plaid/link-token', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create Plaid link token');
      }

      await loadPlaidScript();

      const handler = window.Plaid.create({
        token: data.linkToken,
        onSuccess: async (publicToken, metadata) => {
          try {
            const exchangeResponse = await fetch('/api/banking/plaid/exchange-public-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ publicToken, metadata }),
            });
            const exchangeData = await exchangeResponse.json().catch(() => ({}));

            if (!exchangeResponse.ok) {
              throw new Error(exchangeData.message || 'Failed to connect Plaid account');
            }

            setProfile(exchangeData.profile);
            setMessage('Bank accounts connected.');
          } catch (exchangeError) {
            setError(exchangeError.message);
          }
        },
        onExit: (plaidError) => {
          if (plaidError) {
            setError(plaidError.display_message || plaidError.error_message || 'Plaid Link was closed');
          }
        },
      });

      handler.open();
    } catch (connectError) {
      setError(connectError.message);
    } finally {
      setIsConnectingPlaid(false);
    }
  }

  async function handleSyncPlaid() {
    setIsSyncingPlaid(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/banking/plaid/sync', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync Plaid accounts');
      }

      setProfile(data.profile);
      setMessage('Balances refreshed.');
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setIsSyncingPlaid(false);
    }
  }

  function renderCashAccounts() {
    if (cashAccounts.length === 0) {
      return (
        <div className="banking-empty-state">
          <Wallet size={24} />
          <p>No checking or savings balances yet.</p>
        </div>
      );
    }

    return (
      <div className="banking-account-table cash-table">
        <div className="banking-table-header cash-row">
          <span>Account</span>
          <span>Type</span>
          <span>Institution</span>
          <span>Balance</span>
          <span>Updated</span>
          <span aria-hidden="true" />
        </div>

        {cashAccounts.map((account) => (
          <div className="banking-account-row cash-row" key={account.id}>
            <div className="account-name-cell">
              <span className="banking-account-icon">
                <Landmark size={18} />
              </span>
              <div>
                <strong>{account.name}</strong>
                <small>{account.mask ? `...${account.mask}` : account.accountCategory}</small>
              </div>
            </div>
            <div>
              <strong>{account.accountCategory === 'savings' ? 'Savings' : 'Checking'}</strong>
            </div>
            <div className="institution-cell">
              <span>{account.institutionName?.charAt(0) || 'B'}</span>
              <strong>{account.institutionName || 'Linked bank'}</strong>
            </div>
            <div>
              <strong>{formatPreciseMoney(account.currentBalance)}</strong>
              <small>{account.source === 'plaid' ? formatRelativeTime(account.lastSyncedAt) : allocationLabel(account)}</small>
            </div>
            <div>
              <strong>{formatRelativeTime(account.lastSyncedAt)}</strong>
            </div>
            <button type="button" className="banking-row-action" aria-label={`Open ${account.name}`}>
              <ChevronRight size={18} />
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderCreditAccounts() {
    if (creditAccounts.length === 0) {
      return (
        <div className="banking-empty-state">
          <CreditCard size={24} />
          <p>No credit cards connected yet.</p>
        </div>
      );
    }

    return (
      <div className="banking-account-table credit-table">
        <div className="banking-table-header credit-row">
          <span>Account</span>
          <span>Balance</span>
          <span>Min payment</span>
          <span>Due date</span>
          <span aria-hidden="true" />
        </div>

        {creditAccounts.map((account) => (
          <div className="banking-account-row credit-row" key={account.id}>
            <div className="account-name-cell">
              <span className="banking-account-icon credit-icon">
                <CreditCard size={18} />
              </span>
              <div>
                <strong>{account.name}</strong>
                <small>{accountLabel(account)}</small>
              </div>
            </div>
            <div>
              <strong>{formatPreciseMoney(account.currentBalance)}</strong>
              <small>{formatApr(account)}</small>
            </div>
            <div>
              <strong>{formatPreciseMoney(account.minimumPaymentAmount)}</strong>
            </div>
            <div>
              <strong>{formatDate(account.nextPaymentDueDate)}</strong>
              <small>{daysUntil(account.nextPaymentDueDate)}</small>
            </div>
            <button type="button" className="banking-row-action" aria-label={`Open ${account.name}`}>
              <ChevronRight size={18} />
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderPayScheduleCard() {
    if (isPayEditing) {
      return (
        <article className="finance-panel banking-pay-card">
          <div className="banking-panel-title">
            <span className="banking-snapshot-icon blue"><CalendarDays size={21} /></span>
            <h3>Edit schedule</h3>
            <button type="button" className="icon-button" onClick={cancelPayEdit} aria-label="Cancel pay schedule edit">
              <X size={18} />
            </button>
          </div>

          <form className="finance-form banking-form" onSubmit={handleSavePaySchedule}>
            <div className="form-row">
              <div>
                <label htmlFor="incomeNameSaved">Pay name</label>
                <input id="incomeNameSaved" name="incomeName" value={payForm.incomeName} onChange={handlePayChange} required />
              </div>
              <div>
                <label htmlFor="payerNameSaved">Employer or payer</label>
                <input id="payerNameSaved" name="payerName" value={payForm.payerName} onChange={handlePayChange} />
              </div>
            </div>

            <div className="form-row">
              <div>
                <label htmlFor="netPayAmountSaved">Net pay</label>
                <div className="adorned-input">
                  <span>$</span>
                  <input id="netPayAmountSaved" name="netPayAmount" type="number" min="0" step="0.01" value={payForm.netPayAmount} onChange={handlePayChange} required />
                </div>
              </div>
              <div>
                <label htmlFor="frequencySaved">Frequency</label>
                <select id="frequencySaved" name="frequency" value={payForm.frequency} onChange={handlePayChange}>
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div>
                <label htmlFor="nextPayDateSaved">Next payday</label>
                <input id="nextPayDateSaved" name="nextPayDate" type="date" value={payForm.nextPayDate} onChange={handlePayChange} required />
              </div>
              <div className="form-row compact-form-row">
                <div>
                  <label htmlFor="payDayOneSaved">Day 1</label>
                  <input id="payDayOneSaved" name="payDayOne" type="number" min="1" max="31" value={payForm.payDayOne} onChange={handlePayChange} />
                </div>
                <div>
                  <label htmlFor="payDayTwoSaved">Day 2</label>
                  <input id="payDayTwoSaved" name="payDayTwo" type="number" min="1" max="31" value={payForm.payDayTwo} onChange={handlePayChange} />
                </div>
              </div>
            </div>

            <button type="submit" className="finance-submit" disabled={isSavingPay}>
              <Save size={18} />
              {isSavingPay ? 'Saving...' : 'Save schedule'}
            </button>
          </form>
        </article>
      );
    }

    return (
      <article className="finance-panel banking-pay-card">
        <div className="banking-panel-title">
          <span className="banking-snapshot-icon blue"><CalendarDays size={21} /></span>
          <h3>Pay schedule</h3>
          <button type="button" className="ghost-button" onClick={() => setIsPayEditing(true)}>
            <Pencil size={16} />
            Edit
          </button>
        </div>

        <div className="pay-schedule-grid">
          <span>
            <strong>{formatPreciseMoney(profile?.paySchedule?.netPayAmount)}</strong>
            Net pay
          </span>
          <span>
            <strong>{frequencyLabels[profile?.paySchedule?.frequency] || 'Every 2 weeks'}</strong>
            Frequency
          </span>
          <span>
            <strong>{formatDate(profile?.paySchedule?.nextPayDate)}</strong>
            Next payday
          </span>
          <span>
            <strong>{profile?.paySchedule?.payerName || profile?.paySchedule?.incomeName || 'Primary pay'}</strong>
            Payer
          </span>
        </div>
      </article>
    );
  }

  return (
    <main className="dashboard-shell financials-shell banking-shell">
      <aside className="dashboard-sidebar banking-sidebar" aria-label="Banking navigation">
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
            <Link to="/financials" className="nav-item banking-nav-item">
              <CircleDollarSign size={18} />
              Financials
            </Link>
            <Link to="/banking" className="nav-item banking-nav-item active">
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

      <section className="dashboard-main financials-main banking-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">Banking</p>
            <h1>{user?.name ? `${user.name}'s cash flow` : 'Cash flow'}</h1>
          </div>
        </header>

        {(message || error) && (
          <div className="finance-alerts">
            {message && <p className="success-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}
          </div>
        )}

        {!payConfigured ? (
          <section className="finance-panel banking-onboarding">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">First setup</p>
                <h2>Pay schedule</h2>
              </div>
              <Banknote size={24} />
            </div>

            <form className="finance-form banking-form" onSubmit={handleSavePaySchedule}>
              <div className="form-row">
                <div>
                  <label htmlFor="incomeName">Pay name</label>
                  <input id="incomeName" name="incomeName" value={payForm.incomeName} onChange={handlePayChange} required />
                </div>
                <div>
                  <label htmlFor="payerName">Employer or payer</label>
                  <input id="payerName" name="payerName" value={payForm.payerName} onChange={handlePayChange} placeholder="Employer, client, benefit..." />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label htmlFor="netPayAmount">Net pay after taxes</label>
                  <div className="adorned-input">
                    <span>$</span>
                    <input id="netPayAmount" name="netPayAmount" type="number" min="0" step="0.01" value={payForm.netPayAmount} onChange={handlePayChange} required />
                  </div>
                </div>
                <div>
                  <label htmlFor="frequency">Frequency</label>
                  <select id="frequency" name="frequency" value={payForm.frequency} onChange={handlePayChange}>
                    {Object.entries(frequencyLabels).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label htmlFor="nextPayDate">Next payday</label>
                  <input id="nextPayDate" name="nextPayDate" type="date" value={payForm.nextPayDate} onChange={handlePayChange} required />
                </div>
                <div className="form-row compact-form-row">
                  <div>
                    <label htmlFor="payDayOne">Pay day 1</label>
                    <input id="payDayOne" name="payDayOne" type="number" min="1" max="31" value={payForm.payDayOne} onChange={handlePayChange} />
                  </div>
                  <div>
                    <label htmlFor="payDayTwo">Pay day 2</label>
                    <input id="payDayTwo" name="payDayTwo" type="number" min="1" max="31" value={payForm.payDayTwo} onChange={handlePayChange} />
                  </div>
                </div>
              </div>

              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" rows="2" value={payForm.notes} onChange={handlePayChange} />

              <button type="submit" className="finance-submit" disabled={isSavingPay}>
                <Save size={18} />
                {isSavingPay ? 'Saving...' : 'Save pay schedule'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="banking-hero">
              <div className="banking-snapshot-grid" aria-label="Banking snapshot">
                <div className="banking-snapshot-card">
                  <span className="banking-snapshot-icon blue"><Banknote size={22} /></span>
                  <div>
                    <small>Estimated monthly income</small>
                    <strong>{formatMoney(profile?.summary?.estimatedMonthlyIncome)}</strong>
                    <em>{frequencyLabels[profile.paySchedule.frequency]}</em>
                  </div>
                </div>

                <div className="banking-snapshot-card">
                  <span className="banking-snapshot-icon green"><Wallet size={22} /></span>
                  <div>
                    <small>Cash balance</small>
                    <strong>{formatMoney(profile?.summary?.cashBalance)}</strong>
                    <em>Available cash</em>
                  </div>
                </div>

                <div className="banking-snapshot-card">
                  <span className="banking-snapshot-icon rose"><CreditCard size={22} /></span>
                  <div>
                    <small>Credit owed</small>
                    <strong>{formatMoney(profile?.summary?.creditBalance)}</strong>
                    <em>Across {creditAccounts.length} accounts</em>
                  </div>
                </div>

                <div className="banking-snapshot-card">
                  <span className="banking-snapshot-icon blue"><CalendarDays size={22} /></span>
                  <div>
                    <small>Next payday</small>
                    <strong>{formatDate(profile?.paySchedule?.nextPayDate)}</strong>
                    <em>{daysUntil(profile?.paySchedule?.nextPayDate)}</em>
                  </div>
                </div>
              </div>

              <div className="banking-hero-status">
                <div>
                  <span className="banking-live-dot" />
                  <strong>{profile?.summary?.plaidConnectedCount ? 'Plaid connected' : 'Plaid ready'}</strong>
                </div>
                <p>
                  {profile?.plaid?.environment || 'Production'}
                  <span>Last synced {formatRelativeTime(lastSyncedAt)}</span>
                </p>
                <div className="banking-hero-actions">
                  <button type="button" className="finance-primary-action" onClick={handleSyncPlaid} disabled={!profile?.summary?.plaidConnectedCount || isSyncingPlaid}>
                    <RefreshCcw size={18} />
                    {isSyncingPlaid ? 'Syncing...' : 'Sync'}
                  </button>
                  <button type="button" className="finance-secondary-action" onClick={handleConnectPlaid} disabled={!profile?.plaid?.configured || isConnectingPlaid}>
                    <LinkIcon size={18} />
                    {isConnectingPlaid ? 'Opening...' : 'Connect'}
                  </button>
                </div>
              </div>
            </section>

            <section className="banking-support-grid">
              {renderPayScheduleCard()}

              <article className="finance-panel banking-plaid-panel">
                <div className="banking-panel-title">
                  <span className="banking-snapshot-icon green"><ShieldCheck size={21} /></span>
                  <h3>Plaid status</h3>
                </div>

                <div className="plaid-status-list">
                  <span>
                    <strong>{profile?.summary?.plaidConnectedCount ? 'Connected' : 'Ready'}</strong>
                    Status
                  </span>
                  <span>
                    <strong>{profile?.plaid?.environment || 'Production'}</strong>
                    Environment
                  </span>
                  <span>
                    <strong>{formatRelativeTime(lastSyncedAt)}</strong>
                    Last synced
                  </span>
                </div>
              </article>
            </section>

            <section className="banking-account-panels">
              <article className="finance-panel banking-large-panel">
                <div className="banking-panel-title">
                  <span className="banking-snapshot-icon green"><Landmark size={21} /></span>
                  <h3>Cash accounts</h3>
                  <span className="banking-count-pill">{cashAccounts.length} accounts</span>
                </div>
                {renderCashAccounts()}
              </article>

              <article className="finance-panel banking-large-panel">
                <div className="banking-panel-title">
                  <span className="banking-snapshot-icon rose"><CreditCard size={21} /></span>
                  <h3>Credit cards</h3>
                  <span className="banking-count-pill">{creditAccounts.length} accounts</span>
                </div>
                {renderCreditAccounts()}
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default Banking;
