// Windows integration check. Requires Node 22+, Chrome, and a built app.
// All shop data and browser profiles are isolated in a temporary directory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
const exe=path.resolve(process.argv[2]||process.env.INVENTORY_TEST_EXE||require('./executable.cjs'));
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
  await go('#/settings','#sf');
  assert.equal(await evaluate('document.querySelector("#sf-save-status").dataset.unsaved'),'false');
  const originalStoreName=await evaluate('document.querySelector("#sf [name=storeName]").value');
  await input('#sf [name=storeName]','Temporary draft');
  assert.equal(await evaluate('document.querySelector("#sf-save-status").dataset.unsaved'),'true');
  await click('#settings-tab-invoice');await click('#settings-tab-general');
  assert.equal(await evaluate('document.querySelector("#sf-save-status").dataset.unsaved'),'true');
  await input('#sf [name=storeName]',originalStoreName);
  assert.equal(await evaluate('document.querySelector("#sf-save-status").dataset.unsaved'),'false');
  const reliability=await evaluate(`(async()=>{
    const form=document.querySelector('#sf'), file=document.querySelector('#sf-logo');
    const oldUpload=uploadImage, oldApi=api;let finishUpload, settingsWrites=0;
    uploadImage=()=>new Promise(resolve=>finishUpload=resolve);
    api=async(method,url,body)=>{if(url==='/api/settings')settingsWrites++;return oldApi(method,url,body);};
    Object.defineProperty(file,'files',{configurable:true,value:[new File(['test'],'test.png',{type:'image/png'})]});
    const pending=file.onchange({target:file});
    const saveBlocked=document.querySelector('#sf-save').disabled;
    form.requestSubmit();
    const unload=new Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);
    finishUpload(state.db.settings.logo);await pending;uploadImage=oldUpload;api=oldApi;
    return {saveBlocked,settingsWrites,unloadBlocked:unload.defaultPrevented,saveEnabled:!document.querySelector('#sf-save').disabled};
  })()`);
  assert.deepEqual(reliability,{saveBlocked:true,settingsWrites:0,unloadBlocked:true,saveEnabled:true});
  await input('#sf [name=lowStock]','12.5');
  assert.ok(await evaluate('(()=>{const e=new Event("beforeunload",{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()'));
  await click('#sf-save');assert.equal((await data(url)).db.settings.lowStock,5);
  await click('#settings-tab-invoice');
  assert.equal(await evaluate('document.querySelectorAll("#sf-save").length'),1);
  assert.equal(await evaluate('document.querySelector("#sf-save").form.id'),'sf');
  assert.equal(await evaluate('!!document.querySelector(".settings-toolbar #sf-save")'),true);
  assert.ok(await evaluate('document.querySelector("#sf-preview .inv-cust").textContent.includes("0000 000 0000")'));
  assert.ok(await evaluate('document.querySelector("#sf-preview .inv-cust").textContent.includes(t("sampleAddress"))'));
  const stickyTop=await evaluate('window.scrollTo(0,600);new Promise(resolve=>requestAnimationFrame(()=>resolve(document.querySelector(".settings-preview").getBoundingClientRect().top)))');
  const stickyLower=await evaluate('window.scrollTo(0,1000);new Promise(resolve=>requestAnimationFrame(()=>resolve(document.querySelector(".settings-preview").getBoundingClientRect().top)))');
  assert.ok(Math.abs(stickyTop-stickyLower)<2,'Preview stays pinned when scrolling down');
  assert.ok(await evaluate('document.querySelector("#sf-save").getBoundingClientRect().top>=0'), 'Save stays visible while scrolling');
  const stickyBack=await evaluate('window.scrollTo(0,700);new Promise(resolve=>requestAnimationFrame(()=>resolve(document.querySelector(".settings-preview").getBoundingClientRect().top)))');
  assert.ok(Math.abs(stickyBack-stickyLower)<2,'Preview stays pinned when scrolling up');
  assert.ok(await evaluate('document.querySelector("#sf-preview").clientHeight<innerHeight'));
  assert.ok(await evaluate('document.querySelector("#sf-preview").scrollHeight>document.querySelector("#sf-preview").clientHeight'));
  await evaluate('window.scrollTo(0,0)');
  await evaluate('closeModal()');await pause(350);
  assert.equal(await evaluate('document.querySelector("#settings-panel-general").hidden'),true);
  assert.equal(await evaluate('document.querySelector("#settings-panel-invoice").hidden'),false);
  await input('#sf [name=invoiceTitle]','Custom draft invoice');
  await click('#settings-tab-general');await click('#settings-tab-invoice');
  assert.equal(await evaluate('document.querySelector("#sf [name=invoiceTitle]").value'),'Custom draft invoice');
  await click('#settings-tab-data');
  assert.equal(await evaluate('document.querySelector("#settings-panel-data").hidden'),false);
  assert.equal(await evaluate('document.querySelector("#settings-panel-data a").getAttribute("href")'),'#/backup');
  // Saving validates fields in inactive tabs and brings the error into view.
  await click('#sf-save');
  assert.equal(await evaluate('document.querySelector("#settings-panel-general").hidden'),false);
  await input('#sf [name=lowStock]','5');await click('#settings-tab-invoice');
  await evaluate('document.querySelector("#settings-tab-invoice").dispatchEvent(new KeyboardEvent("keydown", {key:"Home",bubbles:true}))');
  assert.equal(await evaluate('document.activeElement.id'),'settings-tab-general');
  await evaluate('document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {key:"End",bubbles:true}))');
  assert.equal(await evaluate('document.activeElement.id'),'settings-tab-data');
  await click('#settings-tab-invoice');
  assert.equal(await evaluate('document.querySelector("#settings-tab-invoice").getAttribute("aria-selected")'),'true');
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate('window.scrollTo(0,0)');
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const settingsShot=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'settings-invoice-tab.png'),Buffer.from(settingsShot.data,'base64'));
  assert.equal(await evaluate('document.querySelectorAll("#settings-panel-invoice details").length'),0);
  assert.equal(await evaluate('document.querySelector("#a4-margin").getClientRects().length>0'),true);
  assert.equal(await evaluate('document.querySelectorAll("#sf-a4 input[type=range]").length'),0);
  await input('#a4-spacing','spacious','change');await input('#a4-text-size','large','change');
  assert.equal(await evaluate('document.querySelector("#a4-margin").value'),'20');
  assert.equal(await evaluate('document.querySelector("#a4-fontSize").value'),'18');
  assert.ok(await evaluate('document.querySelector("#text-store-size").placeholder.includes("28")'));
  assert.ok(await evaluate('document.querySelector("#text-labels-weight option:first-child").textContent.includes(t("textStyleRegular"))'));
  assert.equal(await evaluate('document.querySelector("#a4-fontSize").closest("section").id||document.querySelector("#a4-fontSize").closest("section").getAttribute("aria-labelledby")'),'invoice-typography-heading');
  assert.equal(await evaluate('document.querySelector("#a4-advanced #a4-fontSize")'),null);
  await input('#sf [name=accentColor]','#245a81');
  assert.equal(await evaluate('document.querySelector("[data-text-hex=store]").textContent'),'#245A81');
  assert.equal(await evaluate('document.querySelector("[data-text-color-source=store]").textContent'),await evaluate('t("textColorAccent")'));
  await input('#text-store-color','#112233');await input('#sf [name=accentColor]','#28634c');
  assert.equal(await evaluate('document.querySelector("[data-text-hex=store]").textContent'),'#112233');
  assert.equal(await evaluate('document.querySelector("[data-text-color-source=store]").textContent'),await evaluate('t("textColorCustom")'));
  await click('#sf-text-reset');await input('#sf [name=accentColor]','#714b67');
  assert.equal(await evaluate('document.querySelector("[data-text-hex=store]").textContent'),'#714B67');
  assert.equal(await evaluate('document.querySelector("[data-text-hex=values]").textContent'),'#000000');
  await input('select[name=englishFont]','googlesans','change');await input('select[name=arabicFont]','cairo','change');
  await evaluate('document.fonts.ready');
  await evaluate('document.fonts.load("18px InvoiceLatin-inter", "Invoice")');
  assert.ok(await evaluate('document.fonts.check("18px InvoiceLatin-inter", "Invoice")'));
  assert.ok(await evaluate('(async()=>{const faces=await document.fonts.load("18px InvoiceLatin-googlesans","Invoice");return faces.length>0&&faces.every(face=>face.status==="loaded");})()'));
  assert.ok(await evaluate('document.fonts.check("18px InvoiceArabic-cairo", "فاتورة")'));
  assert.ok(await evaluate('(async()=>{for(const [font,text] of [["InvoiceLatin-inter","Invoice"],["InvoiceLatin-sourcesans3","Invoice"],["InvoiceLatin-lora","Invoice"],["InvoiceArabic-cairo","فاتورة"],["InvoiceArabic-tajawal","فاتورة"],["InvoiceArabic-amiri","فاتورة"]]){const loaded=await document.fonts.load("18px "+font,text);if(!loaded.length||loaded.some(face=>face.status!=="loaded"))return false;}return true;})()'));
  await evaluate('document.querySelector("#sf-a4").scrollIntoView();document.querySelectorAll(".modal-backdrop").forEach(el=>el.remove());document.querySelector("#toasts").innerHTML=""');
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate('document.querySelector("#sf-a4").scrollIntoView();new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await evaluate('document.querySelector("#sf-save").getBoundingClientRect().top>=0'),true);
  await evaluate('document.querySelector("#sf-save").focus()');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-save")).boxShadow'),'none');
  const fontsShot=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'invoice-font-gallery.png'),Buffer.from(fontsShot.data,'base64'));
  await input('#a4-headerAlign','end','change');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-meta .inv-value")).fontWeight'),'400');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-table th")).fontWeight'),'400');
  assert.ok(await evaluate('Array.from(document.querySelectorAll("#sf-preview .inv-label"), el=>getComputedStyle(el).fontWeight).every(weight=>weight==="400")'));
  await input('#text-labels-weight','700','change');
  await input('#text-tableHeadings-weight','700','change');
  await input('#text-values-size','14');await input('#text-values-color','#123456');
  await input('#text-totals-weight','500','change');await input('#text-totals-size','22');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-value")).fontSize'),'14px');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-value")).color'),'rgb(18, 52, 86)');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-total td")).fontWeight'),'500');
  await input('#text-values-size','99');await click('#sf-save');
  assert.equal(await evaluate('document.activeElement.id'),'text-values-size');
  await input('#text-values-size','14');
  assert.ok(await evaluate('Array.from(document.querySelectorAll("#sf-preview .inv-label"), el=>getComputedStyle(el).fontWeight).every(weight=>weight==="700")'));
  assert.ok(await evaluate('Array.from(document.querySelectorAll("#sf-preview .inv-value"), el=>getComputedStyle(el).fontWeight).every(weight=>weight==="400")'));
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-table th")).fontWeight'),'700');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-meta .inv-value")).fontWeight'),'400');
  assert.ok(await evaluate('getComputedStyle(document.querySelector("#sf-preview .invoice")).fontFamily.includes("InvoiceLatin-googlesans")'));
  assert.ok(await evaluate('getComputedStyle(document.querySelector("#sf-preview .invoice")).fontFamily.includes("InvoiceArabic-cairo")'));
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .invoice")).fontSize'),'18px');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-head-text")).textAlign'),'end');
  assert.ok(await evaluate('pageCss(state.db.settings).includes("12mm")'));
  await input('#sf [name=lowStock]','5');await click('#sf-save');
  await until(async()=>(await data(url)).db.settings.a4Layout?.margin===20);
  await go('#/settings','#sf');assert.equal(await evaluate('document.querySelector("#a4-margin").value'),'20');
  assert.equal(await evaluate('document.querySelector("#sf-save-status").dataset.unsaved'),'false');
  assert.equal(await evaluate('document.querySelector("select[name=arabicFont]").value'),'cairo');
  assert.equal(await evaluate('document.querySelector("select[name=englishFont]").value'),'googlesans');
  assert.ok(await evaluate('pageCss(state.db.settings).includes("20mm")'));
  assert.equal(await evaluate('document.querySelector("#text-values-size").value'),'14');
  assert.equal(await evaluate('document.querySelector("#text-totals-weight").value'),'500');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-label")).fontWeight'),'700');
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate('document.querySelector("#sf-preview .invoice").classList.add("pdf-page")');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .invoice")).paddingTop'),'0px');
  await c('Emulation.setEmulatedMedia',{media:'print'});
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .invoice")).paddingTop'),'0px');
  await c('Emulation.setEmulatedMedia',{media:''});
  await evaluate('document.querySelector("#sf-preview .invoice").classList.remove("pdf-page")');
  await evaluate('downloadInvoicePdf(state.db.invoices[0], state.db.settings)');
  await input('#sf [name=header]','Sample header');await input('#sf [name=footer]','Sample footer');
  for(const [group,selector] of Object.entries({store:'.inv-store',title:'.inv-title',labels:'.inv-label',values:'.inv-value',tableHeadings:'.inv-table th',rows:'.inv-table tbody td',totals:'.inv-total td',header:'.inv-head-text .prewrap',footer:'.inv-foot'})) {
    await input('#text-'+group+'-size','17');await input('#text-'+group+'-weight','500','change');await input('#text-'+group+'-color','#223344');
    const style=await evaluate('(()=>{const s=getComputedStyle(document.querySelector('+JSON.stringify('#sf-preview '+selector)+'));return [s.fontSize,s.fontWeight,s.color]})()');
    assert.deepEqual(style,['17px','500','rgb(34, 51, 68)'],group);
  }
  assert.equal(await evaluate('document.querySelectorAll("#sf-text-reset").length'),1);
  assert.equal(await evaluate('document.querySelectorAll("[data-text-reset]").length'),0);
  await click('#sf-text-reset');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-label")).fontWeight'),'400');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#sf-preview .inv-value")).fontWeight'),'400');
  assert.equal(await evaluate('document.querySelector("#a4-margin").value'),'20');
  assert.equal(await evaluate('document.querySelector("select[name=englishFont]").value'),'googlesans');
  assert.ok(await evaluate('Array.from(document.querySelectorAll("[data-text-prop=size], [data-text-prop=weight]"),control=>control.value).every(value=>value==="")'));
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await evaluate('window.scrollTo({top:document.querySelector("#sf-text-styles").getBoundingClientRect().top+scrollY-85,behavior:"instant"});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const stylesShot=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'invoice-text-styles.png'),Buffer.from(stylesShot.data,'base64'));
  await click('#sf-a4-reset');await click('#sf-save');await until(async()=>!(await data(url)).db.settings.a4Layout);
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
    await click('#inv-pdf');await until(()=>fs.existsSync(path.join(folder,seedInvoice.code+'.pdf')),60000);assert.equal(await evaluate('window.exportDateTime'),shown);
    await until(()=>evaluate('!document.querySelector("#inv-png").disabled'));
    await click('#inv-png');
    assert.equal(await evaluate('document.querySelector("#inv-pdf").disabled'),true);
    const pngPath=path.join(folder,seedInvoice.code+'.png');
    await until(()=>fs.existsSync(pngPath),60000);
    const png=fs.readFileSync(pngPath);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.ok(png.readUInt32BE(16)>1000);assert.ok(png.readUInt32BE(20)>1000);
    assert.equal(await evaluate('window.exportDateTime'),shown);
    await until(()=>evaluate('!document.querySelector("#inv-pdf").disabled&&!document.querySelector("#inv-png").disabled'));
    await evaluate('window.html2pdf=window.baseHtml2pdf');
  }
  // A short receipt and a long invoice both download as one complete PNG.
  const pngFolder=path.join(artifacts,'png-layouts');fs.mkdirSync(pngFolder);
  await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:pngFolder,eventsEnabled:true});
  await evaluate(`downloadInvoicePng({...state.db.invoices[0],code:'PNG-RECEIPT'},{...state.db.settings,paper:'receipt'})`);
  await until(()=>fs.existsSync(path.join(pngFolder,'PNG-RECEIPT.png')),60000);
  const receiptPng=fs.readFileSync(path.join(pngFolder,'PNG-RECEIPT.png'));assert.ok(receiptPng.readUInt32BE(16)<1000);
  await evaluate(`downloadInvoicePng({...state.db.invoices[0],code:'PNG-LONG',items:Array.from({length:300},(_,i)=>({...state.db.invoices[0].items[0],name:'Synthetic row '+i}))},{...state.db.settings,paper:'a4'})`);
  await until(()=>fs.existsSync(path.join(pngFolder,'PNG-LONG.png')),60000);
  const longPng=fs.readFileSync(path.join(pngFolder,'PNG-LONG.png'));assert.ok(longPng.readUInt32BE(20)>10000);assert.ok(longPng.readUInt32BE(20)<=16384);
  // Failed rendering re-enables both export actions and cleans temporary DOM.
  await evaluate('window.baseHtml2pdf=html2pdf;window.html2pdf=()=>{throw new Error("simulated renderer failure")};document.querySelector("#inv-png").click()');
  await until(()=>evaluate('!document.querySelector("#inv-png").disabled&&!document.querySelector("#inv-pdf").disabled'));
  assert.ok(await evaluate('document.querySelector("#toasts").textContent.includes(t("pngError"))'));
  assert.equal(await evaluate('document.querySelectorAll(".invoice-png-host, .html2pdf__overlay").length'),0);
  await evaluate('window.html2pdf=window.baseHtml2pdf');
  // New font families must load all supported weights from this app, offline.
  await c('Network.enable');await c('Network.setBlockedURLs',{urls:['https://*']});
  await go('#/settings','#sf');await click('#settings-tab-invoice');
  const newFonts=[['englishFont','manrope'],['englishFont','ibmplexsans'],['englishFont','notosans'],['arabicFont','ibmplexsansarabic'],['arabicFont','notosansarabic'],['arabicFont','notonaskharabic']];
  for(const [key,value] of newFonts) {
    await input('select[name='+key+']',value,'change');
    assert.ok(await evaluate('document.querySelector("[data-font-sample='+key+']").style.fontFamily.includes('+JSON.stringify(value)+')'));
    const family=(key==='englishFont'?'InvoiceLatin-':'InvoiceArabic-')+value;
    assert.ok(await evaluate(`(async()=>{for(const weight of [400,500,700]){const faces=await document.fonts.load(weight+' 18px '+${JSON.stringify(family)},${JSON.stringify(key==='englishFont'?'Invoice 0123456789':'\u0641\u0627\u062a\u0648\u0631\u0629')});if(!faces.length||faces.some(face=>face.status!=='loaded'))return false;}return true;})()`));
    assert.ok(await evaluate(`getComputedStyle(document.querySelector('#sf-preview .invoice')).fontFamily.includes(${JSON.stringify(family)})`));
  }
  assert.ok(await evaluate('performance.getEntriesByType("resource").filter(entry=>entry.name.includes("/vendor/fonts/")).every(entry=>new URL(entry.name).origin===location.origin)'));
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate('window.scrollTo({top:document.querySelector("select[name=englishFont]").closest(".invoice-font-picker").getBoundingClientRect().top+scrollY-85,behavior:"instant"});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const arabicFontsShot=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'new-arabic-fonts.png'),Buffer.from(arabicFontsShot.data,'base64'));
  await input('#sf [name=language]','ar','change');await click('#sf-save');
  await until(()=>evaluate('document.documentElement.dir==="rtl"&&!document.querySelector("#sf-save").disabled'));
  await go('#/settings','#sf');await click('#settings-tab-invoice');
  assert.equal(await evaluate('document.querySelector("select[name=englishFont]").value'),'notosans');
  assert.equal(await evaluate('document.querySelector("select[name=arabicFont]").value'),'notonaskharabic');
  await go('#/invoice/'+seedInvoice.id,'#inv-png');
  const fontExportFolder=path.join(artifacts,'new-fonts-export');fs.mkdirSync(fontExportFolder);
  await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fontExportFolder,eventsEnabled:true});
  await click('#inv-png');await until(()=>fs.existsSync(path.join(fontExportFolder,seedInvoice.code+'.png')),60000);
  await until(()=>evaluate('!document.querySelector("#inv-pdf").disabled'));await click('#inv-pdf');
  await until(()=>fs.existsSync(path.join(fontExportFolder,seedInvoice.code+'.pdf')),60000);
  assert.equal(events.filter(event=>event.method==='Runtime.exceptionThrown').length,0);
  console.log(JSON.stringify({passed:true,artifacts,checks:'separate app-copy data folders and reuse, invalid price/stock/quantity/settings input, Arabic digits, dropped checkout response, original invoice selection, reload recovery, cancellation/late delivery, independent date/time preview/print/PDF combinations'},null,2));await command('Browser.close');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();chrome?.kill();for(const child of children)child.kill();});
