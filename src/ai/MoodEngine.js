/**
 * MoodEngine — Internal emotional state that evolves over time
 * 
 * Mood is a vector of 5 dimensions that drift based on:
 * - Time passing (boredom rises, energy falls)
 * - User interactions (happiness, curiosity spike)
 * - AI responses (mood aligns with expressed emotions)
 */

export class MoodEngine {
  constructor() {
    // Mood dimensions: 0.0 to 1.0
    this.mood = {
      happy:     0.5,
      bored:     0.0,
      curious:   0.3,
      energetic: 0.5,
      sleepy:    0.0,
    };

    // Drift rates per second (how fast moods change passively)
    this.driftRates = {
      happy:     -0.003,  // Happiness slowly decays
      bored:      0.008,  // Boredom rises over time
      curious:   -0.002,  // Curiosity decays
      energetic: -0.004,  // Energy drops
      sleepy:     0.005,  // Sleepiness rises
    };

    this.timeSinceInteraction = 0;
    this.totalInteractions = 0;
  }

  /**
   * Update mood over time — call every frame
   * @param {number} delta — seconds since last frame
   */
  update(delta) {
    this.timeSinceInteraction += delta;

    // Apply drift
    for (const [key, rate] of Object.entries(this.driftRates)) {
      this.mood[key] = this._clamp(this.mood[key] + rate * delta);
    }

    // Boredom accelerates without interaction
    if (this.timeSinceInteraction > 60) {
      this.mood.bored = this._clamp(this.mood.bored + 0.01 * delta);
    }

    // Sleepiness kicks in after long periods
    if (this.timeSinceInteraction > 180) {
      this.mood.sleepy = this._clamp(this.mood.sleepy + 0.008 * delta);
    }
  }

  /**
   * Called when user interacts (sends a message, clicks avatar, etc.)
   * @param {string} type — 'message', 'click', 'return'
   */
  onInteraction(type) {
    this.timeSinceInteraction = 0;
    this.totalInteractions++;

    switch (type) {
      case 'message':
        this.mood.happy = this._clamp(this.mood.happy + 0.15);
        this.mood.bored = this._clamp(this.mood.bored - 0.3);
        this.mood.curious = this._clamp(this.mood.curious + 0.1);
        this.mood.energetic = this._clamp(this.mood.energetic + 0.1);
        this.mood.sleepy = this._clamp(this.mood.sleepy - 0.2);
        break;
      case 'click':
        this.mood.curious = this._clamp(this.mood.curious + 0.2);
        this.mood.happy = this._clamp(this.mood.happy + 0.05);
        this.mood.bored = this._clamp(this.mood.bored - 0.1);
        break;
      case 'return':
        this.mood.happy = this._clamp(this.mood.happy + 0.2);
        this.mood.bored = this._clamp(this.mood.bored - 0.4);
        this.mood.sleepy = this._clamp(this.mood.sleepy - 0.3);
        this.mood.energetic = this._clamp(this.mood.energetic + 0.15);
        break;
    }
  }

  /**
   * Update mood based on AI's expressed emotion
   * @param {string} emotion — the emotion the AI expressed
   */
  onEmotionExpressed(emotion) {
    const adjustments = {
      happy:     { happy: 0.1, bored: -0.1, energetic: 0.05 },
      sad:       { happy: -0.1, energetic: -0.05 },
      excited:   { happy: 0.15, energetic: 0.2, bored: -0.2 },
      curious:   { curious: 0.15, bored: -0.1 },
      bored:     { bored: 0.1, energetic: -0.05 },
      angry:     { happy: -0.05, energetic: 0.1 },
    };

    const adj = adjustments[emotion];
    if (adj) {
      for (const [key, value] of Object.entries(adj)) {
        if (this.mood[key] !== undefined) {
          this.mood[key] = this._clamp(this.mood[key] + value);
        }
      }
    }
  }

  /**
   * Get the current mood vector
   */
  getMood() {
    return { ...this.mood };
  }

  /**
   * Get the dominant mood as a string
   */
  getDominantMood() {
    let maxKey = 'happy';
    let maxVal = -1;
    for (const [key, value] of Object.entries(this.mood)) {
      if (value > maxVal) {
        maxVal = value;
        maxKey = key;
      }
    }
    return maxKey;
  }

  /**
   * Get mood as a text description (for AI context)
   */
  getMoodDescription() {
    const dominant = this.getDominantMood();
    const m = this.mood;
    const parts = [];

    if (m.happy > 0.6) parts.push('feeling happy');
    else if (m.happy < 0.3) parts.push('not very cheerful');

    if (m.bored > 0.6) parts.push('getting bored');
    if (m.curious > 0.5) parts.push('feeling curious');
    if (m.energetic > 0.6) parts.push('feeling energetic');
    else if (m.energetic < 0.3) parts.push('feeling low energy');
    if (m.sleepy > 0.5) parts.push('feeling sleepy');

    if (parts.length === 0) parts.push('feeling neutral');

    return `You are currently ${parts.join(', ')}. Your dominant mood is ${dominant}.`;
  }

  /**
   * Get emoji for current mood
   */
  getMoodEmoji() {
    const dominant = this.getDominantMood();
    const emojis = {
      happy: '😊',
      bored: '😐',
      curious: '🤔',
      energetic: '⚡',
      sleepy: '😴',
    };
    return emojis[dominant] || '😐';
  }

  _clamp(value) {
    return Math.max(0, Math.min(1, value));
  }
}
