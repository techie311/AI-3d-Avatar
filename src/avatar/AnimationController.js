/**
 * AnimationController — Procedural body animation state machine
 * 
 * KEY DESIGN: 
 * - Bones are NEVER reset to T-pose. A natural standing pose is the base.
 * - All transitions use smooth lerp (no snapping).
 * - Internal offset state is tracked and smoothly interpolated.
 * 
 * VRM BONE ROTATION NOTES (learned from testing):
 * - leftUpperArm.z NEGATIVE = arm goes DOWN, POSITIVE = arm goes UP
 * - rightUpperArm.z POSITIVE = arm goes DOWN, NEGATIVE = arm goes UP
 * - spine.x POSITIVE = lean forward, NEGATIVE = lean back
 * - head.x POSITIVE = look down, NEGATIVE = look up
 * - head.y POSITIVE = look left, NEGATIVE = look right
 * 
 * States: idle, talking, waving, nodding, shaking_head, thinking, walking, excited, sad_idle, looking_around
 */

// Natural standing pose offsets from T-pose rest rotation.
// Arms hang down at sides naturally.
const NATURAL_POSE = {
  hips:           { x: 0, y: 0, z: 0 },
  spine:          { x: 0, y: 0, z: 0 },
  chest:          { x: 0, y: 0, z: 0 },
  upperChest:     { x: 0, y: 0, z: 0 },
  neck:           { x: 0, y: 0, z: 0 },
  head:           { x: 0, y: 0, z: 0 },
  leftShoulder:   { x: 0, y: 0, z: 0 },
  leftUpperArm:   { x: 0, y: 0, z: -0.9 },   // arm DOWN at side
  leftLowerArm:   { x: 0, y: 0, z: 0 },
  leftHand:       { x: 0, y: 0, z: 0 },
  rightShoulder:  { x: 0, y: 0, z: 0 },
  rightUpperArm:  { x: 0, y: 0, z: 0.9 },    // arm DOWN at side
  rightLowerArm:  { x: 0, y: 0, z: 0 },
  rightHand:      { x: 0, y: 0, z: 0 },
  leftUpperLeg:   { x: 0, y: 0, z: 0 },
  leftLowerLeg:   { x: 0, y: 0, z: 0 },
  leftFoot:       { x: 0, y: 0, z: 0 },
  rightUpperLeg:  { x: 0, y: 0, z: 0 },
  rightLowerLeg:  { x: 0, y: 0, z: 0 },
  rightFoot:      { x: 0, y: 0, z: 0 },
};

const ALL_BONES = Object.keys(NATURAL_POSE);

function cloneOffsets(src) {
  const out = {};
  for (const key of ALL_BONES) {
    const s = src[key] || { x: 0, y: 0, z: 0 };
    out[key] = { x: s.x, y: s.y, z: s.z };
  }
  return out;
}

export class AnimationController {
  constructor(vrm) {
    this.vrm = vrm;
    this.humanoid = vrm.humanoid;

    // State
    this.currentState = 'idle';
    this.previousState = 'idle';
    this.stateTime = 0;

    // Internal current offsets (smoothly interpolated each frame)
    this._currentOffsets = cloneOffsets(NATURAL_POSE);

    // Bone cache
    this._bones = {};
    this._boneRestRotations = {};
    this._cacheBones();

    // State-specific phase trackers
    this._walkPhase = 0;
    this._wavePhase = 0;
    this._talkGesturePhase = 0;

    // Position (for walking)
    this.position = { x: 0, z: 0 };
    this.facing = 0;

    // Idle variant tracking
    this._idleVariantTimer = 0;
    this._idleVariant = 0;

    // Available states
    this.availableStates = [
      'idle', 'talking', 'waving', 'nodding', 'shaking_head',
      'thinking', 'walking', 'excited', 'sad_idle', 'looking_around'
    ];

    // Set true by FBXAnimationLoader while an FBX clip is playing
    // so procedural bones don't fight the mixer
    this.disabled = false;
  }

  _cacheBones() {
    if (!this.humanoid) return;
    for (const name of ALL_BONES) {
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

  /**
   * Transition to a new animation state
   */
  setState(state, options = {}) {
    if (!this.availableStates.includes(state)) {
      console.warn(`[AnimationController] Unknown state: ${state}`);
      return;
    }
    if (state === this.currentState) return;

    this.previousState = this.currentState;
    this.currentState = state;
    this.stateTime = 0;

    if (state === 'walking' && options.direction !== undefined) {
      this.facing = options.direction;
    }
  }

  getState() {
    return this.currentState;
  }

  /** Force-set state even if already in that state (used by manual buttons) */
  forceState(state) {
    if (!this.availableStates.includes(state)) return;
    this.previousState = this.currentState;
    this.currentState = state;
    this.stateTime = 0;
    this._talkGesturePhase = 0;
    this._wavePhase = 0;
    this._walkPhase = 0;
  }

  /**
   * Update — call every frame. Uses lerp for smooth transitions.
   */
  update(delta) {
    if (!this.humanoid) return;
    if (this.disabled) return; // FBX mixer is active — don't fight it

    this.stateTime += delta;

    // 1. Calculate target offsets for current animation state
    const targetOffsets = cloneOffsets(NATURAL_POSE);
    this._applyStateToTarget(this.currentState, delta, targetOffsets);

    // 2. Smoothly lerp internal offsets toward target
    //    Using frame-rate independent exponential smoothing
    const factor = 1 - Math.pow(0.02, delta);
    for (const boneName of ALL_BONES) {
      const cur = this._currentOffsets[boneName];
      const tgt = targetOffsets[boneName];
      cur.x += (tgt.x - cur.x) * factor;
      cur.y += (tgt.y - cur.y) * factor;
      cur.z += (tgt.z - cur.z) * factor;
    }

    // 3. Apply offsets to bones (absolute set = rest + smoothed offset)
    for (const boneName of ALL_BONES) {
      const bone = this._bones[boneName];
      if (!bone) continue;
      const rest = this._boneRestRotations[boneName];
      if (!rest) continue;
      const offset = this._currentOffsets[boneName];
      bone.rotation.x = rest.x + offset.x;
      bone.rotation.y = rest.y + offset.y;
      bone.rotation.z = rest.z + offset.z;
    }
  }

  // =========================================================
  // STATE TARGET CALCULATIONS
  // =========================================================

  _applyStateToTarget(state, delta, target) {
    const t = this.stateTime;

    switch (state) {
      case 'idle':        this._targetIdle(t, delta, target); break;
      case 'talking':     this._targetTalking(t, delta, target); break;
      case 'waving':      this._targetWaving(t, delta, target); break;
      case 'nodding':     this._targetNodding(t, target); break;
      case 'shaking_head': this._targetShakingHead(t, target); break;
      case 'thinking':    this._targetThinking(t, target); break;
      case 'walking':     this._targetWalking(t, delta, target); break;
      case 'excited':     this._targetExcited(t, target); break;
      case 'sad_idle':    this._targetSadIdle(t, target); break;
      case 'looking_around': this._targetLookingAround(t, target); break;
    }
  }

  // ----- IDLE -----
  // Natural standing: subtle body sway, weight shifts, occasional variants
  _targetIdle(t, delta, target) {
    // === Constant subtle body sway (always present) ===
    target.spine.x += Math.sin(t * 0.47) * 0.008;
    target.spine.y += Math.sin(t * 0.31) * 0.01;
    target.chest.x += Math.sin(t * 0.47 + 0.5) * 0.004;
    target.chest.y += Math.sin(t * 0.31 + 0.3) * 0.005;

    // === Hip sway (slow weight transfer) ===
    target.hips.y += Math.sin(t * 0.19) * 0.01;
    target.hips.z += Math.sin(t * 0.15) * 0.006;

    // === Arms swing gently like hanging pendulums ===
    target.leftUpperArm.x += Math.sin(t * 0.37) * 0.025;
    target.leftUpperArm.z += Math.sin(t * 0.29) * -0.015; // Note: negative = toward body
    target.rightUpperArm.x += Math.sin(t * 0.37 + 0.8) * 0.025;
    target.rightUpperArm.z += Math.sin(t * 0.29 + 0.5) * 0.015;

    // === Head gentle movement ===
    target.head.x += Math.sin(t * 0.41) * 0.008;
    target.head.y += Math.sin(t * 0.29 + 1) * 0.012;
    target.neck.x += Math.sin(t * 0.41) * 0.003;
    target.neck.y += Math.sin(t * 0.29 + 1) * 0.005;

    // === Periodic idle variants (every 8-12 seconds) ===
    this._idleVariantTimer += delta;
    if (this._idleVariantTimer > 8 + (this._idleVariant * 2)) {
      this._idleVariantTimer = 0;
      this._idleVariant = (this._idleVariant + 1) % 5;
    }

    // Smooth blend for current variant using slow modulation
    const varWeight = Math.sin(this._idleVariantTimer * 0.4) * 0.5 + 0.5;

    switch (this._idleVariant) {
      case 0: // Weight shift to left leg
        target.hips.z += varWeight * 0.012;
        target.spine.z += varWeight * -0.006;
        target.leftUpperLeg.x += varWeight * 0.015;
        break;
      case 1: // Subtle head look left then right
        target.head.y += varWeight * Math.sin(t * 0.4) * 0.04;
        target.neck.y += varWeight * Math.sin(t * 0.4) * 0.015;
        break;
      case 2: // Weight shift to right leg
        target.hips.z += varWeight * -0.012;
        target.spine.z += varWeight * 0.006;
        target.rightUpperLeg.x += varWeight * 0.015;
        break;
      case 3: // Small shoulder roll / stretch
        target.leftShoulder.z += varWeight * Math.sin(t * 0.6) * 0.01;
        target.rightShoulder.z += varWeight * Math.sin(t * 0.6 + 1) * -0.01;
        target.spine.x += varWeight * -0.008; // Very slight lean back
        break;
      case 4: // Relax more on one side
        target.hips.y += varWeight * 0.008;
        target.spine.y += varWeight * 0.005;
        target.head.z += varWeight * 0.005;
        break;
    }
  }

  // ----- TALKING -----
  // Human-like speech gestures using FORWARD swing (X rotation) not sideways (Z).
  // KEY: rightUpperArm.x negative = arm swings FORWARD toward viewer.
  //      rightUpperArm.z stays close to +0.9 (natural hang) so arm doesn't T-pose spread.
  _targetTalking(t, delta, target) {
    this._talkGesturePhase += delta;
    const gp = this._talkGesturePhase;

    const PHASE_LEN = 2.5;
    const phaseIndex = Math.floor(gp / PHASE_LEN) % 5;

    // Micro-oscillations layered on every gesture (hand trembles, weight shifts)
    const w1 = Math.sin(gp * 2.3);
    const w2 = Math.cos(gp * 1.7);
    const w3 = Math.sin(gp * 3.1);

    // ── Spine + head always active ──
    target.spine.x = 0.025 + w1 * 0.009;
    target.spine.y = w2 * 0.007;
    target.head.x  = Math.sin(gp * 2.8) * 0.02;
    target.head.y  = Math.sin(gp * 1.9) * 0.016;
    target.head.z  = w3 * 0.007;
    target.neck.x  = target.head.x * 0.3;
    target.neck.y  = target.head.y * 0.3;

    switch (phaseIndex) {

      case 0: {
        // ── EXPLAIN: right arm swings forward + elbow bent — palm-up explanation ──
        // x negative = arm swings toward viewer; z stays near natural to avoid T-spread
        target.rightUpperArm.x = -0.35 + w1 * 0.05;  // forward swing
        target.rightUpperArm.z =  0.75 + w2 * 0.04;  // only slightly raised from hang
        target.rightLowerArm.x = -0.50 + w3 * 0.06;  // forearm raised (elbow bent)
        target.rightHand.x     = -0.20 + w1 * 0.05;  // wrist slightly curled
        target.rightHand.z     =  w2   * 0.06;

        // Left arm mostly natural, slight sympathetic sway
        target.leftUpperArm.x  =  w2  * 0.04;
        target.leftUpperArm.z  = -0.85 + w1 * 0.03;
        target.leftLowerArm.x  = -0.08;
        break;
      }

      case 1: {
        // ── EMPHASIZE: arm raises higher forward, forearm extended, making a point ──
        target.rightUpperArm.x = -0.50 + w1 * 0.04;  // more forward, higher
        target.rightUpperArm.z =  0.70 + w2 * 0.05;
        target.rightLowerArm.x = -0.65 + w3 * 0.05;  // tight elbow bend
        target.rightHand.x     = -0.25 + w1 * 0.04;
        target.rightHand.z     =  w1   * 0.08;

        // Left arm hangs but tracks slightly
        target.leftUpperArm.x  =  w3  * 0.03;
        target.leftUpperArm.z  = -0.82 + w2 * 0.03;
        target.leftLowerArm.x  = -0.06 + w1 * 0.03;

        target.spine.x = 0.04 + w1 * 0.01;  // lean forward while making a point
        break;
      }

      case 2: {
        // ── BOTH HANDS: bilateral forward gesture — talking with both hands ──
        target.rightUpperArm.x = -0.30 + w1 * 0.05;
        target.rightUpperArm.z =  0.72 + w2 * 0.04;
        target.rightLowerArm.x = -0.45 + w3 * 0.05;
        target.rightHand.x     = -0.18 + w1 * 0.04;

        // Left arm also forward this time
        target.leftUpperArm.x  = -0.25 + w2 * 0.05;
        target.leftUpperArm.z  = -0.72 + w1 * 0.04;
        target.leftLowerArm.x  = -0.40 + w3 * 0.05;
        target.leftHand.x      = -0.18 + w2 * 0.04;

        target.spine.x = 0.02;
        break;
      }

      case 3: {
        // ── RELAXED: right arm naturally gestures, left stays down, casual talk ──
        target.rightUpperArm.x = -0.20 + w1 * 0.06;
        target.rightUpperArm.z =  0.78 + w2 * 0.05;
        target.rightLowerArm.x = -0.38 + w3 * 0.06;
        target.rightHand.z     =  w2   * 0.08;
        target.rightHand.x     = -0.12 + w1 * 0.04;

        // Left arm swings complementary
        target.leftUpperArm.x  = -0.08 + w2 * 0.04;
        target.leftUpperArm.z  = -0.82 + w3 * 0.04;
        target.leftLowerArm.x  = -0.12 + w1 * 0.04;
        target.leftHand.z      =  w1   * 0.05;
        break;
      }

      case 4: {
        // ── EXPRESSIVE SWEEP: most animated, arm swings forward then back ──
        const sweep = Math.sin(gp * 2.5); // slower sweep
        target.rightUpperArm.x = -0.30 + sweep * 0.18;  // pendulum forward/back
        target.rightUpperArm.z =  0.68 + w2 * 0.08;
        target.rightLowerArm.x = -0.45 + Math.abs(sweep) * 0.15;
        target.rightHand.x     = -0.18 + sweep * 0.08;
        target.rightHand.z     =  sweep * 0.10;

        // Left follows opposite phase
        target.leftUpperArm.x  = -0.12 - sweep * 0.08;
        target.leftUpperArm.z  = -0.75 + w1 * 0.07;
        target.leftLowerArm.x  = -0.20 + w3 * 0.05;

        target.spine.x = 0.03 + w1 * 0.012;
        target.spine.y = w2 * 0.01;
        break;
      }
    }
  }

  // ----- WAVING -----
  // Right arm raised high, hand waving
  _targetWaving(t, delta, target) {
    this._wavePhase += delta;
    const wave = Math.sin(this._wavePhase * 8);

    // Right arm raised: z goes from +0.9 (down) toward negative (up)
    target.rightUpperArm.x = -0.2;
    target.rightUpperArm.z = -0.4;            // arm UP above horizontal
    target.rightLowerArm.x = -0.6;            // elbow bent
    target.rightLowerArm.z = wave * 0.2;      // wave motion at wrist
    target.rightHand.x = wave * 0.15;
    target.rightHand.z = wave * 0.1;

    // Left arm stays natural
    // (already set by NATURAL_POSE base)

    // Slight body tilt
    target.spine.z += -0.01;
    target.spine.x += 0.008;

    // Happy head tilt
    target.head.z += 0.03;
    target.head.x += Math.sin(t * 2) * 0.008;

    // Auto-return to idle after 3 seconds
    if (this.stateTime > 3) {
      this.setState('idle');
    }
  }

  // ----- NODDING -----
  _targetNodding(t, target) {
    const decay = Math.max(0, 1 - t * 0.4);
    const nod = Math.sin(t * 5) * decay;

    target.head.x += nod * 0.1;
    target.neck.x += nod * 0.03;
    target.spine.x += nod * 0.008;

    if (this.stateTime > 2.5) {
      this.setState('idle');
    }
  }

  // ----- SHAKING HEAD -----
  _targetShakingHead(t, target) {
    const decay = Math.max(0, 1 - t * 0.35);
    const shake = Math.sin(t * 6) * decay;

    target.head.y += shake * 0.15;
    target.head.z += shake * 0.02;
    target.neck.y += shake * 0.05;

    if (this.stateTime > 2.5) {
      this.setState('idle');
    }
  }

  // ----- THINKING -----
  // Right hand near chin, head tilted
  _targetThinking(t, target) {
    // Right arm: raised to chin
    target.rightUpperArm.x = -0.3;
    target.rightUpperArm.z = -0.1;            // raised up from down
    target.rightLowerArm.x = -1.0;            // tight elbow bend
    target.rightLowerArm.z = 0;
    target.rightHand.x = 0.15;

    // Left arm stays mostly natural
    target.leftUpperArm.z = -0.8;

    // Head tilted, looking up slightly
    target.head.x = -0.03;
    target.head.y = 0.06;
    target.head.z = 0.03;
    target.neck.x = -0.02;

    // Subtle sway while thinking
    target.spine.x += 0.01 + Math.sin(t * 0.5) * 0.004;
    target.spine.y += Math.sin(t * 0.3) * 0.005;
  }

  // ----- WALKING -----
  _targetWalking(t, delta, target) {
    this._walkPhase += delta * 4;
    const wp = this._walkPhase;

    // Leg alternation
    target.leftUpperLeg.x = Math.sin(wp) * 0.25;
    target.rightUpperLeg.x = Math.sin(wp + Math.PI) * 0.25;
    target.leftLowerLeg.x = Math.max(0, -Math.sin(wp)) * 0.4 + 0.08;
    target.rightLowerLeg.x = Math.max(0, -Math.sin(wp + Math.PI)) * 0.4 + 0.08;

    // Arm swing (opposite to legs)
    target.leftUpperArm.x = Math.sin(wp + Math.PI) * 0.2;
    target.rightUpperArm.x = Math.sin(wp) * 0.2;

    // Body bob and twist
    target.hips.y = Math.sin(wp * 2) * 0.015;
    target.spine.z = Math.sin(wp) * 0.02;
    target.spine.x = 0.02;

    // Move scene position
    const speed = 0.5 * delta;
    this.position.x += Math.sin(this.facing) * speed;
    this.position.z += Math.cos(this.facing) * speed;
    if (this.vrm.scene) {
      this.vrm.scene.position.x = this.position.x;
      this.vrm.scene.position.z = this.position.z;
      this.vrm.scene.rotation.y = this.facing;
    }
  }

  // ----- EXCITED -----
  // Bouncy, arms raised, energetic
  _targetExcited(t, target) {
    const bounce = Math.abs(Math.sin(t * 6)) * 0.03;
    if (this.vrm.scene) {
      this.vrm.scene.position.y = bounce;
    }

    // Arms raised (z values move toward 0/past it = arms up)
    target.leftUpperArm.z = -0.3 + Math.sin(t * 6) * 0.1;     // arm UP
    target.rightUpperArm.z = 0.3 + Math.sin(t * 6 + 1) * 0.1; // arm UP
    target.leftLowerArm.x = -0.4 + Math.sin(t * 8) * 0.1;
    target.rightLowerArm.x = -0.4 + Math.sin(t * 8 + 1) * 0.1;

    // Head bobbing
    target.head.x = Math.sin(t * 6) * 0.04;
    target.head.z = Math.sin(t * 3) * 0.02;

    target.spine.x = 0.008 + Math.sin(t * 6) * 0.01;

    if (this.stateTime > 3.5) {
      this.setState('idle');
      if (this.vrm.scene) this.vrm.scene.position.y = 0;
    }
  }

  // ----- SAD IDLE -----
  // Slumped posture, head down
  _targetSadIdle(t, target) {
    target.spine.x = 0.06;
    target.chest.x = 0.02;

    target.neck.x = 0.08;
    target.head.x = 0.08 + Math.sin(t * 0.3) * 0.008;
    target.head.z = Math.sin(t * 0.2) * 0.01;

    // Arms hang more limply (slightly further down)
    target.leftUpperArm.x = 0.1;
    target.leftUpperArm.z = -1.0;
    target.rightUpperArm.x = 0.1;
    target.rightUpperArm.z = 1.0;

    // Drooped shoulders
    target.leftShoulder.z = -0.04;
    target.rightShoulder.z = 0.04;

    target.hips.y = Math.sin(t * 0.15) * 0.003;
  }

  // ----- LOOKING AROUND -----
  _targetLookingAround(t, target) {
    const lookY = Math.sin(t * 0.8) * 0.15;
    const lookX = Math.sin(t * 0.5 + 1.5) * 0.06;

    target.head.y = lookY;
    target.head.x = lookX;
    target.head.z = lookY * 0.06;

    target.neck.y = lookY * 0.3;
    target.neck.x = lookX * 0.25;

    target.spine.y = lookY * 0.1;
    target.hips.y = lookY * 0.04;

    if (this.stateTime > 5) {
      this.setState('idle');
    }
  }
}
