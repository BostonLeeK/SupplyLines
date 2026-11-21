// Voice-over for a short: one audio file per beat, with the time of every word, and the timeline the director films to.
//   node tools/shorts-voice.mjs <id|all> <en|uk|all>
// Voices, best first:
//   ElevenLabs      ELEVENLABS_API_KEY set (in the shell or in .env): multilingual v2 with exact word timings.
//                   ELEVENLABS_VOICE (or ELEVENLABS_VOICE_EN / _UK) picks the voice; the default is "Adam".
//   macOS `say`     no key, English only: a rough draft voice to check pacing; word timings are estimated.
//   silent          no key and no system voice (Ukrainian on most Macs): captions only, timed for reading.
// Output: media/shorts/<id>-<lang>/beat-<k>.<mp3|aiff>, timeline.json and captions.srt.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { for (const l of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
const { shorts } = JSON.parse(fs.readFileSync(path.join(root, 'tools/shorts/scripts.json'), 'utf8'));
const [idArg = 'all', langArg = 'all'] = process.argv.slice(2);
const LEAD = 0.35, GAP = 0.3, TAIL = 0.4;
const KEY = process.env.ELEVENLABS_API_KEY, MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const voiceId = lang => process.env['ELEVENLABS_VOICE_' + lang.toUpperCase()] || process.env.ELEVENLABS_VOICE || 'pNInz6obpgDQGcFmaJgB'; // Adam
const SAY_VOICE = { en: process.env.SAY_VOICE_EN || 'Daniel', uk: process.env.SAY_VOICE_UK || '' };
const hasSayVoice = v => { try { return !!v && execFileSync('say', ['-v', '?'], { encoding: 'utf8' }).split('\n').some(l => l.startsWith(v + ' ')); } catch { return false; } };

// spread a line's duration over its words by length: good enough for captions when no real timings exist
function estimateWords(text, dur, t0 = 0) {
  const words = text.split(/\s+/).filter(Boolean), w = words.map(x => x.length + 1.5 + (/[.,;:!?—]$/.test(x) ? 2 : 0)), tot = w.reduce((a, b) => a + b, 0);
  let t = t0; return words.map((x, k) => { const d = dur * w[k] / tot, r = [x, +t.toFixed(3), +(t + d * 0.92).toFixed(3)]; t += d; return r; });
}
// ElevenLabs gives start and end times per character: join them into words
function wordsFromAlignment(al) {
  const out = []; let cur = null;
  al.characters.forEach((ch, k) => {
    if (/\s/.test(ch)) { if (cur) out.push(cur); cur = null; return; }
    if (!cur) cur = [ch, al.character_start_times_seconds[k], al.character_end_times_seconds[k]];
    else { cur[0] += ch; cur[2] = al.character_end_times_seconds[k]; }
  });
  if (cur) out.push(cur);
  return out.map(([w, a, b]) => [w, +a.toFixed(3), +b.toFixed(3)]);
}
async function eleven(text, lang, file) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId(lang)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json(); fs.writeFileSync(file, Buffer.from(j.audio_base64, 'base64'));
  const words = wordsFromAlignment(j.alignment), dur = words.length ? words[words.length - 1][2] : 0;
  return { dur, words };
}
function sayVoice(text, lang, file) {
  execFileSync('say', ['-v', SAY_VOICE[lang], '-r', '185', '-o', file, text]);
  const info = execFileSync('afinfo', [file], { encoding: 'utf8' }), m = /estimated duration:\s*([\d.]+)/.exec(info), dur = m ? +m[1] : 2;
  return { dur, words: estimateWords(text, dur * 0.96, 0.02) };
}
function silent(text) { const dur = Math.max(1.2, text.length * (0.062)); return { dur, words: estimateWords(text, dur) }; }

async function build(sh, lang) {
  const dir = path.join(root, 'media', 'shorts', `${sh.id}-${lang}`); fs.mkdirSync(dir, { recursive: true });
  const provider = KEY ? 'elevenlabs' : hasSayVoice(SAY_VOICE[lang]) ? 'say' : 'silent';
  let t = LEAD; const beats = [];
  for (const [k, b] of sh.beats.entries()) {
    const text = b.say[lang] || b.say.en, file = provider === 'elevenlabs' ? `beat-${k}.mp3` : provider === 'say' ? `beat-${k}.aiff` : null;
    const v = provider === 'elevenlabs' ? await eleven(text, lang, path.join(dir, file)) : provider === 'say' ? sayVoice(text, lang, path.join(dir, file)) : silent(text);
    const len = Math.max(v.dur + (b.pad ?? GAP), b.min || 0);
    beats.push({ k, scene: b.scene, t0: +t.toFixed(3), t1: +(t + len).toFixed(3), text, file, voice: +v.dur.toFixed(3),
      hook: b.hook ? (b.hook[lang] || b.hook.en) : undefined, big: b.big ? (b.big[lang] || b.big.en) : undefined,
      words: v.words.map(([w, a, c]) => [w, +(t + a).toFixed(3), +(t + c).toFixed(3)]) });
    t += len;
  }
  const timeline = { id: sh.id, lang, provider, dur: +(t + TAIL).toFixed(3), cipher: sh.cipher, beats };
  fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(timeline, null, 1));
  // the same lines as an .srt, for platforms that take a caption file
  const ts = x => { const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  fs.writeFileSync(path.join(dir, 'captions.srt'), beats.map((b, k) => `${k + 1}\n${ts(b.words.length ? b.words[0][1] : b.t0)} --> ${ts(b.words.length ? b.words[b.words.length - 1][2] + 0.3 : b.t1)}\n${b.text}\n`).join('\n'));
  console.log(`${sh.id}-${lang}: ${provider}, ${timeline.dur.toFixed(1)} s, ${beats.length} beats → ${path.relative(root, dir)}`);
}

const ids = idArg === 'all' ? shorts.map(s => s.id) : [idArg], langs = langArg === 'all' ? ['en', 'uk'] : [langArg];
for (const id of ids) { const sh = shorts.find(s => s.id === id); if (!sh) { console.error('no short', id); process.exit(1); } for (const l of langs) await build(sh, l); }
