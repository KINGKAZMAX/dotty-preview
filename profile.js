const STORAGE_KEY = 'dotty-v7-local-profile';
const COLORS = ['#657cb7', '#b5787f', '#5f9290', '#9a83a9'];

// Local presentation only: this is not an authenticated account.
export function setupProfile({ getLocale = () => 'zh-CN', t = text => text, locales = [], onLanguageChange = () => {}, onOpenWorkbench = () => {}, onOpenSaved = () => {}, onOpenDrafts = onOpenWorkbench, onCreateProject = () => {} } = {}) {
  const trigger = document.querySelector('#profile-trigger');
  if (!trigger) return { refresh() {}, destroy() {} };
  let state = null;
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (value && typeof value.name === 'string' && value.name.trim() && Number.isInteger(value.avatar) && value.avatar >= 0 && value.avatar < COLORS.length) state = { name: value.name.trim().slice(0, 32), avatar: value.avatar };
  } catch {}
  let popover = null, dialog = null, returnFocus = null;
  const node = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text != null) element.textContent = t(text);
    return element;
  };
  const button = (label, cls, action) => {
    const element = node('button', cls, label);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  };
  function portrait(profile, size = '') {
    const element = node('span', `profile-avatar ${size}`);
    element.style.setProperty('--avatar-color', COLORS[profile?.avatar ?? 0]);
    element.setAttribute('aria-hidden', 'true');
    if (profile?.name) element.textContent = Array.from(profile.name.trim())[0].toUpperCase();
    else element.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20v-2.4a6.5 6.5 0 0 1 13 0V20"/></svg>';
    return element;
  }
  function updateTrigger() {
    const copy = node('span', 'profile-trigger-copy');
    const title = node('strong', 'profile-trigger-name');
    title.textContent = state?.name || t('登录');
    copy.append(title, node('span', 'profile-trigger-subtitle', state ? '本地访客' : '个人空间'));
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24'); chevron.setAttribute('class', 'profile-trigger-chevron'); chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<path d="m9 5 7 7-7 7"/>';
    trigger.replaceChildren(portrait(state, 'profile-avatar-small'), copy, chevron);
    trigger.setAttribute('aria-label', t(state ? '打开个人菜单' : '打开访客菜单'));
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', String(!!popover));
  }
  function closePopover() {
    if (popover) popover.remove();
    popover = null;
    trigger.setAttribute('aria-expanded', 'false');
  }
  function closeDialog() {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    else { dialog.remove(); dialog = null; returnFocus?.focus(); }
  }
  function openDialog(title) {
    closePopover();
    closeDialog();
    returnFocus = trigger;
    dialog = node('dialog', 'profile-dialog');
    dialog.setAttribute('aria-label', t(title));
    const panel = node('div', 'profile-panel');
    const header = node('div', 'profile-panel-header');
    header.append(node('h2', '', title));
    const close = button('关闭', 'profile-close', closeDialog);
    close.setAttribute('aria-label', t('关闭'));
    close.textContent = '×';
    header.append(close);
    panel.append(header);
    dialog.append(panel);
    document.body.append(dialog);
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
    const current = dialog;
    dialog.addEventListener('close', () => { current.remove(); if (dialog === current) { dialog = null; returnFocus?.focus(); } }, { once: true });
    dialog.showModal();
    return panel;
  }
  function persist(next, error) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); state = next; updateTrigger(); return true; }
    catch { error.textContent = t('无法保存到浏览器本地存储'); return false; }
  }
  function openEditor(editing = false) {
    const panel = openDialog(editing ? '账户设置' : '以访客继续');
    const form = node('form', 'profile-form');
    const label = node('label', 'profile-field-label', '显示名称');
    const input = node('input', 'profile-input');
    input.name = 'displayName'; input.maxLength = 32; input.required = true;
    input.autocomplete = 'nickname'; input.value = state?.name ?? '';
    input.placeholder = t('输入你的显示名称');
    label.append(input); form.append(label);
    const caption = node('p', 'profile-field-label', '选择头像'); form.append(caption);
    const choices = node('div', 'profile-avatar-options');
    choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', t('选择头像'));
    let selected = state?.avatar ?? 0;
    const options = [];
    COLORS.forEach((_, index) => {
      const choice = button(null, 'profile-avatar-option', () => { selected = index; updateChoices(); });
      choice.setAttribute('aria-label', `${t('头像')} ${index + 1}`);
      choice.append(portrait({ name: input.value || '•', avatar: index }));
      options.push(choice); choices.append(choice);
    });
    function updateChoices() { options.forEach((option, index) => { option.setAttribute('aria-pressed', String(index === selected)); option.tabIndex = 0; }); }
    input.addEventListener('input', () => options.forEach(option => { option.firstChild.textContent = Array.from(input.value.trim() || '•')[0].toUpperCase(); }));
    updateChoices(); form.append(choices);
    const error = node('p', 'profile-error'); error.setAttribute('role', 'status'); form.append(error);
    const actions = node('div', 'profile-actions');
    actions.append(button('取消', 'profile-button profile-button-secondary', closeDialog));
    const save = node('button', 'profile-button profile-button-primary', editing ? '保存' : '以访客继续'); save.type = 'submit'; actions.append(save); form.append(actions);
    form.addEventListener('submit', event => {
      event.preventDefault(); const name = input.value.trim();
      if (!name) { error.textContent = t('请输入显示名称'); input.focus(); return; }
      if (persist({ name: name.slice(0, 32), avatar: selected }, error)) { closeDialog(); if (!editing) openProfile(); }
    });
    panel.append(form, node('p', 'profile-disclaimer', '本地演示，不连接真实账号。资料仅保存在此浏览器。'));
    input.focus();
  }
  function openLogin() {
    const panel = openDialog('登录');
    const hero = node('div', 'profile-login-hero');
    const mark = document.createElement('img');
    mark.className = 'profile-login-mark';
    mark.src = new URL('./assets/dotty-mark.svg', import.meta.url).href;
    mark.alt = ''; mark.setAttribute('aria-hidden', 'true');
    hero.append(mark, node('h3', 'profile-login-title', '欢迎来到 DOTTY'), node('p', 'profile-login-subtitle', '从一个点子，开始你的创作。'));
    panel.append(hero);
    const notice = node('p', 'profile-login-notice');
    notice.setAttribute('role', 'status');
    const showNotice = () => { notice.textContent = t('登录界面预览，尚未连接账号服务。'); };
    const methods = node('div', 'profile-login-methods');
    methods.append(button('使用 Google 继续', 'profile-login-provider', showNotice), button('使用 Apple 继续', 'profile-login-provider', showNotice));
    const divider = node('div', 'profile-login-divider'); divider.append(node('span', '', '或使用邮箱'));
    const label = node('label', 'profile-field-label', '邮箱');
    const input = node('input', 'profile-input'); input.type = 'email'; input.autocomplete = 'email'; input.placeholder = t('输入邮箱地址');
    label.append(input);
    const submit = button('继续', 'profile-button profile-button-primary profile-wide', showNotice);
    const guest = button('以访客继续', 'profile-login-guest', () => openEditor(false));
    panel.append(methods, divider, label, submit, notice, guest, node('p', 'profile-disclaimer', '本地演示，不连接真实账号。资料仅保存在此浏览器。'));
  }
  function runCallback(callback) { closeDialog(); closePopover(); callback(); }
  function openProfile() {
    if (!state) { openLogin(); return; }
    const panel = openDialog('个人主页');
    const identity = node('div', 'profile-identity'); identity.append(portrait(state, 'profile-avatar-large'));
    const nameWrap = node('div', 'profile-identity-text'); const name = node('strong', 'profile-name'); name.textContent = state.name; nameWrap.append(name, node('span', 'profile-muted', '本地访客')); identity.append(nameWrap); panel.append(identity);
    const list = node('div', 'profile-list');
    list.append(button('我的收藏', 'profile-list-button', () => runCallback(onOpenSaved)), button('我的草稿', 'profile-list-button', () => runCallback(onOpenDrafts)), button('开始创作', 'profile-list-button', () => runCallback(onCreateProject)));
    panel.append(list, button('账户设置', 'profile-button profile-button-secondary profile-wide', openSettings));
  }
  function openSettings() {
    if (!state) { openLogin(); return; }
    const panel = openDialog('账户设置');
    const identity = node('div', 'profile-identity'); identity.append(portrait(state)); const name = node('strong', 'profile-name'); name.textContent = state.name; identity.append(name); panel.append(identity);
    panel.append(button('编辑资料', 'profile-button profile-button-secondary profile-wide', () => openEditor(true)));
    const label = node('label', 'profile-field-label profile-language-label', '语言');
    const select = node('select', 'profile-input profile-select'); select.setAttribute('aria-label', t('语言'));
    for (const locale of locales) { const option = document.createElement('option'); option.value = locale.code; option.textContent = locale.label; option.selected = locale.code === getLocale(); select.append(option); }
    select.addEventListener('change', () => { onLanguageChange(select.value); updateTrigger(); openSettings(); });
    label.append(select); if (locales.length) panel.append(label);
    const error = node('p', 'profile-error'); error.setAttribute('role', 'status'); panel.append(error);
    panel.append(button('退出本地演示', 'profile-signout', () => {
      try { localStorage.removeItem(STORAGE_KEY); state = null; updateTrigger(); closeDialog(); }
      catch { error.textContent = t('无法保存到浏览器本地存储'); }
    }));
  }
  function openLanguage() {
    const panel = openDialog('语言');
    const list = node('div', 'profile-list');
    for (const locale of locales) {
      const item = button(null, 'profile-list-button', () => { onLanguageChange(locale.code); updateTrigger(); closeDialog(); });
      item.textContent = locale.label;
      item.setAttribute('aria-pressed', String(locale.code === getLocale()));
      list.append(item);
    }
    panel.append(list);
  }
  function openPopover() {
    if (popover) { closePopover(); return; }
    popover = node('div', 'profile-popover'); popover.setAttribute('role', 'group'); popover.setAttribute('aria-label', t('个人空间'));
    const head = node('div', 'profile-popover-head'); head.append(portrait(state));
    const copy = node('div', 'profile-identity-text'); const title = node('strong', 'profile-name'); title.textContent = state?.name || t('访客');
    copy.append(title, node('span', 'profile-muted', state ? '本地访客' : '开始你的创作')); head.append(copy); popover.append(head);
    const items = node('div', 'profile-popover-items');
    const entries = state ? [['个人主页', openProfile], ['我的收藏', () => runCallback(onOpenSaved)], ['我的草稿', () => runCallback(onOpenDrafts)], ['账户设置', openSettings], ['语言', openLanguage]] : [['登录', openLogin], ['我的收藏', () => runCallback(onOpenSaved)], ['我的草稿', () => runCallback(onOpenDrafts)], ['语言', openLanguage]];
    for (const [label, action] of entries) { const item = button(label, 'profile-menu-item', action); items.append(item); }
    popover.append(items); document.body.append(popover);
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(264, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right + 12));
    popover.style.width = `${width}px`; popover.style.left = `${left}px`;
    const top = Math.max(12, Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom - popover.offsetHeight));
    popover.style.top = `${top}px`; trigger.setAttribute('aria-expanded', 'true');
    items.querySelector('button')?.focus();
  }
  function outside(event) { if (popover && !popover.contains(event.target) && !trigger.contains(event.target)) closePopover(); }
  function keydown(event) { if (event.key === 'Escape' && popover) { closePopover(); trigger.focus(); } }
  function reposition() { closePopover(); }
  trigger.addEventListener('click', openPopover); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keydown); window.addEventListener('resize', reposition); window.addEventListener('scroll', reposition, true); updateTrigger();
  return {
    refresh() { closePopover(); updateTrigger(); },
    destroy() { closePopover(); closeDialog(); trigger.removeEventListener('click', openPopover); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keydown); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); }
  };
}
