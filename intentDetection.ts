import * as tf from "@tensorflow/tfjs";
import * as use from "@tensorflow-models/universal-sentence-encoder";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Define intents with example sentences
const intents: { [key: string]: string[] } = {
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
let model: any = null;
let intentEmbeddings: { [key: string]: tf.Tensor1D } = {};
let isInitialized = false;

export async function initializeIntentDetection() {
  if (isInitialized) return;

  // Load pre-bundled model from public/models/
  const modelPath = `${__dirname}/../public/models`; // Relative to intentDetection.ts
  model = await use.load({ modelUrl: modelPath });
  console.log("Model loaded from bundled files.");

  // Load precomputed embeddings from public/intent_embeddings.json
  try {
    const cached = await fs.readFile(
      `${__dirname}/../public/intent_embeddings.json`,
      "utf-8"
    );
    const data = JSON.parse(cached);
    for (const [intent, embedding] of Object.entries(data)) {
      intentEmbeddings[intent] = tf.tensor1d(embedding as number[]);
    }
    console.log("Loaded intent embeddings from bundled cache.");
  } catch (error) {
    console.error("Failed to load bundled embeddings:", error);
    throw new Error(
      "Intent detection initialization failed due to missing embeddings."
    );
  }

  isInitialized = true;
  console.log("Intent detection initialized.");
}

export async function detectIntent(message: string): Promise<string> {
  if (!isInitialized)
    throw new Error("Intent detection model not initialized.");
  const embedding = await model.embed([message]);
  let maxSimilarity = -Infinity;
  let bestIntent = "other";

  for (const [intent, intentEmbedding] of Object.entries(intentEmbeddings)) {
    const similarity = await tf.losses
      .cosineDistance(embedding, intentEmbedding, 0)
      .neg()
      .dataSync()[0];
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      bestIntent = intent;
    }
  }
  embedding.dispose();
  return bestIntent;
}
