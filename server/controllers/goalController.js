const Goal = require('../models/Goal');
const User = require('../models/User');

function calculateLevel(xp) {
  return Math.floor(xp / 250) + 1;
}

function serializeGoal(goal) {
  const targetAmount = goal.targetAmount || 0;
  const progress = targetAmount > 0 ? Math.min(Math.round((goal.currentAmount / targetAmount) * 100), 100) : 0;

  return {
    id: goal._id,
    title: goal.title,
    description: goal.description,
    category: goal.category,
    visibility: goal.visibility,
    ownerId: goal.ownerId,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    dueDate: goal.dueDate,
    visualType: goal.visualType,
    sharedXp: goal.sharedXp,
    sharedLevel: goal.sharedLevel,
    status: goal.status,
    progress,
    tasks: goal.tasks,
    notes: goal.notes,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function canAccessGoal(user, goal) {
  if (user.role === 'admin') return true;
  if (goal.visibility === 'shared') return true;
  return goal.ownerId.toString() === user._id.toString();
}

async function awardUser(userId, xp, coins) {
  const user = await User.findById(userId);
  if (!user) return null;

  user.xp = Math.max(0, user.xp + xp);
  user.coins = Math.max(0, user.coins + coins);
  user.level = calculateLevel(user.xp);
  await user.save();

  return user;
}

function syncGoalStatus(goal) {
  const allTasksComplete = goal.tasks.length > 0 && goal.tasks.every((task) => task.completed);
  const targetReached = goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount;

  if (allTasksComplete && targetReached) {
    goal.status = 'completed';
  } else if (goal.status === 'completed') {
    goal.status = 'active';
  }

  goal.sharedLevel = calculateLevel(goal.sharedXp);
}

async function listGoals(req, res) {
  try {
    const query = req.user.role === 'admin'
      ? { category: 'finance' }
      : {
          category: 'finance',
          $or: [{ ownerId: req.user._id }, { visibility: 'shared' }],
        };

    const goals = await Goal.find(query).sort({ updatedAt: -1 });

    return res.status(200).json({ goals: goals.map(serializeGoal) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function createGoal(req, res) {
  try {
    const {
      title,
      description = '',
      visibility,
      targetAmount,
      currentAmount = 0,
      dueDate = null,
      visualType = 'ring',
      tasks = [],
      note = '',
    } = req.body;

    if (!title || !visibility || targetAmount === undefined) {
      return res.status(400).json({ message: 'Title, visibility, and target amount are required' });
    }

    const goal = await Goal.create({
      title,
      description,
      visibility,
      ownerId: req.user._id,
      targetAmount,
      currentAmount,
      dueDate: dueDate || null,
      visualType,
      tasks: tasks
        .filter((task) => task.title)
        .map((task) => ({
          title: task.title,
          description: task.description || '',
          difficulty: task.difficulty || 'easy',
          xp: task.xp || 20,
          coins: task.coins || 5,
        })),
      notes: note
        ? [{
            authorId: req.user._id,
            authorName: req.user.name,
            text: note,
          }]
        : [],
    });

    return res.status(201).json({ goal: serializeGoal(goal) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function addContribution(req, res) {
  try {
    const { amount, note = '' } = req.body;
    const goal = await Goal.findById(req.params.goalId);

    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    if (!canAccessGoal(req.user, goal)) return res.status(403).json({ message: 'Access denied' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Contribution amount must be greater than zero' });

    goal.currentAmount += Number(amount);

    if (note) {
      goal.notes.push({
        authorId: req.user._id,
        authorName: req.user.name,
        text: note,
      });
    }

    const xp = 10;
    const coins = 2;
    await awardUser(req.user._id, xp, coins);

    if (goal.visibility === 'shared') {
      goal.sharedXp += xp;
    }

    syncGoalStatus(goal);
    await goal.save();

    return res.status(200).json({ goal: serializeGoal(goal), rewards: { xp, coins } });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function completeTask(req, res) {
  try {
    const goal = await Goal.findById(req.params.goalId);

    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    if (!canAccessGoal(req.user, goal)) return res.status(403).json({ message: 'Access denied' });

    const task = goal.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.completed) return res.status(400).json({ message: 'Task is already complete' });

    task.completed = true;
    task.completedBy = req.user._id;
    task.completedAt = new Date();

    await awardUser(req.user._id, task.xp, task.coins);

    if (goal.visibility === 'shared') {
      goal.sharedXp += task.xp;
    }

    syncGoalStatus(goal);
    await goal.save();

    return res.status(200).json({ goal: serializeGoal(goal), rewards: { xp: task.xp, coins: task.coins } });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function undoTask(req, res) {
  try {
    const goal = await Goal.findById(req.params.goalId);

    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    if (!canAccessGoal(req.user, goal)) return res.status(403).json({ message: 'Access denied' });

    const task = goal.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!task.completed) return res.status(400).json({ message: 'Task is not complete' });

    const completedBy = task.completedBy;

    task.completed = false;
    task.completedBy = null;
    task.completedAt = null;

    if (completedBy) {
      await awardUser(completedBy, -task.xp, -task.coins);
    }

    if (goal.visibility === 'shared') {
      goal.sharedXp = Math.max(0, goal.sharedXp - task.xp);
    }

    syncGoalStatus(goal);
    await goal.save();

    return res.status(200).json({ goal: serializeGoal(goal), rewards: { xp: -task.xp, coins: -task.coins } });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function addNote(req, res) {
  try {
    const { text } = req.body;
    const goal = await Goal.findById(req.params.goalId);

    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    if (!canAccessGoal(req.user, goal)) return res.status(403).json({ message: 'Access denied' });
    if (!text) return res.status(400).json({ message: 'Note text is required' });

    goal.notes.push({
      authorId: req.user._id,
      authorName: req.user.name,
      text,
    });

    await goal.save();

    return res.status(201).json({ goal: serializeGoal(goal) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  addContribution,
  addNote,
  completeTask,
  createGoal,
  listGoals,
  undoTask,
};
