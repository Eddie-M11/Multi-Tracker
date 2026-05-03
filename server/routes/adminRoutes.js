const express = require('express');

const adminController = require('../controllers/adminController');
const requireAdmin = require('../middleware/requireAdmin');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);

module.exports = router;
