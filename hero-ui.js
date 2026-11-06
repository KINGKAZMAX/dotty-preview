/** The hero shares one theme clock with the floating image field. */
const THEMES = [
  { phrase: '从一个点子开始', placeholder: '一句灵感，或一个你想寻找的画面', images: ['inspiration-forest-sunbeams.jpg', 'project-courtyard.jpg'] },
  { phrase: '从一束光影开始', placeholder: '搜索场景、人物、光影…', images: ['inspiration-window-light.jpg', 'inspiration-portrait-shadow.jpg'] },
  { phrase: '从一次想象开始', placeholder: '输入创作点子或搜索参考', images: ['project-scifi-city.jpg', 'inspiration-mountain-alaska.jpg'] },
  { phrase: '从一帧画面开始', placeholder: '一句灵感，或一个你想寻找的画面', images: ['inspiration-misty-forest.jpg', 'inspiration-film-hallway.jpg'] }
];
const PERIOD = 4000, MAX_WAIT = 10000;

function hsvToHex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4-k, 1)))); };
  return '#' + [f(5), f(3), f(1)].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function hexToHsv(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(...rgb), min = Math.min(...rgb), d = max - min;
  let h = 0;
  if (d) h = max === rgb[0] ? 60 * (((rgb[1]-rgb[2])/d + 6) % 6) : max === rgb[1] ? 60 * ((rgb[2]-rgb[0])/d + 2) : 60 * ((rgb[0]-rgb[1])/d + 4);
  return {h, s: max ? d/max : 0, v: max};
}

/** onCycle(index) fires immediately and after each visible 4s cycle.
 * onColor({hex, hue}) is called only when the visitor applies a color. */
export function setupHeroUI({ onCycle = () => {}, translate = text => text, reducedMotion, onColor = () => {} } = {}) {
  const hero = document.querySelector('.hero');
  const originalWord = document.querySelector('#rotating-word');
  const originalImages = hero?.querySelector('.title-images');
  const form = document.querySelector('#search-form');
  const input = document.querySelector('#hero-search');
  const inner = form?.querySelector('.search-inner');
  const trigger = form?.querySelector('.search-action');
  if (!hero || !originalWord || !originalImages || !form || !input || !inner || !trigger) return { destroy() {}, setLocale() {} };

  let tr = translate, index = 0, timer, cleanupTimer, inView = true, destroyed = false, generation = 0;
  const label = text => {
    const translated = tr(text);
    const fallback = {'从一帧画面开始': 'starts with a frame', '按颜色探索灵感': 'Explore by color', '选择颜色': 'Choose a color', '色相': 'Hue', '应用颜色': 'Apply color', '关闭': 'Close'};
    return translated === text && document.documentElement.lang.toLowerCase().startsWith('en') ? (fallback[text] || text) : translated;
  };
  const motionQuery = typeof reducedMotion === 'object' && reducedMotion ? reducedMotion : matchMedia('(prefers-reduced-motion: reduce)');
  const isReduced = () => typeof reducedMotion === 'boolean' ? reducedMotion : motionQuery.matches;
  const listeners = new AbortController();
  const listen = (node, name, fn, opts = {}) => node.addEventListener(name, fn, {...opts, signal: listeners.signal});
  const originalPlaceholder = input.getAttribute('placeholder');
  const originalType = trigger.getAttribute('type');
  const originalLabel = trigger.getAttribute('aria-label');
  const titleWrap = document.createElement('span');
  titleWrap.className = 'hero-ui-title-wrap';
  originalWord.before(titleWrap);
  const makeLayer = (themeIndex) => {
    const layer = document.createElement('span'); layer.className = 'hero-ui-title-layer';
    const word = document.createElement('span'); word.className = 'hero-ui-word'; word.textContent = label(THEMES[themeIndex].phrase);
    const images = originalImages.cloneNode(true);
    images.querySelectorAll('img').forEach((image, i) => { image.src = `./assets/${THEMES[themeIndex].images[i]}`; });
    layer.append(word, images); return layer;
  };
  originalWord.remove(); originalImages.remove();
  let layer = makeLayer(index); titleWrap.append(layer);

  const placeholder = document.createElement('span');
  placeholder.className = 'hero-ui-placeholder'; placeholder.setAttribute('aria-hidden', 'true');
  inner.classList.add('hero-ui-search-inner'); inner.append(placeholder); input.placeholder = '';
  const submit = document.createElement('button');
  submit.type = 'submit'; submit.className = 'hero-ui-submit'; submit.hidden = true;
  submit.setAttribute('aria-label', label('搜索创作参考'));
  submit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  inner.append(submit);
  const updateInput = () => { const hasValue = input.value.length > 0; submit.hidden = !hasValue; placeholder.hidden = hasValue; };
  listen(input, 'input', updateInput); updateInput();

  trigger.type = 'button'; trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', label('按颜色探索灵感'));
  form.classList.add('hero-ui-form');
  const popover = document.createElement('div'); popover.className = 'hero-ui-color'; popover.hidden = true;
  popover.id = 'hero-color-picker'; popover.setAttribute('role', 'dialog'); popover.setAttribute('aria-label', label('选择颜色'));
  trigger.setAttribute('aria-controls', popover.id);
  popover.innerHTML = '<div class="hero-ui-color-top"><strong data-label="title"></strong><button class="hero-ui-color-close" type="button" aria-label="关闭">×</button></div><div class="hero-ui-saturation" aria-hidden="true"><span class="hero-ui-color-dot"></span></div><label class="hero-ui-hue-label"><span data-label="hue"></span><input class="hero-ui-hue" type="range" min="0" max="360" value="0"></label><div class="hero-ui-color-bottom"><label><span>HEX</span><input class="hero-ui-hex" type="text" inputmode="text" maxlength="7" spellcheck="false" value="#CC6666" aria-label="HEX"></label><button class="hero-ui-color-apply" type="button" data-label="apply"></button></div>';
  form.append(popover);
  const square = popover.querySelector('.hero-ui-saturation'), dot = popover.querySelector('.hero-ui-color-dot');
  const hueInput = popover.querySelector('.hero-ui-hue'), hexInput = popover.querySelector('.hero-ui-hex');
  const apply = popover.querySelector('.hero-ui-color-apply'), closeButton = popover.querySelector('.hero-ui-color-close');
  let hsv = hexToHsv('#CC6666');
  const paintColor = (updateHex = true) => {
    square.style.setProperty('--hero-hue', `${hsv.h}deg`);
    dot.style.left = `${hsv.s * 100}%`; dot.style.top = `${(1-hsv.v)*100}%`;
    hueInput.value = String(Math.round(hsv.h)); if (updateHex) hexInput.value = hsvToHex(hsv.h, hsv.s, hsv.v);
    hexInput.setAttribute('aria-invalid', 'false');
  };
  paintColor();
  const openPicker = () => { popover.hidden = false; trigger.setAttribute('aria-expanded', 'true'); hexInput.focus({preventScroll:true}); };
  const closePicker = (focus = false) => { popover.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focus) trigger.focus({preventScroll:true}); };
  listen(trigger, 'click', () => popover.hidden ? openPicker() : closePicker());
  listen(closeButton, 'click', () => closePicker(true));
  listen(document, 'pointerdown', event => { if (!popover.hidden && !popover.contains(event.target) && !trigger.contains(event.target)) closePicker(); });
  listen(document, 'keydown', event => { if (event.key === 'Escape' && !popover.hidden) { event.preventDefault(); closePicker(true); } });
  listen(hueInput, 'input', () => { hsv.h = Number(hueInput.value); paintColor(); });
  const setSquare = event => { const box = square.getBoundingClientRect(); hsv.s = Math.max(0, Math.min(1, (event.clientX-box.left)/box.width)); hsv.v = 1 - Math.max(0, Math.min(1, (event.clientY-box.top)/box.height)); paintColor(); };
  listen(square, 'pointerdown', event => { square.setPointerCapture(event.pointerId); setSquare(event); });
  listen(square, 'pointermove', event => { if (square.hasPointerCapture(event.pointerId)) setSquare(event); });
  listen(hexInput, 'input', () => { if (/^#[0-9a-f]{6}$/i.test(hexInput.value)) { hsv = hexToHsv(hexInput.value); paintColor(false); } else hexInput.setAttribute('aria-invalid', 'true'); });
  listen(hexInput, 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); apply.click(); } });
  listen(apply, 'click', () => { if (!/^#[0-9a-f]{6}$/i.test(hexInput.value)) { hexInput.setAttribute('aria-invalid', 'true'); hexInput.focus(); return; } onColor({hex: hexInput.value.toUpperCase(), hue: hsv.h, saturation: hsv.s, brightness: hsv.v}); closePicker(true); });

  const refreshLocale = () => {
    layer.querySelector('.hero-ui-word').textContent = label(THEMES[index].phrase);
    placeholder.textContent = label(THEMES[index].placeholder);
    submit.setAttribute('aria-label', label('搜索创作参考')); trigger.setAttribute('aria-label', label('按颜色探索灵感'));
    popover.setAttribute('aria-label', label('选择颜色')); closeButton.setAttribute('aria-label', label('关闭'));
    popover.querySelector('[data-label=title]').textContent = label('选择颜色');
    popover.querySelector('[data-label=hue]').textContent = label('色相');
    apply.textContent = label('应用颜色');
  };
  const advance = () => {
    index = (index + 1) % THEMES.length; const old = layer; layer = makeLayer(index); layer.classList.add('hero-ui-enter');
    old.classList.add('hero-ui-exit'); old.setAttribute('aria-hidden', 'true'); titleWrap.append(layer); placeholder.textContent = label(THEMES[index].placeholder);
    clearTimeout(cleanupTimer); cleanupTimer = setTimeout(() => old.remove(), 1000); onCycle(index);
  };
  const preload = theme => Promise.all(theme.images.map(name => new Promise(resolve => {
    const image = new Image(); image.onload = image.onerror = resolve; image.src = `./assets/${name}`;
    if (image.complete) resolve();
  })));
  const playback = () => {
    clearTimeout(timer); const ticket = ++generation;
    const paused = destroyed || document.hidden || !inView || isReduced() || form.contains(document.activeElement) || !popover.hidden;
    hero.classList.toggle('hero-ui-paused', paused);
    if (!paused) {
      const ready = preload(THEMES[(index + 1) % THEMES.length]);
      timer = setTimeout(async () => {
        await Promise.race([ready, new Promise(resolve => setTimeout(resolve, MAX_WAIT - PERIOD))]);
        if (ticket !== generation || destroyed) return;
        advance(); playback();
      }, PERIOD);
    }
  };
  refreshLocale(); onCycle(index);
  listen(document, 'visibilitychange', playback);
  listen(form, 'focusin', playback);
  listen(form, 'focusout', () => queueMicrotask(playback));
  if (motionQuery.addEventListener) listen(motionQuery, 'change', playback);
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? true; playback(); }, {threshold: .01}) : null;
  observer?.observe(hero); playback();

  return {
    setLocale(nextTranslate) { if (typeof nextTranslate === 'function') tr = nextTranslate; refreshLocale(); },
    destroy() {
      destroyed = true; playback(); clearTimeout(cleanupTimer); listeners.abort(); observer?.disconnect();
      titleWrap.before(originalWord, originalImages); titleWrap.remove();
      placeholder.remove(); submit.remove(); popover.remove(); inner.classList.remove('hero-ui-search-inner'); form.classList.remove('hero-ui-form'); hero.classList.remove('hero-ui-paused');
      if (originalPlaceholder === null) input.removeAttribute('placeholder'); else input.setAttribute('placeholder', originalPlaceholder);
      if (originalType === null) trigger.removeAttribute('type'); else trigger.setAttribute('type', originalType);
      if (originalLabel === null) trigger.removeAttribute('aria-label'); else trigger.setAttribute('aria-label', originalLabel);
      trigger.removeAttribute('aria-haspopup'); trigger.removeAttribute('aria-expanded'); trigger.removeAttribute('aria-controls');
    }
  };
}
