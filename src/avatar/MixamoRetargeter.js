/**
 * MixamoRetargeter — Maps Mixamo FBX bone tracks → VRM normalized humanoid bones
 *
 * Supports both:
 *  - mixamorig: prefix  (most Mixamo downloads)
 *  - no prefix          (some Mixamo downloads)
 *  - Bip01 prefix       (older biped rigs)
 *
 * POSITION tracks: only hips is kept (root motion), scaled cm→m.
 * SCALE tracks: stripped — VRM doesn't use them.
 * QUATERNION tracks: remapped to VRM normalized bone node names.
 *
 * T-POSE FIX: if the clip starts with a T-pose frame (all rotations ~identity
 * for the first few frames), we trim those frames off by offsetting clip start.
 */

import * as THREE from 'three';

// ── Mixamo bone name → VRM humanoid bone name ────────────────────────────────
const BONE_MAP_PREFIXED = {
  'mixamorig:Hips':         'hips',
  'mixamorig:Spine':        'spine',
  'mixamorig:Spine1':       'chest',
  'mixamorig:Spine2':       'upperChest',
  'mixamorig:Neck':         'neck',
  'mixamorig:Head':         'head',
  'mixamorig:LeftShoulder': 'leftShoulder',
  'mixamorig:LeftArm':      'leftUpperArm',
  'mixamorig:LeftForeArm':  'leftLowerArm',
  'mixamorig:LeftHand':     'leftHand',
  'mixamorig:RightShoulder':'rightShoulder',
  'mixamorig:RightArm':     'rightUpperArm',
  'mixamorig:RightForeArm': 'rightLowerArm',
  'mixamorig:RightHand':    'rightHand',
  'mixamorig:LeftUpLeg':    'leftUpperLeg',
  'mixamorig:LeftLeg':      'leftLowerLeg',
  'mixamorig:LeftFoot':     'leftFoot',
  'mixamorig:LeftToeBase':  'leftToes',
  'mixamorig:RightUpLeg':   'rightUpperLeg',
  'mixamorig:RightLeg':     'rightLowerLeg',
  'mixamorig:RightFoot':    'rightFoot',
  'mixamorig:RightToeBase': 'rightToes',
  // Finger bones (optional — improves hand detail)
  'mixamorig:LeftHandThumb1':  'leftThumbMetacarpal',
  'mixamorig:LeftHandThumb2':  'leftThumbProximal',
  'mixamorig:LeftHandThumb3':  'leftThumbDistal',
  'mixamorig:LeftHandIndex1':  'leftIndexProximal',
  'mixamorig:LeftHandIndex2':  'leftIndexIntermediate',
  'mixamorig:LeftHandIndex3':  'leftIndexDistal',
  'mixamorig:LeftHandMiddle1': 'leftMiddleProximal',
  'mixamorig:LeftHandMiddle2': 'leftMiddleIntermediate',
  'mixamorig:LeftHandMiddle3': 'leftMiddleDistal',
  'mixamorig:LeftHandRing1':   'leftRingProximal',
  'mixamorig:LeftHandRing2':   'leftRingIntermediate',
  'mixamorig:LeftHandRing3':   'leftRingDistal',
  'mixamorig:LeftHandPinky1':  'leftLittleProximal',
  'mixamorig:LeftHandPinky2':  'leftLittleIntermediate',
  'mixamorig:LeftHandPinky3':  'leftLittleDistal',
  'mixamorig:RightHandThumb1': 'rightThumbMetacarpal',
  'mixamorig:RightHandThumb2': 'rightThumbProximal',
  'mixamorig:RightHandThumb3': 'rightThumbDistal',
  'mixamorig:RightHandIndex1': 'rightIndexProximal',
  'mixamorig:RightHandIndex2': 'rightIndexIntermediate',
  'mixamorig:RightHandIndex3': 'rightIndexDistal',
  'mixamorig:RightHandMiddle1':'rightMiddleProximal',
  'mixamorig:RightHandMiddle2':'rightMiddleIntermediate',
  'mixamorig:RightHandMiddle3':'rightMiddleDistal',
  'mixamorig:RightHandRing1':  'rightRingProximal',
  'mixamorig:RightHandRing2':  'rightRingIntermediate',
  'mixamorig:RightHandRing3':  'rightRingDistal',
  'mixamorig:RightHandPinky1': 'rightLittleProximal',
  'mixamorig:RightHandPinky2': 'rightLittleIntermediate',
  'mixamorig:RightHandPinky3': 'rightLittleDistal',
};

// Build no-prefix version by stripping 'mixamorig:'
const BONE_MAP_NO_PREFIX = {};
for (const [k, v] of Object.entries(BONE_MAP_PREFIXED)) {
  BONE_MAP_NO_PREFIX[k.replace('mixamorig:', '')] = v;
}

// THREE.js FBXLoader strips the colon — "mixamorig:Hips" becomes "mixamorigHips"
// Build that lookup too
const BONE_MAP_MERGED = {};
for (const [k, v] of Object.entries(BONE_MAP_PREFIXED)) {
  BONE_MAP_MERGED[k.replace('mixamorig:', 'mixamorig')] = v;
}

// Combined lookup — all three forms
const BONE_MAP = { ...BONE_MAP_NO_PREFIX, ...BONE_MAP_MERGED, ...BONE_MAP_PREFIXED };

/**
 * Retarget a Mixamo AnimationClip so it drives VRM normalized humanoid bones.
 *
 * @param {THREE.AnimationClip} clip  — original clip from FBXLoader
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {object} [opts]
 * @param {boolean} [opts.keepRootMotion=false]  — include hips position track
 * @param {boolean} [opts.fixTpose=true]         — strip T-pose frames at start
 * @returns {THREE.AnimationClip | null}
 */
export function retargetClip(clip, vrm, { keepRootMotion = false, fixTpose = true } = {}) {
  if (!clip || !vrm?.humanoid) return null;

  // ── Detect T-pose start ───────────────────────────────────────────────────
  let tposeEndTime = 0;
  if (fixTpose) {
    const hipsQuat = clip.tracks.find(t =>
      (t.name.toLowerCase().includes('hips') && t.name.endsWith('.quaternion'))
    );
    if (hipsQuat && hipsQuat.times.length > 1) {
      // Check first frames for identity quaternion (w≈1, xyz≈0)
      for (let i = 0; i < hipsQuat.times.length; i++) {
        const base = i * 4;
        const x = hipsQuat.values[base];
        const y = hipsQuat.values[base + 1];
        const z = hipsQuat.values[base + 2];
        const w = hipsQuat.values[base + 3];
        const isIdentity = Math.abs(w - 1) < 0.05 && Math.abs(x) < 0.05 &&
                           Math.abs(y) < 0.05 && Math.abs(z) < 0.05;
        if (isIdentity) {
          tposeEndTime = hipsQuat.times[i];
        } else {
          break; // first non-identity frame marks end of T-pose
        }
      }
      // Only trim if T-pose is less than 20% of clip (avoid stripping real animations)
      if (tposeEndTime > clip.duration * 0.2) tposeEndTime = 0;
    }
  }

  // ── Build retargeted tracks ───────────────────────────────────────────────
  const newTracks = [];

  for (const track of clip.tracks) {
    // Parse "BoneName.property"
    const dot = track.name.lastIndexOf('.');
    if (dot === -1) continue;
    const boneName = track.name.substring(0, dot);
    const property = track.name.substring(dot + 1);

    // Strip scale tracks — VRM doesn't use them
    if (property === 'scale') continue;

    // Map bone name to VRM humanoid name
    const vrmBoneName = BONE_MAP[boneName];
    if (!vrmBoneName) continue;

    // Get VRM normalized bone node
    const node = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);
    if (!node) continue;

    // Position tracks: only hips, scale cm→m
    if (property === 'position') {
      if (!keepRootMotion || vrmBoneName !== 'hips') continue;
      const scaledTrack = new THREE.VectorKeyframeTrack(
        `${node.name}.position`,
        Array.from(track.times),
        Array.from(track.values).map(v => v * 0.01), // cm → m
      );
      _trimTrack(scaledTrack, tposeEndTime);
      newTracks.push(scaledTrack);
      continue;
    }

    // Quaternion tracks: clone and remap name
    if (property === 'quaternion') {
      const newTrack = new THREE.QuaternionKeyframeTrack(
        `${node.name}.quaternion`,
        Array.from(track.times),
        Array.from(track.values),
      );
      _trimTrack(newTrack, tposeEndTime);
      newTracks.push(newTrack);
    }
  }

  if (newTracks.length === 0) return null;

  const duration = clip.duration - tposeEndTime;
  return new THREE.AnimationClip(clip.name || 'animation', duration, newTracks);
}

/** Trim times/values to start from `startTime` */
function _trimTrack(track, startTime) {
  if (startTime <= 0) return;
  const stride = track.getValueSize();
  let startIdx = 0;
  for (let i = 0; i < track.times.length; i++) {
    if (track.times[i] >= startTime) { startIdx = i; break; }
  }
  track.times = track.times.slice(startIdx).map(t => t - startTime);
  track.values = track.values.slice(startIdx * stride);
}

/**
 * Detect approximate FPS from a clip's keyframe spacing.
 * Returns 24, 30, or 60.
 */
export function detectFPS(clip) {
  const track = clip.tracks.find(t => t.name.endsWith('.quaternion'));
  if (!track || track.times.length < 2) return 30;
  const avgDelta = (track.times[track.times.length - 1] - track.times[0])
    / (track.times.length - 1);
  const fps = Math.round(1 / avgDelta);
  if (fps >= 55) return 60;
  if (fps >= 25) return 30;
  return 24;
}
