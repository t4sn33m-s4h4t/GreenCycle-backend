const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
const axios = require('axios');


dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getInsights = async (req, res) => {
    try {
        const { place } = req.query;

        if (!place) {
            return res.status(400).json({ message: "The 'place' query parameter is required." });
        }

        const pastWeatherResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/past-weather?place=${place}&days=14`);
        const pastWeatherData = pastWeatherResponse.data;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const fullPrompt = `You are an AI model specialized in vegetation and bloom prediction.  
Given the following dataset of daily weather conditions, NDVI index, crop type, historical blooming records, and geolocation metadata, analyze the data and generate a concise JSON summary.  

Dataset: ${JSON.stringify(pastWeatherData)}  

Instructions:  
1. Summarize the trends of each factor (temperature, rainfall, humidity, solar radiation, NDVI, crop type, historical bloom patterns, location).  
   - Example: 'Temperature is consistently moderate (26–29°C), favorable for growth.'  
   - Example: 'Historical bloom data shows this crop usually peaks around late March in this region.'  

2. Provide a bloom probability in descriptive terms with range  
   (e.g., 'Very likely (~75–85%)', 'Uncertain (~40–50%)', 'Unfavorable (~20–30%)').  

3. Include a numeric confidence score (0–100) based on how consistent and reliable the data and historical records are.  

4. Provide a short recommendation tailored to the crop and location.  

5. Look up for historical dataset by yourself from internet sources.

5. Output only valid JSON in this format:  
{  
  "location": {  
    "lat": <float>,  
    "long": <float>,  
    "elevation_m": <float>
  },  
  "factor_summary": {
  "task": "analyzyed climate data for the past 14 days and used historical data for precise prediction", //hardcoded
    "temperature": "<short trend analysis>",  
    "rainfall": "<short trend analysis>",  
    "humidity": "<short trend analysis>",  
    "solar_radiation": "<short trend analysis>"
  },  
  "bloom_outlook": {  
    "probability": "<Descriptive probability with range>",  
    "confidence_score": <0-100>,  
    "reason": "<one-sentence explanation>"  
  },  
  "recommendation": "<short practical advice>"  
}"

Here is a demo response for you to work on:
{
  "location": {
    "lat": 30.9,
    "long": 75.8,
    "elevation_m": 250.0
  },
  "factor_summary": {
  "task": "analyzyed climate data for the past 14 days and used historical data for precise prediction",
    "temperature": "Stable 24–28°C range, ideal for wheat.",
    "rainfall": "Low rainfall, irrigation needed.",
    "humidity": "Moderate 60–70%, low disease risk.",
    "solar_radiation": "High sunlight, promotes photosynthesis."
  },
  "bloom_outlook": {
    "probability": "Very likely (~78–88%) bloom success.",
    "confidence_score": 84,
    "reason": "Favorable weather, rising NDVI, and historical alignment support strong bloom likelihood."
  },
  "recommendation": "Maintain irrigation to offset low rainfall and apply balanced nutrients to maximize yield."
}`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = await response.text();
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '');
        res.status(200).json(JSON.parse(cleanedText));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { getInsights };
