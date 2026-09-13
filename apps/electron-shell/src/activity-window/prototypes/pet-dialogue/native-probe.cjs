/*
 * THROWAWAY NATIVE PROBE — never starts the production shell or agent-server.
 * Run from the repo: pnpm --filter handagent-electron-shell exec electron src/activity-window/prototypes/pet-dialogue/native-probe.cjs
 * This file doubles as its own narrow sandbox preload so the experiment stays in two source files.
 */
if (process.type === "renderer") {
  const { contextBridge, ipcRenderer } = require("electron");
  contextBridge.exposeInMainWorld("nativeProbe", {
    requestLayout(mode) {
      if (mode === "collapsed" || mode === "expanded") ipcRenderer.send("wisp-native-probe:layout", mode);
    },
  });
} else {
  runNativeProbe().catch((error) => {
    process.stderr.write(`[native-probe] ${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

async function runNativeProbe() {
  const { app, BrowserWindow, ipcMain, screen, session } = require("electron");
  const fs = require("node:fs");
  const path = require("node:path");
  const os = require("node:os");
  const repoRoot = path.resolve(__dirname, "../../../../../..");
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactRoot = path.join(repoRoot, ".cache/pet-dialogue-native");
  const artifactDir = path.join(artifactRoot, `run-${runId}`);
  const isolatedDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wisp-pet-native-probe-"));
  fs.mkdirSync(artifactDir, { recursive: true });
  app.setName("Wisp Pocket Native Probe");
  app.setPath("userData", isolatedDataDir);
  app.setPath("sessionData", path.join(isolatedDataDir, "session"));
  app.setPath("crashDumps", path.join(isolatedDataDir, "crashes"));
  app.setAppLogsPath(path.join(isolatedDataDir, "logs"));

  const report = {
    experiment: "三透明窗口、展开输入、单槽切换与恢复；只验证本实验应用",
    startedAt: new Date().toISOString(),
    command: "pnpm --filter handagent-electron-shell exec electron src/activity-window/prototypes/pet-dialogue/native-probe.cjs",
    environment: { platform: process.platform, architecture: process.arch, versions: process.versions },
    repoRoot, artifactDir, isolatedDataDir,
    isolation: { productionServerStarted: false, realUserDatabaseOpened: false, networkRequestsBlocked: [] },
    assets: { sprite: "apps/electron-shell/src/activity-window/assets/yachiyo.webp", frame: { column: 0, row: 0, width: 192, height: 208, scale: 2 / 3 } },
    observations: [], checks: [], metrics: [],
    limitations: ["未验证跨应用真实 drop", "未验证透明区域点击穿透", "未验证中文输入法 composition", "未验证 Spaces/全屏切换", "未验证 VoiceOver", "未验证屏幕拔插或另一块屏幕上的布局", "未测量性能；metrics 是一次采样", "截图来自本窗口 capturePage，不是整个桌面的合成截图", "showInactive 与本窗口 isFocused 不等价于已验证外部应用焦点保持"],
  };
  const entries = [];
  const bySender = new Map();
  const sizes = { collapsed: { width: 208, height: 208 }, expanded: { width: 496, height: 640 } };
  const draft = "请先读这篇资料，再给我三个可以继续追问的方向。";
  let cleanupStarted = false;
  let fatalTimer;
  let failure;

  function displayInfo(display) {
    return { id: display.id, label: display.label, bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor, rotation: display.rotation, internal: display.internal };
  }
  function inside(bounds, area) {
    return bounds.x >= area.x && bounds.y >= area.y && bounds.x + bounds.width <= area.x + area.width && bounds.y + bounds.height <= area.y + area.height;
  }
  function clamp(requested, area) {
    const width = Math.min(requested.width, area.width);
    const height = Math.min(requested.height, area.height);
    return { x: Math.round(Math.max(area.x, Math.min(requested.x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(requested.y, area.y + area.height - height))), width, height };
  }
  function boundsFor(entry, mode) {
    const display = screen.getDisplayNearestPoint({ x: entry.anchor.right, y: entry.anchor.bottom });
    const size = sizes[mode];
    return clamp({ x: entry.anchor.right - 200, y: entry.anchor.bottom - size.height, ...size }, display.workArea);
  }
  function setLayout(entry, mode) {
    entry.layout = mode;
    entry.window.setBounds(boundsFor(entry, mode), false);
  }
  async function waitFor(predicate, label) {
    const until = Date.now() + 4000;
    while (!predicate()) {
      if (Date.now() >= until) throw new Error(`Timed out: ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
  async function dom(entry, source) { return entry.window.webContents.executeJavaScript(source, true); }
  function check(name, passed, details) {
    report.checks.push({ name, passed: !!passed, details });
    if (!passed) throw new Error(`Native probe check failed: ${name}`);
  }
  function metrics(label) {
    report.metrics.push({ label, sampledAt: new Date().toISOString(), processes: app.getAppMetrics().map(({ pid, type, creationTime, cpu, memory }) => ({ pid, type, creationTime, cpu, memory })) });
  }
  async function observe(label, captureIds = []) {
    const item = { label, timestamp: new Date().toISOString(), browserWindowCount: BrowserWindow.getAllWindows().length, focusedWindowId: BrowserWindow.getFocusedWindow()?.id ?? null, windows: [] };
    for (const entry of entries) {
      const win = entry.window;
      if (win.isDestroyed()) { item.windows.push({ petId: entry.id, windowId: entry.windowId, destroyed: true }); continue; }
      const bounds = win.getBounds();
      const area = screen.getDisplayMatching(bounds).workArea;
      const state = { petId: entry.id, windowId: win.id, layout: entry.layout, bounds, contentBounds: win.getContentBounds(), visible: win.isVisible(), focused: win.isFocused(), destroyed: win.isDestroyed(), alwaysOnTop: win.isAlwaysOnTop(), backgroundColor: win.getBackgroundColor(), workArea: area, withinWorkArea: inside(bounds, area), dom: await dom(entry, "window.probeSnapshot()") };
      if (captureIds.includes(entry.id)) {
        const captured = await win.webContents.capturePage();
        const pixels = captured.toBitmap();
        let transparent = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] === 0) transparent += 1;
        const filename = `${label}-${entry.id}.png`;
        fs.writeFileSync(path.join(artifactDir, filename), captured.toPNG());
        state.capture = { filename, pixelSize: captured.getSize(), empty: captured.isEmpty(), fullyTransparentPixelRatio: pixels.length ? transparent / (pixels.length / 4) : null };
      }
      item.windows.push(state);
    }
    report.observations.push(item);
    return item;
  }
  async function switchSlot(entry, anchor) {
    for (const current of entries) current.window.hide();
    entry.anchor = { ...anchor };
    setLayout(entry, "collapsed");
    await dom(entry, "window.probeSetExpanded(false)");
    entry.window.showInactive();
    await waitFor(() => entry.window.isVisible(), `single slot ${entry.id}`);
  }
  async function cleanup() {
    if (cleanupStarted) return;
    cleanupStarted = true;
    clearTimeout(fatalTimer);
    ipcMain.removeAllListeners("wisp-native-probe:layout");
    for (const entry of entries) if (!entry.window.isDestroyed()) entry.window.destroy();
    report.cleanup = { windows: entries.map((entry) => ({ petId: entry.id, windowId: entry.windowId, destroyed: entry.window.isDestroyed() })), remainingBrowserWindowCount: BrowserWindow.getAllWindows().length, productionProcessesTouched: false };
    try { session.defaultSession.flushStorageData(); } catch { /* Only scratch data exists. */ }
    report.finishedAt = new Date().toISOString();
    report.success = !failure;
    if (failure) report.error = failure.stack || String(failure);
    fs.writeFileSync(path.join(artifactDir, "report.json"), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(artifactRoot, "latest.json"), JSON.stringify({ artifactDir, reportPath: path.join(artifactDir, "report.json"), isolatedDataDir, success: report.success }, null, 2));
    // Chromium can still write Preferences while Electron exits. This isolated
    // Node helper waits for this exact process to be gone, then removes only its
    // temporary profile and appends the observed result to this run's report.
    const cleanupWorker = require("node:child_process").spawn(process.execPath, ["-e", `
      const fs = require('node:fs');
      const [parentId, temporaryDir, reportPath] = process.argv.slice(1);
      let attempts = 0;
      function afterParentExit() {
        try {
          process.kill(Number(parentId), 0);
          if (attempts++ < 200) setTimeout(afterParentExit, 50);
          return;
        } catch (error) { if (error.code !== 'ESRCH') return; }
        const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        try {
          fs.rmSync(temporaryDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
          data.cleanup.temporaryDataRemovedAfterExit = !fs.existsSync(temporaryDir);
        } catch (error) { data.cleanup.temporaryDataCleanupError = String(error); }
        data.cleanup.cleanupWorkerCompletedAt = new Date().toISOString();
        fs.writeFileSync(reportPath, JSON.stringify(data, null, 2));
      }
      afterParentExit();
    `, String(process.pid), isolatedDataDir, path.join(artifactDir, "report.json")], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "ignore", detached: true });
    report.cleanup.postExitCleanupPid = cleanupWorker.pid;
    cleanupWorker.unref();
    fs.writeFileSync(path.join(artifactDir, "report.json"), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify({ artifactDir, success: report.success, checks: report.checks.length, remainingBrowserWindowCount: report.cleanup.remainingBrowserWindowCount })}\n`);
    app.exit(failure ? 1 : 0);
  }
  app.on("window-all-closed", () => {});
  try {
    await app.whenReady();
    fatalTimer = setTimeout(() => { failure = new Error("Native probe safety deadline exceeded"); void cleanup(); }, 25000);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const cancel = !["file:", "data:"].some((prefix) => details.url.startsWith(prefix));
      if (cancel) report.isolation.networkRequestsBlocked.push(details.url);
      callback({ cancel });
    });
    report.displays = screen.getAllDisplays().map(displayInfo);
    const primary = screen.getPrimaryDisplay();
    report.primaryDisplay = displayInfo(primary);
    const area = primary.workArea;
    const startX = area.x + Math.max(12, Math.floor((area.width - (208 * 3 + 24 * 2)) / 2));
    const fixtures = [
      { id: "pet-writing", name: "八千代 · 写作", role: "把想法说清楚" },
      { id: "pet-research", name: "八千代 · 调研", role: "一起找可靠资料" },
      { id: "pet-organize", name: "八千代 · 整理", role: "收好你交给我的内容" },
    ];
    ipcMain.on("wisp-native-probe:layout", (event, mode) => {
      const entry = bySender.get(event.sender.id);
      if (!entry || !["collapsed", "expanded"].includes(mode) || entry.window.isDestroyed()) return;
      setLayout(entry, mode);
    });
    for (const [index, fixture] of fixtures.entries()) {
      const anchor = { right: startX + index * 232 + 200, bottom: area.y + area.height - 20 };
      const entry = { ...fixture, anchor, originalAnchor: { ...anchor }, layout: "collapsed" };
      const options = { ...boundsFor(entry, "collapsed"), show: false, frame: false, transparent: true, backgroundColor: "#00000000", hasShadow: false, alwaysOnTop: true, skipTaskbar: true, focusable: true, acceptFirstMouse: true, resizable: false, webPreferences: { preload: __filename, contextIsolation: true, nodeIntegration: false, sandbox: true } };
      entry.window = new BrowserWindow(options);
      entry.windowId = entry.window.id;
      entries.push(entry);
      bySender.set(entry.window.webContents.id, entry);
      entry.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      entry.window.webContents.on("will-navigate", (event) => event.preventDefault());
      await entry.window.loadFile(path.join(__dirname, "native-probe.html"), { query: fixture });
      await dom(entry, "window.probeReady");
      entry.window.showInactive();
    }
    await waitFor(() => entries.every((entry) => entry.window.isVisible()), "three visible windows");
    let observed = await observe("01-three-pets", entries.map((entry) => entry.id));
    check("三个真实 BrowserWindow 同时可见且位于工作区内", observed.browserWindowCount === 3 && observed.windows.every((entry) => entry.visible && entry.withinWorkArea), observed.windows.map(({ petId, bounds, focused }) => ({ petId, bounds, focused })));
    check("三窗都载入真实图集与透明画面", observed.windows.every((entry) => entry.dom.spriteLoaded && entry.dom.bodyBackground === "rgba(0, 0, 0, 0)" && entry.capture.fullyTransparentPixelRatio > 0), observed.windows.map(({ petId, capture }) => ({ petId, capture })));
    metrics("three-visible");

    const first = entries[0];
    const initialCharacterAnchor = { right: observed.windows[0].bounds.x + observed.windows[0].dom.characterRect.right, bottom: observed.windows[0].bounds.y + observed.windows[0].dom.characterRect.bottom };
    await dom(first, "document.querySelector('#pet-open').click()");
    await waitFor(() => first.layout === "expanded" && first.window.getBounds().height > 208, "expanded native window");
    await dom(first, "document.querySelector('textarea').focus()");
    await first.window.webContents.insertText(draft);
    observed = await observe("02-expanded-input", [first.id]);
    const expanded = observed.windows[0];
    const expandedCharacterAnchor = { right: expanded.bounds.x + expanded.dom.characterRect.right, bottom: expanded.bounds.y + expanded.dom.characterRect.bottom };
    check("点击原型控件扩展原生窗口并保留角色锚点", expanded.layout === "expanded" && expanded.withinWorkArea && expanded.dom.expanded && initialCharacterAnchor.right === expandedCharacterAnchor.right && initialCharacterAnchor.bottom === expandedCharacterAnchor.bottom, { bounds: expanded.bounds, layout: expanded.layout, initialCharacterAnchor, expandedCharacterAnchor });
    check("文本写入本窗口已聚焦 DOM 输入框", expanded.dom.draft === draft && expanded.dom.activeElement === "draft", expanded.dom);

    await dom(first, "document.querySelector('#collapse').click()");
    await waitFor(() => first.layout === "collapsed" && first.window.getBounds().height === 208, "collapsed native window");
    observed = await observe("03-collapsed-draft", [first.id]);
    check("收起后草稿仍在本 renderer 内", observed.windows[0].dom.draft === draft && !observed.windows[0].dom.expanded, observed.windows[0].dom);

    const requested = { x: area.x + area.width + 600, y: area.y + area.height + 600, ...sizes.collapsed };
    const clamped = clamp(requested, area);
    entries[2].window.setBounds(clamped, false);
    await waitFor(() => inside(entries[2].window.getBounds(), area), "clamped native bounds");
    report.clampObservation = { requested, applied: clamped, actual: entries[2].window.getBounds(), workArea: area };
    check("越界请求经工作区夹取后原生实际 bounds 在屏幕内", inside(report.clampObservation.actual, area), report.clampObservation);

    const slotAnchor = { ...entries[1].originalAnchor };
    for (const [index, entry] of entries.entries()) {
      await switchSlot(entry, slotAnchor);
      observed = await observe(`04-slot-${index + 1}`, [entry.id]);
      check(`单槽仅展示 ${entry.id}`, observed.browserWindowCount === 3 && observed.windows.filter((window) => window.visible).length === 1 && observed.windows.find((window) => window.petId === entry.id).visible, observed.windows.map(({ petId, visible, bounds }) => ({ petId, visible, bounds })));
    }
    for (const entry of entries) {
      entry.anchor = { ...entry.originalAnchor };
      setLayout(entry, "collapsed");
      entry.window.showInactive();
    }
    await waitFor(() => entries.every((entry) => entry.window.isVisible()), "restored three windows");
    observed = await observe("05-restored-three", entries.map((entry) => entry.id));
    check("恢复三宠未重建窗口且草稿保留", observed.browserWindowCount === 3 && observed.windows.every((window) => window.visible && window.withinWorkArea) && observed.windows[0].dom.draft === draft, observed.windows.map(({ petId, windowId, visible, dom: state }) => ({ petId, windowId, visible, draft: state.draft })));
    metrics("restored-three");
    await dom(first, "document.querySelector('#pet-open').click()");
    await waitFor(() => first.layout === "expanded", "reopen preserved draft");
    observed = await observe("06-reopened-draft", [first.id]);
    check("恢复后再次展开仍显示同一草稿", observed.windows[0].dom.draft === draft && observed.windows[0].dom.expanded, observed.windows[0].dom);
  } catch (error) {
    failure = error;
  } finally {
    await cleanup();
  }
}
