const express = require('express');

const requireAuth = require('../middleware/requireAuth');
const relationshipController = require('../controllers/relationshipController');

const router = express.Router();

router.post('/create', requireAuth, relationshipController.createRelationship);
router.post('/join', requireAuth, relationshipController.joinRelationship);

module.exports = router;
