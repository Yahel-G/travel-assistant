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
exports.ConversationManager = void 0;
const xaiApi_1 = require("./xaiApi");
const ioredis_1 = __importDefault(require("ioredis"));
class ConversationManager {
    constructor() {
        this.redis = new ioredis_1.default(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 50, 2000),
        });
        this.redis.on("error", (err) => console.error("Redis connection error:", err));
        this.redis.on("connect", () => console.log("Connected to Redis"));
    }
    getAssistantResponse(userInput_1) {
        return __awaiter(this, arguments, void 0, function* (userInput, externalData = {}, isRetry = false, isValidation = false, userId = "default", sessionId = "default") {
            // Validate userId
            if (!userId || userId.trim().length === 0) {
                throw new Error("Invalid userId");
            }
            const redisKey = `conversation:${userId}:${sessionId}`;
            // Append user input to history (unless it's a retry or validation)
            if (!isRetry && !isValidation) {
                yield this.redis.lpush(redisKey, JSON.stringify({ role: "user", content: userInput }));
                // Set TTL to expire history after 7 days
                yield this.redis.expire(redisKey, 7 * 24 * 60 * 60);
            }
            // Fetch full history from redis, reversing it to maintain chronological order
            const history = yield this.redis.lrange(redisKey, 0, -1);
            const parsedHistory = history.map((msg) => JSON.parse(msg)).reverse(); // Reverse to maintain chronological order
            console.log(`Redis history for ${redisKey}:`, parsedHistory);
            // System prompt with chain of thought and error handling
            const systemPrompt = `
You are a travel assistant providing concise, accurate responses for travel queries (trip planning, packing, attractions) and validation queries. Follow these rules to avoid hallucinations, recover from confused responses, and handle validation:

1. **Conversation Style**: Be friendly, professional, and engaging. Keep responses concise (50-100 words) when possible unless a detailed plan is requested. Format your output for clarity (e.g., numbered lists, bullet points). Use markdown for emphasis (e.g., *italics*, **bold**).
2. **Query Types**:
   - **Trip Planning**: Use a chain of thought to reason through the response. Break it into steps: (1) duration, (2) destinations, (3) activities. Example: "For a 7-day Italy trip: 1) Plan 7 days. 2) Visit Rome (Colosseum), Florence (Uffizi), Venice (Grand Canal). 3) Try a pasta-making class."
   - **Packing Suggestions**: Provide a short list (3-5 items) based on destination and season/weather. Example: "For Berlin in winter: warm coat, scarf, waterproof boots."
   - **Attractions**: List 2-3 attractions with brief descriptions, prioritizing Geoapify data if provided, else use verified knowledge. Example: "In Munich: Marienplatz (city square), Nymphenburg Palace (historic estate)."
   - **Validation**: For queries asking if attractions are valid for a city (e.g., "Are the following attractions valid for Munich?"), check if they are well-known or plausible. Answer only "Valid" if all attractions are relevant, or "Invalid" if any are fictional or unrelated (e.g., "Taj Mahal" in Munich). Do not explain.
3. **Chain of Thought for Trip Planning**:
   - Step 0: Before responding, check if the user has provided a destination, duration, approximate date (e.g., "next month" - so you can look for weather data), travel preferences (e.g., "I love nature"), weather the trip is for business or a leisure vacation. If not, ask clarifying questions before providing suggestions.
   - Step 1: Identify the destination and infer travel preferences (e.g., culture, adventure) from context or history.
   - Step 2: Suggest a reasonable duration if not specified (e.g., 7 days for international trips).
   - Step 3: Select 2-3 destinations based on popularity and diversity (e.g., capital city, cultural hub, natural site).
   - Step 4: Recommend 1-2 activities per destination, considering weather data if provided.
   - Step 5: Summarize in a numbered list and ask if the user wants details.
4. **Context Management**: Use conversation history to maintain context and answer follow-ups. Reference prior user inputs if relevant. However, avoid repeating the entire history in responses or using long prefaces - remember to be concise when extra details aren't necessary. If user corrects or clarifies (e.g., "No, Berlin, Germany"), adjust response accordingly.
5. **External Data**:
   - **Country Info**: Use for trip planning (e.g., "Currency: Euro" for Germany). If unavailable, rely on verified knowledge.
   - **Weather**: Use for packing/attractions if city-specific (e.g., "Sunny **Munich**: outdoor activities").
   - **Attractions**: Prioritize Geoapify data for city-specific attractions, fall back to verified knowledge.
   - If data is unavailable or irrelevant, use accurate, general knowledge, but don't mention to the user that you're relying on general knowledge.
6. **Error Handling**:
   - If the query is vague (e.g., "Plan a trip"), ask for clarification (e.g., "Where to? Please specify a destination.").
   - If the destination is unknown, suggest a popular alternative and explain (e.g., "I’m unfamiliar with that place. How about Paris?").
   - **Hallucinations**: Avoid fabricating places or facts. Cross-check with external data (e.g., Geoapify for attractions). If unsure, admit uncertainty (e.g., "I’m not sure about that attraction. Try **Marienplatz** instead.").
   - **Confused Responses**: If response seems off (e.g., wrong Berlin), use history or external data to correct (e.g., "Did you mean **Berlin, Germany**?").
   - **Validation Queries**: For queries containing "Are the following attractions valid" or "Answer only 'Valid' or 'Invalid'", return "Valid" or "Invalid" directly, bypassing other checks.
7. **Edge Cases**:
   - For invalid inputs (e.g., "Travel to Narnia"), respond politely: "That destination seems fictional. Can I help with a real-world trip?"
   - Reject fictional destinations ("**Narnia**? Try **Paris**.") or real destinations that you can't actually visit (e.g., the Sun).
   - For sensitive queries (e.g., safety concerns), provide general advice and suggest consulting official sources.
8. **Recovery**: If instructed to correct (e.g., "Ensure valid attractions"), provide accurate response without mentioning the correction.

Conversation history:
${parsedHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

External Data:
- Country Info: ${externalData.countryInfo || "None"}
- Weather: ${externalData.weather || "None"}
- Attractions: ${externalData.attractions || "None"}

Current user query: ${userInput}
`;
            try {
                const response = yield (0, xaiApi_1.generateResponse)(systemPrompt);
                // Allow validation responses to bypass length/N/A checks
                if (userInput.includes("Are these attractions") &&
                    response.toLowerCase().match(/^(valid|invalid)$/i)) {
                    if (!isValidation) {
                        yield this.redis.lpush(redisKey, JSON.stringify({ role: "assistant", content: response }));
                        yield this.redis.expire(redisKey, 60 * 60);
                    }
                    return response;
                }
                if (response.length < 10 || response.includes("N/A")) {
                    return "Sorry, I couldn’t process that. Please clarify your destination or query.";
                }
                // Force hallucination for debugging purposes (only for initial response, not retries)
                /*       if (
                  !isRetry &&
                  userInput.toLowerCase().includes("munich") &&
                  userInput.toLowerCase().includes("attractions") &&
                  !userInput.includes("Ensure the response lists valid attractions")
                ) {
                  console.log("Forcing hallucination for initial response");
                  return "**Munich** attractions: 1. **Munich Great Wall** (historic site). 2. **Fantasy Park** (theme park).";
                }
                console.log("Returning response:", response); */
                if (!isValidation) {
                    yield this.redis.lpush(redisKey, JSON.stringify({ role: "assistant", content: response }));
                    yield this.redis.expire(redisKey, 7 * 24 * 60 * 60);
                }
                return response;
            }
            catch (error) {
                console.error("Error generating response:", error);
                return "Sorry, something went wrong. Try rephrasing or another question.";
            }
        });
    }
    // Purge a specific assistant response (for hallucination recovery)
    purgeAssistantResponse(response_1) {
        return __awaiter(this, arguments, void 0, function* (response, userId = "default", sessionId = "default") {
            if (!userId || userId.trim().length === 0) {
                throw new Error("Invalid userId");
            }
            const redisKey = `conversation:${userId}:${sessionId}`;
            const history = yield this.redis.lrange(redisKey, 0, -1);
            const filteredHistory = history.filter((msg) => {
                const parsed = JSON.parse(msg);
                return !(parsed.role === "assistant" && parsed.content === response);
            });
            yield this.redis.del(redisKey);
            if (filteredHistory.length > 0) {
                yield this.redis.lpush(redisKey, ...filteredHistory);
                yield this.redis.expire(redisKey, 7 * 24 * 60 * 60);
            }
        });
    }
}
exports.ConversationManager = ConversationManager;
