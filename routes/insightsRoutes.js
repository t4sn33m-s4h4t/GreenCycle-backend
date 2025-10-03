const express = require('express');
const router = express.Router();
const { getInsights } = require('../controllers/insightsController');

router.get('/insights', getInsights);

module.exports = router;