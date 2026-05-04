const express = require('express');

const creditCardPlanController = require('../controllers/creditCardPlanController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/', creditCardPlanController.listPlans);
router.post('/', creditCardPlanController.createPlan);
router.patch('/:planId/dashboard-share', creditCardPlanController.updateDashboardShare);
router.delete('/:planId', creditCardPlanController.deletePlan);
router.post('/:planId/payments', creditCardPlanController.addPayment);

module.exports = router;
