require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Convert place name to lat/lon using LocationIQ
const getCoordinates = async (place) => {
  if (!process.env.LOCATIONIQ_KEY) {
    throw new Error('LOCATIONIQ_KEY not configured');
  }
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

// Fetch NASA POWER API data
const fetchNasaData = async (lat, lon) => {
  const today = new Date();
  const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  const start = firstDayPrevMonth.toISOString().slice(0, 10).replace(/-/g, "");
  const end = lastDayPrevMonth.toISOString().slice(0, 10).replace(/-/g, "");

  const params = [
    'T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M', 'RH2M'
  ].join(',');

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  
  const res = await axios.get(url);
  const data = res.data.properties.parameter;

  const sum = {};
  const count = Object.keys(data.T2M).length;

  for (const key of Object.keys(data)) {
    sum[key] = Object.values(data[key]).reduce((a, b) => a + b, 0);
  }

  return {
    temperature_avg: sum.T2M / count,
    temperature_max: sum.T2M_MAX / count,
    temperature_min: sum.T2M_MIN / count,
    precipitation: sum.PRECTOTCORR / count,
    precipitationLevel: sum.PRECTOTCORR / count === 0 ? "Low" :
                        sum.PRECTOTCORR / count < 5 ? "Moderate" : "High",
    solar_radiation: sum.ALLSKY_SFC_SW_DWN / count,
    wind_speed: sum.WS2M / count,
    humidity: sum.RH2M / count
  };
};

// Controller
const predictCrops = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const place = req.query.place;
    if (!place) return res.status(400).json({ error: 'Place query parameter is required' });

    // 1. Get lat/lon
    const { lat, lon } = await getCoordinates(place);

    // 2. Fetch NASA data
    const climateData = await fetchNasaData(lat, lon);

    // 3. Gemini AI prompt
    const prompt = `
You are an expert agricultural advisor. 

I will provide you with detailed climate and weather data for a specific location. 
Please generate a list{json} of **5 most suitable crops** for cultivation in this location today, based on the climate data.
Don't include any other text outside the JSON array.
Requirements:
1. For each crop, provide:
   - "name": crop name
   - "suitability": percentage (0-100) of how suitable it is for cultivation today
   - "reason": one short sentence why it's suitable
   - "ideal_season": if applicable
2. Return the response strictly in **JSON array format**.
3. Include the provided climate summary in your reasoning.

Climate data for ${place} today:
- Average Temperature: ${climateData.temperature_avg} °C
- Max Temperature: ${climateData.temperature_max} °C
- Min Temperature: ${climateData.temperature_min} °C
- Precipitation: ${climateData.precipitation} mm (${climateData.precipitationLevel})
- Solar Radiation: ${climateData.solar_radiation} MJ/m²/day
- Wind Speed: ${climateData.wind_speed} m/s
- Humidity: ${climateData.humidity} %
`;

    // 4. Call Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const cropsText = response.text();

    // 5. Parse JSON safely
    let crops = [];
    try {
      crops = JSON.parse(cropsText);
    } catch {
      crops = [
        { name: "Rice", suitability: 80, reason: "Moderate temperature and sufficient humidity", ideal_season: "Kharif" },
        { name: "Wheat", suitability: 70, reason: "Cool temperature suitable for wheat", ideal_season: "Rabi" }
      ];
    }

    // 6. Return result
    res.json({
      place,
      date: new Date().toISOString().slice(0, 10),
      climateData,
      crops
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to predict crops', details: error.message });
  }
};

module.exports = { predictCrops };
