import { createHeroRenderer } from './hero-renderer.js?v=motion-v9';
/** Independently implemented arc-length image flow. Behavior measurements: research/v9-cosmos-motion-spec.md. */
export const MOTION = Object.freeze({
  turns: 8, radius: 1875, spacing: 250, baseVelocity: .32,
  spread: .95, sizeAttenuation: .35, cameraSize: 2500, stageMinSize: 2000,
  fade: .08, cornerRadius: 20, scrollBoost: 8, transition: .85,
  burstDuration: 3.2, burstRamp: .7, burstMultiplier: 24,
  areas: [19111, 18700, 9632]
});
const TAU = Math.PI * 2;
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const smooth = x => x * x * (3 - 2 * x);
const wrap = n => ((n % 1) + 1) % 1;

// A high resolution cumulative-distance map keeps image spacing and travel speed uniform.
function makeSpiral() {
  const resolution = 16384, steps = 4096;
  const cumulative = new Float64Array(resolution + 1);
  const point = s => {
    const angle = MOTION.turns * TAU * s, radius = MOTION.radius * (1 - s);
    return {x: radius * Math.cos(angle), y: radius * Math.sin(angle)};
  };
  let previous = point(0);
  for (let i = 1; i <= resolution; i++) {
    const current = point(i / resolution);
    cumulative[i] = cumulative[i - 1] + Math.hypot(current.x - previous.x, current.y - previous.y);
    previous = current;
  }
  const total = cumulative[resolution], table = [];
  let cursor = 1;
  for (let i = 0; i <= steps; i++) {
    const distance = total * i / steps;
    while (cursor < resolution && cumulative[cursor] < distance) cursor++;
    const fraction = (distance - cumulative[cursor - 1]) / (cumulative[cursor] - cumulative[cursor - 1] || 1);
    const s = (cursor - 1 + fraction) / resolution;
    const angle = MOTION.turns * TAU * s, radius = MOTION.radius * (1 - s);
    const dx = -MOTION.radius * Math.cos(angle) - radius * MOTION.turns * TAU * Math.sin(angle);
    const dy = -MOTION.radius * Math.sin(angle) + radius * MOTION.turns * TAU * Math.cos(angle);
    const length = Math.hypot(dx, dy) || 1;
    table.push({x: radius * Math.cos(angle), y: radius * Math.sin(angle), dx: dx / length, dy: dy / length});
  }
  return {total, table, steps, count: Math.round(total / MOTION.spacing)};
}
const spiral = makeSpiral();
export function sampleSpiral(progress) {
  const position = clamp(progress) * spiral.steps, index = Math.min(spiral.steps - 1, Math.floor(position));
  const blend = position - index, a = spiral.table[index], b = spiral.table[index + 1];
  const x = a.x + (b.x - a.x) * blend, y = a.y + (b.y - a.y) * blend;
  const radius = Math.hypot(x, y), spreadRadius = MOTION.radius * Math.pow(radius / MOTION.radius, 1 / MOTION.spread);
  const radialScale = radius ? spreadRadius / radius : 0;
  return {
    x: x * radialScale, y: y * radialScale,
    angle: Math.atan2(a.dy + (b.dy - a.dy) * blend, a.dx + (b.dx - a.dx) * blend),
    attenuation: Math.pow(clamp(spreadRadius / MOTION.radius), MOTION.sizeAttenuation),
    alpha: Math.min(1, progress / MOTION.fade, (1 - progress) / MOTION.fade)
  };
}

export function setupHeroMotion({hero, field, assets, reducedMotion}) {
  if (!hero || !field) return {setTheme() {}, inspect: () => ({}), destroy() {}};
  field.replaceChildren();
  let canvas = document.createElement('canvas');
  canvas.className = 'hero-spiral-canvas'; canvas.setAttribute('aria-hidden', 'true');
  field.append(canvas); field.dataset.motionMode = 'spiral';
  let gpu = null;
  try { gpu = createHeroRenderer(canvas); } catch {
    const fallback = canvas.cloneNode(); canvas.replaceWith(fallback); canvas = fallback;
  }
  const ctx = gpu ? null : canvas.getContext('2d', {alpha: true});
  if (!gpu && !ctx) return {setTheme() {}, inspect: () => ({state: 'unavailable'}), destroy() {}};
  let width = 1, height = 1, dpr = 1, projection = .8;
  let clock = 0, progress = 0, lastTime = 0, frame = 0, visibleCards = 0;
  let inView = true, ready = false, destroyed = false, fastScroll = 0, slowScroll = 0, lastScroll = scrollY;
  let currentDeck = [], oldDeck = null, transitionStart = -1, generation = 0, theme = -1;
  let maskCanvas, maskContext, currentVelocity = 0, renderTime = 0;
  const textures = new Map(), slotSizes = [];
  const startedAt = performance.now();
  let firstReadyClock = 0;

  const loadTexture = asset => {
    if (!textures.has(asset.id)) textures.set(asset.id, new Promise(resolve => {
      const image = new Image(); image.decoding = 'async';
      image.onload = async () => {
        try { await image.decode(); } catch {}
        // Small cached textures avoid decoding or repeatedly scaling full-size photographs per frame.
        const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
        const texture = document.createElement('canvas');
        texture.width = Math.max(1, Math.round(image.naturalWidth * scale));
        texture.height = Math.max(1, Math.round(image.naturalHeight * scale));
        texture.getContext('2d').drawImage(image, 0, 0, texture.width, texture.height);
        const mips = [texture];
        for (let level = 1; level <= 3; level++) {
          const mip = document.createElement('canvas');
          mip.width = Math.max(1, Math.round(texture.width / 2 ** level)); mip.height = Math.max(1, Math.round(texture.height / 2 ** level));
          mip.getContext('2d').drawImage(texture, 0, 0, mip.width, mip.height); mips.push(mip);
        }
        resolve({id: asset.id, image: texture, mips, ratio: image.naturalWidth / image.naturalHeight});
      };
      image.onerror = () => resolve(null);
      image.src = asset.image;
    }));
    return textures.get(asset.id);
  };
  function deckOrder(index) {
    const groups = [null,
      ['forest','window','portrait','night','hall','alley','mist'],
      ['courtyard','mountain','zhang','waste','scifi','forest','mist'],
      ['night','hall','alley','window','scifi','waste','portrait']];
    const ids = groups[index % groups.length];
    const list = ids ? assets.filter(asset => ids.includes(asset.id)) : [...assets];
    let seed = 7919 * (index + 1);
    for (let i = list.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1); [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  async function setTheme(index = 0) {
    if (index === theme) return;
    theme = index; const token = ++generation;
    const loaded = (await Promise.all(deckOrder(index).map(loadTexture))).filter(Boolean);
    if (destroyed || token !== generation || !loaded.length) return;
    if (gpu) loaded.forEach(texture => gpu.prepare(texture.image));
    oldDeck = currentDeck.length ? currentDeck : null;
    currentDeck = loaded; transitionStart = clock;
    if (!ready) {
      ready = true; clock = Math.max(0, (performance.now() - startedAt) / 1000); firstReadyClock = clock; transitionStart = -1;
      for (let i = 0; i < spiral.count; i++) slotSizes.push(dimensions(currentDeck[i % currentDeck.length], MOTION.areas[i % MOTION.areas.length]));
      field.classList.add('is-ready');
    }
    if (reducedMotion.matches) { oldDeck = null; draw(); }
    if (!frame) updatePlayback();
  }
  function resize() {
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    width = bounds.width; height = bounds.height;
    dpr = Math.min(devicePixelRatio || 1, 2, 4096 / Math.max(width, height));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const cameraSize = Math.round(MOTION.cameraSize * Math.max(width / 1920, 1));
    projection = Math.max(MOTION.stageMinSize, width) / cameraSize;
    if (!gpu) {
    maskCanvas = document.createElement('canvas'); maskCanvas.width = canvas.width; maskCanvas.height = canvas.height;
    maskContext = maskCanvas.getContext('2d');
    maskContext.translate(canvas.width / 2, canvas.height / 2);
    maskContext.scale(canvas.width * .45, canvas.height * .45);
    const radial = maskContext.createRadialGradient(0, 0, .505, 0, 0, .9);
    radial.addColorStop(0, 'rgba(0,0,0,0)'); radial.addColorStop(1, '#000');
    maskContext.fillStyle = radial; maskContext.fillRect(-2, -2, 4, 4);
    }
    if (ready) draw();
  }
  function dimensions(texture, area) {
    const h = Math.sqrt(area / texture.ratio); return {w: h * texture.ratio, h};
  }
  function roundedBox(w, h, radius) {
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(radius, w / 2, h / 2));
  }
  function paintTexture(texture, w, h, opacity, zoom = 1, blur = 0) {
    if (opacity <= .001) return;
    const source = texture.mips[Math.min(3, Math.round(blur))] || texture.image, ratio = w / h;
    let sw = source.width, sh = source.height;
    if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
    sw /= zoom; sh /= zoom;
    ctx.globalAlpha = opacity;
    ctx.filter = 'none';
    ctx.drawImage(source, (source.width - sw) / 2, (source.height - sh) / 2, sw, sh, -w / 2, -h / 2, w, h);
  }
  function draw() {
    if (!ready || !currentDeck.length) return;
    const renderStarted = performance.now();
    if (gpu) gpu.clear(); else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    }
    const transition = oldDeck ? clamp((clock - transitionStart) / MOTION.transition) : 1;
    const mix = smooth(transition), incomingZoom = 1 + .12 * Math.pow(1 - transition, 3);
    const appear = reducedMotion.matches ? 1 : clamp((clock - firstReadyClock) / .4);
    visibleCards = 0;
    for (let i = 0; i < spiral.count; i++) {
      const p = wrap(progress / 100 + i / spiral.count - .5), position = sampleSpiral(p);
      const image = currentDeck[i % currentDeck.length], oldImage = oldDeck?.[i % oldDeck.length];
      const target = slotSizes[i];
      const scale = projection * position.attenuation;
      const w = target.w * scale, h = target.h * scale;
      const x = width / 2 + position.x * projection, y = height / 2 + position.y * projection;
      const diagonal = Math.hypot(w, h) / 2;
      if (x + diagonal < 0 || x - diagonal > width || y + diagonal < 0 || y - diagonal > height || position.alpha < .001 || w < 1) continue;
      if (Math.hypot((x - width / 2) / (.45 * width), (y - height / 2) / (.45 * height)) < .505 - diagonal / Math.min(width, height)) continue;
      visibleCards++;
      if (gpu) {
        gpu.card({image,previous:oldImage,x:x*dpr,y:y*dpr,width:w*dpr,height:h*dpr,angle:position.angle,
          radius:MOTION.cornerRadius*scale*dpr,border:3*scale*dpr,alpha:position.alpha*appear,
          blend:oldImage?mix:1,zoom:incomingZoom,blur:oldImage?2.5*(1-transition):0});
        continue;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(position.angle);
      roundedBox(w, h, MOTION.cornerRadius * scale); ctx.clip();
      const alpha = position.alpha * appear;
      // A full opaque old layer under a blended new one avoids a dip in opacity during the crossfade.
      if (oldImage && transition < 1) paintTexture(oldImage, w, h, alpha * (1 - mix) / Math.max(.0001, 1 - alpha * mix));
      paintTexture(image, w, h, alpha * (oldImage ? mix : 1), incomingZoom, oldImage ? 2.5 * (1 - transition) : 0);
      ctx.filter = 'none'; ctx.globalAlpha = alpha;
      roundedBox(w, h, MOTION.cornerRadius * scale); ctx.lineWidth = 6 * scale; ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.stroke();
      ctx.restore();
    }
    if (!gpu) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(maskCanvas, 0, 0); ctx.globalCompositeOperation = 'source-over';
    }
    if (transition === 1) oldDeck = null;
    renderTime = performance.now() - renderStarted;
  }
  function tick(now) {
    frame = 0;
    if (destroyed || !ready || !inView || document.hidden || reducedMotion.matches) return;
    const dt = lastTime ? Math.min(.15, (now - lastTime) / 1000) : 0;
    lastTime = now; clock += dt;
    const velocity = dt ? Math.abs(scrollY - lastScroll) / dt : 0; lastScroll = scrollY;
    fastScroll = velocity + (fastScroll - velocity) * Math.exp(-dt / .022);
    slowScroll = fastScroll + (slowScroll - fastScroll) * Math.exp(-dt / .227);
    const burstProgress = clamp(clock / MOTION.burstDuration), ramp = Math.pow(clamp(clock / MOTION.burstRamp), 2);
    const burst = 1 + (MOTION.burstMultiplier - 1) * Math.pow(1 - burstProgress, 2) * ramp;
    currentVelocity = MOTION.baseVelocity * burst * (1 + slowScroll / 1000 * MOTION.scrollBoost);
    progress = (progress + currentVelocity * dt) % 100;
    draw(); frame = requestAnimationFrame(tick);
  }
  function updatePlayback() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; lastScroll = scrollY;
    fastScroll = 0; slowScroll = 0;
    canvas.dataset.motionState = reducedMotion.matches ? 'reduced' : (!inView || document.hidden ? 'paused' : 'running');
    if (ready && inView && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    else if (ready) draw();
  }
  const observer = new IntersectionObserver(entries => {inView = entries[0].isIntersecting; updatePlayback();}, {threshold: .01});
  observer.observe(hero);
  const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(hero);
  const onVisibility = () => updatePlayback();
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', updatePlayback);
  window.addEventListener('resize', resize, {passive: true});
  resize();
  const inspect = () => ({state: canvas.dataset.motionState, progress, speed: currentVelocity, pool: spiral.count, visible: visibleCards, pathLength: spiral.total, width, height, theme, renderTime, renderer:gpu?'webgl2':'canvas2d'});
  canvas.getMotionSnapshot = inspect;
  return {setTheme, inspect, destroy() {
    destroyed = true; generation++; cancelAnimationFrame(frame); observer.disconnect(); sizeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility); reducedMotion.removeEventListener('change', updatePlayback);
    window.removeEventListener('resize', resize); gpu?.destroy(); canvas.remove();
  }};
}
