import express from "express";
import { ConversationManager } from "./conversationManager";
import { getWeather } from "./weatherApi";
import { getCountryInfo } from "./restCountriesApi";
import { getAttractions } from "./geoapifyApi";
import dotenv from "dotenv";
import { initializeIntentDetection, detectIntent } from "./intentDetection";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const conversation = new ConversationManager();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Initialize intent detection at startup
initializeIntentDetection();

app.use(express.json());
app.use(express.static("public"));

interface ExternalData {
  weather?: any;
  attractions?: any;
  countryInfo?: any;
}

app.post("/api/chat", async (req: any, res: any) => {
  console.log("Received /api/chat request:", req.body);
  const { message, username } = req.body;
  let response: any;

  if (
    !username ||
    typeof username !== "string" ||
    username.trim().length === 0
  ) {
    return res.status(400).json({ reply: "Please provide a valid username." });
  }
  const userId = username.trim();
  const sessionId = "default"; // Static for simplicity; replace with UUID for dynamic sessions

  try {
    // Fetch conversation history to extract city context
    const { data: history } = await supabase
      .from("conversation_history")
      .select("role, content")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const parsedHistory = history || [];
    console.log(`Supabase history for ${userId}:${sessionId}:`, parsedHistory);

    // Enhanced city extraction to handle variations (e.g., Napoli)
    const currentCityMatch =
      message.match(/to\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i) ||
      message.match(/in\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i) ||
      message.match(/([a-zA-Z\s]+?)\s+(?:trip|vacation|there)/i);
    const historicalCityMatch = parsedHistory
      .filter((msg: any) => msg.role === "user")
      .map(
        (msg: any) =>
          msg.content.match(
            /to\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i
          ) ||
          msg.content.match(
            /in\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i
          ) ||
          msg.content.match(/([a-zA-Z\s]+?)\s+(?:trip|vacation|there)/i)
      )
      .find((match) => match);
    const cityMatch = currentCityMatch || historicalCityMatch;
    const city = cityMatch ? cityMatch[1].trim().toLowerCase() : null;
    console.log("Extracted city:", city);

    let externalData: ExternalData = {};

    // Detect intent using sentence similarity
    const intent = await detectIntent(message);
    console.log("Detected Intent:", intent);

    // Fetch data for relevant intents, retry if previously failed
    if (intent === "tripPlanning" || intent === "packingSuggestions") {
      let countryInfo = "Country info unavailable.";
      if (city) {
        try {
          const weather = await getWeather(city);
          console.log("Weather fetched:", weather);
          const country = weather.country;
          if (country) {
            countryInfo = await getCountryInfo(country);
          }
          const weatherString = weather.description
            ? `Current weather: ${weather.description} with a temperature of ${weather.temperature}°C`
            : "Weather data unavailable.";
          externalData = { countryInfo, weather: weatherString };
        } catch (error) {
          console.error("Error fetching weather or country info:", error);
          externalData = {
            countryInfo: "Country info unavailable.",
            weather: "Weather data unavailable.",
          };
        }
      }
      console.log("Country Info fetched:", countryInfo);
    } else if (intent === "attractions") {
      if (city) {
        const weather = await getWeather(city);
        const attractions = await getAttractions(city);
        console.log("Weather fetched:", weather);
        console.log("Attractions fetched:", attractions || "None");
        externalData = { weather, attractions };
      } else {
        externalData = { weather: "No city specified", attractions: null };
      }
    }

    response = await conversation.getAssistantResponse(
      message,
      externalData,
      false,
      false,
      userId,
      sessionId
    );

    // Hallucination check for attractions
    if (intent === "attractions" && city && externalData.attractions) {
      const lowerResponse = response.toLowerCase();
      const geoapifyAttractions = externalData.attractions.toLowerCase();
      const cityRegex = new RegExp(`\\b${city.toLowerCase()}(?:'s)?\\b`, "i");
      const usesGeoapify =
        geoapifyAttractions !== "No attractions found." &&
        geoapifyAttractions
          .split(": ")[1]
          .split(", ")
          .some((attraction: string) =>
            lowerResponse.includes(attraction.split(" (")[0].toLowerCase())
          );

      console.log("Hallucination check:", {
        cityMatch: cityRegex.test(lowerResponse),
        usesGeoapify,
        geoapifyAttractions,
      });

      if (!cityRegex.test(lowerResponse) || !usesGeoapify) {
        const validationPrompt = `
          I’m planning a trip to ${city} and received this list of attractions: 
          ${response}
          Geoapify suggests: ${externalData.attractions}
          Are these attractions valid and well-known for ${city}, or do any seem fictional or unrelated (e.g., "Great Wall" in Munich)? Answer only "Valid" or "Invalid".
          `;
        const validationResponse = await conversation.getAssistantResponse(
          validationPrompt,
          {},
          false,
          true,
          userId,
          sessionId
        );

        console.log("Validation result:", {
          validationPrompt,
          validationResponse,
        });

        if (validationResponse.toLowerCase().includes("invalid")) {
          console.warn("Potential hallucination detected:", response);
          const retryResponse = await conversation.getAssistantResponse(
            message,
            externalData,
            true,
            false,
            userId,
            sessionId
          );
          console.log("Retry response:", retryResponse);
          await conversation.purgeAssistantResponse(
            response,
            userId,
            sessionId
          );
          response = retryResponse;
        }
      }
    }

    res.json({ reply: response });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ reply: "Sorry, an error occurred. Try again." });
  }
});

if (process.env.NODE_ENV === "debug") {
  (async () => console.log(await getWeather("New York")))();
}
app.get("/health", (req, res) => {
  console.log("Received /health request");
  res.status(200).json({ status: "Server is running" });
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
