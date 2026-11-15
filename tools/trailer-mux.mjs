// Joins a frame-by-frame trailer render with its audio pass: finds the sync click 0.5 s before trailer second 0,
// cuts the audio there, normalises loudness for the web and muxes into one mp4.
// node tools/trailer-mux.mjs media/trailer-en-video.mp4 media/trailer-en-audio.webm media/supply-lines-trailer-en.mp4
import { execFileSync, spawnSync } from 'child_process';
const [video, audio, out] = process.argv.slice(2);
if (!out) { console.log('usage: node tools/trailer-mux.mjs <video.mp4> <audio.webm> <out.mp4>'); process.exit(1); }
// the click is the first sound in the file: where the leading silence ends
const r = spawnSync('ffmpeg', ['-v', 'info', '-i', audio, '-af', 'silencedetect=noise=-40dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' });
const m = /silence_end:\s*([\d.]+)/.exec(r.stderr);
if (!m) throw new Error('sync click not found');
const start = +m[1] + 0.5;
console.log('click at', m[1], '→ trailer second 0 at', start.toFixed(3), 's of the audio');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-ss', start.toFixed(3), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log('done', out);
