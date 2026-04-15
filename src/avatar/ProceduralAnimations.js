/**
 * ProceduralAnimations — Automatic subtle animations that make the avatar feel alive
 * 
 * Includes: auto-blink, breathing, eye saccades, head micro-movements, idle fidgets
 */

export class ProceduralAnimations {
  constructor(vrm) {
    this.vrm = vrm;
    this.expressionManager = vrm.expressionManager;
    this.humanoid = vrm.humanoid;
    this.enabled = true;
    this.time = 0;

    // === Blink State ===
    this.blinkTimer = 0;
    this.nextBlinkTime = this._randomBlinkInterval();
    this.blinkPhase = 'waiting'; // 'waiting', 'closing', 'opening'
    this.blinkProgress = 0;
    this.blinkSpeed = 8.0; // Speed of blink animation

    // === Breathing State ===
    this.breathCycle = 0;
    this.breathRate = 0.25; // Breaths per second (15 per minute)

    // === Eye Saccade State ===
    this.eyeTargetX = 0;
    this.eyeTargetY = 0;
    this.eyeCurrentX = 0;
    this.eyeCurrentY = 0;
    this.eyeSaccadeTimer = 0;
    this.nextSaccadeTime = this._randomSaccadeInterval();

    // === Head Micro-movement State ===
    this.headDriftX = 0;
    this.headDriftY = 0;
    this.headDriftZ = 0;

    // Bone references (cached)
    this._bones = {};
    this._boneRestRotations = {};
    this._cacheBones();
  }

  _cacheBones() {
    if (!this.humanoid) return;
    const boneNames = ['head', 'neck', 'spine', 'chest', 'upperChest',
      'leftEye', 'rightEye', 'leftShoulder', 'rightShoulder'];
    for (const name of boneNames) {
      try {
        const bone = this.humanoid.getNormalizedBoneNode(name);
        this._bones[name] = bone;
        if (bone) {
          this._boneRestRotations[name] = {
            x: bone.rotation.x,
            y: bone.rotation.y,
            z: bone.rotation.z,
          };
        }
      } catch {
        this._bones[name] = null;
      }
    }
  }

  _randomBlinkInterval() {
    // Humans blink every 2-6 seconds on average
    return 2 + Math.random() * 4;
  }

  _randomSaccadeInterval() {
    // Small eye movements every 0.5-2 seconds
    return 0.5 + Math.random() * 1.5;
  }

  /**
   * Update all procedural animations — call every frame
   * @param {number} delta — seconds since last frame
   */
  update(delta) {
    if (!this.enabled) return;
    this.time += delta;

    this._updateBlink(delta);
    this._updateBreathing(delta);
    this._updateEyeSaccades(delta);
    this._updateHeadDrift(delta);
  }

  // ===== AUTO-BLINK =====
  _updateBlink(delta) {
    if (!this.expressionManager) return;

    switch (this.blinkPhase) {
      case 'waiting':
        this.blinkTimer += delta;
        if (this.blinkTimer >= this.nextBlinkTime) {
          this.blinkPhase = 'closing';
          this.blinkProgress = 0;
          // 20% chance of double blink
          this._doubleBlink = Math.random() < 0.2;
        }
        break;

      case 'closing':
        this.blinkProgress += delta * this.blinkSpeed;
        if (this.blinkProgress >= 1) {
          this.blinkProgress = 1;
          this.blinkPhase = 'opening';
        }
        this.expressionManager.setValue('blink', this.blinkProgress);
        break;

      case 'opening':
        this.blinkProgress -= delta * this.blinkSpeed;
        if (this.blinkProgress <= 0) {
          this.blinkProgress = 0;
          this.expressionManager.setValue('blink', 0);
          
          if (this._doubleBlink) {
            // Do a second blink
            this._doubleBlink = false;
            this.blinkPhase = 'closing';
            this.blinkProgress = 0;
          } else {
            this.blinkPhase = 'waiting';
            this.blinkTimer = 0;
            this.nextBlinkTime = this._randomBlinkInterval();
          }
        } else {
          this.expressionManager.setValue('blink', this.blinkProgress);
        }
        break;
    }
  }

  // ===== BREATHING =====
  _updateBreathing(delta) {
    this.breathCycle += delta * this.breathRate * Math.PI * 2;

    const breathAmount = Math.sin(this.breathCycle) * 0.5 + 0.5; // 0 to 1

    // Subtle chest/spine expansion
    const spine = this._bones.spine;
    const chest = this._bones.chest;

    if (spine) {
      spine.rotation.x += breathAmount * 0.008; // Additive: layers on top of animation pose
    }
    if (chest) {
      chest.rotation.x += breathAmount * 0.005;
    }

    // Subtle shoulder rise on inhale
    const leftShoulder = this._bones.leftShoulder;
    const rightShoulder = this._bones.rightShoulder;
    if (leftShoulder) {
      leftShoulder.rotation.z += breathAmount * -0.003;
    }
    if (rightShoulder) {
      rightShoulder.rotation.z += breathAmount * 0.003;
    }
  }

  // ===== EYE SACCADES =====
  _updateEyeSaccades(delta) {
    this.eyeSaccadeTimer += delta;

    // Time for a new saccade target
    if (this.eyeSaccadeTimer >= this.nextSaccadeTime) {
      this.eyeSaccadeTimer = 0;
      this.nextSaccadeTime = this._randomSaccadeInterval();

      // Small random eye movement  
      // 70% chance to look near center, 30% to look further away
      const range = Math.random() < 0.7 ? 0.02 : 0.05;
      this.eyeTargetX = (Math.random() - 0.5) * 2 * range;
      this.eyeTargetY = (Math.random() - 0.5) * 2 * range * 0.6; // Less vertical movement
    }

    // Smooth eye movement toward target
    const eyeSpeed = 10 * delta;
    this.eyeCurrentX += (this.eyeTargetX - this.eyeCurrentX) * Math.min(1, eyeSpeed);
    this.eyeCurrentY += (this.eyeTargetY - this.eyeCurrentY) * Math.min(1, eyeSpeed);

    // Apply to eye bones (ABSOLUTE set, not additive — prevents accumulation)
    const leftEye = this._bones.leftEye;
    const rightEye = this._bones.rightEye;
    const leftEyeRest = this._boneRestRotations.leftEye;
    const rightEyeRest = this._boneRestRotations.rightEye;

    if (leftEye && leftEyeRest) {
      leftEye.rotation.y = leftEyeRest.y + this.eyeCurrentX;
      leftEye.rotation.x = leftEyeRest.x + this.eyeCurrentY;
    }
    if (rightEye && rightEyeRest) {
      rightEye.rotation.y = rightEyeRest.y + this.eyeCurrentX;
      rightEye.rotation.x = rightEyeRest.x + this.eyeCurrentY;
    }
  }

  // ===== HEAD MICRO-DRIFT =====
  _updateHeadDrift(delta) {
    const head = this._bones.head;
    const neck = this._bones.neck;
    if (!head) return;

    // Very slow, subtle head drift using layered sine waves
    const t = this.time;
    this.headDriftX = Math.sin(t * 0.3) * 0.008 + Math.sin(t * 0.7) * 0.004;
    this.headDriftY = Math.sin(t * 0.2 + 1) * 0.006 + Math.sin(t * 0.5) * 0.003;
    this.headDriftZ = Math.sin(t * 0.25 + 2) * 0.003;

    head.rotation.x += this.headDriftX;
    head.rotation.y += this.headDriftY;
    head.rotation.z += this.headDriftZ;

    // Slight neck follow
    if (neck) {
      neck.rotation.x += this.headDriftX * 0.3;
      neck.rotation.y += this.headDriftY * 0.3;
    }
  }

  /**
   * Temporarily disable (e.g., during explicit animations)
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}
