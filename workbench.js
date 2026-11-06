const STORAGE = 'dotty-v7-workbench-demo';
const DEFAULT = { tab: 'overview', shot: 1, prompt: '', drafts: {}, ratio: '16:9', duration: '5', tasks: [], comments: [] };
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = () => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') }; } catch { return { ...DEFAULT }; } };
const save = state => { try { localStorage.setItem(STORAGE, JSON.stringify(state)); return true; } catch { return false; } };
const SHOTS = [
  {id:1, title:'林间初见', scene:'外景 · 雾林', note:'晨雾在林间流动，画面缓缓展开。', image:'./assets/inspiration-misty-forest.jpg'},
  {id:2, title:'穿过林隙', scene:'外景 · 森林', note:'雾气笼罩树林，微光落在树梢。', image:'./assets/inspiration-forest-sunbeams.jpg'},
  {id:3, title:'回望群峰', scene:'外景 · 峰林', note:'视线越过层叠的山峰，远景徐徐展开。', image:'./assets/inspiration-zhangjiajie.jpg'},
  {id:4, title:'远山', scene:'外景 · 雪山', note:'远景交代雪山环境，云影掠过山脊。', image:'./assets/inspiration-mountain-alaska.jpg'}
];
const image = './assets/project-courtyard.jpg';

export function mountWorkbench(container, { onBack, project, initialTab, locale = 'zh-CN' } = {}) {
  const t = (zh, en) => locale === 'en' ? en : zh;
  const localize = () => {
    if (locale !== 'en') return;
    const words = {
      '项目工作台':'Project workspace','本地交互演示':'Local interactive demo','概览':'Overview','镜头':'Shots','审核':'Review',
      '项目草稿':'Project draft','项目资料仅保存在当前浏览器，未连接后台。':'Project details are saved only in this browser. No backend is connected.',
      '项目名称':'Project name','创意描述':'Creative brief','创作类型':'Project type','保存本地草稿':'Save local draft','视频':'Videos',
      '尚未添加镜头':'No shots added yet','暂无生成视频':'No generated videos','暂无镜头':'No shots yet','暂无审核内容':'No reviews yet',
      '新项目是本地草稿，添加镜头功能尚未接入。':'This is a local draft. Adding shots is not connected yet.',
      '本地草稿暂无审核记录。':'This local draft has no review records.','未命名项目':'Untitled project',
      '当前项目 / 第 02 集':'Current project / Episode 02','从故事，走向画面。':'From story to screen.',
      '继续整理镜头与参考，让每一个画面有迹可循。':'Keep your shots and references together, from idea to image.',
      '继续镜头创作':'Continue creating','项目参考画面 · 非已生成视频':'Project reference · not a generated video',
      '当前剧集':'Current episode','共 5 集':'5 episodes total','第 2 集制作清单':'Episode 2 production list',
      '角色 / 场景':'Characters / Scenes','资源准备':'Assets ready','视频产出':'Videos produced','暂无已生成视频':'No generated videos yet',
      '继续创作':'Continue creating','查看镜头':'View shots','第 02 集 · 示例镜头 01':'Episode 02 · Sample shot 01',
      '从参考和描述开始，为镜头准备画面。':'Start with references and a description to prepare the shot.',
      '镜头清单':'Shot list','展示 4 个示例镜头，非实际镜头清单':'4 sample shots shown; not the actual shot list',
      '待创作':'To create','创作描述':'Creative direction','为当前镜头记录画面与动作。':'Describe the image and action for this shot.',
      '描述词':'Prompt','画幅':'Aspect ratio','演示时长':'Demo duration','5 秒':'5 sec','10 秒':'10 sec',
      '模型、实际时长与费用待产品配置。此表单仅演示交互。':'Models, actual duration and pricing await configuration. This form is for demonstration only.',
      '创建本地演示任务 ↗':'Create local demo task ↗','参考画面 · 非生成结果':'Reference image · not generated output',
      '本地演示任务':'Local demo tasks','不连接模型，不会生成视频或产生费用。':'No model is connected. No video will be generated and no fees charged.',
      '暂无演示任务。填写设置后可创建一条本地任务。':'No demo tasks yet. Fill in the settings to create a local task.',
      '已取消记录':'Record cancelled','已记录 · 未执行':'Recorded · not executed','取消本地记录':'Cancel local record',
      '集中查看作品和团队反馈。':'View creative work and team feedback in one place.',
      '实际审核 0 条':'0 actual reviews','提交审核后，可在这里查看版本与反馈。':'Versions and feedback will appear here after submission.',
      '收起流程样例 ↗':'Hide review example ↗','查看流程样例 ↗':'View review example ↗',
      '剧本 v1 · 流程样例':'Script v1 · example workflow','仅展示审阅流程，不属于实际审核记录。':'Example workflow only; this is not an actual review record.',
      '样例':'Example','晨光穿过树叶，山路在薄雾中延伸。':'Morning light filters through the leaves onto a misty mountain path.',
      '她停下脚步，望向远处。':'She stops and looks into the distance.','本地演示意见':'Local demo comments',
      '还没有演示意见。':'No demo comments yet.','添加意见':'Add a comment','记录演示意见':'Save demo comment',
      '草稿已保存在当前浏览器，未提交后台。':'Draft saved in this browser; nothing was submitted to a server.',
      '已创建本地演示任务，未连接生成服务。':'Local demo task created; no generation service is connected.',
      '意见已保存在本地演示中，未提交审核。':'Comment saved locally for this demo; it was not submitted for review.',
      '浏览器无法保存，本次更改仅在当前页面保留。':'Browser storage is unavailable; changes remain only on this page.',
      '外景 · 雾林 · 分镜计划 2 秒':'Exterior · Misty forest · Storyboard: 2 sec',
      '外景 · 森林 · 分镜计划 2 秒':'Exterior · Forest · Storyboard: 2 sec',
      '外景 · 峰林 · 分镜计划 2 秒':'Exterior · Mountain peaks · Storyboard: 2 sec',
      '外景 · 雪山 · 分镜计划 2 秒':'Exterior · Snowy mountains · Storyboard: 2 sec',
      '晨雾在林间流动，画面缓缓展开。':'Morning mist drifts through the forest as the scene unfolds.',
      '雾气笼罩树林，微光落在树梢。':'Mist covers the forest; soft light falls on the treetops.',
      '视线越过层叠的山峰，远景徐徐展开。':'The view moves across layered peaks into the distance.',
      '远景交代雪山环境，云影掠过山脊。':'A wide shot reveals the snowy range beneath passing clouds.'
    };
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || parent.closest('textarea, input, .wb-comments, .wb-project-name b, .wb-breadcrumb')) return;
      const raw = node.nodeValue; const key = raw.trim(); let value = words[key];
      if (!value && /^示例镜头 \d+$/.test(key)) value = key.replace('示例镜头','Sample shot');
      if (!value && /^镜头 \d+$/.test(key)) value = key.replace('镜头','Shot');
      if (!value && /^日月 \/ 第 02 集 \/ 示例镜头 \d+$/.test(key)) value = key.replace('第 02 集','Episode 02').replace('示例镜头','Sample shot');
      if (!value && /^示例镜头 \d+ \/ /.test(key)) value = key.replace('示例镜头','Sample shot');
      if (!value && /^本地演示任务 · /.test(key)) value = key.replace('本地演示任务','Local demo task').replace(/ 秒$/, ' sec');
      if (value) node.nodeValue = raw.replace(key, value);
    });
    const attributes = {'返回首页':'Back to home','项目导航':'Project navigation','打开镜头工作台':'Open shot workspace',
      '描述你想要的画面、动作和氛围…':'Describe the image, action and atmosphere…','输入对样例的意见…':'Add a comment on this example…',
      '山林项目参考画面':'Project reference image'};
    container.querySelectorAll('[aria-label], [placeholder], img[alt]').forEach(el=>{
      for (const attr of ['aria-label','placeholder','alt']) {
        const value=el.getAttribute(attr); if(attributes[value]) el.setAttribute(attr,attributes[value]);
        else if(attr==='alt' && value?.endsWith('的参考画面')) el.setAttribute(attr,`Reference image for ${value.slice(0,-5)}`);
      }
    });
  };
  container.classList.add('workbench');
  const projectKey = project ? `${STORAGE}:project:${encodeURIComponent(project.id || project.title || 'untitled')}` : STORAGE;
  let state = project ? (() => { try { return { ...DEFAULT, draftTitle: project.title || '', draftIdea: project.idea || '', draftType: project.type || '', ...JSON.parse(localStorage.getItem(projectKey) || '{}') }; } catch { return { ...DEFAULT, draftTitle: project.title || '', draftIdea: project.idea || '', draftType: project.type || '' }; } })() : read();
  if (['overview','shots','review'].includes(initialTab)) state.tab = initialTab;
  if (!['overview','shots','review'].includes(state.tab)) state.tab = 'overview';
  if (!SHOTS.some(s => s.id === state.shot)) state.shot = 1;
  let sampleOpen = false;
  let notice = '';
  const persist = () => { try { localStorage.setItem(projectKey, JSON.stringify(state)); } catch { notice = '浏览器无法保存，本次更改仅在当前页面保留。'; } };
  const selected = () => SHOTS.find(s => s.id === state.shot) || SHOTS[0];
  const setTab = tab => { state.tab = tab; persist(); render(); };
  const render = () => {
    if (project) {
      const title = escapeHTML(state.draftTitle || '未命名项目');
      container.innerHTML = `<div class="wb-root"><header class="wb-header"><button class="wb-back" data-back aria-label="返回首页">←</button><span class="wb-divider"></span><div class="wb-project-name"><b>${title}</b><span>项目工作台</span></div><div class="wb-top-note"><span></span>本地交互演示</div></header><div class="wb-main"><div class="wb-breadcrumb">${t('项目','Project')} / ${title} / ${t('本地草稿','Local draft')}</div><nav class="wb-tabs" aria-label="项目导航">${[['overview','概览'],['shots','镜头'],['review','审核']].map(([id,label])=>`<button data-tab="${id}" ${state.tab===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav>${notice?`<p class="wb-notice" role="status">${escapeHTML(notice)}</p>`:''}${state.tab==='overview' ? `<section class="wb-input-panel"><p class="wb-eyebrow">LOCAL DRAFT</p><h2>项目草稿</h2><p>项目资料仅保存在当前浏览器，未连接后台。</p><form id="wb-project-form"><label>项目名称<input name="title" value="${escapeHTML(state.draftTitle)}" required maxlength="100"></label><label>创意描述<textarea name="idea" rows="5">${escapeHTML(state.draftIdea)}</textarea></label><label>创作类型<input name="type" value="${escapeHTML(state.draftType)}" maxlength="100"></label><button class="wb-primary" type="submit">保存本地草稿</button><p class="wb-form-message" role="status"></p></form></section><div class="wb-stat-grid"><div><span>镜头</span><strong>0</strong><p>尚未添加镜头</p></div><div><span>视频</span><strong>0</strong><p>暂无生成视频</p></div></div>` : `<section class="wb-review-empty"><div class="wb-empty-icon">◎</div><h3>${state.tab==='shots'?'暂无镜头':'暂无审核内容'}</h3><p>${state.tab==='shots'?'新项目是本地草稿，添加镜头功能尚未接入。':'本地草稿暂无审核记录。'}</p></section>`}</div></div>`;
      localize();
      container.querySelector('[data-back]').addEventListener('click',()=>{ if(typeof onBack==='function') onBack(); });
      container.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>setTab(el.dataset.tab)));
      const projectForm = container.querySelector('#wb-project-form');
      if (projectForm) projectForm.addEventListener('submit', e=>{e.preventDefault();state.draftTitle=projectForm.elements.title.value.trim();state.draftIdea=projectForm.elements.idea.value;state.draftType=projectForm.elements.type.value;if(!state.draftTitle){projectForm.elements.title.focus();return;}notice='草稿已保存在当前浏览器，未提交后台。';persist();render();});
      return;
    }
    const shot = selected();
    const taskHTML = state.tasks.length ? state.tasks.map(t => `<li class="wb-task"><span><b>镜头 ${String(t.shot).padStart(2,'0')}</b><small>本地演示任务 · ${escapeHTML(t.ratio)} · ${escapeHTML(t.duration)} 秒</small></span><span class="wb-status">${t.cancelled ? '已取消记录' : '已记录 · 未执行'}</span>${t.cancelled ? '' : `<button class="wb-text-btn" data-cancel="${escapeHTML(t.id)}">取消本地记录</button>`}</li>`).join('') : '<p class="wb-empty">暂无演示任务。填写设置后可创建一条本地任务。</p>';
    const overview = `<section class="wb-overview"><div class="wb-overview-copy"><p class="wb-eyebrow">当前项目 / 第 02 集</p><h2>从故事，走向画面。</h2><p>继续整理镜头与参考，让每一个画面有迹可循。</p><button class="wb-primary" data-tab="shots">继续镜头创作 <span>↗</span></button></div><figure class="wb-cover"><img src="${image}" alt="山林项目参考画面"><figcaption>项目参考画面 · 非已生成视频</figcaption></figure></section><div class="wb-stat-grid"><div><span>当前剧集</span><strong>02 <small>/ 05</small></strong><p>共 5 集</p></div><div><span>镜头</span><strong>92</strong><p>第 2 集制作清单</p></div><div><span>角色 / 场景</span><strong>6/6 <small>·</small> 4/4</strong><p>资源准备</p></div><div><span>视频产出</span><strong>0 <small>/ 92</small></strong><p>暂无已生成视频</p></div></div><div class="wb-section-heading"><div><p class="wb-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h3>继续创作</h3></div><button class="wb-quiet" data-tab="shots">查看镜头 <span>↗</span></button></div><div class="wb-recent"><img src="${SHOTS[0].image}" alt=""><div><span>第 02 集 · 示例镜头 01</span><h4>林间初见</h4><p>从参考和描述开始，为镜头准备画面。</p></div><button class="wb-round" data-tab="shots" aria-label="打开镜头工作台">↗</button></div>`;
    const shots = `<div class="wb-shot-layout"><aside class="wb-shot-list"><div class="wb-column-title"><div><p class="wb-eyebrow">EPISODE 02</p><h2>镜头清单 <small>92</small></h2></div></div><p class="wb-list-hint">展示 4 个示例镜头，非实际镜头清单</p>${SHOTS.map(s=>`<button class="wb-shot ${s.id===state.shot?'is-active':''}" data-shot="${s.id}" aria-pressed="${s.id===state.shot}"><img src="${s.image}" alt=""><span><small>示例镜头 ${String(s.id).padStart(2,'0')}</small><b>${escapeHTML(s.title)}</b><em>待创作</em></span></button>`).join('')}</aside><section class="wb-editor"><div class="wb-editor-heading"><div><p class="wb-eyebrow">日月 / 第 02 集 / 示例镜头 ${String(shot.id).padStart(2,'0')}</p><h2>${escapeHTML(shot.title)}</h2><p>${escapeHTML(shot.scene)} · 分镜计划 2 秒</p></div><span class="wb-badge">待创作</span></div><div class="wb-editor-grid"><div class="wb-input-panel"><h3>创作描述</h3><p>为当前镜头记录画面与动作。</p><form id="wb-form"><label for="wb-prompt">描述词</label><textarea id="wb-prompt" name="prompt" rows="6" placeholder="描述你想要的画面、动作和氛围…">${escapeHTML(state.prompt)}</textarea><div class="wb-fields"><label>画幅<select name="ratio"><option ${state.ratio==='16:9'?'selected':''}>16:9</option><option ${state.ratio==='9:16'?'selected':''}>9:16</option><option ${state.ratio==='1:1'?'selected':''}>1:1</option></select></label><label>演示时长<select name="duration"><option value="5" ${state.duration==='5'?'selected':''}>5 秒</option><option value="10" ${state.duration==='10'?'selected':''}>10 秒</option></select></label></div><p class="wb-hint">模型、实际时长与费用待产品配置。此表单仅演示交互。</p><button class="wb-primary wb-full" type="submit">创建本地演示任务 ↗</button><p id="wb-form-message" class="wb-form-message" role="status"></p></form></div><div class="wb-preview-panel"><div class="wb-preview"><img src="${shot.image}" alt="${escapeHTML(shot.title)}的参考画面"><span>参考画面 · 非生成结果</span></div><div class="wb-preview-caption"><span>示例镜头 ${String(shot.id).padStart(2,'0')} / ${escapeHTML(shot.title)}</span><p>${escapeHTML(shot.note)}</p></div></div></div><section class="wb-tasks"><h3>本地演示任务</h3><p>不连接模型，不会生成视频或产生费用。</p><ul>${taskHTML}</ul></section></section></div>`;
    const comments = state.comments.length ? `<ul class="wb-comments">${state.comments.map(c=>`<li>${escapeHTML(c)}</li>`).join('')}</ul>` : '<p class="wb-empty">还没有演示意见。</p>';
    const review = `<section class="wb-review"><p class="wb-eyebrow">REVIEW</p><div class="wb-review-title"><div><h2>审核</h2><p>集中查看作品和团队反馈。</p></div><span class="wb-badge">实际审核 0 条</span></div><div class="wb-review-empty"><div class="wb-empty-icon">◎</div><h3>暂无审核内容</h3><p>提交审核后，可在这里查看版本与反馈。</p><button class="wb-quiet" data-sample>${sampleOpen?'收起流程样例':'查看流程样例'} ↗</button></div>${sampleOpen ? `<div class="wb-sample"><div class="wb-section-heading"><div><p class="wb-eyebrow">DEMO ONLY</p><h3>剧本 v1 · 流程样例</h3><p>仅展示审阅流程，不属于实际审核记录。</p></div><span class="wb-badge">样例</span></div><div class="wb-sample-body"><div><p class="wb-paragraph"><b>01</b> 晨光穿过树叶，山路在薄雾中延伸。</p><p class="wb-paragraph"><b>02</b> 她停下脚步，望向远处。</p></div><div><h4>本地演示意见</h4>${comments}<form id="wb-comment-form"><label for="wb-comment">添加意见</label><textarea id="wb-comment" rows="3" placeholder="输入对样例的意见…"></textarea><button class="wb-primary" type="submit">记录演示意见</button><p id="wb-comment-message" role="status"></p></form></div></div></div>` : ''}</section>`;
    container.innerHTML = `<div class="wb-root"><header class="wb-header"><button class="wb-back" data-back aria-label="返回首页">←</button><span class="wb-divider"></span><div class="wb-project-name"><b>日月</b><span>项目工作台</span></div><div class="wb-top-note"><span></span>本地交互演示</div></header><div class="wb-main"><div class="wb-breadcrumb">${t('项目','Project')} / 日月 / ${t('第 02 集','Episode 02')}</div><nav class="wb-tabs" aria-label="项目导航">${[['overview','概览'],['shots','镜头'],['review','审核']].map(([id,label])=>`<button data-tab="${id}" ${state.tab===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav>${notice?`<p class="wb-notice" role="status">${escapeHTML(notice)}</p>`:''}${state.tab==='overview'?overview:state.tab==='shots'?shots:review}</div></div>`;
    localize();
    container.querySelector('[data-back]').addEventListener('click', () => { if (typeof onBack === 'function') onBack(); });
    container.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>setTab(el.dataset.tab)));
    container.querySelectorAll('[data-shot]').forEach(el=>el.addEventListener('click',()=>{state.drafts[state.shot]=state.prompt;state.shot=Number(el.dataset.shot);state.prompt=state.drafts[state.shot] || '';persist();render();}));
    container.querySelectorAll('[data-cancel]').forEach(el=>el.addEventListener('click',()=>{const task=state.tasks.find(t=>t.id===el.dataset.cancel);if(task)task.cancelled=true;persist();render();}));
    const form=container.querySelector('#wb-form');
    if(form){form.addEventListener('input',()=>{state.prompt=form.elements.prompt.value;state.drafts[state.shot]=state.prompt;state.ratio=form.elements.ratio.value;state.duration=form.elements.duration.value;persist();});form.addEventListener('submit',e=>{e.preventDefault();state.prompt=form.elements.prompt.value;state.ratio=form.elements.ratio.value;state.duration=form.elements.duration.value;if(!state.prompt.trim()){container.querySelector('#wb-form-message').textContent=t('请先填写描述词。','Please enter a prompt.');form.elements.prompt.focus();return;}state.tasks.unshift({id:String(Date.now())+'-'+Math.random().toString(36).slice(2),shot:state.shot,ratio:state.ratio,duration:state.duration,cancelled:false});notice='已创建本地演示任务，未连接生成服务。';persist();render();});}
    const sample=container.querySelector('[data-sample]');if(sample)sample.addEventListener('click',()=>{sampleOpen=!sampleOpen;render();});
    const commentForm=container.querySelector('#wb-comment-form');if(commentForm)commentForm.addEventListener('submit',e=>{e.preventDefault();const input=container.querySelector('#wb-comment');if(!input.value.trim()){container.querySelector('#wb-comment-message').textContent=t('请先输入意见。','Please enter a comment.');input.focus();return;}state.comments.push(input.value.trim());notice='意见已保存在本地演示中，未提交审核。';persist();render();});
  };
  render();
  return () => { container.innerHTML=''; container.classList.remove('workbench'); };
}
