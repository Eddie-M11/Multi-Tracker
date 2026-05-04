const express = require('express');

const bankingController = require('../controllers/bankingController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/', bankingController.getBankingProfile);
router.put('/pay-schedule', bankingController.updatePaySchedule);
router.post('/accounts', bankingController.createManualAccount);
router.put('/accounts/:accountId', bankingController.updateManualAccount);
router.delete('/accounts/:accountId', bankingController.deleteAccount);
router.post('/plaid/link-token', bankingController.createPlaidLinkToken);
router.post('/plaid/exchange-public-token', bankingController.exchangePlaidPublicToken);
router.post('/plaid/sync', bankingController.syncPlaidItems);

module.exports = router;
