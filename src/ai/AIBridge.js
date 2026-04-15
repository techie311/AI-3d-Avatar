/**
 * AIBridge — Communicates with llama.cpp server via HTTP
 *
 * Uses the OpenAI-compatible /v1/chat/completions endpoint
 * that llama-server provides by default.
 */

export class AIBridge {
  constructor(serverUrl = 'http://localhost:8080') {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.conversationHistory = [];
    this.systemPrompt = '';
    this.connected = false;
    this.maxHistoryLength = 20; // Keep last N messages

    // Callbacks
    this.onConnectionChange = null;
  }

  /**
   * Set the system prompt that instructs the AI how to respond
   * @param {string} prompt
   */
  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }

  /**
   * Test connection to the server
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const wasConnected = this.connected;
      this.connected = response.ok;
      if (this.connected !== wasConnected && this.onConnectionChange) {
        this.onConnectionChange(this.connected);
      }
      return this.connected;
    } catch {
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected && this.onConnectionChange) {
        this.onConnectionChange(false);
      }
      return false;
    }
  }

  /**
   * Send a message to the AI and get a response
   * @param {string} userMessage — the user's message
   * @param {string} additionalContext — extra system-level context (mood, situation, etc.)
   * @returns {Promise<string>} — raw AI response text
   */
  async sendMessage(userMessage, additionalContext = '') {
    // Build messages array
    const messages = [];

    // System prompt
    let systemContent = this.systemPrompt;
    if (additionalContext) {
      systemContent += '\n\n' + additionalContext;
    }
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }

    // Conversation history
    for (const msg of this.conversationHistory) {
      messages.push(msg);
    }

    // Current user message
    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch(`${this.serverUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
          temperature: 0.8,
          max_tokens: 512,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || '';

      // Add to history
      this.conversationHistory.push({ role: 'user', content: userMessage });
      this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

      // Trim history if too long
      while (this.conversationHistory.length > this.maxHistoryLength * 2) {
        this.conversationHistory.shift();
        this.conversationHistory.shift();
      }

      this.connected = true;
      if (this.onConnectionChange) this.onConnectionChange(true);

      return assistantMessage;
    } catch (error) {
      console.error('[AIBridge] Error:', error.message);
      this.connected = false;
      if (this.onConnectionChange) this.onConnectionChange(false);
      throw error;
    }
  }

  /**
   * Send a system-level prompt (for auto-talk, no user message in history)
   * @param {string} prompt — the situation/mood prompt
   * @returns {Promise<string>}
   */
  async sendSystemPrompt(prompt) {
    const messages = [];
    
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }

    // Include recent history for context
    const recentHistory = this.conversationHistory.slice(-6);
    for (const msg of recentHistory) {
      messages.push(msg);
    }

    // The auto-talk prompt as a system instruction
    messages.push({ role: 'system', content: prompt });
    messages.push({ role: 'user', content: '[AUTO_TALK_TRIGGER]' });

    try {
      const response = await fetch(`${this.serverUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          temperature: 0.9,
          max_tokens: 256,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('[AIBridge] Auto-talk error:', error.message);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }
}
