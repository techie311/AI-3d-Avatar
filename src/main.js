/**
 * Main Entry Point — AI 3D Avatar Application
 * 
 * Sets up Three.js scene, loads VRM avatar, initializes all controllers,
 * connects to llama.cpp, and runs the render/update loop.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { AvatarLoader } from './avatar/AvatarLoader.js';
import { ExpressionController } from './avatar/ExpressionController.js';
import { ProceduralAnimations } from './avatar/ProceduralAnimations.js';
import { AnimationController } from './avatar/AnimationController.js';
import { FBXAnimationLoader } from './avatar/FBXAnimationLoader.js';
import { ANIMATIONS_MANIFEST } from './animationsManifest.js';

import { SpeechEngine } from './voice/SpeechEngine.js';
import { LipSyncController } from './voice/LipSyncController.js';

import { AIBridge } from './ai/AIBridge.js';
import { CommandParser } from './ai/CommandParser.js';
import { ResponseOrchestrator } from './ai/ResponseOrchestrator.js';
import { MoodEngine } from './ai/MoodEngine.js';
import { AutonomousBehavior } from './ai/AutonomousBehavior.js';

import { SYSTEM_PROMPT } from './systemPrompt.js';

// ====================================================
// CONFIGURATION — Edit these to match your setup
// ====================================================
const CONFIG = {
  llamaServerUrl: 'http://localhost:8080',
  defaultModelPath: null, // Set to '/models/avatar.vrm' if you have one in public/
  connectionCheckInterval: 10000, // ms
};

// ====================================================
// THREE.JS SCENE SETUP
// ====================================================
const canvas = document.getElementById('avatar-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();

// Background gradient — dark purple to deep blue
const bgColor = new THREE.Color(0x0a0a1a);
scene.background = bgColor;
scene.fog = new THREE.Fog(bgColor, 8, 20);

// Camera
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.3, 2.5);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 0.85;
controls.update();

// ====================================================
// LIGHTING
// ====================================================
// Soft ambient
const ambientLight = new THREE.AmbientLight(0x8888cc, 0.6);
scene.add(ambientLight);

// Key light (warm, from upper right)
const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
keyLight.position.set(2, 3, 2);
keyLight.castShadow = false;
scene.add(keyLight);

// Fill light (cool, from left)
const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4);
fillLight.position.set(-2, 1, 1);
scene.add(fillLight);

// Rim light (from behind)
const rimLight = new THREE.DirectionalLight(0xcc88ff, 0.5);
rimLight.position.set(0, 2, -3);
scene.add(rimLight);

// Ground plane
const groundGeometry = new THREE.CircleGeometry(5, 64);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x111122,
  roughness: 0.9,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// Subtle grid for spatial reference
const gridHelper = new THREE.GridHelper(10, 20, 0x222244, 0x1a1a2e);
gridHelper.position.y = 0.001;
scene.add(gridHelper);

// ====================================================
// CONTROLLERS (initialized after VRM loads)
// ====================================================
const avatarLoader = new AvatarLoader(scene);
const speechEngine = new SpeechEngine();
const commandParser = new CommandParser();
const moodEngine = new MoodEngine();
const aiBridge = new AIBridge(CONFIG.llamaServerUrl);

let expressionCtrl = null;
let proceduralAnims = null;
let animationCtrl = null;
let fbxLoader = null;
let lipSyncCtrl = null;
let orchestrator = null;
let autoBehavior = null;

// Clock for delta time
const clock = new THREE.Clock();

// ====================================================
// AVATAR LOADING
// ====================================================
async function loadAvatar(source) {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  
  try {
    if (overlay) overlay.classList.remove('hidden');
    if (loadingText) loadingText.textContent = 'Loading avatar...';
    addSystemMessage('Loading avatar...');
    
    const vrm = await avatarLoader.load(source);

    // Initialize controllers with loaded VRM
    expressionCtrl = new ExpressionController(vrm);
    proceduralAnims = new ProceduralAnimations(vrm);
    animationCtrl = new AnimationController(vrm);
    fbxLoader = new FBXAnimationLoader(vrm, animationCtrl);
    fbxLoader.onAnimationEnd = () => updateAnimLibraryUI();
    lipSyncCtrl = new LipSyncController(expressionCtrl);
    orchestrator = new ResponseOrchestrator(expressionCtrl, animationCtrl, speechEngine, lipSyncCtrl, fbxLoader);

    // Set up autonomous behavior
    autoBehavior = new AutonomousBehavior(aiBridge, orchestrator, moodEngine, commandParser);
    autoBehavior.start();

    // Hide loading overlay
    if (overlay) overlay.classList.add('hidden');
    
    addSystemMessage('Avatar loaded! Say hello 👋');

    // Focus camera on avatar
    controls.target.set(0, 1.0, 0);
    camera.position.set(0, 1.3, 2.5);
    controls.update();

    return vrm;
  } catch (err) {
    console.error('[Main] Failed to load avatar:', err);
    if (loadingText) loadingText.textContent = `Error: ${err.message}`;
    addSystemMessage(`Error loading avatar: ${err.message}`);
  }
}

// ====================================================
// AUTO-LOAD FIRST MODEL + SETTINGS PANEL
// ====================================================
const modelSelect = document.getElementById('model-select');
const modelLoadBtn = document.getElementById('model-load-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const voiceSelect = document.getElementById('voice-select');
const aiServerUrl = document.getElementById('ai-server-url');
const exprDebugToggle = document.getElementById('expr-debug-toggle');

// Fetch available models and auto-load the first one
async function initModels() {
  try {
    const resp = await fetch('/api/models');
    const models = await resp.json();
    
    // Populate settings dropdown
    modelSelect.innerHTML = '';
    if (models.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = 'No .vrm files found';
      modelSelect.appendChild(opt);
      modelLoadBtn.disabled = true;
      document.getElementById('loading-text').textContent = 'No VRM files found in "model VRM" folder';
    } else {
      for (const fileName of models) {
        const opt = document.createElement('option');
        opt.value = fileName;
        const displayName = fileName.replace(/\.vrm$/i, '');
        opt.textContent = displayName.length > 35 
          ? displayName.substring(0, 32) + '...' 
          : displayName;
        modelSelect.appendChild(opt);
      }
      modelSelect.selectedIndex = 0;
      modelLoadBtn.disabled = false;

      // AUTO-LOAD the first model
      loadAvatar(`/models/${encodeURIComponent(models[0])}`);
    }
  } catch (err) {
    console.error('[Main] Failed to load model list:', err);
    document.getElementById('loading-text').textContent = 'Error loading model list';
  }
}

// Load button in settings (switch model)
modelLoadBtn.addEventListener('click', () => {
  const selected = modelSelect.value;
  if (selected) {
    modelLoadBtn.disabled = true;
    loadAvatar(`/models/${encodeURIComponent(selected)}`).then(() => {
      modelLoadBtn.disabled = false;
    });
  }
});

// Settings panel toggle
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

settingsClose.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

// Voice selector
voiceSelect.addEventListener('change', () => {
  speechEngine.setVoice(voiceSelect.value);
  addSystemMessage(`Voice changed to: ${voiceSelect.options[voiceSelect.selectedIndex].text}`);
});

// AI server URL
aiServerUrl.addEventListener('change', () => {
  aiBridge.serverUrl = aiServerUrl.value.replace(/\/$/, '');
  addSystemMessage(`AI server URL updated to: ${aiBridge.serverUrl}`);
  checkConnection();
});

// Expression debug toggle
exprDebugToggle.addEventListener('change', () => {
  const exprPanel = document.getElementById('expression-panel');
  if (exprDebugToggle.checked) {
    exprPanel.classList.remove('hidden');
    buildExpressionPanel();
  } else {
    exprPanel.classList.add('hidden');
  }
});

// ====================================================
// ANIMATION BUTTONS IN SETTINGS
// ====================================================
function initAnimButtons() {
  const btns = document.querySelectorAll('.anim-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const anim = btn.dataset.anim;
      if (!animationCtrl) return;
      animationCtrl.forceState(anim);
      // Highlight active
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// Keep anim button highlight in sync with actual state
function syncAnimButtons() {
  if (!animationCtrl) return;
  const state = animationCtrl.getState();
  document.querySelectorAll('.anim-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.anim === state);
  });

  // Sync animation library now-playing bar
  if (fbxLoader) {
    const nowPlaying = document.getElementById('anim-now-playing');
    if (nowPlaying) {
      const show = fbxLoader.isPlaying && fbxLoader.getCurrentKey();
      nowPlaying.style.display = show ? 'flex' : 'none';
    }
  }
}

// ====================================================
// ANIMATION LIBRARY (FBX)
// ====================================================
let _animLibCategory = 'all';
let _animLibSearch = '';

function initAnimLibrary() {
  const searchInput = document.getElementById('anim-search');
  const stopBtn = document.getElementById('anim-stop-btn');
  const nowPlaying = document.getElementById('anim-now-playing');

  // Category tab clicks
  document.querySelectorAll('.anim-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.anim-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _animLibCategory = btn.dataset.cat;
      renderAnimLibraryList();
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      _animLibSearch = searchInput.value.toLowerCase();
      renderAnimLibraryList();
    });
  }

  // Stop button
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (fbxLoader) fbxLoader.stop();
      if (nowPlaying) nowPlaying.style.display = 'none';
      updateAnimLibraryUI();
    });
  }

  renderAnimLibraryList();
}

function renderAnimLibraryList() {
  const list = document.getElementById('anim-library-list');
  if (!list) return;

  const filtered = ANIMATIONS_MANIFEST.filter(anim => {
    const catOk = _animLibCategory === 'all' || anim.category === _animLibCategory;
    const searchOk = !_animLibSearch ||
      anim.displayName.toLowerCase().includes(_animLibSearch) ||
      anim.description.toLowerCase().includes(_animLibSearch);
    return catOk && searchOk;
  });

  list.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:12px;text-align:center;font-size:11px;color:var(--text-muted)';
    empty.textContent = 'No animations found';
    list.appendChild(empty);
    return;
  }

  const currentKey = fbxLoader ? fbxLoader.getCurrentKey() : null;

  for (const anim of filtered) {
    const item = document.createElement('div');
    item.className = 'anim-library-item' + (anim.key === currentKey ? ' playing' : '');
    item.dataset.key = anim.key;

    const icon = document.createElement('span');
    icon.className = 'anim-item-icon';
    icon.textContent = anim.key === currentKey ? '▶' : '○';

    const info = document.createElement('div');
    info.className = 'anim-item-info';

    const name = document.createElement('div');
    name.className = 'anim-item-name';
    name.textContent = anim.displayName;

    const meta = document.createElement('div');
    meta.className = 'anim-item-meta';
    meta.textContent = `${anim.duration.toFixed(1)}s · ${anim.category}`;

    info.appendChild(name);
    info.appendChild(meta);

    const loopTag = document.createElement('span');
    loopTag.className = 'anim-item-loop';
    loopTag.textContent = anim.loop ? '∞' : '1×';

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(loopTag);

    item.addEventListener('click', () => {
      if (!fbxLoader) return;
      // If already playing this one, stop it
      if (fbxLoader.getCurrentKey() === anim.key && fbxLoader.isPlaying) {
        fbxLoader.stop();
        updateAnimLibraryUI();
        return;
      }
      fbxLoader.playUrl(`/fbx/${encodeURIComponent(anim.file)}`, {
        loop: anim.loop,
        key: anim.key,
        fadeIn: 0.3,
        fadeOut: 0.3,
      });
      updateAnimLibraryUI(anim);
    });

    list.appendChild(item);
  }
}

function updateAnimLibraryUI(anim = null) {
  const nowPlaying = document.getElementById('anim-now-playing');
  const playingName = document.getElementById('anim-playing-name');

  const currentKey = fbxLoader ? fbxLoader.getCurrentKey() : null;
  const isPlaying = fbxLoader ? fbxLoader.isPlaying : false;

  if (nowPlaying) {
    nowPlaying.style.display = (isPlaying && currentKey) ? 'flex' : 'none';
  }
  if (playingName && currentKey) {
    const entry = anim || ANIMATIONS_MANIFEST.find(a => a.key === currentKey);
    playingName.textContent = entry ? entry.displayName : currentKey;
  }

  // Re-render list to update playing highlights
  renderAnimLibraryList();
}

// Auto-load models on startup
initModels();
initAnimButtons();
initAnimLibrary();

// ====================================================
// CHAT UI
// ====================================================
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatToggle = document.getElementById('chat-toggle');
const chatPanel = document.getElementById('chat-panel');

function addMessage(role, text, emotion = '') {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${role}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;
  msgDiv.appendChild(contentDiv);

  if (emotion && role === 'ai') {
    const emotionDiv = document.createElement('div');
    emotionDiv.className = 'message-emotion';
    emotionDiv.textContent = `feeling ${emotion}`;
    msgDiv.appendChild(emotionDiv);
  }

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message system';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;
  msgDiv.appendChild(contentDiv);
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  if (!aiBridge.connected) {
    addSystemMessage('AI not connected. Make sure llama-server is running on port 8080.');
    return;
  }

  chatInput.value = '';
  addMessage('user', text);

  // Lock UI and mark orchestrator busy while waiting — no animations until response arrives
  chatSend.disabled = true;
  chatInput.disabled = true;
  if (orchestrator) orchestrator.isBusy = true;  // block autonomous behavior
  if (animationCtrl) animationCtrl.setState('idle'); // stay idle while waiting

  // Reset autonomous behavior timers
  if (autoBehavior) autoBehavior.onUserActivity();
  moodEngine.onInteraction('message');

  try {
    const moodContext = moodEngine.getMoodDescription();
    const raw = await aiBridge.sendMessage(text, moodContext);
    const command = commandParser.parse(raw);

    // Display in chat
    addMessage('ai', command.text, command.emotion);

    // Update mood based on expressed emotion
    moodEngine.onEmotionExpressed(command.emotion);

    // NOW release busy flag so orchestrator can animate + speak
    if (orchestrator) orchestrator.isBusy = false;

    // Execute avatar actions
    if (orchestrator) {
      await orchestrator.executeCommand(command);
    }
  } catch (err) {
    if (orchestrator) orchestrator.isBusy = false;
    addSystemMessage(`Error: ${err.message}`);
  } finally {
    chatSend.disabled = false;
    chatInput.disabled = false;
  }
}

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Chat toggle
chatToggle.addEventListener('click', () => {
  chatPanel.classList.toggle('minimized');
  chatToggle.textContent = chatPanel.classList.contains('minimized') ? '+' : '−';
});

// ====================================================
// STATUS BAR UPDATE
// ====================================================
function updateStatusBar() {
  // Connection status
  const statusDot = document.querySelector('#status-connection .status-dot');
  const statusText = document.querySelector('#status-connection .status-text');
  if (aiBridge.connected) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'AI Connected';
  } else {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'AI Disconnected';
  }

  // Mood
  const moodIcon = document.querySelector('#status-mood .mood-icon');
  const moodText = document.querySelector('#status-mood .status-text');
  moodIcon.textContent = moodEngine.getMoodEmoji();
  moodText.textContent = moodEngine.getDominantMood();

  // Animation state
  const animText = document.querySelector('#status-animation .status-text');
  if (animationCtrl) {
    animText.textContent = animationCtrl.getState();
  }
}

// ====================================================
// EXPRESSION DEBUG PANEL
// ====================================================
const exprPanel = document.getElementById('expression-panel');
const exprControls = document.getElementById('expression-controls');

function buildExpressionPanel() {
  if (!expressionCtrl) return;
  exprControls.innerHTML = '';
  
  const emotions = ExpressionController.getSupportedEmotions();
  for (const emotion of emotions) {
    const div = document.createElement('div');
    div.className = 'expr-control';
    const label = document.createElement('label');
    label.textContent = emotion;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = '0';
    input.addEventListener('input', () => {
      expressionCtrl.setEmotion(emotion, input.value / 100);
    });
    div.appendChild(label);
    div.appendChild(input);
    exprControls.appendChild(div);
  }
}

// ====================================================
// AI CONNECTION
// ====================================================
aiBridge.setSystemPrompt(SYSTEM_PROMPT);

aiBridge.onConnectionChange = (connected) => {
  if (connected) {
    addSystemMessage('Connected to AI! 🟢');
  } else {
    addSystemMessage('Lost connection to AI 🔴');
  }
  updateStatusBar();
};

// Periodic connection check
async function checkConnection() {
  await aiBridge.testConnection();
  updateStatusBar();
}

checkConnection();
setInterval(checkConnection, CONFIG.connectionCheckInterval);

// ====================================================
// RENDER LOOP
// ====================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // Update controllers (only if VRM is loaded)
  if (avatarLoader.vrm) {
    if (expressionCtrl) expressionCtrl.update(delta);
    if (fbxLoader) fbxLoader.update(delta);               // 0. FBX mixer (disables animCtrl when active)
    if (animationCtrl) animationCtrl.update(delta);       // 1. Sets base pose (with lerp)
    if (proceduralAnims) proceduralAnims.update(delta);    // 2. Adds micro-movements on top
    if (lipSyncCtrl) lipSyncCtrl.update(delta);

    // VRM update (spring bones, etc.)
    avatarLoader.vrm.update(delta);
  }

  // Update mood & autonomous behavior
  moodEngine.update(delta);
  if (autoBehavior) autoBehavior.update(delta);

  // Update orbit controls
  controls.update();

  // Update status bar and anim buttons every ~30 frames
  if (Math.random() < 0.03) {
    updateStatusBar();
    syncAnimButtons();
  }

  // Render
  renderer.render(scene, camera);
}

animate();

// ====================================================
// RESIZE HANDLER
// ====================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


console.log('[Main] AI 3D Avatar initialized. Auto-loading first VRM model...');
