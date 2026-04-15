/**
 * FBX Animation Analyzer
 * Reads every .fbx in "Animation fbx/", extracts clip metadata via Puppeteer + Three.js,
 * renames files to clean names, and writes animations-manifest.json.
 *
 * Run: node scripts/analyze-fbx.js
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FBX_DIR = path.join(ROOT, 'Animation fbx');
const MANIFEST_OUT = path.join(ROOT, 'src', 'animationsManifest.js');
const SCREENSHOTS_OUT = path.join(ROOT, 'test-screenshots', 'animations');

// ── Human-readable descriptions keyed on normalized clip/file name ──────────
// Auto-generated from name; can be enhanced manually afterward.
function autoDescription(cleanName) {
  const n = cleanName.toLowerCase();
  if (n.includes('breathing'))    return 'Gentle breathing idle — chest rises and falls';
  if (n.includes('agreeing'))     return 'Nodding in agreement with conversational gestures';
  if (n.includes('arguing'))      return 'Animated arguing with emphatic hand gestures';
  if (n.includes('annoyed') && n.includes('shake')) return 'Annoyed head shake — disapproval';
  if (n.includes('backward') && n.includes('walk')) return 'Walking backward cautiously';
  if (n.includes('baseball'))     return 'Confident walk-out stride';
  if (n.includes('bashful'))      return 'Bashful shy gesture — looking down awkwardly';
  if (n.includes('catwalk') && n.includes('idle')) return 'Stylish catwalk idle twist pose';
  if (n.includes('catwalk'))      return 'Stylish catwalk runway walk';
  if (n.includes('clapping') || n.includes('clap')) return 'Clapping applause reaction';
  if (n.includes('excited'))      return 'Excited bouncy reaction with raised arms';
  if (n.includes('female') && n.includes('start')) return 'Female character starting to walk';
  if (n.includes('female') && n.includes('stop'))  return 'Female character stopping walk';
  if (n.includes('female') && n.includes('tough')) return 'Tough confident female walk';
  if (n.includes('happy') && n.includes('hand'))   return 'Happy hand gesture — cheerful wave-like motion';
  if (n.includes('happy') && n.includes('idle'))   return 'Happy idle standing — upbeat relaxed pose';
  if (n.includes('happy'))        return 'Happy joyful reaction';
  if (n.includes('hard') && n.includes('nod'))     return 'Strong emphatic head nod — strong agreement';
  if (n.includes('idle'))         return 'Natural standing idle pose';
  if (n.includes('injured') && n.includes('turn')) return 'Injured character turning right';
  if (n.includes('injured'))      return 'Injured limping walk';
  if (n.includes('joyful') || n.includes('jump for joy')) return 'Joyful jump celebration';
  if (n.includes('jump'))         return 'Jump in place';
  if (n.includes('kneeling'))     return 'Kneeling idle resting pose';
  if (n.includes('laughing'))     return 'Laughing — body shakes with laughter';
  if (n.includes('laying'))       return 'Laying down idle rest pose';
  if (n.includes('lengthy') && n.includes('nod'))  return 'Slow lengthy head nod — thoughtful agreement';
  if (n.includes('moonwalk'))     return 'Moonwalk dance move';
  if (n.includes('reacting'))     return 'Reacting with surprise or shock';
  if (n.includes('sad'))          return 'Sad drooped idle — dejected slouch posture';
  if (n.includes('sarcastic') && n.includes('nod')) return 'Slow sarcastic head nod';
  if (n.includes('shak') && n.includes('no'))      return 'Shaking head no — disagreement';
  if (n.includes('surprised'))    return 'Surprised reaction — stepping back, open arms';
  if (n.includes('talking'))      return 'Talking with natural hand gestures';
  if (n.includes('thankful'))     return 'Thankful grateful gesture — hand to chest';
  if (n.includes('thinking') || n.includes('thoughtful')) return 'Thinking — hand near chin, pondering';
  if (n.includes('thoughtful') && n.includes('shake')) return 'Thoughtful head shake — uncertain';
  if (n.includes('victory'))      return 'Victory idle triumphant pose';
  if (n.includes('walking backwards')) return 'Walking backward';
  if (n.includes('walking') || n.includes('walk')) return 'Natural walking cycle';
  if (n.includes('wave hip hop')) return 'Hip-hop wave dance move';
  if (n.includes('waving'))       return 'Waving hello or goodbye';
  if (n.includes('weight shift')) return 'Weight shift side to side — relaxed standing';
  if (n.includes('acknowledging')) return 'Acknowledging gesture — subtle approval nod';
  if (n.includes('angry'))        return 'Angry gesture — frustrated arm movement';
  if (n.includes('being cocky'))  return 'Cocky confident pose';
  if (n.includes('dismissing'))   return 'Dismissive hand wave — brushing off';
  if (n.includes('look away'))    return 'Looking away — avoiding eye contact gesture';
  if (n.includes('ready to fight')) return 'Combat ready idle — defensive stance';
  if (n.includes('relieved'))     return 'Relieved sigh — exhale of relief';
  if (n.includes('left strafe') && n.includes('walk')) return 'Strafing walk to the left';
  if (n.includes('left strafe'))  return 'Strafing step to the left';
  if (n.includes('right strafe') && n.includes('walk')) return 'Strafing walk to the right';
  if (n.includes('right strafe')) return 'Strafing step to the right';
  if (n.includes('left turn'))    return 'Turning left while walking';
  if (n.includes('right turn'))   return 'Turning right while walking';
  if (n.includes('running'))      return 'Running forward';
  if (n.includes('sarcastic'))    return 'Sarcastic gesture or expression';
  if (n.includes('head nod'))     return 'Head nod yes — agreement';
  if (n.includes('nod'))          return 'Head nod gesture';
  return `${cleanName} animation`;
}

// ── Normalize filename to a clean key ────────────────────────────────────────
function toKey(name) {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')        // remove parentheses
    .replace(/\s+/g, '_')        // spaces → underscores
    .replace(/[^a-z0-9_]/g, '_') // non-alphanum → underscore
    .replace(/_+/g, '_')         // collapse multiple underscores
    .replace(/^_|_$/g, '');      // trim leading/trailing
}

// ── Build a clean display name from filename ─────────────────────────────────
function cleanDisplayName(filename) {
  return filename
    .replace(/\.fbx$/i, '')
    .replace(/\s*\(\d+\)\s*$/, match => ` (Alt${match.replace(/[^0-9]/g, '')})`)
    .trim();
}

// ── Deduplicate keys (add _2, _3 suffix) ─────────────────────────────────────
function deduplicateKeys(entries) {
  const seen = {};
  for (const e of entries) {
    if (seen[e.key] === undefined) {
      seen[e.key] = 0;
    } else {
      seen[e.key]++;
      e.key = `${e.key}_${seen[e.key] + 1}`;
    }
  }
  return entries;
}

async function run() {
  if (!fs.existsSync(FBX_DIR)) {
    console.error(`❌ "Animation fbx" folder not found at: ${FBX_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(SCREENSHOTS_OUT, { recursive: true });

  const files = fs.readdirSync(FBX_DIR)
    .filter(f => f.toLowerCase().endsWith('.fbx'))
    .sort();

  console.log(`\n🔍 Found ${files.length} FBX files\n`);

  // ── Launch browser ────────────────────────────────────────────────────────
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Load a minimal analysis page (just needs Three.js + FBXLoader)
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 20000 });

  // Inject the analysis helper into the page
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r172/three.min.js',
  }).catch(() => {}); // three is already in the bundle

  // Wait for app to fully load (VRM etc.)
  await new Promise(r => setTimeout(r, 3000));

  // ── Analyze each FBX via page.evaluate ───────────────────────────────────
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const url = `/fbx/${encodeURIComponent(filename)}`;
    process.stdout.write(`  [${String(i+1).padStart(2)}/${files.length}] ${filename} ... `);

    let meta;
    try {
      meta = await page.evaluate(async (fbxUrl) => {
        // Use the globally available THREE + FBXLoader from the app bundle
        const { FBXLoader } = await import('/node_modules/three/examples/jsm/loaders/FBXLoader.js')
          .catch(() => ({ FBXLoader: null }));

        if (!FBXLoader) return { error: 'FBXLoader not available' };

        return new Promise((resolve) => {
          const loader = new FBXLoader();
          const timeout = setTimeout(() => resolve({ error: 'timeout' }), 15000);

          loader.load(fbxUrl,
            (fbx) => {
              clearTimeout(timeout);
              try {
                const clips = fbx.animations || [];
                const clip = clips[0];

                // Has skinned mesh?
                let hasSkin = false;
                fbx.traverse(obj => {
                  if (obj.isSkinnedMesh) hasSkin = true;
                });

                if (!clip) {
                  resolve({ error: 'no_animation', hasSkin, objectCount: fbx.children.length });
                  return;
                }

                // Detect bone prefix
                const trackNames = clip.tracks.map(t => t.name);
                const hasMixamoPrefix = trackNames.some(n => n.startsWith('mixamorig:'));
                const prefix = hasMixamoPrefix ? 'mixamorig:' : '';

                // Count tracks by type
                const quatTracks = trackNames.filter(n => n.endsWith('.quaternion')).length;
                const posTracks  = trackNames.filter(n => n.endsWith('.position')).length;

                // Detect fps from keyframe spacing
                let fps = 30;
                const quatTrack = clip.tracks.find(t => t.name.endsWith('.quaternion'));
                if (quatTrack && quatTrack.times.length > 1) {
                  const avgDelta = (quatTrack.times[quatTrack.times.length - 1] - quatTrack.times[0])
                    / (quatTrack.times.length - 1);
                  fps = Math.round(1 / avgDelta);
                  // Clamp to known fps values
                  if (fps > 55) fps = 60;
                  else if (fps > 25) fps = 30;
                  else fps = 24;
                }

                // Detect T-pose in first frame: check if Hips quaternion track
                // starts with identity rotation (w≈1, xyz≈0)
                let hasTposeStart = false;
                const hipsTrack = clip.tracks.find(t =>
                  t.name.toLowerCase().includes('hips') && t.name.endsWith('.quaternion')
                );
                if (hipsTrack && hipsTrack.values.length >= 4) {
                  const x = hipsTrack.values[0], y = hipsTrack.values[1],
                        z = hipsTrack.values[2], w = hipsTrack.values[3];
                  // Identity quaternion: w=1, x=y=z=0
                  hasTposeStart = Math.abs(w - 1) < 0.01 && Math.abs(x) < 0.01 &&
                                  Math.abs(y) < 0.01 && Math.abs(z) < 0.01;
                }

                // Get internal clip name
                const internalName = clip.name || '';

                resolve({
                  internalName,
                  duration: Math.round(clip.duration * 100) / 100,
                  fps,
                  hasSkin,
                  hasTposeStart,
                  bonePrefix: prefix,
                  trackCount: clip.tracks.length,
                  quatTracks,
                  posTracks,
                });
              } catch(e) {
                resolve({ error: e.message });
              }
            },
            undefined,
            (err) => {
              clearTimeout(timeout);
              resolve({ error: String(err) });
            }
          );
        });
      }, url);
    } catch (e) {
      meta = { error: e.message };
    }

    if (meta.error) {
      console.log(`⚠️  ${meta.error}`);
      results.push({ filename, error: meta.error });
      continue;
    }

    console.log(`✅  clip="${meta.internalName || 'unnamed'}" ${meta.duration}s ${meta.fps}fps${meta.hasSkin ? ' [skinned]' : ''}${meta.hasTposeStart ? ' [T-pose@0]' : ''}`);

    // Build display name
    // Prefer internal clip name if it's informative (not "mixamo.com")
    const inferredName = (meta.internalName && meta.internalName !== 'mixamo.com')
      ? meta.internalName
      : cleanDisplayName(filename);

    results.push({
      filename,
      displayName: inferredName,
      key: toKey(inferredName),
      internalName: meta.internalName,
      duration: meta.duration,
      fps: meta.fps,
      hasSkin: meta.hasSkin,
      hasTposeStart: meta.hasTposeStart,
      bonePrefix: meta.bonePrefix,
      trackCount: meta.trackCount,
    });
  }

  await browser.close();

  // ── Deduplicate keys ─────────────────────────────────────────────────────
  const valid = results.filter(r => !r.error);
  deduplicateKeys(valid);

  // ── Add descriptions ──────────────────────────────────────────────────────
  for (const e of valid) {
    e.description = autoDescription(e.displayName);
  }

  // ── Print summary ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('ANIMATION MANIFEST SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  for (const e of valid) {
    const flags = [
      e.fps === 60 ? '60fps' : '30fps',
      e.hasSkin    ? 'skinned' : 'no-skin',
      e.hasTposeStart ? 'T-pose-start' : '',
    ].filter(Boolean).join(', ');
    console.log(`  ${e.key.padEnd(35)} ${e.duration}s  [${flags}]`);
    console.log(`    → ${e.description}`);
  }

  const errors = results.filter(r => r.error);
  if (errors.length) {
    console.log(`\n⚠️  Failed (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.filename}: ${e.error}`));
  }

  // ── Write manifest JS module ──────────────────────────────────────────────
  const manifest = valid.map(e => ({
    key:         e.key,
    file:        e.filename,
    displayName: e.displayName,
    description: e.description,
    duration:    e.duration,
    fps:         e.fps,
    hasSkin:     e.hasSkin,
    hasTposeStart: e.hasTposeStart,
    bonePrefix:  e.bonePrefix,
  }));

  const jsContent = `// AUTO-GENERATED by scripts/analyze-fbx.js — do not edit manually
// Re-run: node scripts/analyze-fbx.js

export const ANIMATIONS_MANIFEST = ${JSON.stringify(manifest, null, 2)};

/** Quick lookup by key */
export const ANIMATIONS_BY_KEY = Object.fromEntries(
  ANIMATIONS_MANIFEST.map(a => [a.key, a])
);
`;

  fs.writeFileSync(MANIFEST_OUT, jsContent, 'utf8');
  console.log(`\n✅ Manifest written → ${MANIFEST_OUT}`);
  console.log(`   ${valid.length} animations, ${errors.length} errors`);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
