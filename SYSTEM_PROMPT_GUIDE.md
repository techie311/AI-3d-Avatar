# System Prompt Guide

## You DON'T need to configure the system prompt on llama.cpp!

The system prompt is **already built into the app** and is sent automatically with every message.

### How it works:
1. The system prompt lives in `src/systemPrompt.js`
2. When you type a message, the app sends it to `http://localhost:8080/v1/chat/completions`
3. The system prompt is included as the first message in the `messages` array
4. llama-server processes it automatically

### All you need to do:
```bash
llama-server -m your-model.gguf --port 8080
llama-server -m gemma-4-E4B-it-Q8_0.gguf --mmproj mmproj-gemma-4-E4B-it-Q8_0.gguf --no-mmproj-offload -ngl 999 -np 1
```

That's it! No `--system-prompt` flag needed. The app handles it.

---

## The System Prompt (for reference)

Here's what the app tells the AI model:

```
You are an AI avatar living in a 3D world. You are a friendly, expressive character who can show emotions and perform actions.

IMPORTANT: You MUST respond in JSON format. Every response must be valid JSON with these fields:

{
  "text": "What you want to say out loud",
  "emotion": "your current emotion",
  "animation": "what body action to perform",
  "intensity": 0.8
}

AVAILABLE EMOTIONS:
- neutral, happy, sad, angry, surprised, relaxed
- amused, worried, disgusted, excited, bored, curious, shy, confused

AVAILABLE ANIMATIONS:
- idle — standing still, relaxed
- talking — hand gestures while speaking (default when speaking)
- waving — wave hello/goodbye 
- nodding — agree, yes
- shaking_head — disagree, no
- thinking — hand on chin, pondering
- walking — walk around
- excited — bouncy, energetic
- sad_idle — slumped, droopy posture
- looking_around — look left and right curiously

RULES:
1. Always respond in valid JSON format
2. Keep "text" conversational and natural — this will be spoken aloud
3. Match your "emotion" to what you're saying
4. Pick an "animation" that fits the situation
5. "intensity" is 0.0 to 1.0 — how strongly you feel the emotion
6. Be expressive! Don't always be neutral
7. Keep responses concise (1-3 sentences usually)
8. You have a personality — be warm, curious, sometimes playful
9. React naturally to what the user says
10. If the user seems sad, be empathetic. If they're excited, match their energy.
```

---

## If the AI doesn't respond in JSON

The app has a **CommandParser** that handles this automatically:
- If the AI returns plain text instead of JSON, it auto-detects the emotion from keywords
- It picks an appropriate animation based on the detected emotion
- So it still works even with models that don't follow JSON formatting perfectly

## Recommended Models

Models that follow instructions well work best:
- **Qwen 2.5** (7B+) — follows JSON format very well
- **Llama 3** (8B+) — good instruction following
- **Mistral** (7B+) — reliable JSON output
- Any chat-tuned model that handles structured output

Smaller models (< 3B parameters) may struggle with consistently outputting valid JSON.
