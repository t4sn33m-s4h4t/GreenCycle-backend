const express = require('express');
const router = express.Router();
const { getWeatherData } = require('../controllers/weatherController');

// @route   GET /api/weather
// @desc    Get temperature, rainfall, and solar radiation data

router.get('/', getWeatherData);

module.exports = router;