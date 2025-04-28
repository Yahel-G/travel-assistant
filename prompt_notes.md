# Prompt Engineering Notes

## System Prompt Design Decisions

The system prompt for the Travel Assistant was crafted to ensure natural, accurate, and user-focused conversations, aligning with the assignment's focus on conversation quality, prompt engineering, and error handling. Below are the key strategies emphasized in the prompt design:

### 1. Chain-of-Thought for Trip Planning
A 6-step chain-of-thought process (Rule 3) guides the LLM through trip planning: checking for clarifications, identifying destinations/preferences, suggesting duration, selecting destinations, recommending activities, and summarizing with a follow-up question. This ensures structured, actionable itineraries (e.g., "For a 7-day Italy trip: 1) Plan 7 days..."), enhancing response relevance and conversation quality.

### 2. Hallucination Avoidance with External Data
Rule 6 prevents hallucinations by instructing the LLM to cross-check with Geoapify data for attractions and avoid fabricating facts. Validation queries (Rule 2.4, Rule 6.5) return only "Valid"/"Invalid" to detect errors (e.g., "Taj Mahal in Munich" → "Invalid"). This leverages external data for accuracy while providing a safety net for error detection, addressing LLM limitations effectively.

### 3. Concise, Formatted Responses
Rule 1 enforces concise responses (50-100 words) unless detailed plans are requested, using Markdown for clarity (e.g., numbered lists, **bold**, *italics*). Examples (e.g., "For Berlin in winter: warm coat, scarf, waterproof boots") ensure professional, readable outputs, prioritizing a friendly and engaging user experience.

### 4. Context Management
Rule 4 embeds conversation history (`parsedHistory`) and instructs the LLM to maintain context for follow-ups without repetition. This enables seamless interactions (e.g., "More about Munich" after "Attractions in Munich") while keeping responses concise, ensuring a natural conversational flow across queries.

### 5. External Data Integration
Rule 5 integrates Geoapify, OpenWeatherMap, and Rest Countries data (`externalData`), with instructions to prioritize it (e.g., "Prioritize Geoapify data for attractions"). Fallback to verified knowledge is seamless, ensuring accurate responses (e.g., weather for packing, attractions from Geoapify) without mentioning fallbacks to the user, blending external data naturally.

### 6. Error Handling and Edge Cases
Rule 6 handles vague queries ("Plan a trip" → "Where to?"), unknown destinations ("Try Paris?"), and confused responses ("Did you mean **Berlin, Germany**?"). Rule 7 addresses edge cases like fictional destinations ("Narnia" → "That destination seems fictional.") and sensitive queries, ensuring the assistant remains helpful in all scenarios.

### 7. Recovery Mechanisms
Rule 8 ensures graceful recovery from errors (e.g., "Ensure valid attractions") by providing accurate responses without mentioning corrections. Rule 6.3 allows the LLM to admit uncertainty (e.g., "I’m not sure about that attraction. Try **Marienplatz** instead."), maintaining user trust and conversation quality even after mistakes.