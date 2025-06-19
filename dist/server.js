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
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
const conversation = new conversationManager_1.ConversationManager();
app.use(express_1.default.json());
app.use(express_1.default.static("public"));
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
    "weather",
    "cold",
    "hot",
    "rainy",
    "sunny",
    "snowy",
    "humid",
    "dry",
    "windy",
    "climate",
    "temperature",
    "forecast",
];
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
        const countryMatch = message.match(/to\s+([a-zA-Z\s]+?)(?:\s+(?:in|and|or|for|with|$))/i) ||
            message.match(/to\s+([a-zA-Z\s]+)/i);
        const cityMatch = message.match(/in\s+([a-zA-Z\s]+?)(?:\s+(?:for|and|or|with|$))/i) ||
            message.match(/in\s+([a-zA-Z\s]+)/i);
        const country = countryMatch ? countryMatch[1].trim() : null;
        const city = cityMatch ? cityMatch[1].trim() : null;
        let externalData = {};
        // Enhanced intent detection with case-insensitive matching and broader triggers
        const lowerInput = message.toLowerCase();
        const isTripPlanning = tripPlanningKeywords.some((keyword) => lowerInput.includes(keyword.toLowerCase())) &&
            (country ||
                city ||
                lowerInput.includes("trip") ||
                lowerInput.includes("plan") ||
                (city && lowerInput.includes("for")));
        const isAttractions = attractionsKeywords.some((keyword) => lowerInput.includes(keyword.toLowerCase())) && city;
        const isPacking = packingKeywords.some((keyword) => lowerInput.includes(keyword.toLowerCase())) &&
            (city || lowerInput.includes("pack") || lowerInput.includes("bring"));
        console.log("Intents:", { isTripPlanning, isAttractions, isPacking });
        if (isTripPlanning) {
            const countryInfo = yield (0, restCountriesApi_1.getCountryInfo)(country);
            console.log("Country Info fetched:", countryInfo || "None");
            externalData = { countryInfo };
        }
        else if (isAttractions || isPacking) {
            if (city) {
                const weather = yield (0, weatherApi_1.getWeather)(city);
                console.log("Weather fetched:", weather);
                const attractions = isAttractions ? yield (0, geoapifyApi_1.getAttractions)(city) : null;
                console.log("Attractions fetched:", attractions || "None");
                externalData = { weather, attractions };
            }
            else {
                externalData = { weather: "No city specified", attractions: null };
            }
        }
        response = yield conversation.getAssistantResponse(message, externalData, false, false, userId, sessionId);
        // Hallucination check for attractions
        if (isAttractions && city && externalData.attractions) {
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
