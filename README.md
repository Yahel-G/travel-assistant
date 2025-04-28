# Travel Assistant

The **Travel Assistant** is a web-based conversational application built to demonstrate effective LLM interactions for travel planning. Developed with TypeScript, Express, and Redis Cloud, it handles trip planning, attraction queries, and packing suggestions with a focus on natural conversation, robust prompt engineering, and external API integration. The project prioritizes conversation quality, creative prompt design, error handling, and context management.

## Features

### Conversation-First Design

- **Query Types**:
  - **Trip Planning**: Creates itineraries (e.g., “Plan a trip to Germany” → 7-day plan with Berlin, Munich).
  - **Attractions**: Lists city-specific attractions (e.g., “Attractions in Munich” → BMW Welt, Marienplatz).
  - **Packing Suggestions**: Provides weather-based packing lists (e.g., “Pack for Berlin” → coat, scarf).
- **Context Management**: Maintains conversation history in Redis Cloud per user (e.g., `conversation:Alice:default`), enabling follow-ups (e.g., “More about Munich” after attractions).
- **Natural Flow**: Letter-by-letter typing effect (5 chars/50ms), auto-scrolling after sending and during typing, and a clean UI (resizable 740x350px chatbox, dynamic input scaling) ensure a helpful, engaging experience.

### Enhanced Prompt Engineering

- **Chain-of-Thought Prompting**: Trip planning uses a 6-step reasoning process (clarifications, destination, preferences, duration, destinations, activities), ensuring structured responses (see `conversationManager.ts` system prompt).
- **Concise Responses**: Prompts enforce 50-100 word answers unless detailed plans are requested, with Markdown for clarity (e.g., **bold**, lists).
- **Hallucination Avoidance**: Validates attractions against Geoapify data, retries invalid responses (e.g., “Munich Great Wall”), and purges them from history (see `prompt_notes.md`).

### Simple Technical Implementation

- **Tech Stack**: TypeScript, Express, and a web UI (`index.html`) with Tailwind CSS for simplicity.
- **LLM Integration**: Uses xAI’s `generateResponse` API for responses, accessed via `xaiApi.ts`.
- **Interface**: Basic web UI with a resizable chatbox, username input (350px, top-right), and dynamic message input, accessible at `http://localhost:3000`. **Note: the username input is just for demonstrating context management for maintaining history while allowing multiple users/sessions.** In production the userId/session will be extracted automatically.

### Data Augmentation

- **External APIs**:
  - **OpenWeatherMap**: Weather data for packing/attractions (e.g., “15°C, cloudy” for Berlin).
  - **Rest Countries**: Country info for trip planning (e.g., “Currency: Euro” for Germany).
  - **Geoapify**: City-specific attractions to prevent hallucinations (e.g., “BMW Welt” for Munich).
- **Prompt Blending**: Prompts integrate API data (e.g., weather for packing) while falling back to verified knowledge if data is unavailable.
- **Decision Method**: Intent detection (keywords like “plan”, “attractions”) triggers API calls only when relevant (e.g., Geoapify for attractions queries).

## Evaluation Focus

- **Conversation Quality**: Natural, helpful responses with formatted output (lists, bold text) and context-aware follow-ups, tested in `transcripts.txt`.
- **Prompt Design**: Creative chain-of-thought prompts, concise response rules, and hallucination recovery (detailed in `prompt_notes.md`).
- **Edge Cases & Limitations**:
  - Handles vague queries (e.g., “Plan a trip” → “Please specify a destination”).
  - Rejects fictional places (e.g., “Narnia” → “Try Paris”).
  - Recovers from hallucinations by validating and retrying.
- **External Data Blending**: Seamlessly combines API data (e.g., Geoapify attractions) with LLM knowledge, prioritizing external data for accuracy.

## Hallucination Avoidance and Testing

### Avoidance Mechanisms
Hallucinations are prevented using:
- **Prompt Engineering**: System prompt (`conversationManager.ts`) avoids fabrication, cross-checks with Geoapify, and validates attractions ("Valid"/"Invalid").
- **Geoapify Data**: Fetches real attractions (`server.ts`) to ensure accuracy (e.g., "BMW Welt" for Munich).
- **Validation and Retry**: Checks responses against Geoapify; if invalid (e.g., "Munich Great Wall"), validates as "Invalid," purges from Redis, and retries for valid attractions.
- **Clean History**: Excludes validation queries from Redis using `isValidation` flag.
- **Edge Cases**: Rejects fictional places (e.g., "Narnia") and suggests alternatives (e.g., "Try Paris").

### Testing Process
Testing ensured reliability:
- **Debug Hallucination**: Forced "Munich Great Wall" for "attractions in munich" to test detection.
- **Validation**: Logs confirmed Geoapify mismatch, triggering "Invalid."
- **Retry**: Retry gave valid attractions (e.g., "BMW Welt"), with hallucination purged from Redis.
- **Manual Tests**: Tested cities (Paris, Rome), fictional places ("Narnia"), and follow-ups for accuracy.
- **UI and Logs**: Screenshot showed valid response post-retry, with logs detailing the process. The highlighted code in the screenshot is **commented out** during regular tests/production.
![Recovery from (forced) hallucination](public/screenshots/hallucination.PNG)

## Installation

### Prerequisites

1. **Node.js** (v18 or later):

   ```bash
   curl -fsSL https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1
   node -v
   npm -v
   ```

   Or download from nodejs.org.

2. **Redis Cloud**:

   - Sign up at redis.com for a free account.
   - Get your Redis URL (e.g., `redis://default:password@host:port`).

3. **API Keys**:

   - **OpenWeatherMap**: Register at openweathermap.org, get API key.
   - **Geoapify**: Sign up at geoapify.com, get API key.
   - **xAI**: Contact x.ai/api for API key.

### Setup

1. **Clone or Download**:

   ```bash
   git clone <repository-url>
   cd travel-assistant
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

   Installs `express`, `ioredis`, `dotenv`, `typescript`, etc. (see `package.json`).

3. **Create** `.env`:

   ```bash
   REDIS_URL= example: redis://default:your_password@redis-1234.redislabs.com:15730
   XAI_API_KEY=your_xai_api_key
   WEATHER_API_KEY=your_openweathermap_api_key
   GEOAPIFY_API_KEY=your_geoapify_api_key
   
   ```

Replace placeholders with your credentials.

5. **Compile and run the server**:

   ```bash
   npx tsc
   node dist/server.js
   ```

6. **Verify**:

   - Open `http://localhost:3000`.
   - Enter username “Alice” and query “Attractions in Rome”.
   - Check logs for Redis connection and API responses.

## Submission Materials

- **Source Code**:
  - `index.html`: Web UI with chatbox, typing effect, auto-scrolling.
  - `server.ts`: Express server with intent detection and API integration.
  - `conversationManager.ts`: Manages Redis history and hallucination avoidance.
  - `xaiApi.ts`, `weatherApi.ts`, `restCountriesApi.ts`, `geoapifyApi.ts`: API integrations.
  - `.env.example`, `package.json`, `tsconfig.json`: Configuration files.
- **Sample Transcripts** (`transcripts.txt`):
  - Showcases a few conversations examples.
- **Prompt Engineering Notes** (`prompt_notes.md`):
  - Details chain-of-thought prompting, hallucination avoidance, and error handling decisions.

## Usage

1. Open `http://localhost:3000` in Chrome or Firefox.
2. Enter a username (e.g., “Alice”).
3. Type queries like:
   - “Plan a trip to Germany”
   - “Attractions in Munich”
   - “What to pack for Berlin in winter”
4. Test follow-ups (e.g., “More about Munich”) and edge cases (e.g., “Travel to Narnia”).

## 