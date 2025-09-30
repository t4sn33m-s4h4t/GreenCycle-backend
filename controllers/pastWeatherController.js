require('dotenv').config();
const axios = require('axios');

// Helper: Get coordinates from place name
const getCoordinates = async (place) => {
  if (!process.env.LOCATIONIQ_KEY) throw new Error('LOCATIONIQ_KEY not configured');
  const url = `https://us1.locationiq.com/v1/search.php?key=${process.env.LOCATIONIQ_KEY}&q=${encodeURIComponent(place)}&format=json&limit=1`;
  const response = await axios.get(url);
  if (response.data && response.data.length > 0) {
    return {
      lat: parseFloat(response.data[0].lat),
      lon: parseFloat(response.data[0].lon)
    };
  }
  throw new Error('Place not found');
};

// Helper: Get NASA weather data for date range
const fetchNasaData = async (lat, lon, start, end) => {
  const params = [
    'T2M', 'PRECTOTCORR', 'RH2M', 'ALLSKY_SFC_SW_DWN'
  ].join(',');
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  const res = await axios.get(url);
  return {
    parameter: res.data.properties.parameter,
    elevation: res.data.geometry?.coordinates[2] || 0
  };
};

// Main controller
const getPastWeather = async (req, res) => {
  // Helper to format NASA POWER API values, replacing -999 with null
  const formatNasaValue = (value) => {
    return value === -999 ? null : parseFloat(value.toFixed(2));
  };

  try {
    const { place, days } = req.query;
    if (!place || !days) {
      return res.status(400).json({ error: 'Missing required query parameters: place, days' });
    }
    const numDays = Math.max(1, Math.min(parseInt(days), 30)); // Limit to 30 days max

    // Get coordinates
    const { lat, lon } = await getCoordinates(place);

    // Date range (use yesterday as end date)
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - numDays + 1);
    const start = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    const end = endDate.toISOString().slice(0, 10).replace(/-/g, '');

    // Fetch NASA data
    const nasaData = await fetchNasaData(lat, lon, start, end);
    const data = nasaData.parameter;
    const elevation = nasaData.elevation;

    // Check for missing data
    if (!data || !data.T2M) {
      return res.status(404).json({ error: 'No weather data found for this location and date range.' });
    }

    // Build response in sample.json format
    const result = {
      location: {
        lat,
        long: lon,
        elevation_m: elevation
      }
    };

    // For each day, add Day_XX object
    const dates = Object.keys(data.T2M);
    for (let i = 0; i < dates.length; i++) {
      const dateStr = dates[i];
      const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
      result[`Day_${(i+1).toString().padStart(2, '0')}`] = {
        date: formattedDate,
        temperature_c: formatNasaValue(data.T2M[dateStr]),
        rainfall_mm: formatNasaValue(data.PRECTOTCORR[dateStr]),
        humidity: formatNasaValue(data.RH2M[dateStr]),
        solar_radiation: formatNasaValue(data.ALLSKY_SFC_SW_DWN[dateStr]),
        ndvi: null // NASA POWER does not provide NDVI; set null or fetch from other source if needed
      };
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch past weather data', details: error.message });
  }
};

module.exports = { getPastWeather };