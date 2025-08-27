let ctx = null, buffer = null, src = null;
let startAt = 0;
let pauseTime = 0;

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
  startAt = ctx.currentTime - fromSec;
  src.start(0, fromSec);
}

export function stop() { if (src) { try { src.stop(); } catch {} src.disconnect(); } src = null; }
export function pause() { if (!ctx) return; pauseTime = getTime(); stop(); }
export function resume() { play(pauseTime); }
export function getTime() { return ctx ? Math.max(0, ctx.currentTime - startAt) : 0; }
