import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather";

export async function getWeather(city: string): Promise<string> {
  try {
    const response = await axios.get(WEATHER_API_URL, {
      params: {
        q: city,
        appid: process.env.WEATHER_API_KEY,
        units: "metric",
      },
    });
    const data = response.data;
    return `The current weather in ${city} is ${data.weather[0].description} with a temperature of ${data.main.temp}°C.`;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return "Unable to fetch weather data.";
  }
}
