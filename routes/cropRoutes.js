const express = require('express');
const router = express.Router();
const { predictCrops } = require('../controllers/cropController');

// GET /api/crops?place=Dhaka
router.get('/crops', predictCrops);

module.exports = router;
