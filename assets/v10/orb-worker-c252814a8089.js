import { grainSteps, measureSteps, inkPixels, paintPixels } from './orb-renderer-2c3b14ce8c61.js';

let canvas, ctx, grain, shape, image, running = false, next = null, paused = false;
// Yield between preparation slices so leaving the section or hiding the tab can cancel work.
async function collect(steps, valid) {
  for (;;) {
    if (!valid()) return null;
    const until = performance.now() + 6;
    do { const step = steps.next(); if (step.done) return step.value; } while (performance.now() < until);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
async function draw() {
  if (running || !next || paused) return;
  running = true;
  const state = next; next = null;
  const valid = () => !paused;
  try {
    grain ??= await collect(grainSteps(), valid);
    if (!grain || !valid()) return;
    if (!shape || shape.size !== state.size || shape.dpr !== state.dpr) {
      const prepared = await collect(measureSteps(state.size, state.dpr, grain), valid);
      if (!prepared) return;
      shape = prepared; image = null;
    }
    if (!valid()) return;
    if (canvas.width !== state.size) canvas.width = canvas.height = state.size;
    image ??= ctx.createImageData(state.size, state.size);
    paintPixels(image, shape, state.angle, state.lift, inkPixels(state.dark), inkPixels(state.light));
    ctx.putImageData(image, 0, 0);
    self.postMessage({ drawn: true, size: state.size });
  } catch { self.postMessage({ error: true }); }
  finally {
    running = false;
    if (paused) self.postMessage({ drawn: false });
    else if (next) void draw();
  }
}
self.onmessage = ({ data }) => {
  if (data.canvas) { canvas = data.canvas; ctx = canvas.getContext('2d'); if (!ctx) self.postMessage({ error: true }); return; }
  if (data.pause) { paused = true; next = null; return; }
  if (data.render) { paused = false; next = data.render; void draw(); }
};
