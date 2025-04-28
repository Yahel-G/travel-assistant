import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const GEOAPIFY_API_URL = "https://api.geoapify.com/v2/places";

export async function getAttractions(city: string): Promise<string> {
  if (!process.env.GEOAPIFY_API_KEY) {
    throw new Error("GEOAPIFY_API_KEY is not defined in .env file");
  }

  try {
    // First, get place ID for the city (Geoapify requires a place filter)
    const placeResponse = await axios.get(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
        city
      )}&apiKey=${process.env.GEOAPIFY_API_KEY}`
    );
    const placeId = placeResponse.data.features[0]?.properties.place_id;
    if (!placeId) return "No attractions found.";

    // Fetch attractions (e.g., tourism, culture, leisure)
    const response = await axios.get(GEOAPIFY_API_URL, {
      params: {
        categories: "tourism,entertainment.culture,leisure",
        filter: `place:${placeId}`,
        limit: 3,
        apiKey: process.env.GEOAPIFY_API_KEY,
      },
    });

    const attractions = response.data.features.map((feature: any) => {
      const name = feature.properties.name || "Unnamed attraction";
      const category = feature.properties.categories[0] || "place";
      return `${name} (${category})`;
    });

    return attractions.length > 0
      ? `Attractions: ${attractions.join(", ")}`
      : "No attractions found.";
  } catch (error: any) {
    console.error("Geoapify API error:", error.response?.data || error.message);
    return "Attractions unavailable.";
  }
}
