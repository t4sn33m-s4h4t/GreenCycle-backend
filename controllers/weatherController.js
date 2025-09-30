const axios = require('axios');

const NASA_BASE_URL = 'https://power.larc.nasa.gov/api/temporal/hourly/point';

// Helper function to format timestamp
const formatTimestamp = (timestamp) => {
  const year = timestamp.substring(0, 4);
  const month = timestamp.substring(4, 6);
  const day = timestamp.substring(6, 8);
  const hour = timestamp.substring(8, 10);
  return `${year}-${month}-${day} ${hour}:00`;
};

// Main function to get weather data
const getWeatherData = async (req, res) => {
  try {
    const { latitude, longitude, startDate, endDate } = req.query;

    // Validate required parameters
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: latitude, longitude'
      });
    }

    // Convert dates to NASA format (YYYYMMDD)
    const nasaStart = startDate ? startDate.replace(/-/g, '') : '20230101';
    const nasaEnd = endDate ? endDate.replace(/-/g, '') : '20230103';

    console.log('Making NASA API call with:', {
      start: nasaStart,
      end: nasaEnd,
      latitude,
      longitude
    });

    // NASA API call
    const response = await axios.get(NASA_BASE_URL, {
      params: {
        start: nasaStart,
        end: nasaEnd,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        community: 'ag',
        parameters: 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN',
        format: 'json'
      },
      timeout: 15000
    });

    const nasaData = response.data;
    console.log('NASA API Response received');

    // Process and clean the data
    const cleanedData = processWeatherData(nasaData, nasaStart, nasaEnd);

    res.json({
      success: true,
      data: cleanedData
    });

  } catch (error) {
    console.error('Weather API Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather data: ' + error.message
    });
  }
};

// Process and clean NASA data - FIXED VERSION
const processWeatherData = (nasaData, requestedStart, requestedEnd) => {
  const { properties, geometry, header } = nasaData;
  
  // FIX: Access data from properties.parameter (not parameters)
  const tempData = properties.parameter.T2M;
  const rainData = properties.parameter.PRECTOTCORR;
  const solarData = properties.parameter.ALLSKY_SFC_SW_DWN;
  
  const hourlyData = [];
  const dailyRainfall = {};
  
  // Get all valid timestamps
  const timestamps = Object.keys(tempData).filter(ts => 
    ts.length === 10 && !isNaN(ts)
  );
  
  console.log(`Processing ${timestamps.length} hourly data points`);
  
  timestamps.forEach(timestamp => {
    const formattedTime = formatTimestamp(timestamp);
    const date = formattedTime.split(' ')[0];
    
    const temp = tempData[timestamp];
    const rain = rainData[timestamp];
    const solar = solarData[timestamp];
    
    // Add to hourly data (only valid numbers)
    if (typeof temp === 'number' && temp !== -999) {
      hourlyData.push({
        timestamp: formattedTime,
        temperature: temp,
        solar_radiation: solar,
        rainfall: rain
      });
      
      // Accumulate daily rainfall (only positive values)
      if (rain > 0) {
        dailyRainfall[date] = (dailyRainfall[date] || 0) + rain;
      }
    }
  });
  
  // Convert daily rainfall to array
  const dailyRainfallArray = Object.entries(dailyRainfall).map(([date, value]) => ({
    date,
    rainfall: parseFloat(value.toFixed(2))
  }));
  
  // Calculate statistics only if we have data
  let tempStats = { daily_average: null, daily_min: null, daily_max: null };
  let solarStats = { daily_average: null };
  
  if (hourlyData.length > 0) {
    const temperatures = hourlyData.map(h => h.temperature);
    const solarValues = hourlyData.map(h => h.solar_radiation);
    
    tempStats = {
      daily_average: parseFloat((temperatures.reduce((a, b) => a + b, 0) / temperatures.length).toFixed(2)),
      daily_min: parseFloat(Math.min(...temperatures).toFixed(2)),
      daily_max: parseFloat(Math.max(...temperatures).toFixed(2))
    };
    
    solarStats = {
      daily_average: parseFloat((solarValues.reduce((a, b) => a + b, 0) / solarValues.length).toFixed(2))
    };
  }
  
  return {
    location: {
      latitude: geometry.coordinates[1],
      longitude: geometry.coordinates[0],
      elevation: geometry.coordinates[2]
    },
    period: {
      requested: `${requestedStart} to ${requestedEnd}`,
      actual: `${header.start} to ${header.end}`,
      days_covered: hourlyData.length / 24
    },
    summary: {
      temperature: tempStats,
      rainfall: {
        total: parseFloat(dailyRainfallArray.reduce((sum, day) => sum + day.rainfall, 0).toFixed(2)),
        rainy_days: dailyRainfallArray.length
      },
      solar_radiation: solarStats
    },
    temperature: {
      unit: "°C",
      ...tempStats,
      hourly_data: hourlyData.map(h => ({
        timestamp: h.timestamp,
        value: h.temperature
      })).slice(0, 24) // First 24 hours
    },
    rainfall: {
      unit: "mm",
      total: parseFloat(dailyRainfallArray.reduce((sum, day) => sum + day.rainfall, 0).toFixed(2)),
      daily_data: dailyRainfallArray
    },
    solar_radiation: {
      unit: "MJ/hr",
      ...solarStats,
      hourly_data: hourlyData.map(h => ({
        timestamp: h.timestamp,
        value: h.solar_radiation
      })).slice(0, 24) // First 24 hours
    }
  };
};

module.exports = {
  getWeatherData
};