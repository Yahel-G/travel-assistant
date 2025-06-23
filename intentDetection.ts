import * as tf from "@tensorflow/tfjs";
import * as use from "@tensorflow-models/universal-sentence-encoder";

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
let model: use.UniversalSentenceEncoder;
let intentEmbeddings: { [key: string]: tf.Tensor } = {};
let isInitialized = false;

// Load model and precompute embeddings at startup
export async function initializeIntentDetection() {
  if (isInitialized) return;
  model = await use.load();
  for (const [intent, examples] of Object.entries(intents)) {
    const embeddings = await model.embed(examples); // embeddings: Tensor2D
    const meanEmbedding = tf.mean(embeddings as unknown as tf.Tensor, 0); // axis=0, returns Tensor1D
    intentEmbeddings[intent] = meanEmbedding;
    embeddings.dispose();
  }
  isInitialized = true;
  console.log("Intent detection initialized.");
}

// Cosine similarity function
function cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
  const dotProduct = tf.tidy(() => tf.sum(tf.mul(a, b)).arraySync() as number);
  const normA = tf.tidy(() => a.norm().arraySync() as number);
  const normB = tf.tidy(() => b.norm().arraySync() as number);
  return dotProduct / (normA * normB);
}

// Detect intent from user input
export async function detectIntent(
  userInput: string,
  threshold: number = 0.6
): Promise<string> {
  if (!model) {
    throw new Error("Intent detection model not initialized.");
  }
  const inputEmbedding2D = await model.embed([userInput]);
  const inputEmbeddingArr = (await inputEmbedding2D.array()) as number[][];
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
}

// Example usage (commented out to prevent unintended execution)
// async function run() {
//   await initializeIntentDetection();
//   const userMessage = "What should I pack for a cold trip?";
//   const intent = await detectIntent(userMessage);
//   console.log(`Detected Intent: ${intent}`);
// }

// run();
