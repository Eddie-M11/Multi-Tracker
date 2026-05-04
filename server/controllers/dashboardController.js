const CreditCardPlan = require('../models/CreditCardPlan');
const Goal = require('../models/Goal');
const { awardCoupleProgress, ensureRelationshipForUser, serializeRelationshipProgress } = require('../utils/coupleProgress');

function toMoney(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.round(numberValue * 100) / 100);
}

function serializeUser(user, activityFeed = []) {
  const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentContributionCount = activityFeed.filter((activity) => (
    activity.actorId?.toString() === user._id.toString()
    && new Date(activity.createdAt).getTime() >= recentCutoff
    && Number(activity.xp || 0) > 0
  )).length;

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    xp: user.xp || 0,
    level: user.level || 1,
    coins: user.coins || 0,
    avatar: user.avatar,
    recentContributionCount,
  };
}

function serializeDashboardGoal(goal) {
  const targetAmount = goal.targetAmount || 0;
  const progress = targetAmount > 0 ? Math.min(Math.round((goal.currentAmount / targetAmount) * 100), 100) : 0;
  const owner = goal.ownerId && typeof goal.ownerId === 'object' ? goal.ownerId : null;

  return {
    id: goal._id,
    title: goal.title,
    ownerId: owner?._id || goal.ownerId,
    ownerName: owner?.name || 'Partner',
    visibility: goal.visibility,
    currentAmount: goal.currentAmount,
    targetAmount: goal.targetAmount,
    dueDate: goal.dueDate,
    status: goal.status,
    progress,
    sharedToDashboard: goal.visibility === 'shared' || Boolean(goal.sharedToDashboard),
    updatedAt: goal.updatedAt,
  };
}

function serializeDashboardPlan(plan) {
  const totalBalance = toMoney(plan.purchaseBalance + plan.cashAdvanceBalance);
  const progress = plan.originalBalance > 0
    ? Math.min(Math.round(((plan.originalBalance - totalBalance) / plan.originalBalance) * 100), 100)
    : 100;
  const owner = plan.ownerId && typeof plan.ownerId === 'object' ? plan.ownerId : null;

  return {
    id: plan._id,
    cardName: plan.cardName,
    bank: plan.bank,
    ownerId: owner?._id || plan.ownerId,
    ownerName: owner?.name || 'Partner',
    totalBalance,
    originalBalance: plan.originalBalance,
    plannedMonthlyPayment: plan.plannedMonthlyPayment,
    minimumPayment: plan.minimumPayment,
    targetPayoffDate: plan.targetPayoffDate,
    status: plan.status,
    progress,
    noteCount: plan.dashboardNotes?.length || 0,
    lastNoteAt: plan.dashboardNotes?.length ? plan.dashboardNotes[plan.dashboardNotes.length - 1].createdAt : null,
    sharedToDashboard: Boolean(plan.sharedToDashboard),
    updatedAt: plan.updatedAt,
  };
}

function serializeDashboardNote(note) {
  return {
    id: note._id,
    authorId: note.authorId,
    authorName: note.authorName,
    text: note.text,
    createdAt: note.createdAt,
  };
}

function serializeDashboardPlanDetail(plan) {
  const basePlan = serializeDashboardPlan(plan);
  const nextCheckpoints = (plan.schedule || []).slice(0, 3).map((item) => ({
    month: item.month,
    dueDate: item.dueDate,
    payment: item.payment,
    totalBalance: item.totalBalance,
  }));

  return {
    ...basePlan,
    requiredMonthlyPayment: plan.requiredMonthlyPayment,
    estimatedInterest: plan.estimatedInterest,
    estimatedPayoffDate: plan.estimatedPayoffDate,
    monthsToPayoff: plan.monthsToPayoff,
    nextCheckpoints,
    notes: (plan.dashboardNotes || [])
      .slice()
      .reverse()
      .map(serializeDashboardNote),
  };
}

function serializeActivity(activity) {
  return {
    id: activity._id,
    type: activity.type,
    title: activity.title,
    actorId: activity.actorId,
    actorName: activity.actorName,
    xp: activity.xp,
    coins: activity.coins,
    metadata: activity.metadata || {},
    createdAt: activity.createdAt,
  };
}

async function findSharedPlanForUser(user, planId) {
  if (!planId || !/^[a-f\d]{24}$/i.test(planId)) {
    const error = new Error('Invalid payoff plan');
    error.status = 400;
    throw error;
  }

  const relationship = await ensureRelationshipForUser(user);
  const userIds = relationship.users.map((relationshipUser) => relationshipUser._id);
  const plan = await CreditCardPlan.findOne({
    _id: planId,
    ownerId: { $in: userIds },
    sharedToDashboard: true,
  }).populate('ownerId', 'name');

  if (!plan) {
    const error = new Error('Shared payoff plan not found');
    error.status = 404;
    throw error;
  }

  return { relationship, plan };
}

async function getSharedDashboard(req, res) {
  try {
    const relationship = await ensureRelationshipForUser(req.user);
    const users = relationship.users || [];
    const userIds = users.map((user) => user._id);

    const [goals, plans] = await Promise.all([
      Goal.find({
        category: 'finance',
        ownerId: { $in: userIds },
        $or: [
          { visibility: 'shared' },
          { sharedToDashboard: true },
        ],
      }).populate('ownerId', 'name').sort({ updatedAt: -1 }),
      CreditCardPlan.find({
        ownerId: { $in: userIds },
        sharedToDashboard: true,
      }).populate('ownerId', 'name').sort({ updatedAt: -1 }),
    ]);

    const activityFeed = relationship.activityFeed || [];

    return res.status(200).json({
      relationship: serializeRelationshipProgress(relationship),
      partners: users.map((user) => serializeUser(user, activityFeed)),
      goals: goals.map(serializeDashboardGoal),
      plans: plans.map(serializeDashboardPlan),
      activity: activityFeed.slice(0, 20).map(serializeActivity),
      summary: {
        sharedGoalCount: goals.length,
        sharedPlanCount: plans.length,
        totalGoalTarget: toMoney(goals.reduce((total, goal) => total + (goal.targetAmount || 0), 0)),
        totalGoalCurrent: toMoney(goals.reduce((total, goal) => total + (goal.currentAmount || 0), 0)),
        totalDebtRemaining: toMoney(plans.reduce((total, plan) => total + plan.purchaseBalance + plan.cashAdvanceBalance, 0)),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
}

async function getSharedPlan(req, res) {
  try {
    const { plan } = await findSharedPlanForUser(req.user, req.params.planId);
    return res.status(200).json({ plan: serializeDashboardPlanDetail(plan) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
}

async function addSharedPlanNote(req, res) {
  try {
    const text = String(req.body.text || '').trim();

    if (!text) {
      return res.status(400).json({ message: 'Note text is required' });
    }

    const { plan } = await findSharedPlanForUser(req.user, req.params.planId);

    plan.dashboardNotes.push({
      authorId: req.user._id,
      authorName: req.user.name,
      text,
    });
    await plan.save();

    await awardCoupleProgress(req.user, {
      xp: 0,
      coins: 0,
      type: 'plan_note',
      title: `Note added to ${plan.cardName}`,
      metadata: { planId: plan._id },
    });

    await plan.populate('ownerId', 'name');
    return res.status(201).json({ plan: serializeDashboardPlanDetail(plan) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
}

module.exports = {
  addSharedPlanNote,
  getSharedDashboard,
  getSharedPlan,
};
