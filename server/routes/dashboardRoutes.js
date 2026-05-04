const express = require('express');

const dashboardController = require('../controllers/dashboardController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/shared', dashboardController.getSharedDashboard);
router.get('/shared/plans/:planId', dashboardController.getSharedPlan);
router.post('/shared/plans/:planId/notes', dashboardController.addSharedPlanNote);

module.exports = router;
