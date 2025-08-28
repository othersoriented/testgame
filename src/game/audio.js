let ctx = null, buffer = null, src = null;
let startAt = 0;
let pauseTime = 0;
let isPlaying = false;           // <-- NEW

export async function loadTrack(url) {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  buffer = await new Promise((ok, err) => {
    const p = ctx.decodeAudioData(arr, ok, err);
    if (p && typeof p.then === 'function') p.then(ok).catch(err);
  });
}

export async function resumeOnGesture() {
  if (ctx && ctx.state !== 'running') await ctx.resume();
}

export function play(fromSec = 0) {
  if (!ctx || !buffer) return;
  stop();
  src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  startAt   = ctx.currentTime - fromSec;
  pauseTime = fromSec;           // <-- keep our “paused” clock in sync
  src.start(0, fromSec);
  isPlaying = true;              // <-- NEW
  // optional: when the node ends naturally, flip the flag
  src.onended = () => { isPlaying = false; };
}

export function stop() {
  if (src) { try { src.stop(); } catch {} src.disconnect(); }
  src = null;
  isPlaying = false;             // <-- NEW
}

export function pause() {        // unchanged behavior, but sets isPlaying=false via stop()
  if (!ctx) return;
  pauseTime = getTime();
  stop();
}

export function resume() { play(pauseTime); }

// Only advance while actually playing
export function getTime() {
  if (!ctx) return 0;
  return isPlaying ? Math.max(0, ctx.currentTime - startAt) : (pauseTime || 0);
}

// NEW: expose the decoded file length (in seconds)
export function getDuration() {
  return buffer ? buffer.duration : 0;
}
