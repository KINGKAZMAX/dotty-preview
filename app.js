import { setupHeroUI } from './hero-ui.js?v=motion-v9';
import { setupHeroMotion } from './hero-motion.js?v=motion-v9';
import { assets } from './data.js';
import { mountWorkbench } from './workbench.js?v=motion-v9';
import { getLocale, setLocale, t, localize } from './i18n.js?v=motion-v9';
import { LANGUAGE_OPTIONS } from './language-options.js';
import { setupProfile } from './profile.js?v=motion-v9';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { showToast('无法保存到浏览器本地存储'); } };
const favoriteKey = 'dotty-v7-favorites';
const draftKey = 'dotty-v7-drafts';
let favorites = new Set(read(favoriteKey, []));
let drafts = read(draftKey, []);
let filter = '全部', color = 'all';
let libraryView = 'images', activeBoard = null, profileUI;
let languageChoice = read('dotty-v8-language-preview', getLocale());
if (!LANGUAGE_OPTIONS.some(option => option.code === languageChoice)) languageChoice = getLocale();
const MOODBOARDS = [
 {id:'forest-story',title:'林间的一场梦',description:'雾、光与山林的叙事',ids:['mist','forest','mountain','zhang']},
 {id:'character-story',title:'故事里的人',description:'角色、表情与服装语言',ids:['jiang','youth','blue','elder','fashi','portrait']},
 {id:'light-story',title:'光的方向',description:'用光影建立画面的情绪',ids:['window','alley','hall','forest']},
 {id:'other-worlds',title:'世界的另一种可能',description:'空间、尺度与未知的远方',ids:['courtyard','waste','scifi','mountain']}
];
let lastFocus = null, toastTimer;
const home = $('#home-view'), workbench = $('#workbench-view');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const imageFallback = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#e9ece5"/><circle cx="320" cy="166" r="7" fill="#6f8b7d"/><text x="320" y="220" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#5e6c61">参考图暂不可用</text></svg>');
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.fallback) return;
  image.dataset.fallback = 'true';
  if (image.closest('.floating-field')) image.parentElement.hidden = true;
  else image.src = imageFallback;
}, true);
// The image field fades in as textures become ready; the page remains immediately usable.
function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = t(message);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = t(text);
  return node;
}
function showDialog(dialog) {
  if (!dialog || dialog.open) return;
  lastFocus = document.activeElement;
  localize(dialog);
  dialog.showModal();
}
function setupDialog(dialog) {
  if (!dialog) return;
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (lastFocus?.isConnected) lastFocus.focus(); });
}
let destroyWorkbench;
function openWorkbench(project, initialTab = 'overview') {
  if (!workbench || !home) return;
  destroyWorkbench?.();
  home.hidden = true;
  workbench.hidden = false;
  destroyWorkbench = mountWorkbench(workbench, { project, initialTab, locale: getLocale(), onBack: () => {
    destroyWorkbench?.();
    destroyWorkbench = null;
    workbench.hidden = true;
    home.hidden = false;
    renderDrafts();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('[data-open-workbench]')?.focus();
  }});
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = workbench.querySelector('h2');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}
$$('[data-open-workbench]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); openWorkbench(undefined, button.dataset.tab || 'overview'); if (button.hasAttribute('data-focus-tasks')) workbench.querySelector('.wb-tasks')?.scrollIntoView({ block: 'start' }); }));

function setActive(container, attr, value) {
  $$(`button[${attr}]`, container).forEach(button => {
    const active = button.getAttribute(attr) === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function renderAssets() {
  const grid = $('#library-grid');
  if (!grid) return;
  if (libraryView === 'boards') { renderMoodboards(); return; }
  const search = ($('#library-search')?.value || '').trim().toLocaleLowerCase();
  const results = assets.filter(asset => {
    const matchesText = !search || [asset.title, asset.type, asset.project, asset.description, t(asset.title), t(asset.type), t(asset.description)].some(v => String(v || '').toLocaleLowerCase().includes(search));
    const matchesType = filter === '全部' || (filter === '已收藏' ? favorites.has(asset.id) : asset.type === filter);
    return matchesText && matchesType && (color === 'all' || asset.color === color) && (!activeBoard || activeBoard.ids.includes(asset.id));
  });
  grid.replaceChildren();
  results.forEach(asset => {
    const button = el('button', 'media-card');
    button.type = 'button';
    button.setAttribute('aria-label', getLocale() === 'en' ? `View ${t(asset.title)}` : `查看 ${asset.title}`);
    const imageWrap = el('span', 'media-image');
    const image = document.createElement('img');
    image.src = asset.image; image.alt = t(asset.title); image.loading = 'lazy';
    imageWrap.append(image);
    const info = el('span', 'media-info');
    info.append(el('strong', '', asset.title), el('span', '', `${t(asset.type)} · ${t(asset.project || 'DOTTY')}`));
    button.append(imageWrap, info);
    button.addEventListener('click', () => openAsset(asset));
    grid.append(button);
  });
  const count = $('#result-count'); if (count) count.textContent = getLocale() === 'en' ? `${results.length} references` : `${results.length} 个素材`;
  const empty = $('#empty-state'); if (empty) empty.hidden = results.length > 0;
  $('#active-board').hidden = !activeBoard; if (activeBoard) $('#active-board > span').textContent = t(activeBoard.title);
}
function openAsset(asset) {
  const dialog = $('#asset-dialog'); if (!dialog) return;
  dialog.replaceChildren();
  const frame = el('div', 'asset-dialog-content');
  const close = el('button', 'dialog-close', '×'); close.type = 'button'; close.setAttribute('aria-label', '关闭'); close.addEventListener('click', () => dialog.close());
  const image = document.createElement('img'); image.src = asset.image; image.alt = t(asset.title); image.className = 'asset-dialog-image';
  const body = el('div', 'asset-dialog-body');
  const title = el('h2', '', asset.title); title.id = 'asset-dialog-title'; dialog.setAttribute('aria-labelledby', title.id);
  const meta = el('p', 'asset-dialog-meta', `${t(asset.type)} · ${t(asset.project || 'DOTTY')}`);
  const desc = el('p', '', asset.description || '收藏这个素材，为下一次创作保留灵感。');
  const favorite = el('button', 'button button-dark'); favorite.type = 'button';
  const syncFavorite = () => { const saved = favorites.has(asset.id); favorite.textContent = t(saved ? '♥ 已收藏' : '♡ 收藏素材'); favorite.setAttribute('aria-pressed', String(saved)); };
  syncFavorite();
  favorite.addEventListener('click', () => {
    if (favorites.has(asset.id)) favorites.delete(asset.id); else favorites.add(asset.id);
    write(favoriteKey, [...favorites]); syncFavorite(); renderAssets();
    showToast(favorites.has(asset.id) ? '已收藏到本地' : '已取消收藏');
  });
  body.append(title, meta, desc, favorite); frame.append(close, image, body); dialog.append(frame); showDialog(dialog);
}
$('#library-search')?.addEventListener('input', renderAssets);
$('#filter-tabs')?.addEventListener('click', event => { const button = event.target.closest('button[data-filter]'); if (!button) return; filter = button.dataset.filter; setActive($('#filter-tabs'), 'data-filter', filter); renderAssets(); });
$('#color-filters')?.addEventListener('click', event => { const button = event.target.closest('button[data-color]'); if (!button) return; color = button.dataset.color; setActive($('#color-filters'), 'data-color', color); renderAssets(); });
$('#clear-filters')?.addEventListener('click', () => { activeBoard = null; filter = '全部'; color = 'all'; const input = $('#library-search'); if (input) input.value = ''; if ($('#filter-tabs')) setActive($('#filter-tabs'), 'data-filter', filter); if ($('#color-filters')) setActive($('#color-filters'), 'data-color', color); renderAssets(); });
$('#search-form')?.addEventListener('submit', event => { event.preventDefault(); activeBoard = null; setLibraryView('images'); const search = $('#library-search'); if (search) search.value = $('#hero-search')?.value || ''; filter = '全部'; color = 'all'; if ($('#filter-tabs')) setActive($('#filter-tabs'), 'data-filter', filter); if ($('#color-filters')) setActive($('#color-filters'), 'data-color', color); renderAssets(); $('#library-grid')?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' }); });

function renderDrafts() {
  const list = $('#draft-list'); if (!list) return;
  list.replaceChildren();
  if (!drafts.length) { list.append(el('p', 'draft-empty', '还没有本地草稿。创建项目后会显示在这里。')); return; }
  drafts.forEach(draft => {
    const saved = read(`dotty-v7-workbench-demo:project:${encodeURIComponent(draft.id)}`, null);
    if (saved?.draftTitle) draft.title = saved.draftTitle;
    if (saved?.draftType) draft.type = saved.draftType;
    const item = el('div', 'draft-item');
    const text = el('div', 'draft-text');
    text.append(el('strong', '', draft.title), el('span', '', `${t(draft.type)} · ${t('本地草稿')}`));
    const button = el('button', 'draft-open', '继续创作'); button.type = 'button'; button.addEventListener('click', () => openWorkbench(draft));
    item.append(text, button); list.append(item);
  });
}
function openCreate(prefillIdea = false) {
  const dialog = $('#create-dialog'); if (!dialog) return;
  dialog.replaceChildren();
  const form = el('form', 'create-form');
  const close = el('button', 'dialog-close', '×'); close.type = 'button'; close.setAttribute('aria-label', '关闭'); close.addEventListener('click', () => dialog.close());
  const title = el('h2', '', '新建创作项目'); title.id = 'create-dialog-title'; dialog.setAttribute('aria-labelledby', title.id);
  const subtitle = el('p', '', '先记录你的想法。项目将保存在当前浏览器，作为本地演示草稿。');
  const label1 = el('label', '', '项目名称'); const name = document.createElement('input'); name.name = 'title'; name.required = true; name.maxLength = 80; name.placeholder = '例如：日月影像计划'; label1.append(name);
  const label2 = el('label', '', '创作类型'); const type = document.createElement('select'); type.name = 'type'; ['影像创作', '视觉设计', '品牌项目', '其他'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; type.append(option); }); label2.append(type);
  const label3 = el('label', '', '创作想法'); const idea = document.createElement('textarea'); idea.name = 'idea'; idea.rows = 4; idea.placeholder = '写下主题、氛围或想探索的方向'; idea.value = prefillIdea ? ($('#hero-search')?.value.trim() || '') : ''; label3.append(idea);
  const submit = el('button', 'button button-dark', '创建本地草稿'); submit.type = 'submit';
  form.append(close, title, subtitle, label1, label2, label3, submit); dialog.append(form);
  form.addEventListener('submit', event => { event.preventDefault(); const project = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: name.value.trim(), type: type.value, idea: idea.value.trim() }; if (!project.title) { name.focus(); return; } drafts.unshift(project); write(draftKey, drafts); renderDrafts(); dialog.close(); showToast('本地草稿已创建'); openWorkbench(project); });
  showDialog(dialog);
}
['#create-button', '#new-project'].forEach(selector => $(selector)?.addEventListener('click', event => { event.preventDefault(); openCreate(selector === '#create-button'); }));
setupDialog($('#asset-dialog')); setupDialog($('#create-dialog'));
renderAssets(); renderDrafts();

const menu = $('#mobile-menu'), menuToggle = $('#menu-toggle');
menuToggle?.addEventListener('click', () => { if (!menu) return; const opening = menu.hidden; menu.hidden = !opening; menuToggle.setAttribute('aria-expanded', String(opening)); });
menu?.addEventListener('click', event => { if (event.target.closest('a,button')) { menu.hidden = true; menuToggle?.setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu && !menu.hidden) { menu.hidden = true; menuToggle?.setAttribute('aria-expanded', 'false'); menuToggle?.focus(); } });

const heroMotion = setupHeroMotion({hero:$('.hero'),field:$('#floating-field'),assets,reducedMotion});
const heroUI = setupHeroUI({onCycle:index=>heroMotion.setTheme(index),translate:t,reducedMotion,onColor:({hue,saturation,brightness})=>{
  const neutral=saturation<.12||brightness<.12;
  activeBoard=null; setLibraryView('images'); filter='全部'; color=neutral?'all':hue>=180&&hue<320?'blue':hue>=75&&hue<180?'teal':'warm';
  $('#library-search').value=$('#hero-search').value;
  setActive($('#filter-tabs'),'data-filter',filter); setActive($('#color-filters'),'data-color',color); renderAssets();
  $('#library').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth'});
  showToast(neutral?'当前支持暖色、青色和蓝色，已显示全部色调':`已筛选${color==='blue'?'蓝色':color==='teal'?'青色':'暖色'}调`);
}});

// Footer links use the same project and library actions as the main navigation.
$$('[data-create-project]').forEach(button => button.addEventListener('click', () => openCreate(false)));
$$('[data-library-filter]').forEach(link => link.addEventListener('click', () => {
  activeBoard = null; setLibraryView('images'); filter = link.dataset.libraryFilter; color = 'all'; $('#library-search').value = '';
  if (link.matches('button')) $('#library').scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  setActive($('#filter-tabs'), 'data-filter', filter); setActive($('#color-filters'), 'data-color', color); renderAssets();
}));
const infoDialog = $('#footer-info-dialog');
setupDialog(infoDialog);
const infoContent = {
  about: ['平台介绍', 'DOTTY 面向专业影视制作团队，连接创意、参考、分镜、生成任务与审片反馈，让每一步创作更清晰。', '当前页面为交互预览，展示产品的创作体验与工作流方向。'],
  demo: ['演示说明', '你可以探索素材、收藏参考、创建本地项目草稿，并体验镜头工作台与审片流程样例。', '真实 AI 生成、多人协作与账号系统尚未接入。日月项目原始记录为 92 个镜头；此演示展示 4 个示例，已生成视频为 0。', '素材仅用于创意参考，请勿作为已生成视频或已完成制作的证明。'],
  privacy: ['本地数据与隐私', '收藏、草稿、演示任务、意见与语言选择保存在当前浏览器中，不会同步到其他设备。', '页面没有提交这些内容的后端接口。清除本站浏览器存储会删除这些本地记录；参考图片的加载仍会产生正常网络请求。']
};
function openFooterInfo(content) {
  const body = el('div', 'footer-info-body');
  const close = el('button', 'dialog-close', '×'); close.type = 'button'; close.setAttribute('aria-label', t('关闭窗口')); close.addEventListener('click', () => infoDialog.close());
  const heading = el('h2', '', content[0]); heading.id = 'footer-info-title';
  body.append(close, heading, ...content.slice(1).map(text => el('p', '', text)));
  const done = el('button', 'button button-dark', '知道了'); done.addEventListener('click', () => infoDialog.close()); body.append(done);
  infoDialog.replaceChildren(body); infoDialog.setAttribute('aria-labelledby', heading.id); showDialog(infoDialog);
}
$$('[data-footer-info]').forEach(button => button.addEventListener('click', () => openFooterInfo(infoContent[button.dataset.footerInfo])));
const languageToggle = $('#language-toggle'), languageMenu = $('#language-menu');
languageMenu.replaceChildren(el('p', '', '语言 / LANGUAGE'));
LANGUAGE_OPTIONS.forEach(option => {const button = el('button'); button.type = 'button'; button.dataset.locale = option.code; button.append(document.createTextNode(option.label), el('span', '', '✓')); button.querySelector('span').setAttribute('aria-hidden', 'true'); languageMenu.append(button);});
languageMenu.append(el('small', 'language-preview-note', '语言界面展示'));

function closeLanguageMenu(restoreFocus = false) {
  languageMenu.hidden = true; languageToggle.setAttribute('aria-expanded', 'false');
  if (restoreFocus) languageToggle.focus({ preventScroll: true });
}
function syncLanguage() {
  localize(document);
  $('#current-language').textContent = LANGUAGE_OPTIONS.find(option => option.code === languageChoice)?.label || '简体中文';
  languageToggle.setAttribute('aria-label', `${t('切换语言')} · ${$('#current-language').textContent}`);
  $$('[data-locale]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.locale === languageChoice)));
  heroUI.setLocale(t);
  renderAssets(); renderDrafts(); profileUI?.refresh();
}
function chooseLanguage(code) {
  languageChoice = code; write('dotty-v8-language-preview', code);
  if (code === 'zh-CN' || code === 'en') setLocale(code);
  else showToast('语言界面预览，当前内容保持不变。');
  syncLanguage();
}
languageToggle.addEventListener('click', () => {
  const opening = languageMenu.hidden; languageMenu.hidden = !opening; languageToggle.setAttribute('aria-expanded', String(opening));
  if (opening) languageMenu.querySelector('[aria-pressed=true]').focus({ preventScroll: true });
});
$$('[data-locale]').forEach(button => button.addEventListener('click', () => {
  chooseLanguage(button.dataset.locale); closeLanguageMenu(true);
}));
languageMenu.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const buttons = $$('[data-locale]', languageMenu); let index = buttons.indexOf(document.activeElement);
  index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[index].focus();
});
document.addEventListener('click', event => { if (!event.target.closest('.language-picker')) closeLanguageMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !languageMenu.hidden) { event.preventDefault(); closeLanguageMenu(true); } });
syncLanguage();
const siteHeader = $('.site-header');
function syncHeaderSurface() { siteHeader?.classList.toggle('is-scrolled', window.scrollY > 32); }
window.addEventListener('scroll', syncHeaderSurface, { passive: true });
syncHeaderSurface();


function setLibraryView(view) {
  libraryView = view; if (view === 'boards') activeBoard = null;
  $$('[data-library-view]').forEach(button => {const active = button.dataset.libraryView === view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('#library-grid').hidden = view !== 'images'; $('#moodboard-grid').hidden = view !== 'boards';
  $('.library-toolbar').hidden = view === 'boards'; $('.library-meta').hidden = view === 'boards';
  $('#empty-state').hidden = true; $('#active-board').hidden = !activeBoard;
}
function renderMoodboards() {
  const query = $('#library-search').value.trim().toLowerCase();
  const boards = MOODBOARDS.filter(board => `${t(board.title)} ${t(board.description)}`.toLowerCase().includes(query));
  const grid = $('#moodboard-grid'); grid.replaceChildren();
  boards.forEach(board => {
    const card = el('button','moodboard-card'); card.type='button';
    const cover = el('span','moodboard-cover');
    board.ids.slice(0,3).forEach(id=>{const asset=assets.find(item=>item.id===id);const image=document.createElement('img');image.src=asset.image;image.alt='';image.loading='lazy';cover.append(image);});
    card.append(cover,el('strong','',board.title),el('small','',`${t(board.description)} · ${board.ids.length}`));
    card.addEventListener('click',()=>{activeBoard=board;setLibraryView('images');filter='全部';color='all';$('#library-search').value='';setActive($('#filter-tabs'),'data-filter',filter);setActive($('#color-filters'),'data-color',color);renderAssets();});
    grid.append(card);
  });
  if(!boards.length) grid.append(el('p','moodboard-empty','还没有找到这个画面'));
}
$$('[data-library-view]').forEach(button=>button.addEventListener('click',()=>{setLibraryView(button.dataset.libraryView);$('#library-search').value='';renderAssets();}));
$('#close-board').addEventListener('click',()=>{activeBoard=null;setLibraryView('boards');renderAssets();});
function openSavedReferences(){syncStudioNav('saved');activeBoard=null;setLibraryView('images');filter='已收藏';color='all';$('#library-search').value='';setActive($('#filter-tabs'),'data-filter',filter);setActive($('#color-filters'),'data-color',color);renderAssets();$('#library').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth'});}
profileUI = setupProfile({getLocale:()=>languageChoice,t,locales:LANGUAGE_OPTIONS,onLanguageChange:chooseLanguage,onOpenWorkbench:()=>openWorkbench(),onOpenSaved:openSavedReferences,onOpenDrafts:()=>$('#draft-list').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'center'}),onCreateProject:()=>openCreate(false)});
$('#sidebar-toggle').addEventListener('click',()=>{const collapsed=$('#creative-studio').classList.toggle('sidebar-collapsed');$('#sidebar-toggle').setAttribute('aria-expanded',String(!collapsed));$('#sidebar-toggle').setAttribute('aria-label',collapsed?'展开侧栏':'收起侧栏');});
function syncStudioNav(id){$$('[data-studio-nav]').forEach(item=>item.classList.toggle('active',item.dataset.studioNav===id));}
$$('[data-studio-nav]').forEach(link=>link.addEventListener('click',()=>{syncStudioNav(link.dataset.studioNav);if(link.dataset.studioNav==='explore'){activeBoard=null;setLibraryView('images');filter='全部';color='all';$('#library-search').value='';setActive($('#filter-tabs'),'data-filter',filter);setActive($('#color-filters'),'data-color',color);renderAssets();}}));
const featureTrack=$('#studio-feature-track');
function updateCarousel(){const max=featureTrack.scrollWidth-featureTrack.clientWidth;$('#feature-prev').disabled=featureTrack.scrollLeft<3;$('#feature-next').disabled=featureTrack.scrollLeft>=max-3;}
function moveCarousel(direction){featureTrack.scrollBy({left:direction*featureTrack.clientWidth*.8,behavior:reducedMotion.matches?'instant':'smooth'});}
$('#feature-prev').addEventListener('click',()=>moveCarousel(-1));$('#feature-next').addEventListener('click',()=>moveCarousel(1));featureTrack.addEventListener('scroll',updateCarousel,{passive:true});window.addEventListener('resize',updateCarousel);updateCarousel();
featureTrack.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const cards=$$('.studio-feature-card',featureTrack),index=cards.indexOf(document.activeElement),next=Math.min(cards.length-1,Math.max(0,index+(event.key==='ArrowRight'?1:-1)));cards[next].focus({preventScroll:true});cards[next].scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'nearest',inline:'center'});});
const WORLD_SETS={scenes:{filter:'场景',ids:['courtyard','mountain','zhang']},characters:{filter:'角色',ids:['jiang','blue','youth']},light:{filter:'光影',ids:['forest','window','mist']},shots:{filter:'镜头',ids:['hall','night','alley']}};
let world='scenes';
function selectWorld(key){if(!WORLD_SETS[key])return;world=key;$('.worlds-preview').dataset.previewWorld=key;$$('[data-world]').forEach(button=>{const active=button.dataset.world===key;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});const group=$('#world-images');group.replaceChildren();WORLD_SETS[key].ids.forEach((id,index)=>{const asset=assets.find(item=>item.id===id);const img=document.createElement('img');img.src=asset.image;img.alt=t(asset.title);img.style.setProperty('--image-index',index);img.loading='lazy';group.append(img);});}
$$('[data-world]').forEach(button=>{button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'&&world!==button.dataset.world)selectWorld(button.dataset.world);});button.addEventListener('focus',()=>{if(world!==button.dataset.world)selectWorld(button.dataset.world);});button.addEventListener('click',()=>selectWorld(button.dataset.world));});
$('#world-explore').addEventListener('click',()=>{activeBoard=null;setLibraryView('images');filter=WORLD_SETS[world].filter;color='all';$('#library-search').value='';setActive($('#filter-tabs'),'data-filter',filter);setActive($('#color-filters'),'data-color',color);renderAssets();});selectWorld(world);
const revealTargets=$$('.studio-heading,.studio-shortcuts,.library>.section-heading,.worlds-heading,.worlds-layout,.closing-cta-copy');
if(!reducedMotion.matches&&'IntersectionObserver' in window){document.documentElement.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target);}}),{threshold:.12});revealTargets.forEach(target=>{target.classList.add('scroll-reveal');observer.observe(target);});reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){document.documentElement.classList.remove('motion-ready');observer.disconnect();}});}
