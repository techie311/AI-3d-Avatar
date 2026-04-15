/**
 * SpeechEngine — Text-to-Speech with Microsoft Edge Neural Voices
 * 
 * Uses edge-tts server endpoint for high-quality neural voices.
 * Falls back to browser SpeechSynthesis if edge-tts is unavailable.
 * 
 * Provides audio data + word boundaries for accurate lip sync.
 */

export class SpeechEngine {
  constructor() {
    this.isSpeaking = false;
    this.isPaused = false;
    this.queue = [];
    this.processing = false;

    // Backend selection
    this.backend = 'browser'; // 'edge' or 'browser'
    this.edgeAvailable = false;
    this.edgeVoice = 'en-US-AriaNeural'; // Natural, warm female voice

    // Audio elements (reused for edge-tts)
    this._audioElement = new Audio();
    this._audioCtx = null;
    this._analyser = null;
    this._mediaSource = null;

    // Browser TTS fallback
    this.synth = window.speechSynthesis;
    this._selectedVoice = null;

    // Callbacks
    this.onStart = null;        // (text) => {}
    this.onEnd = null;          // () => {}
    this.onWord = null;         // (word, startTime) => {}
    this.onAudioData = null;    // (analyserNode) => {} — for lip sync

    // Check edge-tts availability
    this._checkEdgeTTS();
    this._selectBrowserVoice();
  }

  async _checkEdgeTTS() {
    try {
      const resp = await fetch('/api/tts/check');
      const data = await resp.json();
      if (data.available) {
        this.edgeAvailable = true;
        this.backend = 'edge';
        console.log('[SpeechEngine] Edge TTS available — using neural voice:', this.edgeVoice);
      }
    } catch {
      console.log('[SpeechEngine] Edge TTS not available, using browser TTS');
    }
  }

  _selectBrowserVoice() {
    // Try to find the best available browser voice
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices.length) return;

      // Priority order: neural/natural > online > english > any
      const priorities = [
        v => /natural|neural/i.test(v.name),
        v => /online/i.test(v.name),
        v => /aria|jenny|guy|ana/i.test(v.name),
        v => v.lang.startsWith('en') && !v.localService,
        v => v.lang.startsWith('en'),
      ];

      for (const test of priorities) {
        const match = voices.find(test);
        if (match) {
          this._selectedVoice = match;
          console.log('[SpeechEngine] Selected browser voice:', match.name);
          return;
        }
      }

      // Fallback to any english voice
      this._selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Speak text. Queues if already speaking.
   */
  async speak(text) {
    if (!text || !text.trim()) return;
    
    this.queue.push(text);
    if (!this.processing) {
      this._processQueue();
    }
  }

  async _processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const text = this.queue.shift();
      try {
        if (this.backend === 'edge') {
          await this._speakEdge(text);
        } else {
          await this._speakBrowser(text);
        }
      } catch (err) {
        console.error('[SpeechEngine] Error:', err);
      }
    }
    
    this.processing = false;
  }

  /**
   * Edge TTS — high quality neural voice via server endpoint
   */
  async _speakEdge(text) {
    this.isSpeaking = true;
    if (this.onStart) this.onStart(text);

    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: this.edgeVoice,
        }),
      });

      if (!resp.ok) throw new Error(`TTS failed: ${resp.status}`);

      const data = await resp.json();
      const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Set up audio analysis for lip sync
      this._audioElement.src = audioUrl;

      if (!this._audioCtx) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this._analyser = this._audioCtx.createAnalyser();
        this._analyser.fftSize = 256;
        this._analyser.smoothingTimeConstant = 0.75;
        this._mediaSource = this._audioCtx.createMediaElementSource(this._audioElement);
        this._mediaSource.connect(this._analyser);
        this._analyser.connect(this._audioCtx.destination);
      }

      // Resume audio context if suspended (autoplay policy)
      if (this._audioCtx.state === 'suspended') {
        await this._audioCtx.resume();
      }

      // Notify lip sync controller about the analyser
      if (this.onAudioData) {
        this.onAudioData(this._analyser);
      }

      // Fire word boundary events for lip sync timing
      if (data.wordBoundaries && this.onWord) {
        const startTime = performance.now();
        for (const wb of data.wordBoundaries) {
          const wordTime = wb.offset / 10000; // Convert to ms
          setTimeout(() => {
            if (this.onWord) this.onWord(wb.text, wordTime);
          }, wordTime);
        }
      }

      // Play and wait for completion
      return new Promise((resolve) => {
        this._audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.isSpeaking = false;
          if (this.onEnd) this.onEnd();
          resolve();
        };
        this._audioElement.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          this.isSpeaking = false;
          if (this.onEnd) this.onEnd();
          resolve();
        };
        this._audioElement.play().catch(() => {
          // Autoplay blocked, fall back to browser TTS
          console.warn('[SpeechEngine] Audio playback blocked, falling back to browser TTS');
          URL.revokeObjectURL(audioUrl);
          this.isSpeaking = false;
          this._speakBrowser(text).then(resolve);
        });
      });
    } catch (err) {
      console.error('[SpeechEngine] Edge TTS error, falling back to browser:', err);
      this.isSpeaking = false;
      return this._speakBrowser(text);
    }
  }

  /**
   * Browser SpeechSynthesis fallback
   */
  _speakBrowser(text) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (this._selectedVoice) {
        utterance.voice = this._selectedVoice;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        this.isSpeaking = true;
        if (this.onStart) this.onStart(text);
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        if (this.onEnd) this.onEnd();
        resolve();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        if (this.onEnd) this.onEnd();
        resolve();
      };

      // Word boundaries for lip sync (when available)
      utterance.onboundary = (event) => {
        if (event.name === 'word' && this.onWord) {
          const word = text.substring(event.charIndex, event.charIndex + event.charLength);
          this.onWord(word, event.elapsedTime);
        }
      };

      this.synth.speak(utterance);
    });
  }

  /**
   * Get the audio analyser node (for amplitude-based lip sync)
   */
  getAnalyser() {
    return this._analyser;
  }

  /**
   * Stop speaking immediately
   */
  stop() {
    this.queue = [];
    
    if (this.backend === 'edge') {
      this._audioElement.pause();
      this._audioElement.currentTime = 0;
    }
    
    this.synth.cancel();
    this.isSpeaking = false;
    if (this.onEnd) this.onEnd();
  }

  /**
   * Set voice (for edge-tts)
   */
  setVoice(voiceName) {
    this.edgeVoice = voiceName;
  }

  /**
   * List available edge-tts voices
   */
  async getAvailableVoices() {
    try {
      const resp = await fetch('/api/tts/voices');
      return await resp.json();
    } catch {
      return [];
    }
  }
}
