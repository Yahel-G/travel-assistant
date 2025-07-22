import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather";

export async function getWeather(city: string): Promise<any> {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) throw new Error("OpenWeatherMap API key not configured");

    // Handle ambiguous cities by appending country code if needed
    let queryCity = city.toLowerCase();
    const countryOverrides: { [key: string]: string } = {
      mexico: "mexico, MX",
      // Add other ambiguous cities as needed (e.g., "vancouver, CA" for Canada)
    };
    queryCity = countryOverrides[queryCity] || queryCity;

    const response = await axios.get(WEATHER_API_URL, {
      params: {
        q: queryCity,
        appid: apiKey,
        units: "metric",
      },
    });
    const data = response.data;
    return {
      description: data.weather[0].description,
      temperature: data.main.temp,
      country: data.sys.country,
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return { description: "unavailable", temperature: null, country: null };
  }
}

module.exports = { getWeather };
