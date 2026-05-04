const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const BankingProfile = require('../models/BankingProfile');

const PLAID_ENV_ALIASES = {
  sandbox: 'sandbox',
  development: 'production',
  dev: 'production',
  production: 'production',
  prod: 'production',
  limited_production: 'production',
  'limited-production': 'production',
};

function toMoney(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue * 100) / 100;
}

function toPositiveMoney(value) {
  return Math.max(0, toMoney(value));
}

function toNullableMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  return toMoney(value);
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function clampDay(value) {
  if (value === null || value === undefined || value === '') return null;
  const day = Number(value);
  if (!Number.isFinite(day)) return null;
  return Math.min(Math.max(Math.round(day), 1), 31);
}

function splitEnvList(value, fallback) {
  return String(value || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolvePlaidEnvironment(value) {
  const rawEnvironment = String(value || 'sandbox').trim().toLowerCase();
  return {
    requestedEnvironment: rawEnvironment,
    environment: PLAID_ENV_ALIASES[rawEnvironment] || 'sandbox',
  };
}

function getPlaidConfig() {
  const { environment, requestedEnvironment } = resolvePlaidEnvironment(process.env.PLAID_ENV);

  return {
    clientId: process.env.PLAID_CLIENT_ID || '',
    secret: process.env.PLAID_SECRET || '',
    environment,
    requestedEnvironment,
    basePath: PlaidEnvironments[environment] || PlaidEnvironments.sandbox,
    clientName: process.env.PLAID_CLIENT_NAME || 'Tracker',
    products: splitEnvList(process.env.PLAID_PRODUCTS, 'transactions,liabilities'),
    countryCodes: splitEnvList(process.env.PLAID_COUNTRY_CODES, 'US'),
    webhook: process.env.PLAID_WEBHOOK_URL || '',
    redirectUri: process.env.PLAID_REDIRECT_URI || '',
  };
}

function isPlaidConfigured() {
  const config = getPlaidConfig();
  return Boolean(config.clientId && config.secret);
}

function getPlaidClient() {
  const config = getPlaidConfig();

  if (!isPlaidConfigured()) {
    const error = new Error('Plaid client ID and secret are not configured');
    error.status = 503;
    throw error;
  }

  const configuration = new Configuration({
    basePath: config.basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': config.clientId,
        'PLAID-SECRET': config.secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

async function plaidRequest(methodName, request) {
  try {
    const response = await getPlaidClient()[methodName](request);
    return response.data;
  } catch (requestError) {
    const data = requestError.response?.data || requestError.data || {};
    const error = new Error(data.error_message || data.message || requestError.message || 'Plaid request failed');
    error.status = requestError.response?.status || requestError.status || 500;
    error.plaid = data;
    throw error;
  }
}

async function getOrCreateProfile(userId, includeAccessTokens = false) {
  let query = BankingProfile.findOne({ ownerId: userId });

  if (includeAccessTokens) {
    query = query.select('+plaidItems.accessToken');
  }

  let profile = await query;

  if (!profile) {
    profile = await BankingProfile.create({ ownerId: userId });
  }

  return profile;
}

function estimateMonthlyIncome(paySchedule) {
  const netPay = toPositiveMoney(paySchedule?.netPayAmount);

  if (!netPay) return 0;

  switch (paySchedule.frequency) {
    case 'weekly':
      return toMoney((netPay * 52) / 12);
    case 'biweekly':
      return toMoney((netPay * 26) / 12);
    case 'semimonthly':
      return toMoney(netPay * 2);
    case 'monthly':
      return netPay;
    default:
      return toMoney((netPay * 26) / 12);
  }
}

function serializePaySchedule(paySchedule) {
  return {
    configured: Boolean(paySchedule?.configured),
    incomeName: paySchedule?.incomeName || '',
    payerName: paySchedule?.payerName || '',
    netPayAmount: paySchedule?.netPayAmount || 0,
    frequency: paySchedule?.frequency || 'biweekly',
    nextPayDate: paySchedule?.nextPayDate || null,
    payDayOne: paySchedule?.payDayOne || '',
    payDayTwo: paySchedule?.payDayTwo || '',
    notes: paySchedule?.notes || '',
    estimatedMonthlyIncome: estimateMonthlyIncome(paySchedule),
  };
}

function serializeAccount(account) {
  return {
    id: account._id,
    source: account.source,
    plaidAccountId: account.plaidAccountId,
    plaidEnvironment: account.plaidEnvironment || 'sandbox',
    institutionName: account.institutionName,
    name: account.name,
    officialName: account.officialName,
    mask: account.mask,
    accountCategory: account.accountCategory,
    plaidType: account.plaidType,
    plaidSubtype: account.plaidSubtype,
    allocationType: account.allocationType,
    allocationValue: account.allocationValue,
    currentBalance: account.currentBalance,
    availableBalance: account.availableBalance,
    creditLimit: account.creditLimit,
    isoCurrencyCode: account.isoCurrencyCode,
    minimumPaymentAmount: account.minimumPaymentAmount,
    nextPaymentDueDate: account.nextPaymentDueDate,
    lastStatementBalance: account.lastStatementBalance,
    lastStatementIssueDate: account.lastStatementIssueDate,
    purchaseApr: account.purchaseApr,
    aprs: account.aprs || [],
    notes: account.notes,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function serializePlaidItem(item) {
  return {
    id: item._id,
    plaidItemId: item.plaidItemId,
    environment: item.environment || 'sandbox',
    institutionId: item.institutionId,
    institutionName: item.institutionName,
    products: item.products,
    status: item.status,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
    lastSyncedAt: item.lastSyncedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function isCurrentPlaidEnvironment(record) {
  if (record.source !== 'plaid' && !record.plaidItemId) return true;
  const recordEnvironment = record.plaidEnvironment || record.environment || 'sandbox';
  return recordEnvironment === getPlaidConfig().environment;
}

function getVisibleAccounts(profile) {
  return profile.accounts.filter((account) => (
    account.source !== 'plaid' || isCurrentPlaidEnvironment(account)
  ));
}

function buildSummary(profile) {
  const activeAccounts = getVisibleAccounts(profile).filter((account) => account.status === 'active');
  const cashAccounts = activeAccounts.filter((account) => ['checking', 'savings'].includes(account.accountCategory));
  const creditAccounts = activeAccounts.filter((account) => account.accountCategory === 'credit-card');
  const cashBalance = cashAccounts.reduce((total, account) => total + toMoney(account.currentBalance), 0);
  const availableCash = cashAccounts.reduce(
    (total, account) => total + toMoney(account.availableBalance ?? account.currentBalance),
    0
  );
  const creditBalance = creditAccounts.reduce((total, account) => total + Math.max(0, toMoney(account.currentBalance)), 0);
  const minimumPayments = creditAccounts.reduce(
    (total, account) => total + toMoney(account.minimumPaymentAmount || 0),
    0
  );

  return {
    estimatedMonthlyIncome: estimateMonthlyIncome(profile.paySchedule),
    accountCount: activeAccounts.length,
    cashBalance: toMoney(cashBalance),
    availableCash: toMoney(availableCash),
    creditBalance: toMoney(creditBalance),
    minimumPayments: toMoney(minimumPayments),
    plaidConnectedCount: profile.plaidItems.filter((item) => (
      item.status === 'active' && isCurrentPlaidEnvironment(item)
    )).length,
  };
}

function serializeProfile(profile) {
  const visibleAccounts = getVisibleAccounts(profile);
  const visiblePlaidItems = profile.plaidItems.filter(isCurrentPlaidEnvironment);

  return {
    id: profile._id,
    ownerId: profile.ownerId,
    paySchedule: serializePaySchedule(profile.paySchedule),
    accounts: visibleAccounts.map(serializeAccount),
    plaidItems: visiblePlaidItems.map(serializePlaidItem),
    summary: buildSummary(profile),
    plaid: {
      configured: isPlaidConfigured(),
      environment: getPlaidConfig().environment,
      requestedEnvironment: getPlaidConfig().requestedEnvironment,
      products: getPlaidConfig().products,
      countryCodes: getPlaidConfig().countryCodes,
    },
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function normalizePaySchedule(body) {
  const frequency = ['weekly', 'biweekly', 'semimonthly', 'monthly'].includes(body.frequency)
    ? body.frequency
    : 'biweekly';

  return {
    configured: true,
    incomeName: String(body.incomeName || 'Primary pay').trim(),
    payerName: String(body.payerName || '').trim(),
    netPayAmount: toPositiveMoney(body.netPayAmount),
    frequency,
    nextPayDate: toDate(body.nextPayDate),
    payDayOne: clampDay(body.payDayOne),
    payDayTwo: clampDay(body.payDayTwo),
    notes: String(body.notes || '').trim(),
  };
}

function normalizeManualAccount(body) {
  const accountCategory = ['checking', 'savings', 'credit-card', 'other'].includes(body.accountCategory)
    ? body.accountCategory
    : 'checking';
  const allocationType = ['percent', 'fixed', 'remaining', 'none'].includes(body.allocationType)
    ? body.allocationType
    : 'percent';

  return {
    source: 'manual',
    institutionName: String(body.institutionName || '').trim(),
    name: String(body.name || '').trim(),
    officialName: String(body.officialName || '').trim(),
    mask: String(body.mask || '').trim().slice(-4),
    accountCategory,
    allocationType,
    allocationValue: toPositiveMoney(body.allocationValue),
    currentBalance: toMoney(body.currentBalance),
    availableBalance: toNullableMoney(body.availableBalance),
    creditLimit: accountCategory === 'credit-card' ? toNullableMoney(body.creditLimit) : null,
    minimumPaymentAmount: accountCategory === 'credit-card' ? toNullableMoney(body.minimumPaymentAmount) : null,
    nextPaymentDueDate: accountCategory === 'credit-card' ? toDate(body.nextPaymentDueDate) : null,
    lastStatementBalance: accountCategory === 'credit-card' ? toNullableMoney(body.lastStatementBalance) : null,
    lastStatementIssueDate: accountCategory === 'credit-card' ? toDate(body.lastStatementIssueDate) : null,
    purchaseApr: accountCategory === 'credit-card' ? toNullableMoney(body.purchaseApr) : null,
    aprs: [],
    notes: String(body.notes || '').trim(),
    lastSyncedAt: new Date(),
  };
}

function getAccountCategory(plaidAccount) {
  if (plaidAccount.type === 'depository' && plaidAccount.subtype === 'checking') return 'checking';
  if (plaidAccount.type === 'depository' && plaidAccount.subtype === 'savings') return 'savings';
  if (plaidAccount.type === 'credit') return 'credit-card';
  return 'other';
}

function normalizeAprs(aprs) {
  if (!Array.isArray(aprs)) return [];

  return aprs
    .map((apr) => ({
      aprPercentage: toNullableMoney(apr.apr_percentage ?? apr.aprPercentage),
      aprType: String(apr.apr_type || apr.aprType || 'unknown'),
      balanceSubjectToApr: toNullableMoney(apr.balance_subject_to_apr ?? apr.balanceSubjectToApr),
      interestChargeAmount: toNullableMoney(apr.interest_charge_amount ?? apr.interestChargeAmount),
    }))
    .filter((apr) => apr.aprPercentage !== null);
}

function getPurchaseApr(liability) {
  const aprs = normalizeAprs(liability?.aprs);
  const purchaseApr = aprs.find((apr) => apr.aprType === 'purchase_apr') || aprs[0];
  return toNullableMoney(purchaseApr?.aprPercentage);
}

function normalizePlaidAccount(plaidAccount, liability, institutionName, plaidItemId, plaidEnvironment) {
  const aprs = normalizeAprs(liability?.aprs);

  return {
    source: 'plaid',
    plaidAccountId: plaidAccount.account_id,
    plaidItemId,
    plaidEnvironment,
    institutionName,
    name: plaidAccount.name || plaidAccount.official_name || 'Linked account',
    officialName: plaidAccount.official_name || '',
    mask: plaidAccount.mask || '',
    accountCategory: getAccountCategory(plaidAccount),
    plaidType: plaidAccount.type || '',
    plaidSubtype: plaidAccount.subtype || '',
    currentBalance: toMoney(plaidAccount.balances?.current),
    availableBalance: toNullableMoney(plaidAccount.balances?.available),
    creditLimit: toNullableMoney(plaidAccount.balances?.limit),
    isoCurrencyCode: plaidAccount.balances?.iso_currency_code || 'USD',
    minimumPaymentAmount: toNullableMoney(liability?.minimum_payment_amount),
    nextPaymentDueDate: toDate(liability?.next_payment_due_date),
    lastStatementBalance: toNullableMoney(liability?.last_statement_balance),
    lastStatementIssueDate: toDate(liability?.last_statement_issue_date),
    purchaseApr: getPurchaseApr({ aprs }),
    aprs,
    lastSyncedAt: new Date(),
  };
}

function upsertPlaidAccounts(profile, plaidAccounts, liabilitiesByAccountId, institutionName, plaidItemId, plaidEnvironment) {
  plaidAccounts.forEach((plaidAccount) => {
    const liability = liabilitiesByAccountId.get(plaidAccount.account_id);
    const normalized = normalizePlaidAccount(plaidAccount, liability, institutionName, plaidItemId, plaidEnvironment);
    const existing = profile.accounts.find((account) => account.plaidAccountId === plaidAccount.account_id);

    if (existing) {
      const preserved = {
        allocationType: existing.allocationType,
        allocationValue: existing.allocationValue,
        notes: existing.notes,
        status: existing.status,
      };
      Object.assign(existing, normalized, preserved);
    } else {
      profile.accounts.push(normalized);
    }
  });
}

async function syncPlaidItem(profile, plaidItem) {
  const balances = await plaidRequest('accountsBalanceGet', {
    access_token: plaidItem.accessToken,
  });
  const liabilitiesByAccountId = new Map();

  try {
    const liabilities = await plaidRequest('liabilitiesGet', {
      access_token: plaidItem.accessToken,
    });

    (liabilities.liabilities?.credit || []).forEach((liability) => {
      liabilitiesByAccountId.set(liability.account_id, liability);
    });
  } catch (error) {
    if (error.status < 500) {
      plaidItem.errorCode = error.plaid?.error_code || '';
      plaidItem.errorMessage = error.message;
    } else {
      throw error;
    }
  }

  upsertPlaidAccounts(
    profile,
    balances.accounts || [],
    liabilitiesByAccountId,
    plaidItem.institutionName,
    plaidItem.plaidItemId,
    plaidItem.environment || getPlaidConfig().environment
  );

  plaidItem.status = 'active';
  plaidItem.errorCode = '';
  plaidItem.errorMessage = '';
  plaidItem.lastSyncedAt = new Date();

  return {
    accounts: balances.accounts?.length || 0,
    creditLiabilities: liabilitiesByAccountId.size,
  };
}

async function getBankingProfile(req, res) {
  try {
    const profile = await getOrCreateProfile(req.user._id);
    return res.status(200).json({ profile: serializeProfile(profile) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function updatePaySchedule(req, res) {
  try {
    const paySchedule = normalizePaySchedule(req.body);

    if (!paySchedule.incomeName || paySchedule.netPayAmount <= 0 || !paySchedule.nextPayDate) {
      return res.status(400).json({ message: 'Pay name, net pay, and next payday are required' });
    }

    const profile = await getOrCreateProfile(req.user._id);
    profile.paySchedule = paySchedule;
    await profile.save();

    return res.status(200).json({ profile: serializeProfile(profile) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function createManualAccount(req, res) {
  try {
    const account = normalizeManualAccount(req.body);

    if (!account.name || !account.accountCategory) {
      return res.status(400).json({ message: 'Account name and type are required' });
    }

    const profile = await getOrCreateProfile(req.user._id);
    profile.accounts.push(account);
    await profile.save();

    return res.status(201).json({ profile: serializeProfile(profile) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function updateManualAccount(req, res) {
  try {
    const profile = await getOrCreateProfile(req.user._id);
    const account = profile.accounts.id(req.params.accountId);

    if (!account) return res.status(404).json({ message: 'Account not found' });

    const updatedAccount = normalizeManualAccount(req.body);
    Object.assign(account, {
      ...updatedAccount,
      source: account.source,
      plaidAccountId: account.plaidAccountId,
      plaidItemId: account.plaidItemId,
      plaidType: account.plaidType,
      plaidSubtype: account.plaidSubtype,
      lastSyncedAt: account.source === 'plaid' ? account.lastSyncedAt : new Date(),
    });

    await profile.save();

    return res.status(200).json({ profile: serializeProfile(profile) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function deleteAccount(req, res) {
  try {
    const profile = await getOrCreateProfile(req.user._id);
    const account = profile.accounts.id(req.params.accountId);

    if (!account) return res.status(404).json({ message: 'Account not found' });

    account.status = 'hidden';
    await profile.save();

    return res.status(200).json({ profile: serializeProfile(profile) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function createPlaidLinkToken(req, res) {
  try {
    const config = getPlaidConfig();
    const request = {
      user: {
        client_user_id: req.user._id.toString(),
      },
      client_name: config.clientName,
      products: config.products,
      country_codes: config.countryCodes,
      language: 'en',
    };

    if (config.webhook) request.webhook = config.webhook;
    if (config.redirectUri) request.redirect_uri = config.redirectUri;

    const data = await plaidRequest('linkTokenCreate', request);
    return res.status(200).json({ linkToken: data.link_token, expiration: data.expiration });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

async function exchangePlaidPublicToken(req, res) {
  try {
    const { publicToken, metadata = {} } = req.body;

    if (!publicToken) {
      return res.status(400).json({ message: 'Plaid public token is required' });
    }

    const exchange = await plaidRequest('itemPublicTokenExchange', {
      public_token: publicToken,
    });
    const profile = await getOrCreateProfile(req.user._id, true);
    const institution = metadata.institution || {};
    let plaidItem = profile.plaidItems.find((item) => item.plaidItemId === exchange.item_id);

    if (!plaidItem) {
      profile.plaidItems.push({
        plaidItemId: exchange.item_id,
        environment: getPlaidConfig().environment,
        accessToken: exchange.access_token,
        institutionId: institution.institution_id || '',
        institutionName: institution.name || 'Linked institution',
        products: getPlaidConfig().products,
      });
      plaidItem = profile.plaidItems[profile.plaidItems.length - 1];
    } else {
      plaidItem.accessToken = exchange.access_token;
      plaidItem.environment = getPlaidConfig().environment;
      plaidItem.institutionId = institution.institution_id || plaidItem.institutionId;
      plaidItem.institutionName = institution.name || plaidItem.institutionName;
      plaidItem.products = getPlaidConfig().products;
      plaidItem.status = 'active';
    }

    await syncPlaidItem(profile, plaidItem);
    await profile.save();

    return res.status(200).json({ profile: serializeProfile(profile) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

async function syncPlaidItems(req, res) {
  try {
    const profile = await getOrCreateProfile(req.user._id, true);
    const results = [];

    for (const plaidItem of profile.plaidItems) {
      if ((plaidItem.environment || 'sandbox') !== getPlaidConfig().environment) {
        results.push({
          plaidItemId: plaidItem.plaidItemId,
          ok: true,
          skipped: true,
          message: `Skipped ${plaidItem.environment || 'sandbox'} item while using ${getPlaidConfig().environment}`,
        });
        continue;
      }

      try {
        const result = await syncPlaidItem(profile, plaidItem);
        results.push({ plaidItemId: plaidItem.plaidItemId, ok: true, ...result });
      } catch (error) {
        plaidItem.status = 'error';
        plaidItem.errorCode = error.plaid?.error_code || '';
        plaidItem.errorMessage = error.message;
        results.push({ plaidItemId: plaidItem.plaidItemId, ok: false, message: error.message });
      }
    }

    await profile.save();

    return res.status(200).json({ profile: serializeProfile(profile), results });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
}

module.exports = {
  createManualAccount,
  createPlaidLinkToken,
  deleteAccount,
  exchangePlaidPublicToken,
  getBankingProfile,
  syncPlaidItems,
  updateManualAccount,
  updatePaySchedule,
};
