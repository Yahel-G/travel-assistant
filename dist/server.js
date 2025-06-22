"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const conversationManager_1 = require("./conversationManager");
const weatherApi_1 = require("./weatherApi");
const restCountriesApi_1 = require("./restCountriesApi");
const geoapifyApi_1 = require("./geoapifyApi");
const dotenv_1 = __importDefault(require("dotenv"));
const intentDetection_1 = require("./intentDetection");
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
const conversation = new conversationManager_1.ConversationManager();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// Initialize intent detection at startup
(0, intentDetection_1.initializeIntentDetection)();
app.use(express_1.default.json());
app.use(express_1.default.static("public"));
app.post("/api/chat", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Received /api/chat request:", req.body);
    const { message, username } = req.body;
    let response;
    if (!username ||
        typeof username !== "string" ||
        username.trim().length === 0) {
        return res.status(400).json({ reply: "Please provide a valid username." });
    }
    const userId = username.trim();
    const sessionId = "default"; // Static for simplicity; replace with UUID for dynamic sessions
    try {
        // Fetch conversation history to extract city context
        const { data: history } = yield supabase
            .from("conversation_history")
            .select("role, content")
            .eq("user_id", userId)
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
        const parsedHistory = history || [];
        console.log(`Supabase history for ${userId}:${sessionId}:`, parsedHistory);
        // Enhanced city extraction to handle variations (e.g., Napoli)
        const currentCityMatch = message.match(/to\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i) ||
            message.match(/in\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i) ||
            message.match(/([a-zA-Z\s]+?)\s+(?:trip|vacation|there)/i);
        const historicalCityMatch = parsedHistory
            .filter((msg) => msg.role === "user")
            .map((msg) => msg.content.match(/to\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i) ||
            msg.content.match(/in\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|next|$))/i) ||
            msg.content.match(/([a-zA-Z\s]+?)\s+(?:trip|vacation|there)/i))
            .find((match) => match);
        const cityMatch = currentCityMatch || historicalCityMatch;
        const city = cityMatch ? cityMatch[1].trim().toLowerCase() : null;
        console.log("Extracted city:", city);
        let externalData = {};
        // Detect intent using sentence similarity
        const intent = yield (0, intentDetection_1.detectIntent)(message);
        console.log("Detected Intent:", intent);
        // Fetch data for relevant intents, retry if previously failed
        if (intent === "tripPlanning" || intent === "packingSuggestions") {
            let countryInfo = "Country info unavailable.";
            if (city) {
                try {
                    const weather = yield (0, weatherApi_1.getWeather)(city);
                    console.log("Weather fetched:", weather);
                    const country = weather.country;
                    if (country) {
                        countryInfo = yield (0, restCountriesApi_1.getCountryInfo)(country);
                    }
                    const weatherString = weather.description
                        ? `Current weather: ${weather.description} with a temperature of ${weather.temperature}°C`
                        : "Weather data unavailable.";
                    externalData = { countryInfo, weather: weatherString };
                }
                catch (error) {
                    console.error("Error fetching weather or country info:", error);
                    externalData = {
                        countryInfo: "Country info unavailable.",
                        weather: "Weather data unavailable.",
                    };
                }
            }
            console.log("Country Info fetched:", countryInfo);
        }
        else if (intent === "attractions") {
            if (city) {
                const weather = yield (0, weatherApi_1.getWeather)(city);
                const attractions = yield (0, geoapifyApi_1.getAttractions)(city);
                console.log("Weather fetched:", weather);
                console.log("Attractions fetched:", attractions || "None");
                externalData = { weather, attractions };
            }
            else {
                externalData = { weather: "No city specified", attractions: null };
            }
        }
        response = yield conversation.getAssistantResponse(message, externalData, false, false, userId, sessionId);
        // Hallucination check for attractions
        if (intent === "attractions" && city && externalData.attractions) {
            const lowerResponse = response.toLowerCase();
            const geoapifyAttractions = externalData.attractions.toLowerCase();
            const cityRegex = new RegExp(`\\b${city.toLowerCase()}(?:'s)?\\b`, "i");
            const usesGeoapify = geoapifyAttractions !== "No attractions found." &&
                geoapifyAttractions
                    .split(": ")[1]
                    .split(", ")
                    .some((attraction) => lowerResponse.includes(attraction.split(" (")[0].toLowerCase()));
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
                const validationResponse = yield conversation.getAssistantResponse(validationPrompt, {}, false, true, userId, sessionId);
                console.log("Validation result:", {
                    validationPrompt,
                    validationResponse,
                });
                if (validationResponse.toLowerCase().includes("invalid")) {
                    console.warn("Potential hallucination detected:", response);
                    const retryResponse = yield conversation.getAssistantResponse(message, externalData, true, false, userId, sessionId);
                    console.log("Retry response:", retryResponse);
                    yield conversation.purgeAssistantResponse(response, userId, sessionId);
                    response = retryResponse;
                }
            }
        }
        res.json({ reply: response });
    }
    catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ reply: "Sorry, an error occurred. Try again." });
    }
}));
if (process.env.NODE_ENV === "debug") {
    (() => __awaiter(void 0, void 0, void 0, function* () { return console.log(yield (0, weatherApi_1.getWeather)("New York")); }))();
}
app.get("/health", (req, res) => {
    console.log("Received /health request");
    res.status(200).json({ status: "Server is running" });
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
