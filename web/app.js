const socket = io();

const storageKey = `auto-mmo-settings:${location.host}`;
const el = {
  extStatus: document.getElementById('extStatus'),
  balance: document.getElementById('balance'),
  today: document.getElementById('today'),
  rank: document.getElementById('rank'),
  logs: document.getElementById('logs'),
  deviceTable: document.getElementById('deviceTable'),
  autoPP: document.getElementById('autoPP'),
  targetOn: document.getElementById('targetOn'),
  targetCount: document.getElementById('targetCount'),
  delaySec: document.getElementById('delaySec'),
  resetBusy: document.getElementById('resetBusy')
};

function pushLog(line) {
  el.logs.textContent = `${line}\n${el.logs.textContent}`.slice(0, 7000);
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (typeof data.autoPPLink === 'boolean') el.autoPP.checked = data.autoPPLink;
    if (typeof data.targetEnabled === 'boolean') el.targetOn.checked = data.targetEnabled;
    if (Number.isFinite(data.targetCount)) el.targetCount.value = data.targetCount;
    if (Number.isFinite(data.delayMs)) el.delaySec.value = Math.max(1, Math.round(data.delayMs / 1000));
  } catch {
    // ignore
  }
}

function saveSettings() {
  const settings = {
    autoPPLink: el.autoPP.checked,
    targetEnabled: el.targetOn.checked,
    targetCount: Number(el.targetCount.value),
    delayMs: Number(el.delaySec.value) * 1000
  };
  localStorage.setItem(storageKey, JSON.stringify(settings));
  socket.emit('settings:update', settings);
}

loadSettings();

socket.on('connect', () => pushLog('[socket] connected'));
socket.on('disconnect', () => pushLog('[socket] disconnected'));

socket.on('settings:init', (settings) => {
  el.autoPP.checked = !!settings.autoPPLink;
  el.targetOn.checked = !!settings.targetEnabled;
  el.targetCount.value = settings.targetCount || 50;
  el.delaySec.value = Math.max(1, Math.round((settings.delayMs || 5000) / 1000));
  saveSettings();
});

socket.on('view:update', (d) => {
  el.balance.textContent = d.balance;
  el.today.textContent = d.today;
});

socket.on('top:update', (d) => {
  el.rank.textContent = d.rank;
});

socket.on('devices:update', (devices) => {
  el.deviceTable.innerHTML = devices
    .map((d) => `<tr><td>${d.ip}</td><td>${d.country || '-'}</td><td>${d.status}</td></tr>`)
    .join('');
});

socket.on('log', (l) => pushLog(`[${l.at}] ${l.message}`));
socket.on('withdraw:approved', () => alert('Tiền về, Tiền về'));

for (const btn of document.querySelectorAll('[data-cmd]')) {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    socket.emit(`command:${cmd}`);
  });
}

el.autoPP.addEventListener('change', saveSettings);
el.targetOn.addEventListener('change', () => {
  saveSettings();
  if (el.targetOn.checked) {
    socket.emit('command:start-target', { targetCount: Number(el.targetCount.value) });
  } else {
    socket.emit('command:stop-target');
  }
});
el.targetCount.addEventListener('change', saveSettings);
el.delaySec.addEventListener('change', saveSettings);

el.resetBusy.addEventListener('click', () => {
  pushLog('Yêu cầu reset trạng thái bận đã gửi (thực thi ở backend tùy biến).');
});

window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'EXTENSION_HEARTBEAT') return;
  el.extStatus.textContent = 'Connected';
});

// Heartbeat for extension bridge.
setInterval(() => {
  window.dispatchEvent(new CustomEvent('DASHBOARD_HEARTBEAT', { detail: { at: Date.now() } }));
}, 5000);

setInterval(() => {
  if (el.extStatus.textContent !== 'Connected') {
    pushLog('Cảnh báo: Extension chưa kết nối hoặc context invalidated.');
  }
  el.extStatus.textContent = 'Disconnected';
}, 15000);
