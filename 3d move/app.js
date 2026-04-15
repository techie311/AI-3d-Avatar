import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// ============================================================
//  Mixamo → VRM Rig Map (official from @pixiv/three-vrm)
// ============================================================
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

const VRM_TO_MIXAMO = {};
for (const [k, v] of Object.entries(mixamoVRMRigMap)) VRM_TO_MIXAMO[v] = k;

// ============================================================
//  Logger
// ============================================================
const logOutput = document.getElementById('log-output');
function log(msg, level = '') {
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="log-time">${time}</span><span class="log-msg ${level}">${msg}</span>`;
  logOutput.appendChild(div);
  logOutput.scrollTop = logOutput.scrollHeight;
  console.log(`[${level || 'log'}] ${msg}`);
}

// ============================================================
//  Loading overlay
// ============================================================
const overlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
function setLoading(text) { loadingText.textContent = text; overlay.classList.remove('hidden'); }
function hideLoading() { overlay.classList.add('hidden'); }

// ============================================================
//  Three.js Scene
// ============================================================
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
const bgCanvas = document.createElement('canvas');
bgCanvas.width = 2; bgCanvas.height = 512;
const bgCtx = bgCanvas.getContext('2d');
const bgGrad = bgCtx.createLinearGradient(0, 0, 0, 512);
bgGrad.addColorStop(0, '#14142a');
bgGrad.addColorStop(0.5, '#0e0e1a');
bgGrad.addColorStop(1, '#0a0a0f');
bgCtx.fillStyle = bgGrad;
bgCtx.fillRect(0, 0, 2, 512);
scene.background = new THREE.CanvasTexture(bgCanvas);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 1.2, 3.5);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.update();

scene.add(new THREE.AmbientLight(0x404060, 0.6));
const kL = new THREE.DirectionalLight(0xffeedd, 1.2); kL.position.set(2, 3, 2); scene.add(kL);
const fL = new THREE.DirectionalLight(0xccddff, 0.5); fL.position.set(-2, 1, -1); scene.add(fL);
const rL = new THREE.DirectionalLight(0x9966ff, 0.4); rL.position.set(0, 2, -3); scene.add(rL);
scene.add(new THREE.GridHelper(10, 20, 0x2a2a40, 0x1a1a28));

// ============================================================
//  State
// ============================================================
let vrm = null;
let vrmAllBones = [];
let fbxAnimations = {};    // filename → { asset, clip }
let skeletonHelper = null;
let showSkeleton = true;
let showWireframe = false;
let mixer = null;
let currentAction = null;
let isAnimating = false;
let currentAnimFile = '';
const clock = new THREE.Clock();

// ============================================================
//  Tuning
// ============================================================
const tuning = {
  hipsScale: 1.0,      // multiplier on auto-computed hips scale
  offsetX: 0, offsetY: 0, offsetZ: 0,
  rotY: 0,
  speed: 1.0,
  boneGroupWeights: {
    spine: 1.0, leftArm: 1.0, rightArm: 1.0,
    leftLeg: 1.0, rightLeg: 1.0, head: 1.0, fingers: 1.0,
  },
};

const BONE_GROUPS = {
  hips: 'spine', spine: 'spine', chest: 'spine', upperChest: 'spine',
  neck: 'head', head: 'head',
  leftShoulder: 'leftArm', leftUpperArm: 'leftArm', leftLowerArm: 'leftArm', leftHand: 'leftArm',
  rightShoulder: 'rightArm', rightUpperArm: 'rightArm', rightLowerArm: 'rightArm', rightHand: 'rightArm',
  leftUpperLeg: 'leftLeg', leftLowerLeg: 'leftLeg', leftFoot: 'leftLeg', leftToes: 'leftLeg',
  rightUpperLeg: 'rightLeg', rightLowerLeg: 'rightLeg', rightFoot: 'rightLeg', rightToes: 'rightLeg',
};
for (const side of ['left', 'right'])
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Little'])
    for (const part of ['Metacarpal', 'Proximal', 'Intermediate', 'Distal'])
      BONE_GROUPS[`${side}${finger}${part}`] = 'fingers';

// ============================================================
//  Resize
// ============================================================
function resize() {
  const p = document.getElementById('viewer-panel');
  renderer.setSize(p.clientWidth, p.clientHeight);
  camera.aspect = p.clientWidth / p.clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ============================================================
//  Load VRM
// ============================================================
async function loadVRM() {
  setLoading('Loading VRM model...');
  log('Loading VRM...', 'info');
  const loader = new GLTFLoader();
  loader.register((p) => new VRMLoaderPlugin(p));

  return new Promise((resolve, reject) => {
    loader.load('./model VRM/3352063661248101394.vrm', (gltf) => {
      vrm = gltf.userData.vrm;
      if (!vrm) { log('No VRM data!', 'error'); reject(new Error('No VRM')); return; }

      vrm.scene.rotation.y = Math.PI;
      scene.add(vrm.scene);

      vrm.scene.traverse(c => { if (c.isBone) vrmAllBones.push(c); });

      skeletonHelper = new THREE.SkeletonHelper(vrm.scene);
      skeletonHelper.material.linewidth = 2;
      skeletonHelper.visible = showSkeleton;
      scene.add(skeletonHelper);

      // Log humanoid bone info
      const boneCount = Object.keys(vrm.humanoid.humanBones).length;
      log(`VRM loaded: ${boneCount} humanoid bones, ${vrmAllBones.length} total`, 'success');

      // Log VRM meta version (affects retargeting axis)
      const metaVer = vrm.meta?.metaVersion || '1';
      log(`VRM meta version: ${metaVer}`, 'info');

      document.getElementById('vrm-bone-count').textContent = `${boneCount} / ${vrmAllBones.length}`;
      populateVRMBoneTree();
      resolve(vrm);
    },
    (p) => { if (p.total) setLoading(`VRM... ${Math.round(p.loaded/p.total*100)}%`); },
    (e) => { log(`VRM error: ${e.message}`, 'error'); reject(e); });
  });
}

// ============================================================
//  Load FBX + Retarget (official three-vrm method)
//
//  From: github.com/pixiv/three-vrm examples/humanoidAnimation
//
//  For each quaternion keyframe:
//    result = parentWorldRestQuat × keyframeQuat × inv(boneWorldRestQuat)
//
//  This converts the Mixamo local rotation into VRM normalized
//  bone space, properly handling bone axis differences.
// ============================================================
async function loadFBX(filename) {
  log(`Loading FBX: ${filename}...`, 'info');
  const loader = new FBXLoader();

  return new Promise((resolve, reject) => {
    loader.load(`./FBX/${filename}`, (asset) => {
      if (!asset.animations?.length) { log(`No animations in ${filename}`, 'warn'); resolve(null); return; }

      // Try to find clip by name, fall back to first clip
      let clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com');
      if (!clip) clip = asset.animations[0];

      // Collect track bone names
      const trackBones = new Set();
      clip.tracks.forEach(t => trackBones.add(t.name.split('.')[0]));

      fbxAnimations[filename] = {
        asset,
        clip,
        trackBones: Array.from(trackBones),
      };

      log(`FBX "${filename}": ${clip.tracks.length} tracks, ${clip.duration.toFixed(2)}s`, 'success');
      resolve(fbxAnimations[filename]);
    }, undefined, (e) => { log(`FBX error: ${e.message}`, 'error'); reject(e); });
  });
}

// ============================================================
//  Official Retarget: Mixamo FBX → VRM
//  Exact algorithm from @pixiv/three-vrm examples
// ============================================================
function retargetMixamoToVRM(fbxData) {
  if (!vrm || !fbxData) return null;

  const asset = fbxData.asset;
  const srcClip = fbxData.clip;
  const tracks = [];

  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();
  const _vec3 = new THREE.Vector3();

  // Compute hips height ratio for position scaling
  const mixamoHips = asset.getObjectByName('mixamorigHips');
  const motionHipsHeight = mixamoHips ? mixamoHips.position.y : 100;

  // Get VRM hips height
  let vrmHipsHeight;
  try {
    // Try the normalizedRestPose approach (newer API)
    vrmHipsHeight = vrm.humanoid.normalizedRestPose?.hips?.position?.[1];
  } catch (e) {}

  if (!vrmHipsHeight) {
    // Fallback: get world position of normalized hips
    const normalizedHips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (normalizedHips) {
      const vrmHipsY = normalizedHips.getWorldPosition(_vec3).y;
      const vrmRootY = vrm.scene.getWorldPosition(new THREE.Vector3()).y;
      vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
    }
  }

  if (!vrmHipsHeight || vrmHipsHeight === 0) vrmHipsHeight = 1.0;

  const baseHipsScale = vrmHipsHeight / motionHipsHeight;
  const hipsPositionScale = baseHipsScale * tuning.hipsScale;

  log(`  Hips scale: VRM=${vrmHipsHeight.toFixed(4)} / FBX=${motionHipsHeight.toFixed(1)} = ${baseHipsScale.toFixed(6)} × ${tuning.hipsScale} = ${hipsPositionScale.toFixed(6)}`, 'info');

  let matched = 0, skipped = 0;

  srcClip.tracks.forEach((track) => {
    const trackSplitted = track.name.split('.');
    const mixamoRigName = trackSplitted[0];
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
    const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name;
    const mixamoRigNode = asset.getObjectByName(mixamoRigName);

    if (vrmNodeName == null || !mixamoRigNode) { skipped++; return; }

    const propertyName = trackSplitted[1];

    // Get bone group weight for fine-tuning
    const group = BONE_GROUPS[vrmBoneName] || 'spine';
    const weight = tuning.boneGroupWeights[group] ?? 1.0;

    // Store rotations of rest-pose (world space)
    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // ===== THE KEY FORMULA (from official three-vrm) =====
      // result = parentWorldRest × keyframe × inv(boneWorldRest)
      //
      // This converts the Mixamo bone-local rotation into
      // the VRM normalized bone's coordinate space
      const newValues = new Float32Array(track.values.length);

      for (let i = 0; i < track.values.length; i += 4) {
        _quatA.set(track.values[i], track.values[i+1], track.values[i+2], track.values[i+3]);

        // parentWorldRest × keyframe × inv(boneWorldRest)
        _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);

        // Apply bone weight (slerp with identity)
        if (weight !== 1.0) {
          const identity = new THREE.Quaternion();
          identity.slerp(_quatA, weight);
          _quatA.copy(identity);
        }

        newValues[i] = _quatA.x;
        newValues[i+1] = _quatA.y;
        newValues[i+2] = _quatA.z;
        newValues[i+3] = _quatA.w;
      }

      // VRM 0.x needs axis flip, VRM 1.x does not
      const isVRM0 = vrm.meta?.metaVersion === '0';
      const finalValues = isVRM0
        ? Array.from(newValues).map((v, i) => (i % 2 === 0 ? -v : v))
        : Array.from(newValues);

      tracks.push(new THREE.QuaternionKeyframeTrack(
        `${vrmNodeName}.${propertyName}`, track.times, finalValues
      ));
      matched++;

    } else if (track instanceof THREE.VectorKeyframeTrack) {
      // Hips position
      const isVRM0 = vrm.meta?.metaVersion === '0';
      const value = Array.from(track.values).map((v, i) => {
        let scaled = (isVRM0 && i % 3 !== 1 ? -v : v) * hipsPositionScale;
        // Apply tuning offsets
        const axis = i % 3;
        if (axis === 0) scaled += tuning.offsetX;
        if (axis === 1) scaled += tuning.offsetY;
        if (axis === 2) scaled += tuning.offsetZ;
        return scaled;
      });

      tracks.push(new THREE.VectorKeyframeTrack(
        `${vrmNodeName}.${propertyName}`, track.times, value
      ));
      matched++;
    }
  });

  log(`  Retarget: ${matched} mapped, ${skipped} skipped`, matched > 0 ? 'success' : 'warn');

  if (tracks.length === 0) return null;
  return new THREE.AnimationClip('vrmAnimation', srcClip.duration, tracks);
}

// ============================================================
//  Play / Stop (uses normalized bones now)
// ============================================================
function playAnimation(filename) {
  if (!fbxAnimations[filename]) return;
  stopAnimation(false);

  const clip = retargetMixamoToVRM(fbxAnimations[filename]);
  if (!clip) { log(`Failed to retarget ${filename}`, 'error'); return; }

  // Find the root that contains normalized bones
  const normalizedRoot = findNormalizedRoot();
  mixer = new THREE.AnimationMixer(normalizedRoot || vrm.scene);

  currentAction = mixer.clipAction(clip);
  currentAction.reset();
  currentAction.setEffectiveWeight(1.0);
  currentAction.setEffectiveTimeScale(tuning.speed);
  currentAction.loop = THREE.LoopRepeat;
  currentAction.play();
  isAnimating = true;
  currentAnimFile = filename;

  log(`▶ ${filename} | ${clip.tracks.length} tracks`, 'success');
}

function findNormalizedRoot() {
  try {
    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (!hips) return null;
    let root = hips;
    while (root.parent) root = root.parent;
    return root;
  } catch (e) { return null; }
}

function stopAnimation(logIt = true) {
  if (currentAction) { currentAction.stop(); currentAction = null; }
  if (mixer) { mixer.stopAllAction(); mixer = null; }
  isAnimating = false;
  currentAnimFile = '';

  // Reset normalized bones to identity (T-pose)
  const humanoid = vrm.humanoid;
  if (humanoid) {
    for (const boneName of Object.keys(mixamoVRMRigMap).map(k => mixamoVRMRigMap[k])) {
      try {
        const node = humanoid.getNormalizedBoneNode(boneName);
        if (node) {
          node.quaternion.identity();
          node.position.set(0, 0, 0);
        }
      } catch (e) {}
    }
    // Restore hips position
    try {
      const hips = humanoid.getNormalizedBoneNode('hips');
      if (hips) hips.position.set(0, 0, 0);
    } catch (e) {}
  }
  if (logIt) log('⏹ Stopped', 'info');
}

function reRetarget() {
  if (!isAnimating || !currentAnimFile) return;
  const t = currentAction ? currentAction.time : 0;
  playAnimation(currentAnimFile);
  if (currentAction) currentAction.time = t;
}

// ============================================================
//  UI: Bone Trees
// ============================================================
function addHeader(c, icon, text, bg) {
  const d = document.createElement('div'); d.className = 'bone-item';
  d.style.background = bg; d.style.fontWeight = '600';
  d.innerHTML = `<span class="bone-icon">${icon}</span><span class="bone-name" style="font-family:var(--font-sans);font-size:12px;font-weight:600;">${text}</span>`;
  c.appendChild(d);
}

function populateVRMBoneTree() {
  const c = document.getElementById('vrm-bone-tree'); c.innerHTML = '';
  const hb = vrm.humanoid.humanBones;
  const names = Object.keys(hb).sort();
  addHeader(c, '👤', `Humanoid (${names.length})`, 'var(--accent-bg)');
  for (const bn of names) {
    const bone = hb[bn]?.node;
    if (!bone) continue;
    const mx = VRM_TO_MIXAMO[bn] || '—';
    const d = document.createElement('div'); d.className = 'bone-item';
    d.innerHTML = `<span class="indent"></span><span class="bone-icon">🦴</span><span class="bone-name">${bn}</span><span class="bone-type">${bone.name}</span><span class="bone-vrm-name">${mx}</span>`;
    d.onclick = () => {
      c.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); d.classList.add('selected');
      const q = bone.quaternion;
      document.getElementById('bone-hover-info').textContent = `${bn} → ${bone.name} | q(${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)},${q.w.toFixed(3)})`;
    };
    c.appendChild(d);
  }
  const extra = vrmAllBones.filter(b => !Object.values(hb).some(h => h.node === b));
  if (extra.length) {
    addHeader(c, '📦', `Other (${extra.length})`, 'var(--yellow-bg)');
    for (const b of extra) {
      const d = document.createElement('div'); d.className = 'bone-item';
      d.innerHTML = `<span class="indent"></span><span class="bone-icon">◇</span><span class="bone-name">${b.name}</span>`;
      c.appendChild(d);
    }
  }
  document.getElementById('vrm-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    c.querySelectorAll('.bone-item').forEach(i => { i.style.display = (i.querySelector('.bone-name')?.textContent?.toLowerCase()||'').includes(q)||!q?'':'none'; });
  });
}

function populateFBXBoneTree() {
  const c = document.getElementById('fbx-bone-tree'); c.innerHTML = ''; let total = 0;
  for (const [fn, data] of Object.entries(fbxAnimations)) {
    addHeader(c, '📁', `${fn} (${data.trackBones.length})`, 'var(--blue-bg)');
    for (const bn of data.trackBones.sort()) {
      const vn = mixamoVRMRigMap[bn]; const has = vn && vrm.humanoid.humanBones[vn];
      const d = document.createElement('div'); d.className = 'bone-item';
      d.innerHTML = `<span class="indent"></span><span class="bone-icon">${has?'✅':'❌'}</span><span class="bone-name">${bn}</span>${vn?`<span class="bone-vrm-name">${vn}${has?'':' ⚠'}</span>`:'<span class="bone-vrm-name" style="color:var(--red)">No map</span>'}`;
      c.appendChild(d); total++;
    }
  }
  document.getElementById('fbx-bone-count').textContent = `${total} bones`;
  document.getElementById('fbx-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    c.querySelectorAll('.bone-item').forEach(i => { i.style.display = (i.querySelector('.bone-name')?.textContent?.toLowerCase()||'').includes(q)||!q?'':'none'; });
  });
}

function populateMappingTable() {
  const tbody = document.getElementById('mapping-body'); tbody.innerHTML = '';
  let matched = 0, unmatched = 0, extra = 0;
  const allFBX = new Set();
  for (const d of Object.values(fbxAnimations)) d.trackBones.forEach(b => allFBX.add(b));
  for (const fb of Array.from(allFBX).sort()) {
    const vn = mixamoVRMRigMap[fb]; const has = vn && vrm.humanoid.humanBones[vn]; const tr = document.createElement('tr');
    if (has) { tr.innerHTML = `<td>${fb}</td><td><span class="status-badge matched">MATCHED</span></td><td>${vn} (${vrm.humanoid.humanBones[vn].node.name})</td>`; matched++; }
    else if (vn) { tr.innerHTML = `<td>${fb}</td><td><span class="status-badge partial">PARTIAL</span></td><td>${vn}</td>`; extra++; }
    else { tr.innerHTML = `<td>${fb}</td><td><span class="status-badge unmatched">NO MAP</span></td><td>—</td>`; unmatched++; }
    tbody.appendChild(tr);
  }
  document.getElementById('stat-matched').textContent = `${matched} matched`;
  document.getElementById('stat-unmatched').textContent = `${unmatched} unmatched`;
  document.getElementById('stat-extra').textContent = `${extra} partial`;
}

// ============================================================
//  Tabs + Viewer Controls
// ============================================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});
document.getElementById('btn-toggle-skeleton').addEventListener('click', () => {
  showSkeleton = !showSkeleton; if (skeletonHelper) skeletonHelper.visible = showSkeleton;
});
document.getElementById('btn-reset-camera').addEventListener('click', () => {
  camera.position.set(0, 1.2, 3.5); controls.target.set(0, 0.9, 0); controls.update();
});
document.getElementById('btn-toggle-wireframe').addEventListener('click', () => {
  showWireframe = !showWireframe;
  if (vrm) vrm.scene.traverse(c => { if (c.isMesh && c.material) (Array.isArray(c.material)?c.material:[c.material]).forEach(m => m.wireframe=showWireframe); });
});

// ============================================================
//  Play/Stop Controls
// ============================================================
const animSelect = document.getElementById('anim-select');
const btnPlay = document.getElementById('btn-play-anim');
btnPlay.addEventListener('click', () => {
  if (isAnimating) { stopAnimation(); btnPlay.textContent = '▶ Play Animation'; }
  else { const f = animSelect.value; if (f) { playAnimation(f); btnPlay.textContent = '⏹ Stop'; } }
});
animSelect.addEventListener('change', () => {
  btnPlay.disabled = !animSelect.value;
  if (isAnimating) { stopAnimation(); btnPlay.textContent = '▶ Play Animation'; }
});

// Speed
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
speedSlider.addEventListener('input', () => {
  tuning.speed = speedSlider.value / 100;
  speedValue.textContent = `${tuning.speed.toFixed(1)}×`;
  if (currentAction) currentAction.setEffectiveTimeScale(tuning.speed);
});

// ============================================================
//  Tuning Controls
// ============================================================
function setupTuning() {
  // Mode selector — update for the official method
  const modeSelect = document.getElementById('retarget-mode');
  modeSelect.innerHTML = `<option value="official" selected>Official three-vrm Method</option>`;

  // Hips scale — now a multiplier on auto-computed value
  const hipsSlider = document.getElementById('tune-hips-scale');
  hipsSlider.min = '0.1'; hipsSlider.max = '3.0'; hipsSlider.step = '0.05'; hipsSlider.value = '1.0';
  document.getElementById('val-hips-scale').textContent = '1.00';
  bindSlider('tune-hips-scale', 'val-hips-scale', v => { tuning.hipsScale = parseFloat(v); return parseFloat(v).toFixed(2); }, reRetarget);

  bindSlider('tune-y-offset', 'val-y-offset', v => { tuning.offsetY = parseFloat(v); return v; }, reRetarget);
  bindSlider('tune-x-offset', 'val-x-offset', v => { tuning.offsetX = parseFloat(v); return v; }, reRetarget);
  bindSlider('tune-z-offset', 'val-z-offset', v => { tuning.offsetZ = parseFloat(v); return v; }, reRetarget);
  bindSlider('tune-rot-y', 'val-rot-y', v => {
    tuning.rotY = parseFloat(v);
    if (vrm) vrm.scene.rotation.y = Math.PI + THREE.MathUtils.degToRad(tuning.rotY);
    return `${v}°`;
  });

  document.querySelectorAll('.bone-weight').forEach(s => {
    const g = s.dataset.group;
    const valSpan = document.querySelector(`[data-group-val="${g}"]`);
    s.addEventListener('input', () => {
      tuning.boneGroupWeights[g] = parseInt(s.value) / 100;
      if (valSpan) valSpan.textContent = `${s.value}%`;
      reRetarget();
    });
  });

  document.getElementById('btn-reset-tuning').addEventListener('click', resetTuning);

  document.getElementById('btn-export-config').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(tuning, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'retarget-config.json'; a.click(); log('📥 Config exported', 'success');
  });
  document.getElementById('btn-import-config').addEventListener('click', () => document.getElementById('config-file-input').click());
  document.getElementById('config-file-input').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { Object.assign(tuning, JSON.parse(ev.target.result)); syncTuningUI(); reRetarget(); log('📤 Imported', 'success'); }
      catch (err) { log(`Import err: ${err.message}`, 'error'); }
    };
    reader.readAsText(file); e.target.value = '';
  });
}

function bindSlider(sid, vid, fn, after) {
  const s = document.getElementById(sid); if (!s) return;
  const v = document.getElementById(vid);
  s.addEventListener('input', () => { if (v) v.textContent = fn(s.value); if (after) after(); });
}

function syncTuningUI() {
  document.getElementById('tune-hips-scale').value = tuning.hipsScale;
  document.getElementById('val-hips-scale').textContent = tuning.hipsScale.toFixed(2);
  for (const a of ['x','y','z']) {
    document.getElementById(`tune-${a}-offset`).value = tuning[`offset${a.toUpperCase()}`];
    document.getElementById(`val-${a}-offset`).textContent = tuning[`offset${a.toUpperCase()}`].toFixed(2);
  }
  document.getElementById('tune-rot-y').value = tuning.rotY;
  document.getElementById('val-rot-y').textContent = `${tuning.rotY}°`;
  speedSlider.value = tuning.speed * 100;
  speedValue.textContent = `${tuning.speed.toFixed(1)}×`;
  for (const [g, w] of Object.entries(tuning.boneGroupWeights)) {
    const s = document.querySelector(`.bone-weight[data-group="${g}"]`);
    const v = document.querySelector(`[data-group-val="${g}"]`);
    if (s) s.value = w * 100; if (v) v.textContent = `${Math.round(w*100)}%`;
  }
  if (vrm) vrm.scene.rotation.y = Math.PI + THREE.MathUtils.degToRad(tuning.rotY);
}

function resetTuning() {
  tuning.hipsScale = 1.0; tuning.offsetX = 0; tuning.offsetY = 0; tuning.offsetZ = 0;
  tuning.rotY = 0; tuning.speed = 1.0;
  for (const g of Object.keys(tuning.boneGroupWeights)) tuning.boneGroupWeights[g] = 1.0;
  syncTuningUI();
  if (currentAction) currentAction.setEffectiveTimeScale(1.0);
  log('🔄 Reset', 'info'); reRetarget();
}

// ============================================================
//  Clear Log
// ============================================================
document.getElementById('btn-clear-log').addEventListener('click', () => { logOutput.innerHTML = ''; });

// ============================================================
//  Render Loop
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controls.update();
  // Mixer updates normalized bones → vrm.update() converts to raw bones
  if (mixer) mixer.update(delta);
  if (vrm) vrm.update(delta);
  renderer.render(scene, camera);
}

// ============================================================
//  Scan for FBX files
// ============================================================
function getAvailableFBXFiles() {
  // We'll try to load these files - add any new ones here
  return ['Waving.fbx', 'idle.fbx', 'Jump.fbx'];
}

// ============================================================
//  Init
// ============================================================
async function init() {
  log('🦴 Skeleton Diagnostic v6 — Official three-vrm retargeting', 'info');
  log('Using: parentWorldRest × keyframe × inv(boneWorldRest)', 'info');
  resize();

  try {
    await loadVRM();
    setLoading('Loading FBX...');

    const fbxFiles = getAvailableFBXFiles();
    for (const f of fbxFiles) {
      try { await loadFBX(f); } catch (e) { log(`Skip ${f}: ${e.message}`, 'warn'); }
    }

    populateFBXBoneTree();
    populateMappingTable();

    for (const fn of Object.keys(fbxAnimations)) {
      const opt = document.createElement('option');
      opt.value = fn; opt.textContent = fn.replace('.fbx', '');
      animSelect.appendChild(opt);
    }
    animSelect.disabled = false;
    setupTuning();

    log('═══════════════════════════════════════', 'success');
    log('✅ Ready — using OFFICIAL @pixiv retarget algorithm', 'success');
    log('═══════════════════════════════════════', 'success');
    document.querySelector('.tab[data-tab="tuning"]').click();
  } catch (err) {
    log(`Fatal: ${err.message}`, 'error');
    console.error(err);
  }

  hideLoading();
  animate();
}

init();
