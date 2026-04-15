/**
 * LipSyncController — Maps speech to mouth blend shapes for lip-sync
 * 
 * Uses three approaches (priority order):
 * 1. Audio amplitude analysis (when edge-tts provides actual audio)
 * 2. Character-to-viseme mapping (when word boundaries are available)
 * 3. Oscillation-based fallback (when no boundary events fire)
 */

// Map characters to VRM viseme shapes
const CHAR_TO_VISEME = {
  'a': 'aa', 'à': 'aa', 'á': 'aa',
  'e': 'ee', 'è': 'ee', 'é': 'ee',
  'i': 'ih', 'ì': 'ih', 'í': 'ih',
  'o': 'oh', 'ò': 'oh', 'ó': 'oh',
  'u': 'ou', 'ù': 'ou', 'ú': 'ou',
  
  // Consonants that shape the mouth
  'b': null, 'm': null, 'p': null,        // Lips closed
  'f': 'ih', 'v': 'ih',                   // Teeth on lip
  'l': 'ih', 'n': 'ih', 't': 'ih', 'd': 'ih',
  'r': 'oh',
  'w': 'ou',
  'y': 'ih',
  's': 'ee', 'z': 'ee', 'c': 'ee',
  'k': 'oh', 'g': 'oh',
  'h': 'aa',
  'j': 'ih',
  'x': 'ee',
  'q': 'ou',
};

export class LipSyncController {
  constructor(expressionController) {
    this.exprCtrl = expressionController;
    this.active = false;
    this.time = 0;

    // Audio analysis mode (for edge-tts)
    this.audioMode = false;
    this._analyser = null;
    this._amplitudeData = null;
    this._smoothedAmplitude = 0;

    // Character-based viseme state
    this.visemeQueue = [];
    this.currentVisemeIndex = 0;
    this.visemeTimer = 0;
    this.visemeInterval = 0.08;

    // Current speaking word
    this.currentWord = '';
    this.wordReceived = false;

    // Fallback oscillation state
    this.fallbackMode = false;
    this.speakingStartTime = 0;
    this.noWordEventTimer = 0;
    this.wordEventReceived = false;
  }

  /**
   * Start lip-sync with an audio analyser node (from edge-tts)
   * This gives much better lip sync based on actual audio amplitude.
   */
  startAudioSync(analyserNode) {
    this.active = true;
    this.audioMode = true;
    this.time = 0;
    this._analyser = analyserNode;
    this._amplitudeData = new Uint8Array(analyserNode.frequencyBinCount);
    this._smoothedAmplitude = 0;
  }

  /**
   * Start lip-sync for text (character-based mode)
   * Used when no audio analyser is available.
   */
  startSync(fullText) {
    this.active = true;
    this.audioMode = false;
    this.time = 0;
    this.fullText = fullText;
    this.fallbackMode = false;
    this.wordEventReceived = false;
    this.noWordEventTimer = 0;
    this.speakingStartTime = performance.now();

    this.fullVisemeSequence = this._textToVisemes(fullText);
    this.fullVisemeIndex = 0;
  }

  /**
   * Called when a word boundary event fires from SpeechEngine
   */
  onWordBoundary(word) {
    if (!this.active) return;
    
    this.wordEventReceived = true;
    this.fallbackMode = false;
    this.currentWord = word;

    this.visemeQueue = this._textToVisemes(word);
    this.currentVisemeIndex = 0;
    this.visemeTimer = 0;

    const estimatedWordDuration = Math.max(0.2, word.length * 0.07);
    this.visemeInterval = this.visemeQueue.length > 0
      ? estimatedWordDuration / this.visemeQueue.length
      : 0.08;
  }

  /**
   * Stop lip-sync
   */
  stopSync() {
    this.active = false;
    this.audioMode = false;
    this.visemeQueue = [];
    this.currentWord = '';
    this._analyser = null;
    this._smoothedAmplitude = 0;
    
    // Close mouth smoothly
    this.exprCtrl.clearVisemes();
  }

  /**
   * Update — call every frame
   */
  update(delta) {
    if (!this.active) return;

    this.time += delta;

    // Priority: audio analysis > character mapping > fallback
    if (this.audioMode && this._analyser) {
      this._updateAudioAnalysis(delta);
    } else {
      // Check if we should switch to fallback mode
      if (!this.wordEventReceived) {
        this.noWordEventTimer += delta;
        if (this.noWordEventTimer > 0.5) {
          this.fallbackMode = true;
        }
      }

      if (this.fallbackMode) {
        this._updateFallback(delta);
      } else {
        this._updateVisemeQueue(delta);
      }
    }
  }

  /**
   * Audio amplitude-based lip sync (best quality, used with edge-tts)
   */
  _updateAudioAnalysis(delta) {
    if (!this._analyser || !this._amplitudeData) return;

    // Get time-domain data
    this._analyser.getByteTimeDomainData(this._amplitudeData);

    // Calculate RMS amplitude
    let sum = 0;
    for (let i = 0; i < this._amplitudeData.length; i++) {
      const normalized = (this._amplitudeData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / this._amplitudeData.length);

    // Smooth the amplitude to avoid flickering
    const smoothSpeed = 12 * delta; // Fast enough to follow speech
    this._smoothedAmplitude += (rms - this._smoothedAmplitude) * Math.min(1, smoothSpeed);

    // Map amplitude to mouth shapes
    const amp = Math.min(1, this._smoothedAmplitude * 5); // Scale up for visibility

    if (amp < 0.05) {
      // Mouth closed (silence or very quiet)
      this.exprCtrl.clearVisemes();
    } else {
      // Map different amplitude levels to different mouth shapes
      // Low amplitude = subtle movements (ih, ee)
      // Medium amplitude = moderate opening (oh, ou)
      // High amplitude = wide open (aa)
      const aa = Math.pow(amp, 1.2) * 0.8;        // Wide open, dominant at high amplitude
      const oh = Math.sin(amp * Math.PI) * 0.3;    // Peaks at medium amplitude
      const ee = (1 - amp) * amp * 0.4;             // Low-mid amplitude
      
      // Add temporal variation so the mouth doesn't just open/close
      const variation = Math.sin(this.time * 12) * 0.1 * amp;
      
      this.exprCtrl.setVisemes({
        aa: Math.max(0, aa + variation),
        oh: Math.max(0, oh),
        ih: Math.max(0, ee * 0.5),
        ee: Math.max(0, ee),
        ou: Math.max(0, oh * 0.3),
      });
    }
  }

  /**
   * Character-based viseme playback
   */
  _updateVisemeQueue(delta) {
    if (this.visemeQueue.length === 0) {
      this.exprCtrl.clearVisemes();
      return;
    }

    this.visemeTimer += delta;

    if (this.visemeTimer >= this.visemeInterval) {
      this.visemeTimer -= this.visemeInterval;
      this.currentVisemeIndex++;
    }

    if (this.currentVisemeIndex >= this.visemeQueue.length) {
      this.exprCtrl.clearVisemes();
      this.visemeQueue = [];
      return;
    }

    const currentViseme = this.visemeQueue[this.currentVisemeIndex];
    const blend = this.visemeTimer / this.visemeInterval;

    this._applyViseme(currentViseme, 0.7);

    if (this.currentVisemeIndex + 1 < this.visemeQueue.length) {
      const nextViseme = this.visemeQueue[this.currentVisemeIndex + 1];
      if (nextViseme !== currentViseme) {
        this._applyViseme(nextViseme, 0.7 * blend * 0.3);
      }
    }
  }

  /**
   * Fallback: oscillation-based mouth movement
   */
  _updateFallback(delta) {
    const speed = 8;
    const mouthOpen = (Math.sin(this.time * speed) * 0.5 + 0.5) * 0.6;
    const variation = Math.sin(this.time * speed * 2.3) * 0.15;
    const jawOpen = Math.max(0, mouthOpen + variation);

    this.exprCtrl.setVisemes({
      aa: jawOpen,
      oh: jawOpen * 0.2,
      ih: 0,
      ee: 0,
      ou: 0,
    });
  }

  _applyViseme(viseme, intensity) {
    const visemes = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    if (viseme === null) {
      // Closed mouth
    } else if (visemes.hasOwnProperty(viseme)) {
      visemes[viseme] = intensity;
    }
    this.exprCtrl.setVisemes(visemes);
  }

  _textToVisemes(text) {
    const visemes = [];
    const lower = text.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      const char = lower[i];
      if (char === ' ' || char === ',' || char === '.') {
        visemes.push(null);
        continue;
      }
      const viseme = CHAR_TO_VISEME[char];
      if (viseme !== undefined) {
        visemes.push(viseme);
      }
    }
    return visemes;
  }
}
