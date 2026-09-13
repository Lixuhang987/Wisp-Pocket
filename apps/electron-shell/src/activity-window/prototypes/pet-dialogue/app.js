/* PROTOTYPE — fixtures and in-memory state only. No server, file writes, or model calls. */
const root = document.querySelector('#prototype-root');
const variants = {
  A: { name: '口袋对话', hypothesis: '围绕这只桌宠，就地展开工作。' },
  B: { name: '桌面长桌', hypothesis: '先看资料，再交给负责的桌宠。' },
  C: { name: '对话手册', hypothesis: '角色在身边，长文有稳定的阅读面。' },
};
const workspaces = {
  book: { name: '读书交换日', path: '~/Documents/读书交换日' },
  writing: { name: '写作随记', path: '~/Documents/写作随记' },
  project: { name: '小工具', path: '~/Projects/小工具' },
};
const initialPets = [
  { id: 'yachiyo', name: '八千代', role: '整理资料', short: '资料', sprite: 'yachiyo', prompt: '先认真阅读我交付的资料。把事实、还缺什么、下一步分别说明。表达温和，先给简短结论；引用资料时标出依据。', tone: '简洁温和', version: 1, defaultWorkspaceId: 'book' },
  { id: 'miku', name: 'Miku', role: '写作与表达', short: '写作', sprite: 'miku', prompt: '帮助我把想法写成自然、有节奏的文字。保留我的意思，避免空话。先给可以直接使用的一版，再简短说明还可怎么改。', tone: '轻快自然', version: 1, defaultWorkspaceId: 'book' },
  { id: 'xiaoba', name: '小八', role: '执行与收尾', short: '执行', sprite: 'yachiyo', prompt: '把确认好的方案落实为清楚的小步骤。涉及保存、替换或对外提交时，先展示准确目标和变更，再按用户决定执行；报告可核对的结果。', tone: '清楚利落', version: 1, defaultWorkspaceId: 'book' },
];
const material = { id: 'event-pdf', name: '读书交换日 · 活动草案.pdf', type: 'PDF', detail: '3 页 · 248 KB', text: '9 月 19 日 15:00–17:00，松林社区一楼。带一本愿意交换的书，写一张推荐卡。场地可容纳 24 人。' };
const invitation = '带一本书，换一种视角。\n\n这个周六下午，来松林社区一起交换一本喜欢的书吧。带上一本愿意分享的书，再写一句推荐它的理由；也许，你会带着一本意料之外的好书回家。\n\n时间：9 月 19 日（周六）15:00–17:00\n地点：松林社区一楼共享空间\n人数：24 人以内，自由交流，不需要准备正式发言。\n\n我们会先用几分钟介绍手里的书，再把它们放上交换桌。如果愿意，也可以留下一张小纸条，让下一位读者知道你为什么喜欢它。\n\n报名时留下名字即可。书目不必提前登记，临时带来的一本也欢迎。期待在书页之间，认识新的朋友。';
const timers = new Map();
let serial = 30;
let filePickerSessionId = null;
let state;
const $id = prefix => `${prefix}-${++serial}`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iconPaths = {
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="m6 12 6-6 6 6M12 6v13"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.4 7M3 5v6h6M12 7v5l3 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  folder: '<path d="M3 7V5h6l2 2h10v13H3Z"/>',
  file: '<path d="M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8M8 17h6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  paperclip: '<path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  spark: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.file}</svg>`;
const pet = id => state.pets.find(item => item.id === id);
const selectedSession = (petId = state.activePet) => state.sessions[state.selectedSessions[petId]];
const active = () => selectedSession();
const historyFilter = (petId = state.activePet) => state.historyFilters[petId];
const sessionStatus = session => ({ ready: '可以继续聊', receiving: '正在接收资料', running: session.activity || '正在整理', waiting: '等你决定', stopped: '已停止', failed: '需要重试' }[session.status] || '可以继续聊');
const petUnread = petId => Object.values(state.sessions).filter(s => s.petId === petId).reduce((n, s) => n + s.unread, 0);
const petBusy = petId => Object.values(state.sessions).find(s => s.petId === petId && ['receiving', 'running', 'waiting'].includes(s.status));
function seedSession(id, petId, workspaceId, title, messages, draft = '') {
  const owner = state.pets.find(p => p.id === petId);
  return { id, petId, workspaceId, title, messages: messages.map(([role, text]) => ({ id: $id('message'), role, text })), draft, attachments: [], queued: [], outputs: [], status: 'ready', unread: 0, activity: '', profileVersion: owner.version, promptSnapshot: owner.prompt, toneSnapshot: owner.tone, longExpanded: false, pendingRequest: null, runToken: null, updatedAt: Date.now() };
}
function reset() {
  timers.forEach(clearTimeout); timers.clear();
  const requestedVariant = new URLSearchParams(location.search).get('variant');
  state = { variant: variants[requestedVariant] ? requestedVariant : 'A', display: 'all', activePet: 'yachiyo', panelOpen: true, historyOpen: false, inspectorOpen: false, profilePet: null, profileDraft: '', toneDraft: '', historyFilters: Object.fromEntries(initialPets.map(p => [p.id, { workspaceId: 'all', query: '' }])), toast: '', receipts: [], deliveryLog: [], selectedMaterial: material.id, pets: structuredClone(initialPets), sessions: {}, selectedSessions: {} };
  const definitions = [
    ['y-book', 'yachiyo', 'book', '活动安排与待办', [['user', '周六的读书交换日，帮我看看现在的安排。'], ['assistant', '活动框架已经清楚了。\n时间和场地已定，24 个名额也合适。现在还差一版邀请文案，以及交换书目要不要提前登记。\n我建议先写邀请，再把报名方式补齐。']]],
    ['y-writing', 'yachiyo', 'writing', '收集秋天的书单', [['user', '整理一下最近提过的三本书。'], ['assistant', '我按散文、小说、城市观察分好了。下次回来可以继续补书目。']], '再加一本适合周末读的散文。'],
    ['m-book', 'miku', 'book', '一版轻松的邀请', [['user', '写得像邀请朋友，不要像正式通知。'], ['assistant', invitation]], '再轻松一点，控制在 150 字左右。'],
    ['m-writing', 'miku', 'writing', '一封迟来的回信', [['user', '帮我把这封回信整理得自然一点。'], ['assistant', '我们保留那句“最近总会想起那次散步”，其余稍微收短，读起来更像你。']]],
    ['x-book', 'xiaoba', 'book', '活动资料归档', [['assistant', '我在这里等文案定稿。给我确认好的内容，我会先列出保存位置和文件名。']]],
    ['x-project', 'xiaoba', 'project', '周末小工具', [['user', '记一下下一步需要做的事。'], ['assistant', '下一步：确认输入格式，完成一个可用的小版本，再整理使用说明。']], '先把说明书框架列出来。'],
  ];
  for (const definition of definitions) { const session = seedSession(...definition); state.sessions[session.id] = session; }
  state.selectedSessions = { yachiyo: 'y-book', miku: 'm-book', xiaoba: 'x-book' };
  render();
}
function createSession(petId, workspaceId, title = '新对话', select = true) {
  const session = seedSession($id('conversation'), petId, workspaceId, title, []);
  state.sessions[session.id] = session;
  if (select) state.selectedSessions[petId] = session.id;
  return session;
}
function announce(message) {
  state.toast = message;
  render();
  const token = $id('toast');
  timers.set(token, setTimeout(() => { if (state.toast === message) { state.toast = ''; render(); } timers.delete(token); }, 3800));
}
function selectPet(id, toggle = false) {
  const wasSelected = state.activePet === id;
  state.activePet = id;
  state.panelOpen = toggle && wasSelected ? !state.panelOpen : true;
  state.historyOpen = false; state.profilePet = null;
  if (state.panelOpen) selectedSession(id).unread = 0;
  render();
  // Only this explicit user action requests focus; background renders preserve existing focus.
  if (state.panelOpen) document.querySelector('#message-input')?.focus({ preventScroll: true });
}
function isVisible(session) { return state.activePet === session.petId && state.selectedSessions[session.petId] === session.id && state.panelOpen; }
function schedule(session, milliseconds, fn) {
  const token = session.runToken;
  const handle = setTimeout(() => { timers.delete(token); if (session.runToken === token) fn(); }, milliseconds);
  timers.set(token, handle);
}
function fixtureReply(session, mode, text) {
  const owner = pet(session.petId);
  if (mode === 'inspect') {
    return owner.id === 'yachiyo' ? '我读完活动草案了，先把关键安排留在这里。\n\n9 月 19 日 15:00–17:00，在松林社区一楼。每人带一本书和一句推荐语，名额 24 人。\n还需要确定：报名入口、书目是否提前登记。\n\n下一步可以请 Miku 写一版轻松的邀请，或者先把待办整理出来。' : owner.id === 'miku' ? '资料我看到了，语气可以轻松一些，像约朋友来坐坐。\n活动时间、地点和交换方式都足够写第一版了。你想先看一版邀请文案吗？' : '这份材料的时间、地点和安排都清楚。\n我可以把它整理成一份活动说明。保存前会给你看文件名和位置。';
  }
  if (owner.id === 'miku') return /150|简短|短一点/.test(text) ? '这个周六，带一本书来交换吧。\n\n9 月 19 日 15:00–17:00，松林社区一楼。带上一本愿意分享的书，写一句推荐理由，和新朋友聊聊最近的阅读。24 个名额，不用准备正式发言。\n\n也许下一本喜欢的书，就在别人的书袋里。' : invitation;
  if (/失败|重试演示/.test(text)) return null;
  return `我先按${session.toneSnapshot}的方式整理了一版。\n\n活动目标：用一本书，开启一次自然的交流。\n已确认：9 月 19 日下午，松林社区一楼，24 人以内。\n待决定：报名入口和是否登记书目。\n\n建议今天先定邀请文案，明天再发出报名信息。这样大家有时间挑一本愿意交换的书。`;
}
function complete(session, mode, text) {
  const reply = fixtureReply(session, mode, text);
  session.runToken = null;
  if (reply === null) { session.status = 'failed'; session.activity = '这次没有完成，材料和草稿都还在'; session.lastRun = { text, mode }; }
  else { session.status = 'ready'; session.activity = ''; session.messages.push({ id: $id('message'), role: 'assistant', text: reply }); }
  session.updatedAt = Date.now();
  if (!isVisible(session)) session.unread += 1;
  render();
  if (session.queued.length && session.status === 'ready') continueQueue(session);
}
function askSavePermission(session) {
  session.runToken = null; session.status = 'waiting'; session.activity = '等你确认保存位置';
  session.pendingRequest = { id: $id('request'), file: '读书交换日-邀请文案.md', path: `${workspaces[session.workspaceId].path}/读书交换日-邀请文案.md`, content: invitation };
  if (!isVisible(session)) session.unread += 1;
  render();
}
function startRun(session, text, mode = 'message', appendUser = true, attachments = []) {
  if (appendUser) session.messages.push({ id: $id('message'), role: 'user', text, attachments });
  session.updatedAt = Date.now(); session.status = 'running'; session.activity = mode === 'inspect' ? '正在阅读你交付的资料' : '正在整理回复'; session.runToken = $id('run');
  if (session.title === '新对话') session.title = text.slice(0, 18) || '资料对话';
  const shouldSave = mode !== 'inspect' && (session.petId === 'xiaoba' || /保存|写入|执行/.test(text));
  schedule(session, shouldSave ? 1500 : 2400, () => shouldSave ? askSavePermission(session) : complete(session, mode, text));
  render();
}
function submitMessage(text = active().draft) {
  const session = active();
  const fromComposer = arguments.length === 0;
  text = text.trim();
  if (!text && !session.attachments.length) return;
  const attachments = fromComposer ? session.attachments.splice(0) : []; if (fromComposer) session.draft = '';
  if (!text) text = '请看一下这些材料。';
  if (['running', 'receiving', 'waiting'].includes(session.status)) {
    const message = { id: $id('message'), role: 'user', text, attachments, queued: true };
    session.messages.push(message); session.queued.push({ text, messageId: message.id }); render(); return;
  }
  startRun(session, text, 'message', true, attachments);
  requestAnimationFrame(() => document.querySelector('#message-input')?.focus({ preventScroll: true }));
}
function continueQueue(session) {
  if (!session.queued.length) return;
  const item = session.queued.shift();
  const message = session.messages.find(m => m.id === item.messageId); if (message) message.queued = false;
  startRun(session, item.text, item.mode || 'message', false);
}
function stop(session) {
  if (session.runToken) { clearTimeout(timers.get(session.runToken)); timers.delete(session.runToken); }
  session.runToken = null;
  if (session.pendingRequest) state.receipts.push({ requestId: session.pendingRequest.id, sessionId: session.id, choice: 'cancelled', count: 1 });
  session.pendingRequest = null; session.status = 'stopped'; session.activity = '已经停下，随时可以继续'; render();
}
function resolvePermission(sessionId, requestId, allowed) {
  const session = state.sessions[sessionId];
  if (!session || session.pendingRequest?.id !== requestId || state.receipts.some(r => r.requestId === requestId)) return;
  const request = session.pendingRequest;
  state.receipts.push({ requestId, sessionId, choice: allowed ? 'allow' : 'deny', count: 1 });
  session.pendingRequest = null;
  if (!allowed) {
    session.status = 'ready'; session.activity = '';
    session.messages.push({ id: $id('message'), role: 'assistant', text: '好，这次先不保存。文案仍在这段对话里，可以修改后再决定。' });
    if (session.queued.length) continueQueue(session); else render();
    return;
  }
  session.status = 'running'; session.activity = '正在保存确认后的内容'; session.runToken = $id('run');
  schedule(session, 1100, () => {
    session.runToken = null; session.status = 'ready'; session.activity = '';
    session.outputs.push({ name: request.file, path: request.path, content: request.content });
    session.messages.push({ id: $id('message'), role: 'assistant', text: `已经保存好了。\n${request.file}\n你可以从下面的成果卡随时打开这版内容。` });
    if (!isVisible(session)) session.unread += 1;
    render(); if (session.queued.length) continueQueue(session);
  });
  render();
}
function deliver(petId, kind, files, targetSessionId) {
  const destination = kind === 'append' ? state.sessions[targetSessionId] : createSession(petId, pet(petId).defaultWorkspaceId, '阅读活动资料');
  if (!destination || destination.petId !== petId) return;
  const snapshot = { petId, workspaceId: destination.workspaceId, sessionId: destination.id, names: files.map(file => file.name), mode: 'inspect' };
  state.deliveryLog.push(snapshot);
  state.activePet = petId; state.selectedSessions[petId] = destination.id; state.panelOpen = true; state.historyOpen = false;
  const text = `请看看${files.map(file => `「${file.name}」`).join('、')}，先整理关键点。`;
  if (['running', 'receiving', 'waiting'].includes(destination.status)) {
    const message = { id: $id('message'), role: 'user', text, attachments: files, queued: true };
    destination.messages.push(message); destination.queued.push({ text, messageId: message.id, mode: 'inspect' }); render(); return;
  }
  destination.messages.push({ id: $id('message'), role: 'user', text, attachments: files });
  destination.status = 'receiving'; destination.activity = '正在接收资料'; destination.runToken = $id('delivery'); render();
  schedule(destination, 500, () => {
    destination.runToken = null;
    startRun(destination, text, 'inspect', false);
  });
}
function handoff(targetId) {
  const source = active();
  const lastReply = [...source.messages].reverse().find(m => m.role === 'assistant');
  const destination = createSession(targetId, source.workspaceId, targetId === 'miku' ? '写一版活动邀请' : '保存活动邀请');
  const sourceOwner = pet(source.petId);
  const text = `${targetId === 'miku' ? '请根据这些安排写一版轻松的邀请。' : '请把确认的邀请文案保存到活动文件夹。'}\n来自 ${sourceOwner.name}「${source.title}」的摘录：\n${lastReply?.text || material.text}`;
  state.activePet = targetId; state.panelOpen = true; state.historyOpen = false;
  startRun(destination, text, 'message', true, [{ name: `来自 ${sourceOwner.name} 的摘录`, type: '摘录' }]);
}
function sprite(owner, size = 'normal', status = 'ready') {
  const animationState = { running: 'running', receiving: 'waiting', waiting: 'waiting', failed: 'failed' }[status] || 'idle';
  return `<span class="sprite-frame sprite-${size}" aria-hidden="true">${owner.sprite === 'miku' ? '<img class="miku-sprite" src="./assets/miku-preview.webp" alt="" />' : `<span class="pet-sprite" data-animation="${animationState}"></span>`}</span>`;
}
function petButton(owner, className = '') {
  const busy = petBusy(owner.id); const unread = petUnread(owner.id); const selected = owner.id === state.activePet;
  return `<button class="pet-button ${selected ? 'selected' : ''} ${className}" data-action="pet" data-pet-id="${owner.id}" data-drop-pet="${owner.id}" data-drop-kind="new" aria-label="与 ${owner.name} 对话" aria-pressed="${selected}">
    ${busy ? `<span class="pet-status status-${busy.status}">${escapeHTML(busy.status === 'waiting' ? '等你决定' : '正在忙')}</span>` : ''}
    ${sprite(owner, 'normal', busy?.status)}
    <span class="pet-name">${owner.name}${unread ? `<span class="unread-badge">${unread}</span>` : ''}</span><span class="pet-role">${owner.role}</span>
    <span class="drop-label">交给 ${owner.name} · 新对话</span>
  </button>`;
}
function petStage(extra = '') {
  const visiblePets = state.display === 'all' ? state.pets : [pet(state.activePet)];
  return `<div class="character-stage ${extra} ${state.display === 'solo' ? 'solo-stage' : ''}" aria-label="桌面上的桌宠">${visiblePets.map(p => petButton(p)).join('')}${state.display === 'solo' ? `<div class="slot-switcher" aria-label="切换当前位置的桌宠">${state.pets.map(p => `<button data-action="select-pet" data-pet-id="${p.id}" class="${p.id === state.activePet ? 'selected' : ''}" aria-label="切换到 ${p.name}">${p.name}${petUnread(p.id) ? '<span class="unread-dot"></span>' : ''}</button>`).join('')}</div>` : ''}</div>`;
}
function materialCard(extra = '') {
  return `<div class="material-card ${extra}" draggable="true" data-material-id="${material.id}" role="group" aria-label="可拖拽的活动草案 PDF"><span class="file-symbol">${icon('file')}<small>PDF</small></span><span class="material-description"><span>${material.name}</span><small>${material.detail}</small></span><span class="drag-grip" aria-hidden="true">⠿</span></div>`;
}
function desktopBackground() {
  return `<div class="desktop-environment">
    <div class="mac-menubar" aria-hidden="true"><span class="desktop-mark">◉</span><strong>预览</strong><span>文件</span><span>编辑</span><span>显示</span><span>窗口</span><span class="menubar-spacer"></span><span>简体拼音</span><span>9 月 14 日 周一</span><span>16:24</span></div>
    <section class="document-window" aria-label="正在查看的示例活动草案"><div class="window-chrome"><span class="traffic-lights" aria-hidden="true"><i></i><i></i><i></i></span><span>读书交换日 · 活动草案.pdf</span><span class="window-tools">${icon('search')}${icon('expand')}</span></div>
      <div class="document-content"><aside class="page-thumbnails" aria-hidden="true"><div class="page-thumb selected"><span>读书交换日</span><i></i><i></i><i></i><i></i></div><small>1</small><div class="page-thumb"><span>活动流程</span><i></i><i></i><i></i></div><small>2</small><div class="page-thumb"><span>准备事项</span><i></i><i></i></div><small>3</small></aside>
      <article class="paper-page"><div class="paper-eyebrow">松林社区 · 秋日活动 / 014</div><h1>带一本书，<br>换一种视角。</h1><p class="paper-lead">一场没有标准答案的读书交换日</p><div class="paper-rule"></div><div class="event-facts"><div><small>时间</small><span>9 月 19 日，周六<br>15:00 — 17:00</span></div><div><small>地点</small><span>社区一楼<br>共享空间</span></div></div><h2>我们想做的事</h2><p>带一本愿意分享的书，写一句推荐的理由。把书放上交换桌，也把一次新的相遇带回家。</p><h2>下午怎么过</h2><ol><li><time>15:00</time>签到，把书与推荐卡放在一起</li><li><time>15:20</time>介绍一本书，认识一位新朋友</li><li><time>16:00</time>自由交换，慢慢聊一会儿</li></ol><div class="paper-note">待补：报名入口、是否提前登记书目。</div><footer>活动草案 · 供讨论使用<span>1 / 3</span></footer></article></div>
    </section>
    <div class="desktop-materials"><span class="desktop-materials-label">桌面上的资料</span>${materialCard()}<button class="text-button" data-action="example-drop">${icon('arrow')}交给 ${pet(state.activePet).name}</button></div>
    <div class="desktop-folder" aria-hidden="true">${icon('folder')}<span>读书交换日</span><small>邀请文案 / 报名表 / 照片</small></div>
  </div>`;
}
function productControls() {
  return `<div class="product-controls" aria-label="桌宠展示方式"><span class="product-wordmark">${icon('spark')} Wisp Pocket</span><span class="control-divider"></span><div class="segmented" role="group" aria-label="桌宠显示模式"><button data-action="display" data-mode="all" aria-pressed="${state.display === 'all'}" class="${state.display === 'all' ? 'selected' : ''}">全部同屏</button><button data-action="display" data-mode="solo" aria-pressed="${state.display === 'solo'}" class="${state.display === 'solo' ? 'selected' : ''}">单个位置</button></div></div>`;
}
function statusLine(session) {
  return `<div class="conversation-status status-${session.status}" aria-live="polite"><span class="status-dot"></span><span>${escapeHTML(sessionStatus(session))}</span>${session.queued.length ? `<span class="queue-count">${session.queued.length} 条待处理</span>` : ''}${['running', 'receiving', 'waiting'].includes(session.status) ? `<button class="text-button stop-control" data-action="stop" aria-label="停止 ${pet(session.petId).name} 当前对话">${icon('stop')}停止</button>` : ''}</div>`;
}
function conversationHeader(session, extra = '') {
  const owner = pet(session.petId);
  return `<div class="conversation-header ${extra}"><div class="conversation-identity"><span class="identity-name">${owner.name}<small>${owner.role}</small></span><button class="workspace-label" data-action="toggle-history" title="查看工作区和对话历史">${icon('folder')}${workspaces[session.workspaceId].name}</button></div><div class="header-actions"><button class="icon-button" data-action="new-session" title="新对话" aria-label="与 ${owner.name} 开始新对话">${icon('plus')}</button><button class="icon-button ${state.historyOpen ? 'active' : ''}" data-action="toggle-history" title="历史对话" aria-label="${owner.name} 的历史对话">${icon('history')}</button><button class="icon-button" data-action="profile" title="桌宠设定" aria-label="编辑 ${owner.name} 的人设">${icon('settings')}</button><button class="icon-button" data-action="hide" title="隐藏对话" aria-label="隐藏对话">${icon('close')}</button></div></div>`;
}
function textBlocks(text) { return escapeHTML(text).split(/\n\n/).map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`).join(''); }
function messageHTML(message, collapsed = false) {
  return `<article class="message message-${message.role} ${collapsed ? 'message-collapsed' : ''}">${message.role === 'user' ? '<span class="message-who">你</span>' : ''}<div class="message-text">${textBlocks(message.text)}</div>${message.attachments?.length ? `<div class="message-attachments">${message.attachments.map(a => `<span>${icon('file')}${escapeHTML(a.name)}</span>`).join('')}</div>` : ''}${message.queued ? '<small class="queued-label">待处理</small>' : ''}</article>`;
}
function permissionCard(session) {
  const request = session.pendingRequest;
  if (!request) return '';
  return `<section class="permission-card" aria-label="保存文件确认"><div class="permission-eyebrow">需要你的决定</div><h3>将这版邀请保存下来？</h3><p>新建文件，保留现在的文案。</p><div class="save-target">${icon('file')}<span>${request.file}<small>${escapeHTML(workspaces[session.workspaceId].path)}</small></span></div><details><summary>查看将保存的内容</summary><div class="save-preview">${textBlocks(request.content)}</div></details><div class="permission-actions"><button class="quiet-button" data-action="permission" data-choice="deny" data-session-id="${session.id}" data-request-id="${request.id}">暂不保存</button><button class="primary-button" data-action="permission" data-choice="allow" data-session-id="${session.id}" data-request-id="${request.id}">允许这次</button></div></section>`;
}
function outputsHTML(session) {
  return session.outputs.map((output, i) => `<button class="output-card" data-action="preview-output" data-output-index="${i}">${icon('file')}<span>${escapeHTML(output.name)}<small>查看成果</small></span>${icon('chevron')}</button>`).join('');
}
function suggestions(session) {
  if (session.status !== 'ready' || !session.messages.some(m => m.role === 'assistant')) return '';
  if (session.petId === 'yachiyo') return '<div class="suggestions"><button data-action="suggest" data-text="把活动待办列成三项">列出待办</button><button data-action="handoff" data-target-pet="miku">交给 Miku 写邀请</button></div>';
  if (session.petId === 'miku') return '<div class="suggestions"><button data-action="suggest" data-text="再短一点，控制在 150 字">再短一点</button><button data-action="handoff" data-target-pet="xiaoba">请小八保存</button></div>';
  return '<div class="suggestions"><button data-action="suggest" data-text="请把确认的邀请文案保存到活动文件夹">保存活动文案</button></div>';
}
function conversationContent(session, full = false) {
  const replies = session.messages.filter(message => message.role === 'assistant');
  const latest = replies[replies.length - 1];
  const visible = full || session.longExpanded ? session.messages : latest ? [latest] : session.messages.slice(-1);
  return `<div class="conversation-content ${full ? 'full-transcript' : ''}" data-scroll-key="${session.id}-${full ? 'full' : 'preview'}">${visible.length ? visible.map(m => messageHTML(m, !full && !session.longExpanded && m.text.length > 115)).join('') : `<div class="empty-conversation">${icon('spark')}<p>我是 ${pet(session.petId).name}。<br>${session.petId === 'miku' ? '想写点什么？从一句想法开始就好。' : session.petId === 'xiaoba' ? '把准备好的事交给我，我们一步步做完。' : '想聊什么，或者给我一份资料看看。'}</p></div>`}${!full && session.messages.length ? `<button class="text-button expand-message" data-action="expand-message">${session.longExpanded ? '收起对话' : '展开全文与前文'}${icon('chevron')}</button>` : ''}${permissionCard(session)}${outputsHTML(session)}${session.status === 'failed' ? '<button class="quiet-button" data-action="retry">重试这次回复</button>' : ''}${session.status === 'stopped' && session.queued.length ? '<button class="quiet-button" data-action="continue-queue">继续处理待发消息</button>' : ''}</div>`;
}
function composer(session) {
  return `<form class="composer" data-session-id="${session.id}"><div class="draft-attachments">${session.attachments.map((a, i) => `<span>${icon('file')}${escapeHTML(a.name)}<button type="button" data-action="remove-attachment" data-attachment-index="${i}" aria-label="移除 ${escapeHTML(a.name)}">×</button></span>`).join('')}</div><textarea id="message-input" name="message" data-field="draft" data-focus-key="message" rows="2" aria-label="给 ${pet(session.petId).name} 的消息" placeholder="和 ${pet(session.petId).name} 说点什么…">${escapeHTML(session.draft)}</textarea><div class="composer-footer"><button type="button" class="icon-button" data-action="choose-file" title="添加资料" aria-label="添加资料">${icon('paperclip')}</button><span>${['running', 'receiving', 'waiting'].includes(session.status) ? '发送后排入这段对话' : 'Enter 发送 · Shift Enter 换行'}</span><button type="submit" class="send-button" aria-label="发送给 ${pet(session.petId).name}">${icon('send')}</button></div></form>`;
}
function historyPanel(permanent = false) {
  const owner = pet(state.activePet);
  const filter = historyFilter(owner.id);
  const sessions = Object.values(state.sessions).filter(s => s.petId === owner.id && (filter.workspaceId === 'all' || s.workspaceId === filter.workspaceId) && `${s.title} ${s.messages.map(m => m.text).join(' ')}`.toLowerCase().includes(filter.query.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt);
  return `<aside class="history-panel ${permanent ? 'permanent-history' : ''}" aria-label="${owner.name} 的对话历史"><div class="history-heading"><span>与 ${owner.name} 的对话</span>${!permanent ? '<button class="icon-button" data-action="toggle-history" aria-label="关闭历史">'+icon('close')+'</button>' : ''}</div><label class="history-search">${icon('search')}<input type="search" name="history-search" data-field="history-search" data-focus-key="history-search" aria-label="搜索 ${owner.name} 的历史对话" placeholder="搜索对话" value="${escapeHTML(filter.query)}"></label><label class="workspace-filter">${icon('folder')}<select data-field="workspace" aria-label="筛选工作区"><option value="all" ${filter.workspaceId === 'all' ? 'selected' : ''}>所有工作区</option>${Object.entries(workspaces).map(([id, w]) => `<option value="${id}" ${filter.workspaceId === id ? 'selected' : ''}>${w.name}</option>`).join('')}</select></label><div class="history-items">${sessions.map(s => `<button class="history-item ${s.id === active().id ? 'selected' : ''}" data-action="open-session" data-session-id="${s.id}"><span>${escapeHTML(s.title)}${s.unread ? '<i class="unread-dot"></i>' : ''}</span><small>${workspaces[s.workspaceId].name}${s.draft ? ' · 有草稿' : ''}${s.status === 'waiting' ? ' · 等你决定' : ''}</small></button>`).join('') || '<p class="empty-history">没有找到这只桌宠的相关对话。</p>'}</div><button class="text-button new-conversation" data-action="new-session">${icon('plus')}新对话</button></aside>`;
}
function VariantA() {
  const session = active(); const index = state.pets.findIndex(p => p.id === state.activePet);
  const offset = state.display === 'solo' ? 58 : Math.max(34, (2 - index) * 182 - 42);
  return `<section class="variant variant-a" aria-label="A 口袋对话">${petStage()}${state.panelOpen ? `<div class="pocket-anchor" style="--pocket-right:${offset}px"><section class="pocket-dialogue ${session.longExpanded ? 'expanded' : ''}" data-drop-pet="${session.petId}" data-drop-kind="append" data-drop-session="${session.id}" aria-label="${pet(session.petId).name} 的口袋对话">${conversationHeader(session)}${statusLine(session)}${conversationContent(session)}${suggestions(session)}${composer(session)}<span class="append-drop-label">添到这段对话 · ${pet(session.petId).name}</span></section>${state.historyOpen ? historyPanel() : ''}</div>` : `<button class="restore-conversation" data-action="show">继续与 ${pet(session.petId).name} 对话 ${icon('chevron')}</button>`}</section>`;
}
function VariantB() {
  const session = active();
  if (!state.panelOpen) return `<section class="variant variant-b" aria-label="B 桌面长桌"><div class="desk-pets">${petStage('desk-stage')}</div><button class="restore-conversation" data-action="show">继续与 ${pet(session.petId).name} 的桌面工作 ${icon('chevron')}</button></section>`;
  return `<section class="variant variant-b" aria-label="B 桌面长桌"><div class="desk-pets">${petStage('desk-stage')}</div><section class="long-desk"><div class="desk-title"><span>${icon('folder')}读书交换日 <small>桌面长桌</small></span><button class="text-button" data-action="new-session">${icon('plus')}新对话</button></div><div class="desk-columns"><section class="desk-material-column"><span class="section-eyebrow">手边的资料</span>${materialCard('desk-file')}<div class="material-excerpt"><p>时间、地点与活动流程已经整理好。</p><span>“带一本书，换一种视角。”</span></div><span class="section-eyebrow route-caption">交给谁来做</span><div class="recipient-list">${state.pets.map(p => `<button data-action="select-pet" data-pet-id="${p.id}" class="${p.id === state.activePet ? 'selected' : ''}"><span>${p.name}</span><small>${p.role}</small>${p.id === state.activePet ? icon('check') : ''}</button>`).join('')}</div><button class="primary-button deliver-button" data-action="example-drop">交给 ${pet(state.activePet).name} 看看 ${icon('arrow')}</button></section><section class="desk-work-column"><div class="desk-work-heading"><span>${pet(session.petId).name} 正在负责</span><button class="icon-button" data-action="profile" title="桌宠设定" aria-label="编辑 ${pet(session.petId).name} 的人设">${icon('settings')}</button></div><h2>${escapeHTML(session.title)}</h2><div class="work-context">${icon('folder')}${workspaces[session.workspaceId].name}</div>${statusLine(session)}<div class="desk-result" data-scroll-key="${session.id}-desk-result" data-drop-pet="${session.petId}" data-drop-kind="append" data-drop-session="${session.id}">${conversationContent(session)}<span class="append-drop-label">继续交付给 ${pet(session.petId).name}</span></div>${suggestions(session)}</section><section class="desk-chat-column"><div class="desk-chat-heading"><span>和 ${pet(session.petId).name} 商量</span><button class="icon-button" data-action="toggle-history" aria-label="${pet(session.petId).name} 的历史对话">${icon('history')}</button><button class="icon-button" data-action="hide" aria-label="隐藏对话" title="隐藏对话">${icon('close')}</button></div>${state.panelOpen ? `<div class="desk-chat-note">${sprite(pet(session.petId), 'tiny', session.status)}<p>${pet(session.petId).id === 'miku' ? '你说清楚想传达的感觉，文字交给我来试。' : pet(session.petId).id === 'xiaoba' ? '决定好了就交给我。要保存的内容，我们先一起看一眼。' : '先看材料，再决定下一步。还缺什么，我会告诉你。'}</p></div>${composer(session)}` : '<button class="quiet-button" data-action="show">继续对话</button>'}${state.historyOpen ? historyPanel() : '<div class="desk-history-peek"><span>这只桌宠的最近对话</span>'+Object.values(state.sessions).filter(s => s.petId === session.petId).slice(0, 2).map(s => `<button data-action="open-session" data-session-id="${s.id}">${escapeHTML(s.title)}${s.draft ? '<small>有草稿</small>' : ''}</button>`).join('')+'</div>'}</section></div></section></section>`;
}
function VariantC() {
  const session = active();
  return `<section class="variant variant-c" aria-label="C 对话手册">${petStage('handbook-stage')}${state.panelOpen ? `<section class="handbook" aria-label="桌宠对话手册"><div class="handbook-title"><span>${icon('history')}对话手册</span><small>与 ${pet(session.petId).name} 一起</small></div>${conversationHeader(session)}<div class="handbook-body">${historyPanel(true)}<section class="handbook-reading" data-drop-pet="${session.petId}" data-drop-kind="append" data-drop-session="${session.id}"><div class="reading-title"><h2>${escapeHTML(session.title)}</h2><small>${workspaces[session.workspaceId].name}</small></div>${statusLine(session)}${conversationContent(session, true)}${suggestions(session)}${composer(session)}<span class="append-drop-label">交给 ${pet(session.petId).name} · ${escapeHTML(session.title)}</span></section></div></section>` : `<button class="restore-conversation" data-action="show">打开 ${pet(session.petId).name} 的对话手册 ${icon('chevron')}</button>`}</section>`;
}
function profileDialog() {
  if (!state.profilePet) return '';
  const owner = pet(state.profilePet);
  return `<div class="dialog-backdrop"><section class="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title"><header><h2 id="profile-title">${owner.name} 的设定</h2><button class="icon-button" data-action="close-profile" aria-label="关闭设定">${icon('close')}</button></header><div class="profile-identity">${sprite(owner, 'small')}<div><strong>${owner.name}</strong><p>${owner.role}</p><small>${owner.id === 'xiaoba' ? '本原型与八千代共用角色外观' : owner.id === 'miku' ? 'Miku · 静态形象预览' : '月见八千代 · 动画形象'}</small></div></div><label>说话方式<input data-field="tone" data-focus-key="tone" aria-label="说话方式" value="${escapeHTML(state.toneDraft)}"></label><label>人设与工作提示词<textarea data-field="profile" data-focus-key="profile" aria-label="工作提示词" rows="5">${escapeHTML(state.profileDraft)}</textarea></label><p class="profile-scope">保存后用于新对话。已有对话继续保留开始时的设定。</p><footer><button class="quiet-button" data-action="close-profile">取消</button><button class="primary-button" data-action="save-profile">保存设定</button></footer></section></div>`;
}
function outputDialog() {
  if (!state.outputPreview) return '';
  return `<div class="dialog-backdrop"><section class="output-dialog" role="dialog" aria-modal="true" aria-labelledby="output-title"><header><h2 id="output-title">${escapeHTML(state.outputPreview.name)}</h2><button class="icon-button" data-action="close-output" aria-label="关闭成果预览">${icon('close')}</button></header><small>${escapeHTML(state.outputPreview.path)}</small><article>${textBlocks(state.outputPreview.content)}</article><footer><button class="quiet-button" data-action="close-output">回到对话</button></footer></section></div>`;
}
function reviewControls() {
  const current = variants[state.variant];
  const diagnostic = { variant: state.variant, display: state.display, activePet: state.activePet, selectedSessions: state.selectedSessions, historyFilters: state.historyFilters, defaultWorkspaces: Object.fromEntries(state.pets.map(p => [p.id, p.defaultWorkspaceId])), sessions: Object.values(state.sessions).map(s => ({ id: s.id, pet: s.petId, workspace: s.workspaceId, status: s.status, draft: s.draft, promptVersion: s.profileVersion, unread: s.unread, request: s.pendingRequest?.id, queue: s.queued.length })), latestDelivery: state.deliveryLog.at(-1), receipts: state.receipts, profileVersions: Object.fromEntries(state.pets.map(p => [p.id, p.version])) };
  return `<footer class="prototype-switcher" aria-label="原型方向切换"><button id="variant-prev" data-action="variant-prev" aria-label="上一个原型方向">${icon('chevron', 'flip')}</button><div class="variant-description"><span id="variant-label">${state.variant} · ${current.name}<small>交互原型</small></span><p>${current.hypothesis}</p></div><button id="variant-next" data-action="variant-next" aria-label="下一个原型方向">${icon('chevron')}</button><span class="switcher-divider"></span><button class="review-reset" data-action="reset" title="清空本次演示状态">重置</button></footer><details class="prototype-inspector" ${state.inspectorOpen ? 'open' : ''}><summary>检查模拟状态</summary><div class="inspector-content"><p>示例回复与保存均为模拟；只保留在本页内存。浏览器原型不验证跨 App 拖拽、原生焦点或权限。</p><div class="inspector-actions"><button data-action="background-demo">后台完成演示</button><button data-action="save-demo">保存确认演示</button></div><pre>${escapeHTML(JSON.stringify(diagnostic, null, 2))}</pre></div></details>`;
}
function render(focus = null) {
  const oldField = document.activeElement;
  if (!focus && oldField?.dataset?.focusKey) focus = { key: oldField.dataset.focusKey, start: oldField.selectionStart, end: oldField.selectionEnd, sessionId: oldField.closest('.composer')?.dataset.sessionId };
  const scrolls = new Map([...root.querySelectorAll('[data-scroll-key]')].map(e => [e.dataset.scrollKey, e.scrollTop]));
  root.dataset.variant = state.variant; root.dataset.display = state.display; root.dataset.activePet = state.activePet;
  root.innerHTML = desktopBackground() + productControls() + ({ A: VariantA, B: VariantB, C: VariantC }[state.variant])() + reviewControls() + profileDialog() + outputDialog() + `<div class="toast ${state.toast ? 'visible' : ''}" role="status">${escapeHTML(state.toast)}</div><input id="prototype-file-input" type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md">`;
  root.querySelectorAll('[data-scroll-key]').forEach(e => { if (scrolls.has(e.dataset.scrollKey)) e.scrollTop = scrolls.get(e.dataset.scrollKey); });
  if (focus) { const input = root.querySelector(`[data-focus-key="${focus.key}"]`); if (input && (!focus.sessionId || input.closest('.composer')?.dataset.sessionId === focus.sessionId)) { input.focus({ preventScroll: true }); if (typeof input.setSelectionRange === 'function') { try { input.setSelectionRange(focus.start, focus.end); } catch {} } } }
}
function cycleVariant(delta) {
  const keys = Object.keys(variants); state.variant = keys[(keys.indexOf(state.variant) + delta + keys.length) % keys.length];
  const url = new URL(location.href); url.searchParams.set('variant', state.variant); history.replaceState(null, '', url); state.profilePet = null; state.historyOpen = false; render();
}
root.addEventListener('submit', event => { if (event.target.matches('.composer')) { event.preventDefault(); submitMessage(); } });
root.addEventListener('input', event => {
  const { field } = event.target.dataset;
  if (field === 'draft') active().draft = event.target.value;
  if (field === 'profile') state.profileDraft = event.target.value;
  if (field === 'tone') state.toneDraft = event.target.value;
  if (field === 'history-search') { historyFilter().query = event.target.value; render({ key: 'history-search', start: event.target.selectionStart, end: event.target.selectionEnd }); }
});
root.addEventListener('change', event => {
  if (event.target.dataset.field === 'workspace') { historyFilter().workspaceId = event.target.value; render(); }
  if (event.target.id === 'prototype-file-input') {
    const destination = state.sessions[filePickerSessionId] || active();
    destination.attachments.push(...[...event.target.files].map(file => ({ name: file.name, type: file.type || '文件' })));
    filePickerSessionId = null; render();
  }
});
root.addEventListener('toggle', event => { if (event.target.matches('.prototype-inspector')) state.inspectorOpen = event.target.open; }, true);
root.addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action } = button.dataset;
  if (action === 'pet' || action === 'select-pet') selectPet(button.dataset.petId, action === 'pet');
  else if (action === 'display') { state.display = button.dataset.mode; render(); }
  else if (action === 'variant-prev' || action === 'variant-next') cycleVariant(action === 'variant-prev' ? -1 : 1);
  else if (action === 'reset') reset();
  else if (action === 'hide' || action === 'show') { state.panelOpen = action === 'show'; if (state.panelOpen) active().unread = 0; render(); }
  else if (action === 'toggle-history') { state.historyOpen = !state.historyOpen; render(); }
  else if (action === 'new-session') { createSession(state.activePet, pet(state.activePet).defaultWorkspaceId); state.panelOpen = true; state.historyOpen = false; render(); document.querySelector('#message-input')?.focus({ preventScroll: true }); }
  else if (action === 'open-session') { const s = state.sessions[button.dataset.sessionId]; state.activePet = s.petId; state.selectedSessions[s.petId] = s.id; s.unread = 0; state.panelOpen = true; state.historyOpen = false; render(); }
  else if (action === 'expand-message') { active().longExpanded = !active().longExpanded; render(); }
  else if (action === 'stop') stop(active());
  else if (action === 'suggest') submitMessage(button.dataset.text);
  else if (action === 'continue-queue') continueQueue(active());
  else if (action === 'retry') startRun(active(), active().lastRun?.text.replace(/失败|重试演示/g, '继续') || '继续整理', active().lastRun?.mode || 'message', false);
  else if (action === 'handoff') handoff(button.dataset.targetPet);
  else if (action === 'permission') resolvePermission(button.dataset.sessionId, button.dataset.requestId, button.dataset.choice === 'allow');
  else if (action === 'example-drop') deliver(state.activePet, 'new', [{ ...material }]);
  else if (action === 'choose-file') { filePickerSessionId = active().id; document.querySelector('#prototype-file-input')?.click(); }
  else if (action === 'remove-attachment') { active().attachments.splice(Number(button.dataset.attachmentIndex), 1); render(); }
  else if (action === 'profile') { const owner = pet(state.activePet); state.profilePet = owner.id; state.profileDraft = owner.prompt; state.toneDraft = owner.tone; render(); }
  else if (action === 'close-profile') { state.profilePet = null; render(); }
  else if (action === 'save-profile') { const owner = pet(state.profilePet); owner.prompt = state.profileDraft; owner.tone = state.toneDraft || owner.tone; owner.version += 1; state.profilePet = null; announce(`${owner.name} 的新设定已保存，将用于新对话。`); }
  else if (action === 'preview-output') { state.outputPreview = active().outputs[Number(button.dataset.outputIndex)]; render(); }
  else if (action === 'close-output') { state.outputPreview = null; render(); }
  else if (action === 'background-demo') { const other = state.pets.find(p => p.id !== state.activePet && p.id !== 'xiaoba'); const s = createSession(other.id, 'book', '后台整理的活动文案'); startRun(s, '把读书交换日写成一版邀请。'); announce(`${other.name} 已开始整理，完成后只在它身边提醒。`); }
  else if (action === 'save-demo') { const s = createSession('xiaoba', 'book', '确认保存活动文案'); state.activePet = 'xiaoba'; state.panelOpen = true; startRun(s, '请保存确认后的活动邀请。'); }
});
root.addEventListener('keydown', event => {
  if (event.target.matches('#message-input') && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submitMessage(); }
});
document.addEventListener('keydown', event => {
  if (event.isComposing || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); cycleVariant(event.key === 'ArrowLeft' ? -1 : 1); }
  if (event.key === 'Escape' && (state.profilePet || state.outputPreview)) { state.profilePet = null; state.outputPreview = null; render(); }
});
root.addEventListener('dragstart', event => {
  const item = event.target.closest('[data-material-id]'); if (!item) return;
  event.dataTransfer.setData('application/x-wisp-material', item.dataset.materialId);
  event.dataTransfer.setData('text/plain', material.name); event.dataTransfer.effectAllowed = 'copy';
});
root.addEventListener('dragover', event => {
  const target = event.target.closest('[data-drop-pet]'); if (!target) return;
  event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
  root.querySelectorAll('.drag-over').forEach(e => { if (e !== target) e.classList.remove('drag-over'); }); target.classList.add('drag-over');
});
root.addEventListener('dragleave', event => { const target = event.target.closest('[data-drop-pet]'); if (target && !target.contains(event.relatedTarget)) target.classList.remove('drag-over'); });
root.addEventListener('dragend', () => root.querySelectorAll('.drag-over').forEach(e => e.classList.remove('drag-over')));
root.addEventListener('drop', event => {
  const target = event.target.closest('[data-drop-pet]'); if (!target) return;
  event.preventDefault(); event.stopPropagation();
  const { dropPet, dropKind, dropSession } = target.dataset;
  const transfer = event.dataTransfer;
  let files;
  if (transfer.getData('application/x-wisp-material') === material.id) files = [{ ...material }];
  else if (transfer.files.length) files = [...transfer.files].map(file => ({ name: file.name, type: file.type || '文件', size: file.size }));
  else { const text = transfer.getData('text/uri-list') || transfer.getData('text/plain'); files = text ? [{ name: /^https?:/.test(text) ? '交付的链接' : '交付的文字', type: '文本', text: text.slice(0, 2000) }] : []; }
  if (files.length) deliver(dropPet, dropKind, files, dropSession);
});
// Exact row/frame durations from the owning PetSprite.tsx. Miku is intentionally a static preview.
const animations = { idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] }, failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] }, waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] }, running: { row: 7, durations: [120, 120, 120, 120, 120, 220] } };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function animateSprites(now) {
  root.querySelectorAll('.pet-sprite').forEach(element => {
    const animation = reducedMotion.matches ? animations.idle : animations[element.dataset.animation] || animations.idle;
    let frame = 0;
    if (!reducedMotion.matches) { let offset = now % animation.durations.reduce((a, b) => a + b, 0); while (offset >= animation.durations[frame] && frame < animation.durations.length - 1) offset -= animation.durations[frame++]; }
    element.style.backgroundPosition = `${-frame * 192}px ${-(reducedMotion.matches ? 0 : animation.row) * 208}px`;
  });
  requestAnimationFrame(animateSprites);
}
reset(); requestAnimationFrame(animateSprites);
