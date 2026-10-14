// Shared, deterministic sphere math for the worker and compatibility renderer.
const ORB_GRID = 64;
function orbRandom(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function* grainSteps() {
  const G = ORB_GRID, count = G * G, rnd = orbRandom(862104), crowd = new Float32Array(count), taken = new Uint8Array(count);
  const reach = 9, span = reach * 2 + 1, near = new Float32Array(span * span);
  for (let y = -reach; y <= reach; y++) for (let x = -reach; x <= reach; x++) near[(y + reach) * span + x + reach] = Math.exp(-(x * x + y * y) / 7.22);
  for (let i = 0; i < count; i++) crowd[i] = rnd() * 1e-4;
  const rowLeast = new Float32Array(G), rowPlace = new Int32Array(G);
  const recount = row => { let place = -1, least = Infinity; for (let i = row * G, end = i + G; i < end; i++) if (!taken[i] && crowd[i] < least) { least = crowd[i]; place = i; } rowLeast[row] = least; rowPlace[row] = place; };
  for (let row = 0; row < G; row++) recount(row);
  const order = new Float32Array(count);
  for (let step = 0; step < count; step++) {
    let py = 0; for (let row = 1; row < G; row++) if (rowLeast[row] < rowLeast[py]) py = row;
    const place = rowPlace[py], px = place % G; taken[place] = 1; order[place] = (step + .5) / count;
    for (let y = -reach; y <= reach; y++) { const row = (py + y + G) % G, line = (y + reach) * span + reach; for (let x = -reach; x <= reach; x++) crowd[row * G + (px + x + G) % G] += near[line + x]; recount(row); }
    if (step % 128 === 127) yield;
  }
  return order;
}
const LIGHT = { angle: -Math.PI * 2 * .108, lift: .56, fall: 2.4, gain: .9, floor: .02, rim: .06 };
const FALL = new Float32Array(1025); for (let i = 0; i <= 1024; i++) FALL[i] = Math.pow(i / 1024, LIGHT.fall) * LIGHT.gain;
function inkPixels(ink) {
  // Uint32Array는 같은 4바이트를 한 번에 쓴다. 바이트 배열로 만들어 엔디언과 알파 반올림을 보존한다.
  const bytes = new Uint8ClampedArray(256 * 4);
  for (let a = 0; a < 256; a++) bytes.set([ink[0], ink[1], ink[2], a * ink[3] / 255], a * 4);
  return new Uint32Array(bytes.buffer);
}
function* measureSteps(size, dpr, grain) {
  const G = ORB_GRID, cell = Math.max(1, Math.round(dpr * .62)), radius = size / 2 - dpr, middle = size / 2, outer = (1 + 1.5 / radius) ** 2;
  // 픽셀마다 일반 배열을 늘린 뒤 일곱 번 복사하던 임시 메모리를 없앤다.
  const capacity = size * size, index = new Int32Array(capacity), cx = new Float32Array(capacity), cy = new Float32Array(capacity), cz = new Float32Array(capacity), rim = new Float32Array(capacity), threshold = new Float32Array(capacity), cover = new Uint8Array(capacity);
  let used = 0;
  for (let py = 0; py < size; py++) {
    const y = (py + .5 - middle) / radius, gy = Math.floor(py / cell), sy = ((gy + .5) * cell - middle) / radius, row = (gy % G) * G;
    for (let px = 0; px < size; px++) {
      const x = (px + .5 - middle) / radius, reachSq = x * x + y * y; if (reachSq > outer) continue;
      const edge = Math.round(Math.min(1, Math.max(0, (1 - Math.sqrt(reachSq)) * radius + .5)) * 255); if (!edge) continue;
      const gx = Math.floor(px / cell), sx = ((gx + .5) * cell - middle) / radius, z = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
      index[used] = (py * size + px) * 4; cx[used] = sx; cy[used] = sy; cz[used] = z; rim[used] = LIGHT.floor + Math.pow(1 - z, 5) * LIGHT.rim; threshold[used] = grain[row + gx % G]; cover[used++] = edge;
    }
    if (py % 8 === 7) yield;
  }
  return { size, dpr, index: index.subarray(0, used), cx: cx.subarray(0, used), cy: cy.subarray(0, used), cz: cz.subarray(0, used), rim: rim.subarray(0, used), threshold: threshold.subarray(0, used), cover: cover.subarray(0, used) };
}
function paintPixels(image, shape, angle, lift, dark, light) {
  const data = new Uint32Array(image.data.buffer), side = Math.sqrt(1 - lift * lift), lx = Math.sin(angle) * side, ly = -Math.cos(angle) * side;
  const { index, cx, cy, cz, rim, threshold, cover } = shape;
  for (let k = 0; k < index.length; k++) {
    const facing = Math.max(0, Math.min(1, cx[k] * lx + cy[k] * ly + cz[k] * lift));
    data[index[k] >>> 2] = (rim[k] + FALL[(facing * 1024) | 0] > threshold[k] ? light : dark)[cover[k]];
  }
}

export { ORB_GRID, LIGHT, grainSteps, measureSteps, inkPixels, paintPixels };
