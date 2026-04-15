/**
 * ResponseOrchestrator — Coordinates expressions, animations, and speech
 *
 * When a parsed command arrives, this orchestrator:
 * 1. Sets the facial expression
 * 2. Triggers the body animation (FBX or procedural)
 * 3. Speaks the text with lip-sync
 */

import { FBX_ANIMATIONS, PROCEDURAL_ANIMATIONS, resolveAnimationKey } from './CommandParser.js';
import { ANIMATIONS_MANIFEST } from '../animationsManifest.js';

// Build key→file lookup once
const FBX_KEY_TO_FILE = {};
for (const entry of ANIMATIONS_MANIFEST) {
  FBX_KEY_TO_FILE[entry.key] = entry;
}

// "Talking" FBX keys — use these instead of procedural 'talking' state when speaking
const TALKING_FBX = ['talking', 'talking_2', 'talking_3'];

export class ResponseOrchestrator {
  /**
   * @param {import('../avatar/ExpressionController').ExpressionController} expressionCtrl
   * @param {import('../avatar/AnimationController').AnimationController} animationCtrl
   * @param {import('../voice/SpeechEngine').SpeechEngine} speechEngine
   * @param {import('../voice/LipSyncController').LipSyncController} lipSyncCtrl
   * @param {import('../avatar/FBXAnimationLoader').FBXAnimationLoader} [fbxLoader]
   */
  constructor(expressionCtrl, animationCtrl, speechEngine, lipSyncCtrl, fbxLoader = null) {
    this.expression = expressionCtrl;
    this.animation = animationCtrl;
    this.fbx = fbxLoader;
    this.speech = speechEngine;
    this.lipSync = lipSyncCtrl;

    this.isBusy = false;
    this.currentCommand = null;

    // Wire up SpeechEngine events to LipSync
    this.speech.onStart = (text) => {
      // If not in audio mode, use character-based lip sync
      if (!this.lipSync.audioMode) {
        this.lipSync.startSync(text);
      }
      // Only switch to procedural 'talking' if no FBX is active
      if (!this.fbx?.isPlaying) {
        const state = this.animation.getState();
        if (state !== 'excited' && state !== 'waving') {
          this.animation.setState('talking');
        }
      }
    };

    // When edge-tts provides audio, use amplitude-based lip sync
    this.speech.onAudioData = (analyserNode) => {
      this.lipSync.startAudioSync(analyserNode);
    };

    this.speech.onWord = (word, charIndex) => {
      this.lipSync.onWordBoundary(word);
    };

    this.speech.onEnd = () => {
      this.lipSync.stopSync();
      // FBX non-looping clips will self-stop; stop looping FBX talking clips
      if (this.fbx?.isPlaying) {
        const key = this.fbx.getCurrentKey();
        if (key && TALKING_FBX.includes(key)) {
          this.fbx.stop();
        }
      }
      // Return to idle
      const emotion = this.expression.getEmotionInfo().emotion;
      if (emotion === 'sad' || emotion === 'worried') {
        this.animation.setState('sad_idle');
      } else {
        this.animation.setState('idle');
      }
    };
  }

  /**
   * Execute a parsed command (from CommandParser)
   * @param {Object} command — { text, emotion, animation, intensity }
   * @returns {Promise<void>}
   */
  async executeCommand(command) {
    if (!command) return;

    this.isBusy = true;
    this.currentCommand = command;

    console.log('[Orchestrator] Executing:', command);

    // 1. Set expression (immediate, with transition)
    if (command.emotion) {
      this.expression.setEmotion(command.emotion, command.intensity || 0.8);
    }

    // 2. Set animation — route FBX vs procedural
    let animKey = command.animation;
    if (animKey) {
      // Resolve aliases (e.g. 'waving_gesture' → 'waving', 'walk_1' → 'walking_1')
      animKey = resolveAnimationKey(animKey);

      if (this.fbx && FBX_ANIMATIONS.has(animKey) && FBX_KEY_TO_FILE[animKey]) {
        const entry = FBX_KEY_TO_FILE[animKey];
        await this.fbx.playUrl(`/fbx/${encodeURIComponent(entry.file)}`, {
          loop: entry.loop,
          key: entry.key,
          fadeIn: 0.3,
          fadeOut: 0.3,
        });
      } else if (PROCEDURAL_ANIMATIONS.has(animKey) && animKey !== 'talking') {
        this.animation.setState(animKey);
      }
      // 'talking' FBX or procedural is handled by speech.onStart callback
    }

    // 3. Speak the text (triggers lip-sync and talking animation via callbacks)
    if (command.text && command.text !== '...') {
      try {
        await this.speech.speak(command.text);
      } catch (err) {
        console.warn('[Orchestrator] Speech error:', err);
      }
    }

    this.isBusy = false;
    this.currentCommand = null;
  }

  /**
   * Interrupt the current action
   */
  interrupt() {
    this.speech.stop();
    this.lipSync.stopSync();
    this.isBusy = false;
    this.currentCommand = null;
  }
}
