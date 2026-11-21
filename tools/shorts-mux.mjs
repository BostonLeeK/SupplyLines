// Final cut of a short: the frame-by-frame video, the game's sounds and music bed (ducked under the voice), and the voice
// lines placed at their beats; loudness set for phones (-14 LUFS).
//   node tools/shorts-mux.mjs <id> <lang>
// in:  media/short-<id>-<lang>-video.mp4, media/short-<id>-<lang>-audio.webm (optional), media/shorts/<id>-<lang>/timeline.json + beat files
// out: media/shorts/supply-lines-<id>-<lang>.mp4
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), media = path.join(root, 'media');
const [id, lang = 'en'] = process.argv.slice(2);
if (!id) { console.log('usage: node tools/shorts-mux.mjs <id> <lang>'); process.exit(1); }
const dir = path.join(media, 'shorts', `${id}-${lang}`), tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
const video = path.join(media, `short-${id}-${lang}-video.mp4`), game = path.join(media, `short-${id}-${lang}-audio.webm`), out = path.join(media, 'shorts', `supply-lines-${id}-${lang}.mp4`);
if (!fs.existsSync(video)) { console.error('no video yet:', path.relative(root, video)); process.exit(1); }

const inputs = ['-i', video], parts = []; let n = 1;
// the game audio pass starts with a click 0.5 s before second 0 of the short: cut there
let gameIn = -1;
if (fs.existsSync(game)) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', game, '-af', 'silencedetect=noise=-40dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /silence_end:\s*([\d.]+)/.exec(r.stderr); if (!m) throw new Error('sync click not found in the game audio');
  inputs.push('-i', game); gameIn = n++; parts.push(`[${gameIn}:a]atrim=start=${(+m[1] + 0.5).toFixed(3)},asetpts=PTS-STARTPTS,volume=0.9[game]`);
}
const voices = tl.beats.filter(b => b.file && fs.existsSync(path.join(dir, b.file)));
for (const b of voices) { inputs.push('-i', path.join(dir, b.file)); const ms = Math.round(b.t0 * 1000); parts.push(`[${n}:a]aresample=48000,adelay=${ms}|${ms}[v${n}]`); n++; }
let mixOut;
if (voices.length) {
  parts.push(`${voices.map((_, k) => `[v${k + (gameIn > 0 ? 2 : 1)}]`).join('')}amix=inputs=${voices.length}:normalize=0,volume=1.6[voice]`);
  if (gameIn > 0) { parts.push('[voice]asplit=2[vs][vm]', '[game][vs]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=350[duck]', '[duck][vm]amix=inputs=2:normalize=0[mix]'); mixOut = 'mix'; }
  else mixOut = 'voice';
} else if (gameIn > 0) mixOut = 'game';
const args = ['-y', '-v', 'error', ...inputs];
if (mixOut) { parts.push(`[${mixOut}]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]`); args.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k'); }
else args.push('-map', '0:v');
args.push('-c:v', 'copy', '-t', String(tl.dur), '-movflags', '+faststart', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log('→', path.relative(root, out), `(${tl.dur.toFixed(1)} s, voice: ${tl.provider}, ${voices.length} lines${gameIn > 0 ? ', game sound' : ''})`);
