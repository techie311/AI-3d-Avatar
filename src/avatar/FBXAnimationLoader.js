/**
 * FBXAnimationLoader — Loads Mixamo FBX animations, retargets to VRM, plays via AnimationMixer
 *
 * Usage:
 *   const loader = new FBXAnimationLoader(vrm, animationController);
 *   await loader.play('breathing_idle');   // plays by manifest key
 *   loader.stop();                         // returns to procedural animations
 *   loader.update(delta);                  // call every frame
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { retargetClip, detectFPS } from './MixamoRetargeter.js';

export class FBXAnimationLoader {
  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {import('./AnimationController.js').AnimationController} animCtrl
   */
  constructor(vrm, animCtrl) {
    this.vrm = vrm;
    this.animCtrl = animCtrl;

    this._fbxLoader = new FBXLoader();
    this._mixer = new THREE.AnimationMixer(vrm.scene);
    this._currentAction = null;
    this._clipCache = {};       // url → THREE.AnimationClip (retargeted)
    this._currentKey = null;
    this.isPlaying = false;

    // Callbacks
    this.onAnimationEnd = null; // () => void — called when non-looping anim finishes

    this._mixer.addEventListener('finished', () => {
      this.isPlaying = false;
      this._currentAction = null;
      this._currentKey = null;
      // Re-enable procedural controller
      if (this.animCtrl) this.animCtrl.disabled = false;
      if (this.onAnimationEnd) this.onAnimationEnd();
    });
  }

  /**
   * Play an animation by URL (file path like '/fbx/Waving.fbx')
   * @param {string} url
   * @param {object} [opts]
   * @param {boolean} [opts.loop=true]
   * @param {number}  [opts.fadeIn=0.3]
   * @param {number}  [opts.fadeOut=0.3]  — time to fade out current action
   * @param {number}  [opts.timeScale=1]  — 0.5 = half speed, 2 = double
   * @param {string}  [opts.key]          — manifest key (for UI display)
   */
  async playUrl(url, opts = {}) {
    const { loop = true, fadeIn = 0.3, fadeOut = 0.3, timeScale = 1, key = null } = opts;

    // Load + retarget (cached)
    let clip = this._clipCache[url];
    if (!clip) {
      clip = await this._loadAndRetarget(url);
      if (!clip) {
        console.warn('[FBXAnimationLoader] Could not load or retarget:', url);
        return;
      }
      this._clipCache[url] = clip;
    }

    // Fade out current action
    if (this._currentAction) {
      this._currentAction.fadeOut(fadeOut);
    }

    // Disable procedural AnimationController while FBX plays
    if (this.animCtrl) this.animCtrl.disabled = true;

    // Create and play new action
    const action = this._mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.timeScale = timeScale;
    action.fadeIn(fadeIn);
    action.play();

    this._currentAction = action;
    this._currentKey = key;
    this.isPlaying = true;
  }

  /**
   * Stop current FBX animation — fades out and returns to procedural controller
   * @param {number} [fadeOut=0.4]
   */
  stop(fadeOut = 0.4) {
    if (this._currentAction) {
      this._currentAction.fadeOut(fadeOut);
      setTimeout(() => {
        if (this.animCtrl) this.animCtrl.disabled = false;
        this._currentAction = null;
        this._currentKey = null;
        this.isPlaying = false;
      }, fadeOut * 1000);
    } else {
      if (this.animCtrl) this.animCtrl.disabled = false;
      this.isPlaying = false;
    }
  }

  /** Update the mixer — call every frame */
  update(delta) {
    if (this._mixer) this._mixer.update(delta);
  }

  getCurrentKey() {
    return this._currentKey;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  async _loadAndRetarget(url) {
    return new Promise((resolve) => {
      this._fbxLoader.load(
        url,
        (fbx) => {
          const clip = fbx.animations?.[0];
          if (!clip) {
            console.warn('[FBXAnimationLoader] No animation clip in:', url);
            resolve(null);
            return;
          }

          // Detect FPS — normalize 60fps clips to play at standard speed
          const fps = detectFPS(clip);
          // Three.js handles 60fps clips fine — no time scaling needed

          // Retarget Mixamo → VRM
          const retargeted = retargetClip(clip, this.vrm, { fixTpose: true });
          if (!retargeted) {
            console.warn('[FBXAnimationLoader] Retargeting failed (no matching bones) for:', url);
            resolve(null);
            return;
          }

          console.log(`[FBXAnimationLoader] Loaded: ${url} (${fps}fps, ${retargeted.duration.toFixed(2)}s, ${retargeted.tracks.length} tracks)`);
          resolve(retargeted);
        },
        undefined,
        (err) => {
          console.error('[FBXAnimationLoader] Load error:', err);
          resolve(null);
        }
      );
    });
  }

  /** Preload a list of URLs for instant playback later */
  async preload(urls) {
    await Promise.all(urls.map(u => this._loadAndRetarget(u).then(c => {
      if (c) this._clipCache[u] = c;
    })));
  }

  dispose() {
    this._mixer.stopAllAction();
    this._mixer.uncacheRoot(this.vrm.scene);
    this._clipCache = {};
    this._currentAction = null;
  }
}
