// Procedural SFX generator. Synthesizes the grey-box sound set into 16-bit mono
// WAV files under public/sounds/ (served by Vite at /sounds/*.wav). Run once:
//   node scripts/gen-sounds.mjs
// Re-run to regenerate after tweaking. Real assets can drop in later.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

// Deterministic PRNG so regenerated files are stable (no Math.random churn).
let seed = 0x1234abcd;
const rand = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 0xffffffff) * 2 - 1;
};

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

// Attack/release envelope (seconds).
const env = (t, dur, a = 0.005, r = 0.05) => {
  if (t < a) return t / a;
  if (t > dur - r) return Math.max(0, (dur - t) / r);
  return 1;
};

const TAU = Math.PI * 2;

// freq glide blip (sine).
function blip(dur, f0, f1, vol, a = 0.003, r = 0.04) {
  const n = (dur * SR) | 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 + (f1 - f0) * (t / dur);
    out[i] = Math.sin(TAU * f * t) * env(t, dur, a, r) * vol;
  }
  return out;
}

// Sequence of sine notes (arpeggio).
function arp(freqs, noteDur, vol) {
  const seg = (noteDur * SR) | 0;
  const out = new Float32Array(seg * freqs.length);
  freqs.forEach((f, k) => {
    for (let i = 0; i < seg; i++) {
      const t = i / SR;
      out[k * seg + i] =
        Math.sin(TAU * f * t) * env(t, noteDur, 0.004, 0.05) * vol;
    }
  });
  return out;
}

const sounds = {
  // soft rising pick-up blip
  pickup: blip(0.08, 680, 1020, 0.5),

  // square buzz + noise, descending — taking a hit
  hurt: (() => {
    const dur = 0.16;
    const n = (dur * SR) | 0;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = 300 + (120 - 300) * (t / dur);
      const sq = Math.sign(Math.sin(TAU * f * t));
      out[i] = (sq * 0.5 + rand() * 0.3) * env(t, dur, 0.002, 0.05) * 0.5;
    }
    return out;
  })(),

  // bright ascending arpeggio — level up
  levelup: arp([523, 659, 784], 0.1, 0.45),

  // low ominous rumble — boss arrival
  boss: (() => {
    const dur = 0.8;
    const n = (dur * SR) | 0;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const trem = 0.8 + 0.2 * Math.sin(TAU * 6 * t);
      const tone =
        Math.sin(TAU * 55 * t) + Math.sin(TAU * 82 * t) * 0.6;
      out[i] = (tone * 0.4 + rand() * 0.12) * trem * env(t, dur, 0.06, 0.25);
    }
    return out;
  })(),

  // triumphant fanfare — victory
  win: arp([523, 659, 784, 1047], 0.16, 0.5),

  // descending somber tone — death
  death: (() => {
    const dur = 0.6;
    const n = (dur * SR) | 0;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = 440 + (110 - 440) * (t / dur);
      const vib = Math.sin(TAU * f * t + Math.sin(TAU * 5 * t) * 1.5);
      out[i] = vib * env(t, dur, 0.01, 0.15) * 0.5;
    }
    return out;
  })(),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const path = join(OUT, name + ".wav");
  writeFileSync(path, wav(samples));
  console.log("wrote", path, (samples.length / SR).toFixed(2) + "s");
}
