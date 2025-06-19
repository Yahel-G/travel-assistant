import * as tf from "@tensorflow/tfjs";
import * as use from "@tensorflow-models/universal-sentence-encoder";

// Define intents with example sentences
const intents: { [key: string]: string[] } = {
  tripPlanning: [
    "I want to plan a trip to Paris.",
    "Help me organize my vacation to Japan.",
    "Can you suggest an itinerary for a week in Italy?",
  ],
  packingSuggestions: [
    "What should I pack for a trip to New York?",
    "Do I need warm clothes for my vacation?",
    "What are the essentials for a beach trip?",
  ],
  attractions: [
    "What are the must-see places in Rome?",
    "Tell me about the top attractions in London.",
    "What should I visit in Tokyo?",
  ],
};

// Global variables for model and embeddings
let model: use.UniversalSentenceEncoder;
let intentEmbeddings: { [key: string]: tf.Tensor } = {};

// Load model and precompute embeddings at startup
async function initializeIntentDetection() {
  model = await use.load();
  for (const [intent, examples] of Object.entries(intents)) {
    const embeddings = await model.embed(examples); // embeddings: Tensor2D
    // Compute mean embedding manually since Tensor2D doesn't have .mean() as a method
    const meanEmbedding = tf.mean(embeddings as unknown as tf.Tensor, 0); // axis=0, returns Tensor1D
    intentEmbeddings[intent] = meanEmbedding;
    embeddings.dispose();
  }
  console.log("Intent detection initialized.");
}

// Cosine similarity function
function cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
  // a and b should be 1D tensors
  const dotProduct = tf.tidy(() => tf.sum(tf.mul(a, b)).arraySync() as number);
  const normA = tf.tidy(() => a.norm().arraySync() as number);
  const normB = tf.tidy(() => b.norm().arraySync() as number);
  return dotProduct / (normA * normB);
}

// Detect intent from user input
async function detectIntent(
  userInput: string,
  threshold: number = 0.7
): Promise<string> {
  if (!model) await initializeIntentDetection();
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
  return maxSimilarity >= threshold ? detectedIntent : "other";
  return maxSimilarity >= threshold ? detectedIntent : "other";
}

// Example usage
async function run() {
  await initializeIntentDetection();
  const userMessage = "What should I pack for a cold trip?";
  const intent = await detectIntent(userMessage);
  console.log(`Detected Intent: ${intent}`);
}

run();
