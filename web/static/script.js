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
  ws = new WebSocket(`ws://${location.host}${location.pathname}ws${location.search}`);
  ws.addEventListener('close', () => {
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
    send("tab.select", location.hash.split('#')[1] || 'summary');
  });
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

onMessage['page.change'] = msg => {
  location.hash = msg.value || '';
}

window.addEventListener('pageshow', runMessageManager);
window.addEventListener('hashchange', evt => {
  send("tab.select", location.hash.split('#')[1]);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    send('ui.visible', true);
  }
  else {
    send('ui.visible', false);
  }
});
