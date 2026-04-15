/**
 * MixamoRetargeter — Official @pixiv/three-vrm world-space retargeting
 *
 * Algorithm (from three-vrm examples/humanoidAnimation):
 *   result = parentWorldRestQuat × keyframeQuat × inv(boneWorldRestQuat)
 *
 * This converts Mixamo bone-local rotations into VRM normalized bone space,
 * properly handling bone axis differences between the two skeletons.
 *
 * Position tracks (hips only) are auto-scaled using the hips height ratio.
 */

import * as THREE from 'three';

// ── Mixamo bone name → VRM humanoid bone name ────────────────────────────────
// THREE.js FBXLoader strips the colon — "mixamorig:Hips" becomes "mixamorigHips"
const mixamoVRMRigMap = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
};

/**
 * Retarget a Mixamo FBX animation to VRM using the official three-vrm method.
 *
 * @param {THREE.AnimationClip} clip — original clip from FBXLoader
 * @param {THREE.Group} fbxAsset — the full FBX scene (needed for rest-pose world quats)
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @returns {THREE.AnimationClip | null}
 */
export function retargetClip(clip, fbxAsset, vrm) {
  if (!clip || !vrm?.humanoid || !fbxAsset) return null;

  const tracks = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();
  const _vec3 = new THREE.Vector3();

  // ── Compute hips height ratio for position scaling ──────────────────────
  const mixamoHips = fbxAsset.getObjectByName('mixamorigHips');
  const motionHipsHeight = mixamoHips ? mixamoHips.position.y : 100;

  let vrmHipsHeight;
  try {
    vrmHipsHeight = vrm.humanoid.normalizedRestPose?.hips?.position?.[1];
  } catch (e) { /* ignore */ }

  if (!vrmHipsHeight) {
    const normalizedHips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (normalizedHips) {
      const vrmHipsY = normalizedHips.getWorldPosition(_vec3).y;
      const vrmRootY = vrm.scene.getWorldPosition(new THREE.Vector3()).y;
      vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
    }
  }

  if (!vrmHipsHeight || vrmHipsHeight === 0) vrmHipsHeight = 1.0;

  const hipsPositionScale = vrmHipsHeight / motionHipsHeight;

  // Detect VRM version for axis handling
  const isVRM0 = vrm.meta?.metaVersion === '0';

  let matched = 0;
  let skipped = 0;

  // ── Process each track ──────────────────────────────────────────────────
  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split('.');
    const mixamoRigName = trackSplitted[0];
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
    const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name;
    const mixamoRigNode = fbxAsset.getObjectByName(mixamoRigName);

    if (vrmNodeName == null || !mixamoRigNode) {
      skipped++;
      return;
    }

    const propertyName = trackSplitted[1];

    // ── Get rest-pose world quaternions ─────────────────────────────────
    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // ════════════════════════════════════════════════════════════════
      //  THE KEY FORMULA (official @pixiv/three-vrm):
      //    result = parentWorldRest × keyframe × inv(boneWorldRest)
      // ════════════════════════════════════════════════════════════════
      const newValues = new Float32Array(track.values.length);

      for (let i = 0; i < track.values.length; i += 4) {
        _quatA.set(
          track.values[i],
          track.values[i + 1],
          track.values[i + 2],
          track.values[i + 3]
        );

        // parentWorldRest × keyframe × inv(boneWorldRest)
        _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);

        newValues[i] = _quatA.x;
        newValues[i + 1] = _quatA.y;
        newValues[i + 2] = _quatA.z;
        newValues[i + 3] = _quatA.w;
      }

      // VRM 0.x needs axis flip, VRM 1.x does not
      const finalValues = isVRM0
        ? Array.from(newValues).map((v, i) => (i % 2 === 0 ? -v : v))
        : Array.from(newValues);

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          track.times,
          finalValues
        )
      );
      matched++;

    } else if (track instanceof THREE.VectorKeyframeTrack) {
      // Hips position — scale from Mixamo space to VRM space
      const value = Array.from(track.values).map((v, i) => {
        return (isVRM0 && i % 3 !== 1 ? -v : v) * hipsPositionScale;
      });

      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          track.times,
          value
        )
      );
      matched++;
    }
  });

  console.log(
    `[MixamoRetargeter] Retarget: ${matched} mapped, ${skipped} skipped ` +
    `(hipsScale=${hipsPositionScale.toFixed(6)}, VRM${isVRM0 ? '0' : '1'})`
  );

  if (tracks.length === 0) return null;
  return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
}

/**
 * Detect approximate FPS from a clip's keyframe spacing.
 * Returns 24, 30, or 60.
 */
export function detectFPS(clip) {
  const track = clip.tracks.find(t => t.name.endsWith('.quaternion'));
  if (!track || track.times.length < 2) return 30;
  const avgDelta =
    (track.times[track.times.length - 1] - track.times[0]) /
    (track.times.length - 1);
  const fps = Math.round(1 / avgDelta);
  if (fps >= 55) return 60;
  if (fps >= 25) return 30;
  return 24;
}
