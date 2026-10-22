// Source-only website/component compatibility checks; never runs a production build.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';
import { createServer } from '../../bayjs.org/node_modules/vite/dist/node/index.js';

async function checks() {
  const cases = await (await fetch('/__migration/cases.json')).json();
  const reports = [];
  await Promise.all(cases.map((entry, i) => new Promise(resolve => {
    const frame = document.createElement('iframe');
    const listener = event => {
      if (event.source !== frame.contentWindow || !event.data.migration) return;
      window.removeEventListener('message', listener);
      reports.push({ name: entry.id, ...event.data.migration });
      document.querySelector('#result').textContent = JSON.stringify(reports);
      frame.remove(); resolve();
    };
    window.addEventListener('message', listener);
    frame.src = '/__migration/fixture?i=' + i;
    document.body.append(frame);
  })));
  const site = document.createElement('iframe');
  site.src = '/examples?tab=examples&item=example_counter'; document.body.append(site);
  const interactions = [];
  const errors = [];
  const pause = () => new Promise(resolve => setTimeout(resolve, 40));
  const wait = async predicate => {
    for (let i=0;i<160;i++) { if(predicate()) return; await pause(); }
    throw Error('Timed out waiting for website navigation');
  };
  try {
    await wait(()=>site.contentDocument?.querySelector('#code_result')?.contentDocument?.querySelector('example-template')?.shadowRoot?.querySelector('button'));
    const doc=site.contentDocument, win=site.contentWindow;
    interactions.push({name:'website uses authoritative source',pass:typeof win.bay.html==='function'});
    interactions.push({name:'sidebar trusted icons render',pass:Boolean(doc.querySelector('accordions-examples').shadowRoot.querySelector('svg'))});
    const preview=doc.querySelector('#code_result');
    const previewWindow=preview.contentWindow;
    previewWindow.requestAnimationFrame=callback=>previewWindow.setTimeout(()=>callback(previewWindow.performance.now()),16);
    previewWindow.cancelAnimationFrame=id=>previewWindow.clearTimeout(id);
    // Flush the first frame queued before the test gained access to the Blob window.
    previewWindow.requestAnimationFrame(()=>preview.contentDocument.querySelector('example-template').render());
    await wait(()=>previewWindow.bay[preview.contentDocument.querySelector('example-template').uniqid]?.events);
    const counter=preview.contentDocument.querySelector('example-template').shadowRoot;
    const before=Number(counter.querySelector('p').textContent);
    counter.querySelectorAll('button')[1].click();
    await wait(()=>Number(counter.querySelector('p').textContent)===before+1);
    interactions.push({name:'actual editor preview counter updates',pass:Number(counter.querySelector('p').textContent)===before+1});
    doc.querySelector('accordions-examples').shadowRoot.querySelector('p[data-menu="example_functions_decode"]').click();
    await wait(()=>doc.querySelector('#code_result')!==preview && doc.querySelector('#code_result')?.contentDocument?.querySelector('example-template')?.shadowRoot?.querySelector('h1'));
    interactions.push({name:'sidebar navigation updates URL and trusted HTML preview',pass:win.location.search.includes('example_functions_decode')});
    win.history.pushState({},'', '/docs?doc=introduction&tab=start'); win.bay.update_route();
    await wait(()=>doc.querySelector('bay-docs')?.shadowRoot?.querySelector('docs-1')?.shadowRoot?.querySelector('h1'));
    const introduction=doc.querySelector('bay-docs').shadowRoot.querySelector('docs-1').shadowRoot;
    interactions.push({name:'documentation navigation renders',pass:introduction.textContent.includes('What is Bay.js?')});
    await wait(()=>introduction.querySelector('bay-codemirror')?.shadowRoot?.querySelector('iframe')?.src.startsWith('blob:'));
    interactions.push({name:'documentation editor uses owned Blob URL',pass:true});
    errors.push(...win.siteErrors);
  } catch(error) { errors.push(String(error),...(site.contentWindow?.siteErrors??[])); }
  reports.push({name:'website_navigation',errors,interactions,roots:[{tag:'website'}]});
  site.remove();
  document.querySelector('#result').textContent = JSON.stringify(reports);
}

function siteInit() {
  window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);
  window.cancelAnimationFrame=clearTimeout;
  window.siteErrors=[];
  console.error=(...args)=>window.siteErrors.push(args.map(String).join(' '));
  window.addEventListener('unhandledrejection',event=>{window.siteErrors.push(String(event.reason));event.preventDefault();});
  window.addEventListener('error',event=>{if(event.message)window.siteErrors.push(event.message);});
  // Only the external editor widget is stubbed; Bay, routing and previews are real.
  window.CodeMirror={fromTextArea:element=>({getValue:()=>element.value})};
}

function bootstrap() {
  window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16);
  window.cancelAnimationFrame = clearTimeout;
  const errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));
  window.addEventListener('error', event => { if (event.message) errors.push(event.message); });
  window.addEventListener('unhandledrejection', event => { errors.push(String(event.reason)); event.preventDefault(); });
  window.alert = () => {};
  const nativeFetch = window.fetch;
  window.fetch = (url, ...args) => String(url).includes('dummyjson.com/products')
    ? Promise.resolve(new Response(JSON.stringify({products:[{id:1,title:'<img src=x onerror=alert(1)>',
      description:'Fixture product',price:12,discountPercentage:0,rating:4.5,stock:3,thumbnail:'/favicon.svg'}]}),
      {headers:{'Content-Type':'application/json'}})) : nativeFetch(url, ...args);
  window.addEventListener('load', () => setTimeout(async () => {
    const interactions = [];
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    const run = document.querySelector('#example-inline').value;
    try {
      if (run === 'slide' || run === 'modal') {
        const root = document.querySelector(run === 'slide' ? 'example-slide' : 'example-modal').shadowRoot;
        root.querySelector('button').click(); await pause();
        interactions.push({name:run+' opens',pass:root.querySelector(run==='slide'?'bay-slide':'bay-modal').getAttribute('open')==='true'});
      }
      if (run === 'todos') {
        const root = document.querySelector('todos-template').shadowRoot;
        const input = root.querySelector('#add-todo');
        const value = '<img src=x onerror=alert(1)> O\'Brien';
        input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));
        await pause(); root.querySelector('button').click(); await pause();
        interactions.push({name:'todo user data stays text',pass:root.textContent.includes(value)&&!root.querySelector('img')});
        root.querySelector('input[data-id]').click(); await pause();
        interactions.push({name:'trusted checkbox attributes update',pass:Boolean(root.querySelector('del'))});
      }
      if (run === 'products') {
        interactions.push({name:'remote product title remains text',pass:
          document.querySelector('.product-desc')?.textContent.includes('<img src=x onerror=alert(1)>') &&
          !document.querySelector('img[onerror]')});
      }
      if (run === 'clock') interactions.push({name:'trusted clock markers remain SVG elements',pass:
        document.querySelector('bay-clock')?.shadowRoot.querySelectorAll('ellipse').length>=60});
      if (run === 'table') interactions.push({name:'trusted sort arrows remain elements',pass:
        document.querySelectorAll('th i').length===5});
      if (run === 'svgtext') interactions.push({name:'SVG lines use structural text spans',pass:
        document.querySelector('svg-text')?.shadowRoot.querySelector('tspan')?.textContent.includes('Hello')});
      if (run === 'route') {
        const route = document.createElement('bay-route');
        route.setAttribute('href','/migration-destination?name=O%27Brien');
        route.setAttribute('title','" onmouseover="window.compromised=true');
        route.setAttribute('onclick','window.routeHostClicked=true');
        route.innerHTML='<span>Nested route content</span>';
        document.body.append(route); await pause();
        const anchor=route.querySelector('a');
        interactions.push({name:'copied route attributes cannot break out',pass:anchor?.title==='" onmouseover="window.compromised=true'&&!anchor?.hasAttribute('onmouseover')});
        interactions.push({name:'authored host handlers are not copied into trusted markup',pass:route.hasAttribute('onclick')&&!anchor?.hasAttribute('onclick')});
        anchor?.querySelector('span').click(); await pause();
        interactions.push({name:'nested route content navigates',pass:location.pathname==='/migration-destination'&&window.routeHostClicked&&!window.compromised});
      }
    } catch(error) { errors.push(String(error)); }
    const roots = [];
    function walk(root) {
      for (const element of root.querySelectorAll('*')) if (element.shadowRoot) {
        roots.push({ tag:element.localName, text:element.shadowRoot.textContent.slice(0,120),
          html:element.shadowRoot.querySelector('#bay')?.innerHTML.slice(0,300) });
        walk(element.shadowRoot);
      }
    }
    walk(document);
    parent.postMessage({migration:{errors, roots, interactions, text:document.body.textContent.slice(0,120)}}, location.origin);
  }, 4500));
}

test('website example sources render against authoritative Bay source', async t => {
  const browser = process.env.BAY_TEST_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!existsSync(browser)) return t.skip('Installed Chrome required');
  const site = fileURLToPath(new URL('../../bayjs.org/', import.meta.url));
  const codeedit = readFileSync(join(site, 'codeedit.js'), 'utf8');
  let cases = [...codeedit.matchAll(/case "([^"]+)":([\s\S]*?)(?=\n\s*case |\n\s*\})/g)]
    .map(match => ({ id:match[1], file:/"(\.\/example_code\/[^"?]+)\?raw"/.exec(match[2])?.[1],
      run:/run_fn = "([^"]+)"/.exec(match[2])?.[1] })).filter(entry => entry.file);
  assert.equal(cases.length, 61, 'Every editor example, including the trusted HTML example, must be covered');
  if (process.env.BAY_MIGRATION_FILTER) cases = cases.filter(entry=>new RegExp(process.env.BAY_MIGRATION_FILTER).test(entry.id));
  const profile = mkdtempSync(join(tmpdir(), 'bay-migration-browser-'));
  const server = await createServer({ root:site, configFile:join(site,'vite.config.js'),
    cacheDir:join(profile,'vite-cache'), server:{host:'127.0.0.1',port:0},
    optimizeDeps:{noDiscovery:true,include:[]}, logLevel:'error',
    plugins:[{name:'migration-fixtures', transformIndexHtml(html) {
      return html.replace(/<script src="https:[^>]+><\/script>/g,'')
        .replace('<head>','<head><script src="/__migration/site-init.js"></script>');
    }, configureServer(server) {
      server.middlewares.use((request,response,next) => {
        const url = new URL(request.url, 'http://localhost');
        const path = url.pathname;
        if (!path.startsWith('/__migration/')) return next();
        if (/\.m?js$/.test(path)) response.setHeader('Content-Type','text/javascript');
        if (path === '/__migration/site-init.js') return response.end(`(${siteInit.toString()})();`);
        if (path === '/__migration/cases.json') {
          response.setHeader('Content-Type','application/json'); return response.end(JSON.stringify(cases));
        }
        if (path === '/__migration/checks.mjs') return response.end(`(${checks.toString()})().catch(error=>document.querySelector('#result').textContent=JSON.stringify({fatal:String(error)}));`);
        if (path === '/__migration/bootstrap.mjs') return response.end(`(${bootstrap.toString()})();`);
        if (path === '/__migration/lodash.mjs') return response.end('export default {capitalize:value=>String(value).charAt(0).toUpperCase()+String(value).slice(1)};');
        response.setHeader('Content-Type','text/html');
        if (path === '/__migration/fixture') {
          const entry = cases[Number(url.searchParams.get('i'))];
          let snippet = readFileSync(join(site,entry.file),'utf8')
            .replace(/<script src="main.js"[^>]*><\/script>/g,'')
            .replace(/(?:https?:)?\/\/cdn\.jsdelivr\.net\/npm\/@dunks1980\/bay\.js(?:@[^/"'\s]+)?\/bay(?:\.min)?\.js/g,'/__bay/bay.js')
            .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@dunks1980\/bay\.js(?:@[^/"'\s]+)?\/components\/(route|slide|modal)\.mjs/g,'%{origin}/__bay/components/$1.mjs')
            .replace('https://cdn.jsdelivr.net/npm/@esm-bundle/lodash@latest/+esm','%{origin}/__migration/lodash.mjs');
          if (entry.run === 'create') snippet = '<my-element color="green" font-size="3rem"></my-element>';
          if (entry.run === 'refresh') snippet = '<template id="new-bay"><h1>${"<new-bay></new-bay>"}</h1></template>';
          return response.end(`<!doctype html><html><head><script type="module" src="/__migration/bootstrap.mjs"></script></head><body><input id="example-inline" type="hidden" value="${entry.run}">${snippet}<script type="module" src="/example_bay.js"></script></body></html>`);
        }
        response.end('<!doctype html><html><body><pre id="result">pending</pre><script type="module" src="/__migration/checks.mjs"></script></body></html>');
      });
    }}],
  });
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    const {stdout,stderr} = await promisify(execFile)(browser,[
      '--headless','--disable-gpu','--no-first-run','--no-default-browser-check',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
      '--disable-extensions','--disable-background-networking',`--user-data-dir=${profile}`,
      '--dump-dom','--virtual-time-budget=15000',`http://127.0.0.1:${port}/__migration/`,
    ],{timeout:45000,maxBuffer:3*1024*1024,windowsHide:true});
    const value=/<pre id="result">([\s\S]*?)<\/pre>/.exec(stdout)?.[1]
      .replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
    assert.ok(value && value !== 'pending','Examples did not finish: ' + stdout.slice(-1800) + stderr.slice(-1200));
    const reports=JSON.parse(value);
    assert.ok(Array.isArray(reports),JSON.stringify(reports));
    assert.equal(reports.length,cases.length+1,'Every selected example and website navigation must finish');
    const failures=reports.filter(report=>report.errors.length || report.interactions.some(check=>!check.pass) || (!report.roots.length && report.name!=='example_template_security'));
    assert.deepEqual(failures,[],JSON.stringify(failures,null,2));
    t.diagnostic(`${cases.length} editor examples and actual website navigation passed; ${reports.reduce((count,report)=>count+report.interactions.length,0)} interaction checks; remote product/lodash responses are deterministic fixtures`);
  } finally {
    await server.close();
    const target=resolve(profile);
    assert.ok(target.startsWith(resolve(tmpdir())+sep) && target.includes('bay-migration-browser-'));
    rmSync(target,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
