const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const weatherRoutes = require('./routes/weather');
const cropRoutes = require('./routes/cropRoutes');
const app = express();
 
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use('/api/weather', weatherRoutes);
app.use('/api/crops', cropRoutes);
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Express.js API!' });
});
 
 
 
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});
 
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;