"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeIntentDetection = initializeIntentDetection;
exports.detectIntent = detectIntent;
const tf = __importStar(require("@tensorflow/tfjs"));
const use = __importStar(require("@tensorflow-models/universal-sentence-encoder"));
const fs = __importStar(require("fs/promises"));
// Define intents with example sentences
const intents = {
    tripPlanning: [
        "I want to plan a trip to a destination.",
        "Help me organize my vacation to a place.",
        "Can you suggest an itinerary for a week somewhere?",
        "Could you help me map out a tour of a location?",
        "I'm thinking about traveling next spring—any ideas?",
        "Assist me in scheduling a road trip.",
        "I need to arrange a multi-city trip.",
        "Plan a weekend getaway.",
        "What’s the best way to visit multiple places over two weeks?",
        "Help me book flights and hotels for a journey.",
        "I want to design a budget-friendly route.",
        "Outline a family-friendly holiday plan.",
        "Draft an itinerary for a business trip.",
        "Can you build me a day-by-day schedule for a getaway?",
        "Show me how to combine a safari with a beach stay.",
        "I’d like to plan a ski vacation—what should I do first?",
        "Help me chart a culinary tour of great food cities.",
        "What steps do I need to plan a cruise?",
        "I’m planning a festival trip in September—any suggestions?",
        "Give me an outline for a cultural tour.",
    ],
    packingSuggestions: [
        "What should I pack for a trip to a destination?",
        "Do I need warm clothes for my vacation?",
        "What are the essentials for a beach trip?",
        "Can you tell me what to pack for a month away?",
        "I have a backpacking trip—what gear do I need?",
        "Suggest a packing list for a business conference.",
        "What travel adapters and chargers should I bring?",
        "Do I need waterproof gear for a trip in July?",
        "Which toiletries are airline-friendly for carry-on only?",
        "Help me pack light for a weekend.",
        "What winter clothing is necessary for a ski trip?",
        "List the must-have electronics for travel.",
        "What documents should I keep in my carry-on?",
        "Advise me on packing for a tropical cruise.",
        "What vaccines or medical kit items to pack for a region?",
        "I’m going camping—what should go in my duffel?",
        "What shoes should I bring for a tour and light hiking?",
        "Recommend packing tips for traveling with a toddler.",
        "I need a minimalist packing list for a trip.",
        "What seasonal clothes are best for a fall journey?",
        "What personal care items do I need in my daypack?",
        "Give me a checklist for camping essentials and kitchen gear.",
        "Do you know the current weather there?",
        "Do you have access for the weather forecast?",
    ],
    attractions: [
        "What are the must-see places in a city?",
        "Tell me about the top attractions somewhere.",
        "What should I visit in a location?",
        "Show me the hidden gems around a place.",
        "What landmarks shouldn’t I miss?",
        "Recommend the best museums in a region.",
        "Which neighborhoods have the coolest street art?",
        "What day-trip excursions can I do from a town?",
        "List the top scenic viewpoints in an area.",
        "Suggest family-friendly attractions in a spot.",
        "What cultural experiences are a must in a country?",
        "Where can I catch a sunset?",
        "Which wine tours are best near a region?",
        "What are the can’t-miss historic sites?",
        "What hiking trails with views are near a place?",
        "Recommend foodie hotspots in a city.",
        "What activities are popular around a landmark?",
        "Where can I go whale-watching?",
        "What jazz clubs should I visit?",
        "Which temples should I see?",
        "What Christmas markets are best?",
    ],
};
// Global variables for model and embeddings
let model;
let intentEmbeddings = {};
let isInitialized = false;
// Load model and precompute embeddings at startup
function initializeIntentDetection() {
    return __awaiter(this, void 0, void 0, function* () {
        if (isInitialized)
            return;
        // Try to load cached embeddings
        try {
            const cached = yield fs.readFile("intent_embeddings.json", "utf-8");
            const data = JSON.parse(cached);
            for (const [intent, embedding] of Object.entries(data)) {
                intentEmbeddings[intent] = tf.tensor1d(embedding);
            }
            console.log("Loaded intent embeddings from cache.");
        }
        catch (error) {
            model = yield use.load();
            for (const [intent, examples] of Object.entries(intents)) {
                const embeddings = yield model.embed(examples);
                const meanEmbedding = tf.mean(embeddings, 0);
                intentEmbeddings[intent] = meanEmbedding;
                embeddings.dispose();
            }
            // Save to cache
            const cacheData = Object.fromEntries(Object.entries(intentEmbeddings).map(([intent, tensor]) => [
                intent,
                tensor.arraySync(),
            ]));
            yield fs.writeFile("intent_embeddings.json", JSON.stringify(cacheData));
            console.log("Computed and cached intent embeddings.");
        }
        isInitialized = true;
        console.log("Intent detection initialized.");
    });
}
// Cosine similarity function
function cosineSimilarity(a, b) {
    const dotProduct = tf.tidy(() => tf.sum(tf.mul(a, b)).arraySync());
    const normA = tf.tidy(() => a.norm().arraySync());
    const normB = tf.tidy(() => b.norm().arraySync());
    return dotProduct / (normA * normB);
}
// Detect intent from user input
function detectIntent(userInput_1) {
    return __awaiter(this, arguments, void 0, function* (userInput, threshold = 0.6) {
        if (!model) {
            throw new Error("Intent detection model not initialized.");
        }
        const inputEmbedding2D = yield model.embed([userInput]);
        const inputEmbeddingArr = (yield inputEmbedding2D.array());
        const inputEmbedding = tf.tensor1d(inputEmbeddingArr[0]); // Make it 1D
        let maxSimilarity = -1;
        let detectedIntent = "other";
        for (const [intent, embedding] of Object.entries(intentEmbeddings)) {
            const similarity = cosineSimilarity(inputEmbedding, embedding);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                detectedIntent = intent;
            }
        }
        inputEmbedding2D.dispose();
        return maxSimilarity >= threshold ? detectedIntent : "other";
    });
}
// Example usage (commented out to prevent unintended execution)
// async function run() {
//   await initializeIntentDetection();
//   const userMessage = "What should I pack for a cold trip?";
//   const intent = await detectIntent(userMessage);
//   console.log(`Detected Intent: ${intent}`);
// }
// run();
