const OpenAI = require('openai');
const mongoose = require('mongoose');

const CreditCardPlan = require('../models/CreditCardPlan');
const { awardCoupleProgress } = require('../utils/coupleProgress');

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
const MAX_MONTHS = 360;

function toMoney(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.round(numberValue * 100) / 100);
}

function clampDueDay(value) {
  const day = Number(value || 1);
  if (!Number.isFinite(day)) return 1;
  return Math.min(Math.max(Math.round(day), 1), 31);
}

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function dueDateForMonth(startDate, dueDay, monthOffset) {
  const dueDate = addMonths(startDate, monthOffset);
  const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
  dueDate.setDate(Math.min(dueDay, lastDay));
  return dueDate;
}

function monthsUntilTarget(targetPayoffDate, dueDay) {
  const today = new Date();
  const targetDate = new Date(targetPayoffDate);
  let months = 1;

  while (months < MAX_MONTHS && dueDateForMonth(today, dueDay, months - 1) < targetDate) {
    months += 1;
  }

  return months;
}

function allocatePrincipal(payment, purchaseBalance, cashAdvanceBalance, purchaseApr, cashAdvanceApr) {
  let remainingPayment = payment;
  let purchasePaid = 0;
  let cashAdvancePaid = 0;

  const cashFirst = cashAdvanceApr >= purchaseApr;

  function payCashAdvance() {
    const amount = Math.min(cashAdvanceBalance - cashAdvancePaid, remainingPayment);
    cashAdvancePaid += amount;
    remainingPayment -= amount;
  }

  function payPurchase() {
    const amount = Math.min(purchaseBalance - purchasePaid, remainingPayment);
    purchasePaid += amount;
    remainingPayment -= amount;
  }

  if (cashFirst) {
    payCashAdvance();
    payPurchase();
  } else {
    payPurchase();
    payCashAdvance();
  }

  return {
    purchasePaid: toMoney(purchasePaid),
    cashAdvancePaid: toMoney(cashAdvancePaid),
  };
}

function simulatePayoff({
  purchaseBalance,
  cashAdvanceBalance,
  purchaseApr,
  cashAdvanceApr,
  monthlyPayment,
  monthlyDueDay,
  maxMonths = MAX_MONTHS,
}) {
  let purchase = toMoney(purchaseBalance);
  let cashAdvance = toMoney(cashAdvanceBalance);
  const payment = toMoney(monthlyPayment);
  const purchaseMonthlyRate = Number(purchaseApr || 0) / 100 / 12;
  const cashAdvanceMonthlyRate = Number(cashAdvanceApr || 0) / 100 / 12;
  let estimatedInterest = 0;
  const schedule = [];
  const today = new Date();

  if (payment <= 0) {
    return {
      canPayoff: false,
      estimatedInterest: 0,
      monthsToPayoff: 0,
      estimatedPayoffDate: null,
      schedule: [],
    };
  }

  for (let month = 1; month <= maxMonths; month += 1) {
    const purchaseInterest = toMoney(purchase * purchaseMonthlyRate);
    const cashAdvanceInterest = toMoney(cashAdvance * cashAdvanceMonthlyRate);
    purchase = toMoney(purchase + purchaseInterest);
    cashAdvance = toMoney(cashAdvance + cashAdvanceInterest);
    estimatedInterest = toMoney(estimatedInterest + purchaseInterest + cashAdvanceInterest);

    const totalBalance = toMoney(purchase + cashAdvance);
    const actualPayment = Math.min(payment, totalBalance);
    const allocation = allocatePrincipal(actualPayment, purchase, cashAdvance, purchaseApr, cashAdvanceApr);

    purchase = toMoney(purchase - allocation.purchasePaid);
    cashAdvance = toMoney(cashAdvance - allocation.cashAdvancePaid);

    const dueDate = dueDateForMonth(today, monthlyDueDay, month - 1);
    const remainingBalance = toMoney(purchase + cashAdvance);

    schedule.push({
      month,
      dueDate,
      payment: actualPayment,
      purchaseInterest,
      cashAdvanceInterest,
      purchaseBalance: purchase,
      cashAdvanceBalance: cashAdvance,
      totalBalance: remainingBalance,
    });

    if (remainingBalance <= 0) {
      return {
        canPayoff: true,
        estimatedInterest,
        monthsToPayoff: month,
        estimatedPayoffDate: dueDate,
        schedule,
      };
    }

    if (actualPayment <= purchaseInterest + cashAdvanceInterest) {
      break;
    }
  }

  return {
    canPayoff: false,
    estimatedInterest,
    monthsToPayoff: maxMonths,
    estimatedPayoffDate: null,
    schedule,
  };
}

function calculateRequiredPayment(planInput) {
  const targetMonths = monthsUntilTarget(planInput.targetPayoffDate, planInput.monthlyDueDay);
  const totalBalance = toMoney(planInput.purchaseBalance + planInput.cashAdvanceBalance);
  let low = 1;
  let high = Math.max(totalBalance * 1.5, planInput.minimumPayment, 50);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = simulatePayoff({ ...planInput, monthlyPayment: high, maxMonths: targetMonths });
    if (result.canPayoff) break;
    high *= 1.5;
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const mid = (low + high) / 2;
    const result = simulatePayoff({ ...planInput, monthlyPayment: mid, maxMonths: targetMonths });
    if (result.canPayoff) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return toMoney(Math.max(high, planInput.minimumPayment));
}

function buildPlanCalculations(input) {
  const requiredMonthlyPayment = calculateRequiredPayment(input);
  const plannedMonthlyPayment = toMoney(input.plannedMonthlyPayment || requiredMonthlyPayment);
  const plannedSimulation = simulatePayoff({
    ...input,
    monthlyPayment: plannedMonthlyPayment,
  });

  return {
    plannedMonthlyPayment,
    requiredMonthlyPayment,
    estimatedInterest: plannedSimulation.estimatedInterest,
    estimatedPayoffDate: plannedSimulation.estimatedPayoffDate,
    monthsToPayoff: plannedSimulation.monthsToPayoff,
    schedule: plannedSimulation.schedule.slice(0, 24),
  };
}

function serializePlan(plan) {
  const totalBalance = toMoney(plan.purchaseBalance + plan.cashAdvanceBalance);
  const progress = plan.originalBalance > 0
    ? Math.min(Math.round(((plan.originalBalance - totalBalance) / plan.originalBalance) * 100), 100)
    : 100;

  return {
    id: plan._id,
    cardName: plan.cardName,
    bank: plan.bank,
    ownerId: plan.ownerId,
    linkedBankingAccountId: plan.linkedBankingAccountId,
    linkedPlaidAccountId: plan.linkedPlaidAccountId,
    linkedInstitutionName: plan.linkedInstitutionName,
    linkedAccountMask: plan.linkedAccountMask,
    balanceSource: plan.balanceSource,
    balanceSyncedAt: plan.balanceSyncedAt,
    sharedToDashboard: Boolean(plan.sharedToDashboard),
    sharedAt: plan.sharedAt,
    sharedBy: plan.sharedBy,
    openDate: plan.openDate,
    targetPayoffDate: plan.targetPayoffDate,
    monthlyDueDay: plan.monthlyDueDay,
    purchaseBalance: plan.purchaseBalance,
    cashAdvanceBalance: plan.cashAdvanceBalance,
    totalBalance,
    originalBalance: plan.originalBalance,
    purchaseApr: plan.purchaseApr,
    hasCashAdvance: plan.hasCashAdvance,
    cashAdvanceApr: plan.cashAdvanceApr,
    cashAdvanceDate: plan.cashAdvanceDate,
    cashAdvanceFee: plan.cashAdvanceFee,
    minimumPayment: plan.minimumPayment,
    plannedMonthlyPayment: plan.plannedMonthlyPayment,
    requiredMonthlyPayment: plan.requiredMonthlyPayment,
    estimatedInterest: plan.estimatedInterest,
    estimatedPayoffDate: plan.estimatedPayoffDate,
    monthsToPayoff: plan.monthsToPayoff,
    status: plan.status,
    progress,
    aiTips: plan.aiTips,
    schedule: plan.schedule,
    payments: plan.payments,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

async function generatePlanTips(planInput, calculations) {
  if (!process.env.OPENAI_API_KEY) return [];

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: 'You write concise, practical credit card payoff habits. Do not calculate balances or payment amounts.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            card: {
              cardName: planInput.cardName,
              bank: planInput.bank,
              hasCashAdvance: planInput.hasCashAdvance,
              targetPayoffDate: planInput.targetPayoffDate,
              plannedMonthlyPayment: planInput.plannedMonthlyPayment,
              requiredMonthlyPayment: calculations.requiredMonthlyPayment,
            },
            request: 'Give 3 short habits that help the user follow this payoff plan.',
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'credit_card_payoff_tips',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['tips'],
            properties: {
              tips: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
      max_output_tokens: 500,
    });

    const parsed = JSON.parse(response.output_text || '{}');
    return Array.isArray(parsed.tips) ? parsed.tips.filter(Boolean).slice(0, 3) : [];
  } catch (error) {
    return [];
  }
}

function normalizeCreateInput(body) {
  const purchaseBalance = toMoney(body.purchaseBalance);
  const rawCashAdvanceBalance = toMoney(body.cashAdvanceBalance);
  const hasCashAdvance = body.hasCashAdvance === true || body.hasCashAdvance === 'true';
  const cashAdvanceFee = hasCashAdvance ? toMoney(body.cashAdvanceFee) : 0;
  const cashAdvanceBalance = hasCashAdvance ? toMoney(rawCashAdvanceBalance + cashAdvanceFee) : 0;
  const linkedBankingAccountId = mongoose.Types.ObjectId.isValid(body.linkedBankingAccountId)
    ? body.linkedBankingAccountId
    : null;

  return {
    cardName: String(body.cardName || '').trim(),
    bank: String(body.bank || '').trim(),
    linkedBankingAccountId,
    linkedPlaidAccountId: String(body.linkedPlaidAccountId || '').trim(),
    linkedInstitutionName: String(body.linkedInstitutionName || '').trim(),
    linkedAccountMask: String(body.linkedAccountMask || '').trim(),
    balanceSource: linkedBankingAccountId ? 'banking' : 'manual',
    balanceSyncedAt: body.balanceSyncedAt || null,
    openDate: body.openDate || null,
    targetPayoffDate: body.targetPayoffDate || null,
    monthlyDueDay: clampDueDay(body.monthlyDueDay),
    purchaseBalance,
    cashAdvanceBalance,
    originalBalance: toMoney(purchaseBalance + cashAdvanceBalance),
    purchaseApr: Number(body.purchaseApr || 0),
    hasCashAdvance,
    cashAdvanceApr: hasCashAdvance ? Number(body.cashAdvanceApr || 0) : 0,
    cashAdvanceDate: hasCashAdvance ? body.cashAdvanceDate || null : null,
    cashAdvanceFee,
    minimumPayment: toMoney(body.minimumPayment),
    plannedMonthlyPayment: 0,
    sharedToDashboard: body.sharedToDashboard === true || body.sharedToDashboard === 'true',
  };
}

async function listPlans(req, res) {
  try {
    const query = req.user.role === 'admin' ? {} : { ownerId: req.user._id };
    const plans = await CreditCardPlan.find(query).sort({ updatedAt: -1 });

    return res.status(200).json({ plans: plans.map(serializePlan) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function createPlan(req, res) {
  try {
    const planInput = normalizeCreateInput(req.body);

    if (!planInput.cardName || !planInput.targetPayoffDate) {
      return res.status(400).json({ message: 'Card name and target payoff date are required' });
    }

    if (planInput.originalBalance <= 0 || planInput.purchaseApr < 0) {
      return res.status(400).json({ message: 'Balance and APR must be valid numbers' });
    }

    const calculations = buildPlanCalculations(planInput);
    const aiTips = await generatePlanTips(planInput, calculations);

    const plan = await CreditCardPlan.create({
      ...planInput,
      ownerId: req.user._id,
      sharedAt: planInput.sharedToDashboard ? new Date() : null,
      sharedBy: planInput.sharedToDashboard ? req.user._id : null,
      ...calculations,
      aiTips,
      status: planInput.originalBalance <= 0 ? 'paid_off' : 'active',
    });

    return res.status(201).json({ plan: serializePlan(plan) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function addPayment(req, res) {
  try {
    const amount = toMoney(req.body.amount);
    const note = String(req.body.note || '').trim();
    const plan = await CreditCardPlan.findById(req.params.planId);

    if (!plan) return res.status(404).json({ message: 'Credit card plan not found' });
    if (req.user.role !== 'admin' && plan.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than zero' });

    const purchaseInterest = toMoney(plan.purchaseBalance * (plan.purchaseApr / 100 / 12));
    const cashAdvanceInterest = toMoney(plan.cashAdvanceBalance * (plan.cashAdvanceApr / 100 / 12));
    plan.purchaseBalance = toMoney(plan.purchaseBalance + purchaseInterest);
    plan.cashAdvanceBalance = toMoney(plan.cashAdvanceBalance + cashAdvanceInterest);

    const totalBalance = toMoney(plan.purchaseBalance + plan.cashAdvanceBalance);
    const appliedPayment = Math.min(amount, totalBalance);
    const allocation = allocatePrincipal(
      appliedPayment,
      plan.purchaseBalance,
      plan.cashAdvanceBalance,
      plan.purchaseApr,
      plan.cashAdvanceApr
    );

    plan.purchaseBalance = toMoney(plan.purchaseBalance - allocation.purchasePaid);
    plan.cashAdvanceBalance = toMoney(plan.cashAdvanceBalance - allocation.cashAdvancePaid);

    const recalculatedInput = {
      purchaseBalance: plan.purchaseBalance,
      cashAdvanceBalance: plan.cashAdvanceBalance,
      purchaseApr: plan.purchaseApr,
      cashAdvanceApr: plan.cashAdvanceApr,
      monthlyPayment: plan.plannedMonthlyPayment,
      monthlyDueDay: plan.monthlyDueDay,
      minimumPayment: plan.minimumPayment,
      plannedMonthlyPayment: plan.plannedMonthlyPayment,
      targetPayoffDate: plan.targetPayoffDate,
    };
    const calculations = buildPlanCalculations(recalculatedInput);

    plan.requiredMonthlyPayment = calculations.requiredMonthlyPayment;
    plan.estimatedInterest = calculations.estimatedInterest;
    plan.estimatedPayoffDate = calculations.estimatedPayoffDate;
    plan.monthsToPayoff = calculations.monthsToPayoff;
    plan.schedule = calculations.schedule;
    plan.status = plan.purchaseBalance + plan.cashAdvanceBalance <= 0 ? 'paid_off' : 'active';
    plan.payments.push({
      amount: appliedPayment,
      note,
      paidAt: req.body.paidAt || new Date(),
      purchasePrincipalPaid: allocation.purchasePaid,
      cashAdvancePrincipalPaid: allocation.cashAdvancePaid,
      interestCharged: toMoney(purchaseInterest + cashAdvanceInterest),
      balanceAfter: toMoney(plan.purchaseBalance + plan.cashAdvanceBalance),
    });

    await plan.save();

    if (plan.sharedToDashboard) {
      const xp = 10 + Math.min(50, Math.floor(appliedPayment / 25));
      const coins = Math.max(2, Math.floor(xp / 10));

      await awardCoupleProgress(req.user, {
        xp,
        coins,
        type: 'debt_payment',
        title: `Payment logged for ${plan.cardName}`,
        metadata: { planId: plan._id, amount: appliedPayment, balanceAfter: toMoney(plan.purchaseBalance + plan.cashAdvanceBalance) },
      });
    }

    return res.status(200).json({ plan: serializePlan(plan) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function deletePlan(req, res) {
  try {
    const plan = await CreditCardPlan.findById(req.params.planId);

    if (!plan) return res.status(404).json({ message: 'Credit card plan not found' });
    if (req.user.role !== 'admin' && plan.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete this payoff plan' });
    }

    await plan.deleteOne();

    return res.status(200).json({ planId: req.params.planId });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function updateDashboardShare(req, res) {
  try {
    const plan = await CreditCardPlan.findById(req.params.planId);

    if (!plan) return res.status(404).json({ message: 'Credit card plan not found' });
    if (plan.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can change dashboard sharing' });
    }

    const nextValue = Boolean(req.body.sharedToDashboard);
    const wasShared = Boolean(plan.sharedToDashboard);

    plan.sharedToDashboard = nextValue;
    plan.sharedAt = nextValue ? plan.sharedAt || new Date() : null;
    plan.sharedBy = nextValue ? plan.sharedBy || req.user._id : null;

    await plan.save();

    if (nextValue && !wasShared) {
      await awardCoupleProgress(req.user, {
        xp: 0,
        coins: 0,
        type: 'share_plan',
        title: `Shared ${plan.cardName}`,
        metadata: { planId: plan._id },
      });
    }

    return res.status(200).json({ plan: serializePlan(plan) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  addPayment,
  createPlan,
  deletePlan,
  listPlans,
  updateDashboardShare,
};
