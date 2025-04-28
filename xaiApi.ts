import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

export async function generateResponse(prompt: string): Promise<string> {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not defined in .env file");
  }

  try {
    const response = await axios.post(
      XAI_API_URL,
      {
        model: "grok-3",
        messages: [
          { role: "system", content: "You are a helpful travel assistant." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error: any) {
    console.error("xAI API error:", error.response?.data || error.message);
    throw error;
  }
}
