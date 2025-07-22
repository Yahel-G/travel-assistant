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
const compromise_1 = __importDefault(require("compromise")); // Import compromise for NER
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
const conversation = new conversationManager_1.ConversationManager();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// Start initialization in the background (optional, will be overridden per request)
let isIntentInitialized = false;
let intentInitialization;
intentInitialization = (0, intentDetection_1.initializeIntentDetection)()
    .then(() => {
    isIntentInitialized = true;
    console.log("Intent detection initialized successfully.");
})
    .catch((error) => {
    console.error("Failed to initialize intent detection:", error);
    isIntentInitialized = false; // Ensure flag reflects failure
});
app.use(express_1.default.json());
app.use(express_1.default.static("public"));
function initializeWithRetry() {
    return __awaiter(this, arguments, void 0, function* (maxRetries = 3, delayMs = 1000) {
        let retries = 0;
        while (retries < maxRetries) {
            try {
                yield intentInitialization;
                if (isIntentInitialized)
                    return; // Success
                throw new Error("Initialization still failed after attempt.");
            }
            catch (error) {
                retries++;
                console.error(`Initialization attempt ${retries} failed:`, error);
                if (retries === maxRetries)
                    throw error;
                const backoff = delayMs * Math.pow(2, retries - 1); // Exponential backoff
                console.log(`Retrying in ${backoff}ms...`);
                yield new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    });
}
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
    const sessionId = "default";
    try {
        // Ensure intent detection is initialized before proceeding
        if (!isIntentInitialized) {
            console.log("Initializing intent detection...");
            try {
                yield initializeWithRetry(); // Use enhanced retry logic
                console.log("Intent detection initialized and ready.");
            }
            catch (error) {
                console.error("All initialization attempts failed:", error);
                // Fallback: Proceed with a default intent if initialization fails
                console.warn("Falling back to default intent 'other' due to initialization failure.");
            }
        }
        const { data: history } = yield supabase
            .from("conversation_history")
            .select("role, content")
            .eq("user_id", userId)
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
        const parsedHistory = history || [];
        console.log(`Supabase history for ${userId}:${sessionId}:`, parsedHistory);
        // NER-based city extraction using compromise
        let city = null;
        const doc = (0, compromise_1.default)(message);
        const locations = doc.places().out("array");
        if (locations.length > 0) {
            city = locations[0].toLowerCase(); // Take the first detected location as the city
            console.log("Extracted city from NER:", city);
        }
        // Fallback to LLM if NER fails
        if (!city) {
            const cityDetectionPrompt = `Identify the city the user is asking about in this prompt. Return only the city name, nothing else: ${message}`;
            const cityResponse = yield conversation.getAssistantResponse(cityDetectionPrompt, {}, false, true, userId, sessionId);
            const cleanedCity = cityResponse.trim().toLowerCase();
            if (cleanedCity &&
                !cleanedCity.match(/^(sorry|couldn’t|please|invalid|no|none)$/i)) {
                city = cleanedCity;
                console.log("Extracted city from LLM:", city);
            }
            else {
                console.log("LLM failed to detect a valid city:", cityResponse);
            }
        }
        let externalData = {};
        const intent = isIntentInitialized ? yield (0, intentDetection_1.detectIntent)(message) : "other"; // Fallback intent
        console.log("Detected Intent:", intent);
        // Fetch external data only if a valid city is present
        if (city &&
            (intent === "tripPlanning" ||
                intent === "packingSuggestions" ||
                intent === "other" ||
                intent === "attractions")) {
            try {
                const weather = yield (0, weatherApi_1.getWeather)(city);
                console.log("Weather fetched:", weather);
                if (weather && weather.description === "unavailable") {
                    throw new Error("Weather data not found");
                }
                const country = weather.country;
                let countryInfo = "Country info unavailable.";
                if (country) {
                    countryInfo = yield (0, restCountriesApi_1.getCountryInfo)(country);
                }
                const weatherString = weather.description
                    ? `Current weather: ${weather.description} with a temperature of ${weather.temperature}°C`
                    : "Weather data unavailable.";
                externalData = { countryInfo, weather: weatherString };
            }
            catch (error) {
                console.error("Error fetching weather data:", error);
                externalData = {
                    countryInfo: "Country info unavailable.",
                    weather: "Weather data unavailable.",
                };
            }
            console.log("Country Info fetched:", externalData.countryInfo);
        }
        else if (intent === "attractions" && city) {
            const weather = yield (0, weatherApi_1.getWeather)(city);
            const attractions = yield (0, geoapifyApi_1.getAttractions)(city);
            console.log("Weather fetched:", weather);
            console.log("Attractions fetched:", attractions || "None");
            externalData = { weather, attractions };
        }
        response = yield conversation.getAssistantResponse(message, externalData, false, false, userId, sessionId);
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
    process.env.NODE_ENV = "development"; // Set development mode for local testing
    (() => __awaiter(void 0, void 0, void 0, function* () { return console.log(yield (0, weatherApi_1.getWeather)("New York")); }))();
}
app.get("/health", (req, res) => {
    console.log("Received /health request");
    res.status(200).json({ status: "Server is running" });
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
