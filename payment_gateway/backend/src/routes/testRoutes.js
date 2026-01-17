const express = require('express');
const router = express.Router();
const { getTestMerchant } = require('../controllers/testController');

router.get('/merchant', getTestMerchant);

module.exports = router;
