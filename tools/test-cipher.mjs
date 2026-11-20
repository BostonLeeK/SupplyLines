// Intercepted cipher: a spy who gets in hands its player a code to break; cracking it opens the enemy radio.
//   node tools/test-cipher.mjs
import fs from 'fs';
import assert from 'assert/strict';
import { createEngine } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const E = createEngine(NET), K = E.K;
const p = E.addPlayer('p1', 0), evs = []; E.onEvent(e => evs.push(e));
for (let k = 0; k < 400; k++) E.step(0.1);

// scoring: right place, then right symbol in the wrong place
assert.deepEqual(E.cipherScore([0, 1, 2, 3], [0, 1, 2, 3]), [4, 0]);
assert.deepEqual(E.cipherScore([0, 1, 2, 3], [3, 2, 1, 0]), [0, 4]);
assert.deepEqual(E.cipherScore([0, 1, 2, 3], [0, 4, 5, 1]), [1, 1]);
assert.equal(E.cipherMarks([0, 1, 2, 3], [0, 4, 5, 1]), 'hxxn');
assert.equal(K.CIPHER_SYMS, 10, 'the key is made of digits');

assert.equal(E.command('p1', { type: 'cipher', g: [0, 1, 2, 3] }).ok, false, 'no cipher before a spy');

// a successful spy hands out a cipher (retry past the 1-in-4 catch)
const enemy = E.cities.find(c => E.S.owner[c.i] === 1);
for (let k = 0; k < 40 && !p.cipher; k++) { p.cp = 99; E.S.spies = []; E.command('p1', { type: 'spy', city: enemy.i }); }
assert.ok(p.cipher, 'cipher after a successful spy');
const view = E.publicPlayer(p).cipher;
assert.equal(view.code, undefined, 'the code never leaves the server while the cipher is open');
assert.equal(view.max, K.CIPHER_TRIES);

// a second spy does not replace a cipher that is still being worked on
const first = p.cipher; p.cp = 99; E.S.spies = []; E.command('p1', { type: 'spy', city: enemy.i }); assert.equal(p.cipher, first);

// bad guesses are refused and cost no try
assert.equal(E.command('p1', { type: 'cipher', g: [0, 0, 1, 2] }).ok, false, 'repeats refused');
assert.equal(E.command('p1', { type: 'cipher', g: [0, 1, 2] }).ok, false, 'short guess refused');
assert.equal(E.command('p1', { type: 'cipher', g: [0, 1, 2, 12] }).ok, false, 'not a digit refused');
assert.equal(p.cipher.tries.length, 0);

// solve it the way a player would: only ever guess codes that fit every answer so far
const all = [];
const Z = K.CIPHER_SYMS;
for (let a = 0; a < Z; a++) for (let b = 0; b < Z; b++) for (let c = 0; c < Z; c++) for (let d = 0; d < Z; d++) { const g = [a, b, c, d]; if (new Set(g).size === 4) all.push(g); }
let cand = all, res;
for (;;) {
  // the last try reads the key off the server, so the winning path is always covered
  const g = p.cipher.tries.length === K.CIPHER_TRIES - 1 ? p.cipher.code.slice() : cand[(Math.random() * cand.length) | 0]; res = E.command('p1', { type: 'cipher', g }); assert.ok(res.ok); assert.equal(res.marks.length, K.CIPHER_LEN);
  if (res.done) break;
  cand = cand.filter(x => E.cipherMarks(x, g) === res.marks);
}
if (res.done === 'won') {
  assert.ok(E.decrypted(0) && !E.decrypted(1), 'the radio opens for the solver\'s faction only');
  assert.ok(evs.some(e => e.k === 'decrypt' && e.f === 0));
  assert.deepEqual(E.publicPlayer(p).cipher.code, p.cipher.code, 'a finished cipher shows its code');
  assert.equal(E.command('p1', { type: 'cipher', g: [0, 1, 2, 3] }).ok, false, 'no guesses after it is solved');
  // enemy convoys heading for our cities show through the fog; the enemy's own view is unchanged
  const snap = E.snapshot(0);
  assert.equal(snap.decrypt.length, 1); assert.equal(E.snapshot(1).decrypt.length, 0);
  const incoming = E.S.convoys.filter(c => c.f === 1 && !c.drop && E.S.owner[c.nodes[c.nodes.length - 1]] === 0);
  for (const c of incoming) assert.ok(snap.conv.some(x => x[0] === c.id), 'incoming convoy visible');
  // the radio goes quiet again
  for (let k = 0; k < (K.DECRYPT_TIME + K.DECRYPT_BONUS * K.CIPHER_TRIES) * 10 + 10; k++) E.step(0.1);
  assert.ok(!E.decrypted(0)); assert.ok(evs.some(e => e.k === 'decrypt_end'));
  assert.equal(p.cipher, null, 'the finished cipher is cleared');
} else assert.fail('the cipher should be solved');

// a cipher left alone expires
p.cipher = null; for (let k = 0; k < 40 && !p.cipher; k++) { p.cp = 99; E.S.spies = []; E.command('p1', { type: 'spy', city: enemy.i }); }
for (let k = 0; k < (K.CIPHER_TIME + 25) * 10; k++) E.step(0.1);
assert.equal(E.publicPlayer(p).cipher, null, 'an ignored cipher expires');

// state survives a save and load
const M = createEngine(NET); M.load(JSON.parse(JSON.stringify(E.save()))); assert.ok(Array.isArray(M.S.decrypt));
console.log('cipher ok', res.done, 'in', first.tries.length, 'tries');
