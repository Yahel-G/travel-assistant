import express from "express";
import { ConversationManager } from "./conversationManager";
import { getWeather } from "./weatherApi";
import { getCountryInfo } from "./restCountriesApi";
import { getAttractions } from "./geoapifyApi";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const conversation = new ConversationManager();

app.use(express.json());
app.use(express.static("public"));

// Intent detection keywords
const tripPlanningKeywords = [
  "plan",
  "trip",
  "travel",
  "visit",
  "go to",
  "tour",
  "arrange",
  "organize",
  "schedule",
  "book",
  "reserve",
  "journey",
  "vacation",
  "getaway",
  "adventure",
  "head to",
  "take a trip",
  "go on a",
  "plan a vacation",
  "itinerary",
  "route",
  "destination",
  "travel plan",
  "holiday",
  "explore",
  "venture",
];
const attractionsKeywords = [
  "attractions",
  "things to do",
  "places to see",
  "sights",
  "what to see",
  "landmarks",
  "points of interest",
  "hotspots",
  "must-see",
  "activities",
  "check out",
  "look at",
  "what to do",
  "stuff to see",
  "tourist spots",
  "cultural sites",
  "historical sites",
  "museums",
  "monuments",
  "explore",
  "discover",
  "sightsee",
];
const packingKeywords = [
  "pack",
  "what to bring",
  "clothing",
  "what should i wear",
  "prepare",
  "gear",
  "items",
  "essentials",
  "outfit",
  "what do i need",
  "stuff to pack",
  "things to take",
  "luggage",
  "travel gear",
  "packing list",
  "wardrobe",
  "supplies",
  "pack for",
  "bring for",
  "wear in",
];

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
    const countryMatch =
      message.match(/to\s+([a-zA-Z\s]+?)(?:\s+(?:in|and|or|for|with|$))/i) ||
      message.match(/to\s+([a-zA-Z\s]+)/i);
    const cityMatch =
      message.match(/in\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|$))/i) ||
      message.match(/in\s+([a-zA-Z\s]+)/i);
    const country = countryMatch ? countryMatch[1].trim() : null;
    const city = cityMatch ? cityMatch[1].trim() : null;

    let externalData: ExternalData = {};

    // Flexible intent detection. For a larger scope project, would use NLP libraries.
    const lowerInput = message.toLowerCase();
    const isTripPlanning =
      tripPlanningKeywords.some((keyword) => lowerInput.includes(keyword)) &&
      country;
    const isAttractions =
      attractionsKeywords.some((keyword) => lowerInput.includes(keyword)) &&
      city;
    const isPacking =
      packingKeywords.some((keyword) => lowerInput.includes(keyword)) && city;
    console.log("Intents:", { isTripPlanning, isAttractions, isPacking });

    if (isTripPlanning) {
      const countryInfo = await getCountryInfo(country);
      externalData = { countryInfo };
    } else if (isAttractions || isPacking) {
      if (city) {
        const weather = await getWeather(city);
        const attractions = isAttractions ? await getAttractions(city) : null;
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
    if (isAttractions && city && externalData.attractions) {
      const lowerResponse = response.toLowerCase();
      const geoapifyAttractions = externalData.attractions.toLowerCase();
      // Flexible city name check (matches "Munich", "Munich's", etc.)
      const cityRegex = new RegExp(`\\b${city.toLowerCase()}(?:'s)?\\b`, "i");
      // Check if Geoapify attractions are used
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
        // Validate attractions with a secondary LLM query
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
          // Purge hallucinated response and add retry response
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

app.get("/health", (req, res) => {
  console.log("Received /health request");
  res.status(200).json({ status: "Server is running" });
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
