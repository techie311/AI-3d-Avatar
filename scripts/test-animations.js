/**
 * test-animations.js — Puppeteer animation test runner
 *
 * Opens the app, waits for VRM to load, then for each animation:
 *   1. Opens the settings panel
 *   2. Clicks the animation in the library list
 *   3. Waits 2s for it to load and play
 *   4. Screenshots
 *   5. Reports any console errors
 *
 * Run: node scripts/test-animations.js
 * Output: screenshots/anim-test-*.png
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.resolve('screenshots');
const REPORT_FILE = path.resolve('scripts/animation-test-report.md');

// Only test a subset first to verify everything works
const TEST_SAMPLE = [
  'breathing_idle', 'idle_1', 'happy_idle',
  'talking', 'talking_2', 'talking_3',
  'agreeing_1', 'head_nod_yes', 'shaking_head_no',
  'laughing', 'excited', 'happy',
  'waving_gesture', 'thinking_gesture', 'shrug',
  'walk_1', 'running', 'silly_walk',
  'jump', 'surprised',
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // Ensure screenshots dir exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const errors = [];
  const results = [];

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  console.log('Opening app...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for VRM to load (loading overlay to disappear)
  console.log('Waiting for VRM to load...');
  try {
    await page.waitForSelector('#loading-overlay.hidden', { timeout: 20000 });
    console.log('VRM loaded.');
  } catch {
    console.warn('Loading overlay did not hide — VRM may not have loaded. Continuing anyway.');
  }
  await sleep(2000);

  // Take initial screenshot
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'anim-test-00-initial.png') });

  // Open settings panel
  await page.click('#settings-btn');
  await sleep(500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'anim-test-01-settings-open.png') });

  // Test each animation
  for (let i = 0; i < TEST_SAMPLE.length; i++) {
    const key = TEST_SAMPLE[i];
    const prefix = `anim-test-${String(i + 2).padStart(2, '0')}-${key}`;
    console.log(`\n[${i + 1}/${TEST_SAMPLE.length}] Testing: ${key}`);

    const errorsBefore = consoleErrors.length;

    try {
      // Click the animation item in the library list
      const clicked = await page.evaluate((animKey) => {
        const items = document.querySelectorAll('.anim-library-item');
        for (const item of items) {
          if (item.dataset.key === animKey) {
            item.click();
            return true;
          }
        }
        return false;
      }, key);

      if (!clicked) {
        // Try searching for it
        await page.focus('#anim-search');
        await page.keyboard.selectAll();
        await page.type('#anim-search', key.replace(/_/g, ' '));
        await sleep(300);

        const clickedAfterSearch = await page.evaluate((animKey) => {
          const items = document.querySelectorAll('.anim-library-item');
          for (const item of items) {
            if (item.dataset.key === animKey) {
              item.click();
              return true;
            }
          }
          return false;
        }, key);

        // Clear search
        await page.focus('#anim-search');
        await page.keyboard.selectAll();
        await page.keyboard.press('Delete');
        await sleep(200);

        if (!clickedAfterSearch) {
          results.push({ key, status: 'NOT_FOUND', errors: [] });
          console.log(`  ⚠ NOT FOUND in library list`);
          continue;
        }
      }

      // Wait for animation to start playing
      await sleep(2500);

      // Check now-playing bar
      const nowPlayingVisible = await page.evaluate(() => {
        const el = document.getElementById('anim-now-playing');
        return el && el.style.display !== 'none';
      });

      const playingName = await page.evaluate(() => {
        const el = document.getElementById('anim-playing-name');
        return el ? el.textContent : '';
      });

      // Screenshot
      const screenshotPath = path.join(SCREENSHOTS_DIR, `${prefix}.png`);
      await page.screenshot({ path: screenshotPath });

      // Collect any new errors
      const newErrors = consoleErrors.slice(errorsBefore).filter(e =>
        e.toLowerCase().includes('error') ||
        e.toLowerCase().includes('failed') ||
        e.toLowerCase().includes('warn')
      );

      const status = nowPlayingVisible ? 'OK' : 'NO_PLAYING_BAR';
      results.push({ key, status, playingName, errors: newErrors });
      console.log(`  ${status === 'OK' ? '✓' : '⚠'} ${status} — playing: "${playingName}"`);
      if (newErrors.length > 0) {
        console.log(`  Errors: ${newErrors.slice(0, 2).join('; ')}`);
      }

      // Stop animation before next
      await page.evaluate(() => {
        const stopBtn = document.getElementById('anim-stop-btn');
        if (stopBtn) stopBtn.click();
      });
      await sleep(500);

    } catch (err) {
      results.push({ key, status: 'EXCEPTION', errors: [err.message] });
      console.log(`  ✗ EXCEPTION: ${err.message}`);
    }
  }

  // Final screenshot
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'anim-test-final.png') });

  await browser.close();

  // Generate report
  const okCount = results.filter(r => r.status === 'OK').length;
  const failCount = results.filter(r => r.status !== 'OK').length;

  let report = `# Animation Test Report\n\n`;
  report += `Tested: ${results.length} animations | ✓ ${okCount} OK | ✗ ${failCount} issues\n\n`;
  report += `## Results\n\n`;

  for (const r of results) {
    const icon = r.status === 'OK' ? '✓' : '✗';
    report += `${icon} **${r.key}** — ${r.status}`;
    if (r.errors?.length > 0) {
      report += `\n   - ${r.errors.slice(0, 3).join('\n   - ')}`;
    }
    report += '\n';
  }

  if (consoleErrors.length > 0) {
    report += `\n## Console Errors (${consoleErrors.length})\n\n`;
    const unique = [...new Set(consoleErrors)].slice(0, 20);
    report += unique.map(e => `- ${e}`).join('\n');
  }

  fs.writeFileSync(REPORT_FILE, report);
  console.log(`\n\nReport written to: ${REPORT_FILE}`);
  console.log(`Results: ${okCount}/${results.length} OK`);
  console.log(`Screenshots in: ${SCREENSHOTS_DIR}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
