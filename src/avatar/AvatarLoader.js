/**
 * AvatarLoader — Loads VRM models into the Three.js scene
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class AvatarLoader {
  constructor(scene) {
    this.scene = scene;
    this.vrm = null;
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /**
   * Load a VRM model from URL or File
   * @param {string|File} source — URL string or File object
   * @returns {Promise<import('@pixiv/three-vrm').VRM>}
   */
  async load(source) {
    // Remove existing model
    if (this.vrm) {
      this.dispose();
    }

    let url = source;
    let objectUrl = null;

    // If source is a File, create an object URL
    if (source instanceof File) {
      objectUrl = URL.createObjectURL(source);
      url = objectUrl;
    }

    try {
      const gltf = await this.loader.loadAsync(url);
      const vrm = gltf.userData.vrm;

      if (!vrm) {
        throw new Error('File is not a valid VRM model');
      }

      // Optimize the model
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (e) { /* non-critical */ }
      try { VRMUtils.removeUnnecessaryJoints(gltf.scene); } catch (e) { /* non-critical */ }

      // Rotate model to face camera (VRM 0.x models face +Z)
      try { VRMUtils.rotateVRM0(vrm); } catch (e) { console.log('[AvatarLoader] rotateVRM0 skipped (VRM 1.0 model)'); }

      // Add to scene
      this.scene.add(vrm.scene);
      this.vrm = vrm;

      // Set initial look-at target to camera position
      if (vrm.lookAt) {
        vrm.lookAt.target = null; // Will be set by ProceduralAnimations
      }

      console.log('[AvatarLoader] VRM loaded successfully');
      console.log('[AvatarLoader] Available expressions:', this.getAvailableExpressions());

      return vrm;
    } finally {
      // Clean up object URL
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  /**
   * Get list of available expressions on the loaded model
   */
  getAvailableExpressions() {
    if (!this.vrm?.expressionManager) return [];
    const manager = this.vrm.expressionManager;
    // Try multiple ways to get expression names (API varies by version)
    try {
      // VRM 1.0 API: _expressionMap is a plain object, not a Map
      if (manager._expressionMap) {
        const map = manager._expressionMap;
        if (typeof map.keys === 'function') {
          return Array.from(map.keys()); // Map
        } else {
          return Object.keys(map); // plain object
        }
      }
      if (manager.expressions) {
        return manager.expressions.map(e => e.expressionName || e.name).filter(Boolean);
      }
    } catch (e) {
      console.warn('[AvatarLoader] Could not enumerate expressions:', e);
    }
    // Fallback: return the standard VRM presets
    return ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral',
            'aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'blinkLeft', 'blinkRight'];
  }

  /**
   * Remove the current model from the scene and clean up
   */
  dispose() {
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
  }
}
