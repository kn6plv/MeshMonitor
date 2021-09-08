const dummyWS = { send: () => {} };
let ws = dummyWS;

// If the window disconnects from the server, poll until it comes back and reload
function watchAndReload() {
  if (window.location.pathname === '/') {
    const TIMEOUT = 10000;
    function reload() {
      const req = new XMLHttpRequest();
      req.open('GET', window.location);
      req.onreadystatechange = function() {
        if (req.readyState === 4) {
          if (req.status === 200) {
            window.location.reload();
          }
          else {
            setTimeout(reload, TIMEOUT);
          }
        }
      }
      req.timeout = TIMEOUT;
      try {
        req.send(null);
      }
      catch (_) {
      }
    }
    setTimeout(reload, TIMEOUT);
  }
}

const onMessage = {
};

function runMessageManager() {
  let keepalive;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${location.pathname}ws${location.search}`);
  ws.addEventListener('close', () => {
    clearInterval(keepalive);
    ws = dummyWS;
    watchAndReload();
  });
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    const fn = onMessage[msg.cmd];
    if (fn) {
      fn(msg);
    }
  });
  ws.addEventListener('open', () => {
    const hashes = decodeURIComponent(location.hash).split('#');
    let arg;
    try {
      arg = JSON.parse(atob(hashes[2]));
    }
    catch (_) {
    }
    send("tab.select", { name: hashes[1] || 'summary', arg: arg });
  });
  setInterval(() => send('keepalive'), 30 * 1000);
}

const psend = {};
function send(cmd, value, delay) {
  clearTimeout(psend[cmd]);
  if (delay !== undefined) {
    psend[cmd] = setTimeout(() => {
      send(cmd, value);
    }, delay * 1000);
  }
  else {
    ws.send(JSON.stringify({
      cmd: cmd,
      value: value
    }));
  }
}

onMessage['html.update'] = msg => {
  const node = document.getElementById(msg.value.id);
  if (node) {
    const active = document.activeElement;
    node.innerHTML = msg.value.html;
    if (active && active.id) {
      const elem = document.getElementById(active.id);
      if (elem && elem != active && (active.nodeName === 'INPUT' || active.nodeName === 'SELECT' || active.nodeName === 'TEXTAREA')) {
        elem.replaceWith(active);
        active.focus();
      }
    }
    const scripts = node.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      try {
        eval(scripts[i].innerText);
      }
      catch (e) {
        console.error(e);
      }
    }
  }
}

currentLocation = {};

function updateHash() {
  let nhash = '#';
  if (currentLocation.name) {
    nhash += currentLocation.name;
  }
  for (const k in currentLocation.arg) {
    nhash += `#${btoa(JSON.stringify(currentLocation.arg))}`;
    break;
  }
  if (location.hash !== nhash) {
    location.hash = nhash;
  }
}

onMessage['page.change'] = msg => {
  currentLocation = Object.assign({ name: '', arg: {} }, msg.value);
  updateHash();
}

window.addEventListener('pageshow', runMessageManager);
window.addEventListener('hashchange', () => {
  const hashes = location.hash.split('#');
  let arg;
  try {
    arg = JSON.parse(atob(hashes[2]));
  }
  catch (_) {
  }
  send("tab.select", { name: hashes[1], arg: arg });
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    send('ui.visible', true);
  }
  else {
    send('ui.visible', false);
  }
});

const visibleQ = [];
window.whenVisible = (id, tick, callback) => {
  (new MutationObserver(() => {
    clearTimeout(entry.timer);
  })).observe(document.getElementById(id), { childList: true });
  const now = Date.now();
  const entry = {
    tick: tick * 1000,
    callback: callback,
    timer: null,
    last: now,
    exec: () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const delay = now - entry.last;
        entry.last = now;
        entry.timer = setTimeout(entry.exec, entry.tick - (entry.last % entry.tick));
        try {
          entry.callback(delay);
        }
        catch (e) {
          console.error(e);
        }
      }
      else {
        entry.timer = 'pending';
      }
    }
  };
  visibleQ.push(entry);
  entry.timer = setTimeout(entry.exec, entry.tick - (entry.last % entry.tick));
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    visibleQ.forEach(entry => {
      if (entry.timer === 'pending') {
        entry.exec();
      }
    });
  }
});
