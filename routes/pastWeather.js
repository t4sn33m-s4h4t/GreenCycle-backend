const express = require('express');
const router = express.Router();
const { getPastWeather } = require('../controllers/pastWeatherController');

// GET /api/past-weather?place=Dhaka&days=14
router.get('/', getPastWeather);

module.exports = router;