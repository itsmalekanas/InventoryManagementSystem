// Windows integration check. Requires Node 22+, Chrome, and a built app.
// All shop data and browser profiles are isolated in a temporary directory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
const exe=path.resolve(process.argv[2]||process.env.INVENTORY_TEST_EXE||path.resolve(__dirname,'../dist/Inventory Management System.exe'));
const chromeExe=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-regression-'));
const children=[];let chrome,socket;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){const result=await fn();if(result)return result;await pause(70);}throw new Error('Timed out');}
async function freePort(){const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));return port;}
async function launch(binary,port,data){const args=['-port',String(port),'-no-tray','-no-browser'];if(data)args.push('-data',data);const child=spawn(binary,args,{windowsHide:true,stdio:'ignore'});children.push(child);return child;}
async function data(url){return (await fetch(url+'/api/data')).json();}
async function api(url,endpoint,body,method='POST'){
  const current=await data(url);if(endpoint==='/api/sales'&&!body.requestId)body={...body,requestId:require('node:crypto').randomBytes(16).toString('hex')};
  const res=await fetch(url+endpoint,{method,headers:{'Content-Type':'application/json','X-Inventory-Generation':current.generation},body:body===undefined?undefined:JSON.stringify(body)});return{status:res.status,...await res.json()};
}
(async()=>{
  // Separate physical copies sharing a preferred port must use their own data.
  let copyPort=await freePort();while(copyPort>65000)copyPort=await freePort();
  const copies=[];for(const name of ['copy-a','copy-b']){const folder=path.join(artifacts,name);fs.mkdirSync(folder);const binary=path.join(folder,'Inventory Management System.exe');fs.copyFileSync(exe,binary);copies.push(binary);}
  await launch(copies[0],copyPort);const copyA=`http://127.0.0.1:${copyPort}`;await until(async()=>{try{return(await data(copyA)).db;}catch{return false;}});
  await launch(copies[1],copyPort);const copyB=`http://127.0.0.1:${copyPort+1}`;await until(async()=>{try{return(await data(copyB)).db;}catch{return false;}});
  await api(copyA,'/api/products',{name:'Only in shop A',price:1,stock:2,images:[]});assert.equal((await data(copyB)).db.products.length,0);
  const duplicate=await launch(copies[0],copyPort);await until(()=>duplicate.exitCode!==null);assert.equal(duplicate.exitCode,0);
  const identityA=await(await fetch(copyA+'/api/ping')).json(),identityB=await(await fetch(copyB+'/api/ping')).json();assert.notEqual(identityA.dataDir,identityB.dataDir);assert.equal(identityA.buildId,identityB.buildId);

  let port=await freePort();while(Math.abs(port-copyPort)<50)port=await freePort();const url=`http://127.0.0.1:${port}`;
  await launch(exe,port,path.join(artifacts,'main-data'));await until(async()=>{try{return(await data(url)).db;}catch{return false;}});
  let result=await api(url,'/api/products',{name:'Perfume',price:25000,stock:30,images:[]});assert.equal(result.status,200);const product=result.db.products[0].id;
  result=await api(url,'/api/sales',{customer:{name:'Seed customer'},items:[{productId:product,qty:1}]});assert.equal(result.status,200);const seedInvoice=result.db.invoices[0],seedDate=seedInvoice.date;
  chrome=spawn(chromeExe,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${path.join(artifacts,'browser')}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let output='';chrome.stderr.on('data',chunk=>output+=chunk);const endpoint=await until(()=>output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1]);
  socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});let id=0;const pending=new Map(),events=[];
  socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const item=pending.get(m.id);pending.delete(m.id);m.error?item.reject(new Error(JSON.stringify(m.error))):item.resolve(m.result);}else events.push(m);};
  function command(method,params={},sessionId){return new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});socket.send(JSON.stringify({id:call,method,params,...(sessionId?{sessionId}:{})}));});}
  const {targetId}=await command('Target.createTarget',{url:'about:blank'}),{sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params)=>command(method,params,sessionId);
  const evaluate=async expression=>{const response=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
  await c('Runtime.enable');await c('Page.enable');await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  async function go(hash,selector){await c('Page.navigate',{url:url+'/'+hash});await until(()=>evaluate(`!!document.querySelector(${JSON.stringify(selector)})`));await evaluate('languageStylesReady');}
  async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
  async function input(selector,value,event='input'){await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);}
  await go('#/','#lang-btn');assert.ok((await evaluate('document.title')).includes('Inventory Management System'));assert.ok((await evaluate('document.querySelector(".home-brand").textContent')).includes('Inventory Management System'));assert.equal(await evaluate('document.querySelector(".app-version").textContent'),fs.readFileSync(path.resolve(__dirname,'../VERSION'),'utf8').trim());
  const controlRects=()=>evaluate('Array.from(document.querySelectorAll(".home-actions button"),button=>{const rect=button.getBoundingClientRect();return{x:rect.x,y:rect.y,width:rect.width,height:rect.height}})');
  const equalRects=(before,after)=>before.forEach((rect,i)=>Object.keys(rect).forEach(key=>assert.ok(Math.abs(rect[key]-after[i][key])<1,`Control moved: ${key}`)));
  const homeReady=async()=>{await until(()=>evaluate('!document.querySelector("#lang-btn").disabled'));await evaluate('languageStylesReady');};
  const englishControls=await controlRects();await click('#theme-btn');await until(()=>evaluate('document.documentElement.dataset.bsTheme==="dark"'));await homeReady();equalRects(englishControls,await controlRects());
  await click('#lang-btn');await until(()=>evaluate('document.documentElement.dir==="rtl"'));await homeReady();equalRects(englishControls,await controlRects());
  const homeShot=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'home-ar-dark.png'),Buffer.from(homeShot.data,'base64'));
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});const mobileControls=await controlRects();
  await click('#lang-btn');await until(()=>evaluate('document.documentElement.dir==="ltr"'));await homeReady();equalRects(mobileControls,await controlRects());assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await click('#theme-btn');await until(()=>evaluate('document.documentElement.dataset.bsTheme==="light"'));await homeReady();
  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await go('#/products','#p-add');await click('#p-add');await input('#pf [name=name]','Validation product');await input('#pf [name=stock]','2');
  for(const value of ['-5','12.5']){await input('#pf [name=price]',value);await input('#pf [name=price]',value,'blur');assert.equal(await evaluate('document.querySelector("#pf").price.value'),value);await click('#pf-save');assert.equal((await data(url)).db.products.length,1);}
  await input('#pf [name=price]','٢٥٬٠٠٠');await input('#pf [name=stock]','-2');await click('#pf-save');assert.equal((await data(url)).db.products.length,1);
  await input('#pf [name=stock]','٢');await click('#pf-save');await until(async()=>(await data(url)).db.products.length===2);await until(()=>evaluate('!document.querySelector("#modal").classList.contains("show")'));await pause(200);
  await go('#/settings','#sf');await input('#sf [name=lowStock]','12.5');await click('#sf-save');assert.equal((await data(url)).db.settings.lowStock,5);
  await evaluate('leaveGuard=null');
  await go('#/pos','#sale-btn');await evaluate(`document.querySelector('.pcard[data-id="${product}"]').click()`);await input('#c-name','Browser buyer');await input('.cart-line .qty','-1','change');assert.equal(await evaluate('!!document.querySelector(".qty.is-invalid")'),true);await click('#sale-btn');assert.equal((await data(url)).db.invoices.length,1);await input('.cart-line .qty','٢','change');
  // Price edits affect this line only, support gifts, and can be reset.
  await click('[data-act=price]');await input('#sale-price-input','-1');await click('#sale-price-form button[type=submit]');assert.equal(await evaluate('state.cart[0].customPrice'),undefined);
  await input('#sale-price-input','0');await click('#sale-price-form button[type=submit]');assert.equal(await evaluate('cartTotal()'),0);await pause(350);
  await click('[data-act=price]');await click('#sale-price-reset');assert.equal(await evaluate('cartTotal()'),50000);await pause(350);
  await click('[data-act=price]');await input('#sale-price-input','١٢٬٥٠٠');await click('#sale-price-form button[type=submit]');assert.equal(await evaluate('cartTotal()'),25000);await pause(350);
  // Simulate a successful save whose HTTP response never reaches the UI.
  await evaluate(`window.realFetch=window.fetch;window.fetch=async function(resource,options){const path=new URL(resource,location.href).pathname;if(path==='/api/sales'&&options?.method==='POST'){await realFetch(resource,options);throw new TypeError('simulated lost response');}if(path.startsWith('/api/sales/requests/'))throw new TypeError('simulated lookup outage');return realFetch(resource,options);}`);
  await click('#sale-btn');await until(()=>evaluate('!!document.querySelector("#checkout-retry")&&!checkoutWorking'));let saved=await data(url);assert.equal(saved.db.invoices.length,2);assert.equal(saved.db.products[0].stock,27);const recoveredID=saved.db.invoices[1].id;
  const requestId=await evaluate('state.pendingSale.payload.requestId');assert.equal(requestId.length,32);
  assert.equal(saved.db.invoices[1].items[0].price,12500);assert.equal(saved.db.invoices[1].total,25000);assert.equal(saved.db.products[0].price,25000);assert.equal(await evaluate('state.pendingSale.payload.items[0].customPrice'),12500);
  // Another sale occurring meanwhile must not make retry open the newest one.
  await api(url,'/api/sales',{customer:{name:'Other sale'},items:[{productId:product,qty:1}]});await evaluate('window.fetch=window.realFetch');await click('#checkout-retry');await until(()=>evaluate(`location.hash==='#/invoice/${recoveredID}'`));saved=await data(url);assert.equal(saved.db.invoices.length,3);assert.equal(saved.db.products[0].stock,26);assert.equal(await evaluate('state.pendingSale'),null);
  // Reopening the page looks up a persisted attempt, without posting a new sale.
  await go('#/pos','#sale-btn');await evaluate(`document.querySelector('.pcard[data-id="${product}"]').click()`);await input('#c-name','Reload buyer');await evaluate(`window.realFetch=window.fetch;window.fetch=async function(resource,options){const path=new URL(resource,location.href).pathname;if(path==='/api/sales'&&options?.method==='POST'){await realFetch(resource,options);throw new TypeError('simulated lost response');}if(path.startsWith('/api/sales/requests/'))throw new TypeError('simulated lookup outage');return realFetch(resource,options);}`);await click('#sale-btn');await until(()=>evaluate('!!document.querySelector("#checkout-retry")&&!checkoutWorking'));saved=await data(url);const reloadID=saved.db.invoices[3].id;
  await evaluate('window.previousCheckoutPage=true');await c('Page.reload',{ignoreCache:true});await until(async()=>{try{return await evaluate(`window.previousCheckoutPage!==true && location.hash==='#/invoice/${reloadID}' && !!document.querySelector('#inv-print')`);}catch{return false;}});assert.equal((await data(url)).db.invoices.length,4);
  // Cancel an attempt that never reached the server, then deliver it late.
  await go('#/pos','#sale-btn');await evaluate(`document.querySelector('.pcard[data-id="${product}"]').click()`);await input('#c-name','Cancelled buyer');await evaluate(`window.realFetch=window.fetch;window.fetch=async function(resource,options){if(new URL(resource,location.href).pathname==='/api/sales'&&options?.method==='POST')throw new TypeError('simulated outage');return realFetch(resource,options);}`);await click('#sale-btn');await until(()=>evaluate('!!document.querySelector("#checkout-cancel")&&!checkoutWorking'));const cancelled=await evaluate('state.pendingSale.payload');await evaluate('window.fetch=window.realFetch');await click('#checkout-cancel');await until(()=>evaluate('!!document.querySelector("#sale-btn")&&!state.pendingSale'));const late=await api(url,'/api/sales',cancelled);assert.equal(late.status,409);assert.equal(late.error,'err.saleCancelled');assert.equal((await data(url)).db.invoices.length,4);

  // Four independent date/time combinations, preview, print and actual PDF.
  for(const [showDate,showTime] of [[true,true],[true,false],[false,true],[false,false]]){
    await go('#/settings','#sf');await evaluate(`document.querySelector('#sf-date').checked=${showDate};document.querySelector('#sf-time').checked=${showTime};document.querySelector('#sf').dispatchEvent(new Event('change',{bubbles:true}))`);const preview=await evaluate('document.querySelector("#sf-preview .inv-date-time")?.textContent||""');assert.equal(/\d{4}-\d{2}-\d{2}/.test(preview),showDate);assert.equal(/\d{2}:\d{2}/.test(preview),showTime);await click('#sf-save');await until(()=>evaluate('!document.querySelector("#sf-save").disabled'));
    await go('#/invoice/'+seedInvoice.id,'#inv-pdf');const shown=await evaluate('document.querySelector(".inv-date-time")?.textContent||""');assert.equal(/\d{4}-\d{2}-\d{2}/.test(shown),showDate);assert.equal(/\d{2}:\d{2}/.test(shown),showTime);assert.equal((await data(url)).db.invoices[0].date,seedDate);
    await c('Emulation.setEmulatedMedia',{media:'print'});assert.equal(await evaluate('document.querySelector(".inv-date-time")?.textContent||""'),shown);await c('Emulation.setEmulatedMedia',{media:''});
    const folder=path.join(artifacts,`pdf-${showDate}-${showTime}`);fs.mkdirSync(folder);await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:folder,eventsEnabled:true});
    await evaluate(`window.baseHtml2pdf=html2pdf;window.html2pdf=function(){const worker=baseHtml2pdf();const set=worker.set;worker.set=function(options){if(options?.html2canvas)options.html2canvas.onclone=doc=>{window.exportDateTime=doc.querySelector('.html2pdf__container .inv-date-time')?.textContent||''};return set.call(this,options)};return worker;}`);
    await click('#inv-pdf');await until(()=>fs.existsSync(path.join(folder,seedInvoice.code+'.pdf')),60000);assert.equal(await evaluate('window.exportDateTime'),shown);await evaluate('window.html2pdf=window.baseHtml2pdf');
  }
  assert.equal(events.filter(event=>event.method==='Runtime.exceptionThrown').length,0);
  console.log(JSON.stringify({passed:true,artifacts,checks:'separate app-copy data folders and reuse, invalid price/stock/quantity/settings input, Arabic digits, dropped checkout response, original invoice selection, reload recovery, cancellation/late delivery, independent date/time preview/print/PDF combinations'},null,2));await command('Browser.close');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();chrome?.kill();for(const child of children)child.kill();});
