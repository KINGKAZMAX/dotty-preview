/** DOTTY hero motion: content is supplied by the existing #floating-field renderer. */
const hero = document.querySelector('.hero');
const field = document.querySelector('#floating-field');
if (hero && field) {
  const anchors = [...field.querySelectorAll('.float-anchor')];
  const mobile = matchMedia('(max-width: 767px)');
  // Top/bottom clusters deliberately leave the central title and search area clear.
  const desktopPositions = [
    [3,18],[20,14],[34,5],[60,5],[85,13],[97,5],
    [14,35],[-1,43],[89,35],[78,45],[2,64],[16,62],
    [34,76],[64,87],[80,78],[96,70],[6,86],[19,80],
    [46,94],[70,94],[30,94],[45,1],[10,3],[75,0]
  ];
  const mobilePositions = [[3,12],[23,16],[47,10],[70,16],[86,11],[1,24],[83,25],[3,79],[37,85],[75,79]];
  anchors.forEach((anchor, i) => {
    const img = anchor.querySelector('img');
    if (!img) return;
    if (!anchor.querySelector('.hero-motion-drift')) {
      const wrap = document.createElement('span');
      wrap.className = 'hero-motion-drift';
      img.before(wrap); wrap.append(img);
    }
    const angle = parseFloat(anchor.style.getPropertyValue('--r')) || 0;
    const dir = i % 2 ? -1 : 1;
    anchor.style.setProperty('--hero-angle-start', `${angle}deg`);
    anchor.style.setProperty('--hero-angle-end', `${angle + 360 * dir}deg`);
    anchor.style.setProperty('--hero-spin-time', `${200 + (i * 37) % 121}s`);
    anchor.style.setProperty('--hero-float-time', `${14 + (i * 7) % 10}s`);
    anchor.style.setProperty('--hero-float-delay', `${-((i * 3.1) % 15)}s`);
    anchor.style.setProperty('--hero-float-y', `${i % 2 ? 7 : -8}px`);
    anchor.style.setProperty('--hero-float-x', `${i % 3 === 0 ? 3 : -3}px`);
  });
  const arrange = () => anchors.forEach((anchor, i) => {
    const point = mobile.matches ? mobilePositions[i] : desktopPositions[i % desktopPositions.length];
    anchor.classList.toggle('hero-motion-mobile-hidden', mobile.matches && !point);
    if (!point) return;
    anchor.style.setProperty('--hero-x', `${point[0]}%`);
    anchor.style.setProperty('--hero-y', `${point[1]}%`);
    if (mobile.matches) anchor.style.setProperty('--hero-size', `${40 + (i * 7) % 21}px`);
    else anchor.style.setProperty('--hero-size', anchor.style.getPropertyValue('--s') || '64px');
  });
  arrange();
  mobile.addEventListener?.('change', arrange);
  // Pause all independent CSS timelines while the hero is not visible or the tab is backgrounded.
  let inView = true;
  const updatePlayback = () => field.classList.toggle('hero-motion-paused', !inView || document.hidden);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? true; updatePlayback(); }, {threshold: 0.01});
    observer.observe(hero);
  }
  document.addEventListener('visibilitychange', updatePlayback);
}
