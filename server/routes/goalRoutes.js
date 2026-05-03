const express = require('express');

const goalController = require('../controllers/goalController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/', goalController.listGoals);
router.post('/', goalController.createGoal);
router.post('/suggest-tasks', goalController.suggestTasks);
router.post('/:goalId/contributions', goalController.addContribution);
router.post('/:goalId/notes', goalController.addNote);
router.post('/:goalId/tasks/:taskId/complete', goalController.completeTask);
router.post('/:goalId/tasks/:taskId/undo', goalController.undoTask);

module.exports = router;
