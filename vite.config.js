import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
  plugins: [
    {
      name: 'serve-vrm-models-and-tts',
      configureServer(server) {

        // ================================================
        // API: List available VRM models
        // ================================================
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/models') {
            const dir = path.resolve('model VRM');
            let files = [];
            if (fs.existsSync(dir)) {
              files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.vrm'));
            }
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(files));
            return;
          }

          // ================================================
          // API: List available FBX animations
          // ================================================
          if (req.url === '/api/animations') {
            const dir = path.resolve('Animation fbx');
            let files = [];
            if (fs.existsSync(dir)) {
              files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.fbx'));
            }
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(files));
            return;
          }

          // ================================================
          // Serve FBX animation files from "Animation fbx" directory
          // ================================================
          if (req.url.startsWith('/fbx/')) {
            const fileName = decodeURIComponent(req.url.replace('/fbx/', ''));
            const filePath = path.resolve('Animation fbx', fileName);
            if (fs.existsSync(filePath) && !filePath.includes('..')) {
              const stat = fs.statSync(filePath);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', stat.size);
              res.setHeader('Access-Control-Allow-Origin', '*');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }

          // ================================================
          // Serve VRM files from "model VRM" directory
          // ================================================
          if (req.url.startsWith('/models/')) {
            const fileName = decodeURIComponent(req.url.replace('/models/', ''));
            const filePath = path.resolve('model VRM', fileName);
            
            if (fs.existsSync(filePath) && !filePath.includes('..')) {
              const stat = fs.statSync(filePath);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', stat.size);
              res.setHeader('Access-Control-Allow-Origin', '*');
              const stream = fs.createReadStream(filePath);
              stream.pipe(res);
              return;
            }
          }

          // ================================================
          // TTS: Check if edge-tts is available
          // ================================================
          if (req.url === '/api/tts/check') {
            (async () => {
              try {
                const { EdgeTTS } = await import('@andresaya/edge-tts');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ available: true }));
              } catch {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ available: false }));
              }
            })();
            return;
          }

          // ================================================
          // TTS: List available voices
          // ================================================
          if (req.url === '/api/tts/voices') {
            (async () => {
              try {
                const { EdgeTTS } = await import('@andresaya/edge-tts');
                const tts = new EdgeTTS();
                const voices = await tts.getVoices();
                const englishVoices = voices
                  .filter(v => v.Locale.startsWith('en'))
                  .map(v => ({
                    name: v.ShortName,
                    friendly: v.FriendlyName,
                    gender: v.Gender,
                    locale: v.Locale,
                  }));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(englishVoices));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            })();
            return;
          }

          // ================================================
          // TTS: Synthesize speech
          // ================================================
          if (req.url === '/api/tts' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              try {
                const { text, voice, rate, pitch } = JSON.parse(body);
                const { EdgeTTS } = await import('@andresaya/edge-tts');
                const tts = new EdgeTTS();

                const voiceName = voice || 'en-US-AriaNeural';
                const options = {};
                if (rate !== undefined) options.rate = rate;
                if (pitch !== undefined) options.pitch = pitch;

                await tts.synthesize(text, voiceName, options);

                // Get audio data and word boundaries
                const audioData = tts.toBase64();
                const wordBoundaries = tts.getWordBoundaries();

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  audio: audioData,
                  wordBoundaries,
                  format: 'mp3',
                }));
              } catch (err) {
                console.error('[TTS] Synthesis error:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          // Handle CORS preflight for TTS
          if (req.url.startsWith('/api/tts') && req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.statusCode = 204;
            res.end();
            return;
          }

          next();
        });
      },
    },
  ],
});
