const FS = require('fs');

const CACHE_MAXAGE = 0;// 24 * 60 * 60; // 24 hours

const Main = require('./pages/Main');
const Pages = {
  '/':                  { fn: Main.HTML },
  '/ws':                { fn: Main.WS },
  '/js/script.js':      { path: `${__dirname}/static/script.js`, type: 'text/javascript' },
  '/js/chart.js':       { path: `${__dirname}/../node_modules/chart.js/dist/chart.min.js`, type: 'text/css' },
  '/css/general.css':   { path: `${__dirname}/static/general.css`, type: 'text/css' },
  '/css/main.css':      { path: `${__dirname}/static/main.css`, type: 'text/css' },
};


function Register(root, wsroot) {

  if (!process.env.DEBUG) {
    for (let name in Pages) {
      const page = Pages[name];
      if (page.fn) {
        page.get = page.fn;
      }
      else {
        const options = {};
        if (page.encoding !== 'binary') {
          options.encoding = page.encoding || 'utf8';
        }
        const data = FS.readFileSync(page.path, options);
        page.get = async ctx => {
          ctx.body = data;
          ctx.type = page.type;
          if (CACHE_MAXAGE) {
            ctx.cacheControl = { maxAge: CACHE_MAXAGE };
          }
        }
      }
    }
  }
  else {
    for (let name in Pages) {
      const page = Pages[name];
      if (page.fn) {
        page.get = page.fn;
      }
      else {
        page.get = async ctx => {
          const options = {};
          if (page.encoding !== 'binary') {
            options.encoding = page.encoding || 'utf8';
          }
          ctx.body = FS.readFileSync(page.path, options);
          ctx.type = page.type;
        }
      }
    }
  }

  for (let name in Pages) {
    if (name.endsWith('/ws')) {
      wsroot.get(name, Pages[name].get);
    }
    else {
      root.get(name, Pages[name].get);
    }
  }

}

module.exports = Register;
