/**
 * ExpressionController — Manages facial expressions with smooth transitions
 * 
 * Supports: happy, sad, angry, surprised, relaxed, neutral
 * Plus direct blend shape control for lip-sync visemes
 */

// Map of high-level emotions to VRM expression presets with weights
const EMOTION_MAP = {
  neutral:   { neutral: 1.0 },
  happy:     { happy: 1.0 },
  sad:       { sad: 1.0 },
  angry:     { angry: 1.0 },
  surprised: { surprised: 1.0 },
  relaxed:   { relaxed: 1.0 },
  // Composite emotions (blend multiple)
  amused:    { happy: 0.6, surprised: 0.3 },
  worried:   { sad: 0.5, surprised: 0.3 },
  disgusted: { angry: 0.6, sad: 0.2 },
  excited:   { happy: 0.8, surprised: 0.5 },
  bored:     { sad: 0.3, neutral: 0.5 },
  curious:   { surprised: 0.4, happy: 0.2 },
  shy:       { sad: 0.2, happy: 0.3 },
  confused:  { surprised: 0.5, sad: 0.2 },
};

// Viseme presets (mouth shapes for lip-sync)
const VISEME_PRESETS = ['aa', 'ih', 'ou', 'ee', 'oh'];

export class ExpressionController {
  constructor(vrm) {
    this.vrm = vrm;
    this.manager = vrm.expressionManager;

    // Current and target expression weights
    this.currentWeights = {};
    this.targetWeights = {};
    this.transitionSpeed = 3.0; // How fast expressions transition (higher = faster)

    // Viseme weights (separate from emotions, for lip sync)
    this.currentVisemes = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this.targetVisemes = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this.visemeSpeed = 12.0; // Visemes need to be fast

    // Initialize all emotion weights to 0
    for (const preset of ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral']) {
      this.currentWeights[preset] = 0;
      this.targetWeights[preset] = 0;
    }

    // Current emotion name for display
    this.currentEmotion = 'neutral';
    this.emotionIntensity = 0;
  }

  /**
   * Set an emotion with optional intensity and transition speed
   * @param {string} emotion — 'happy', 'sad', 'angry', 'surprised', 'relaxed', 'neutral', etc.
   * @param {number} intensity — 0.0 to 1.0 (default 1.0)
   * @param {number} speed — transition speed (default uses global)
   */
  setEmotion(emotion, intensity = 1.0, speed = null) {
    const emotionKey = emotion.toLowerCase();
    const mapping = EMOTION_MAP[emotionKey];

    if (!mapping) {
      console.warn(`[ExpressionController] Unknown emotion: ${emotion}, using neutral`);
      this.setEmotion('neutral', 1.0, speed);
      return;
    }

    if (speed !== null) {
      this.transitionSpeed = speed;
    }

    // Reset all targets to 0
    for (const key of Object.keys(this.targetWeights)) {
      this.targetWeights[key] = 0;
    }

    // Set new targets based on emotion mapping, scaled by intensity
    for (const [preset, weight] of Object.entries(mapping)) {
      this.targetWeights[preset] = weight * Math.max(0, Math.min(1, intensity));
    }

    this.currentEmotion = emotionKey;
    this.emotionIntensity = intensity;
  }

  /**
   * Set a specific viseme value (used by LipSyncController)
   * @param {string} viseme — 'aa', 'ih', 'ou', 'ee', 'oh'
   * @param {number} value — 0.0 to 1.0
   */
  setViseme(viseme, value) {
    if (VISEME_PRESETS.includes(viseme)) {
      this.targetVisemes[viseme] = Math.max(0, Math.min(1, value));
    }
  }

  /**
   * Set all visemes at once (for lip sync)
   * @param {Object} visemes — { aa, ih, ou, ee, oh }
   */
  setVisemes(visemes) {
    for (const [key, value] of Object.entries(visemes)) {
      this.setViseme(key, value);
    }
  }

  /**
   * Reset all visemes to 0 (close mouth)
   */
  clearVisemes() {
    for (const key of VISEME_PRESETS) {
      this.targetVisemes[key] = 0;
    }
  }

  /**
   * Directly set a raw blend shape value (bypass emotion system)
   * @param {string} name — VRM expression name
   * @param {number} value — 0.0 to 1.0
   */
  setRawExpression(name, value) {
    if (this.manager) {
      this.manager.setValue(name, value);
    }
  }

  /**
   * Get current emotion info
   */
  getEmotionInfo() {
    return {
      emotion: this.currentEmotion,
      intensity: this.emotionIntensity,
    };
  }

  /**
   * Get list of supported emotions
   */
  static getSupportedEmotions() {
    return Object.keys(EMOTION_MAP);
  }

  /**
   * Update — call every frame
   * @param {number} delta — time since last frame in seconds
   */
  update(delta) {
    if (!this.manager) return;

    // Lerp emotion weights toward targets
    for (const [key, target] of Object.entries(this.targetWeights)) {
      const current = this.currentWeights[key] || 0;
      const speed = this.transitionSpeed * delta;
      this.currentWeights[key] = current + (target - current) * Math.min(1, speed);
      
      // Apply to VRM
      this.manager.setValue(key, this.currentWeights[key]);
    }

    // Lerp visemes toward targets (faster)
    for (const key of VISEME_PRESETS) {
      const current = this.currentVisemes[key] || 0;
      const target = this.targetVisemes[key] || 0;
      const speed = this.visemeSpeed * delta;
      this.currentVisemes[key] = current + (target - current) * Math.min(1, speed);
      
      // Apply to VRM
      this.manager.setValue(key, this.currentVisemes[key]);
    }
  }
}
