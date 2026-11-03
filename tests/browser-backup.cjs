const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-backup-e2e-'));
const executable=path.resolve(process.argv[2]||process.env.INVENTORY_TEST_EXE||path.join(__dirname,'../dist/Inventory Management System.exe'));
const processes=[];let chrome,socket;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){const value=await fn();if(value)return value;await pause(70);}throw new Error('Timed out');}
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function launch(name,port){
  const child=spawn(executable,['-port',String(port),'-data',path.join(artifacts,name),'-no-browser','-no-tray'],{windowsHide:true,stdio:'ignore'});processes.push(child);
  const url=`http://127.0.0.1:${port}`;
  await until(async()=>{try{return (await (await fetch(url+'/api/ping')).json()).app==='inventory-app';}catch{return false;}});
  return {child,url};
}
async function request(url,method,endpoint,body,type='application/json',generation){
  if(method==='POST'&&endpoint==='/api/sales'&&!body.requestId)body={...body,requestId:require('node:crypto').randomBytes(16).toString('hex')};
  if(method!=='GET'&&!generation)generation=(await (await fetch(url+'/api/data')).json()).generation;
  const response=await fetch(url+endpoint,{method,headers:{'Content-Type':type,...(generation?{'X-Inventory-Generation':generation}:{})},body:body===undefined?undefined:(type==='application/json'?JSON.stringify(body):body)});
  return {status:response.status,...await response.json()};
}
(async()=>{
  const sourcePort=await freePort();let destPort=await freePort();while(Math.abs(sourcePort-destPort)<100)destPort=await freePort();
  const source=await launch('source',sourcePort);let dest=await launch('destination',destPort);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ZkAAAAASUVORK5CYII=','base64');
  const image=await request(source.url,'POST','/api/images',png,'image/png');const logo=await request(source.url,'POST','/api/images',png,'image/png');
  let response=await request(source.url,'POST','/api/products',{name:'عطر ورد',price:25000,stock:12,images:[image.name]});assert.equal(response.status,200);
  const product=response.db.products[0].id;
  const sourceYear=response.numbering.year;
  response=await request(source.url,'POST','/api/sales',{invoiceNumber:2000,invoiceYear:sourceYear,customer:{name:'أحمد علي',phone:'٠٧٧٠١٢٣٤٥٦٧',address:'بغداد - الكرادة'},items:[{productId:product,qty:3}]});assert.equal(response.status,200);
  response=await request(source.url,'PUT','/api/settings',{...response.db.settings,language:'ar',storeName:'متجر الورد',logo:logo.name,header:'بغداد\n0770 123 4567',footer:'شكراً لزيارتكم'});assert.equal(response.status,200);
  const expected=response.db;
  response=await request(dest.url,'POST','/api/products',{name:'Old destination stock',price:100,stock:5,images:[]});const destinationBefore=response.db;
  chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${path.join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let stderr='';chrome.stderr.on('data',data=>stderr+=data);
  const endpoint=await until(()=>stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1]);
  socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let id=0;const pending=new Map(),events=[];
  socket.onmessage=({data})=>{const message=JSON.parse(data);if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(new Error(JSON.stringify(message.error))):p.resolve(message.result);}else events.push(message);};
  function command(method,params={},sessionId){return new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});socket.send(JSON.stringify({id:call,method,params,...(sessionId?{sessionId}:{})}));});}
  async function tab(url){
    const {targetId}=await command('Target.createTarget',{url:'about:blank'});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
    const c=(method,params)=>command(method,params,sessionId);
    const evaluate=async expression=>{const result=await c('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
    await c('Runtime.enable');await c('Page.enable');await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await c('Page.navigate',{url});
    await until(()=>evaluate('!!document.querySelector(' + JSON.stringify('.topbar') + ')'));
    return {c,evaluate};
  }
  const sourceTab=await tab(source.url+'/#/backup');
  const destTab=await tab(dest.url+'/#/backup');const staleTab=await tab(dest.url+'/#/products');
  const sourceDownloads=path.join(artifacts,'source-downloads');fs.mkdirSync(sourceDownloads);
  await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:sourceDownloads,eventsEnabled:true});
  await sourceTab.evaluate('document.querySelector("#backup-export").click()');
  const download=await until(()=>events.find(event=>event.method==='Browser.downloadWillBegin'&&event.params.url.startsWith(source.url)));
  await until(()=>events.some(event=>event.method==='Browser.downloadProgress'&&event.params.guid===download.params.guid&&event.params.state==='completed'));
  const zipPath=path.join(sourceDownloads,download.params.suggestedFilename);assert.ok(fs.existsSync(zipPath));assert.ok(download.params.suggestedFilename.startsWith('InventoryBackup-'));
  async function selectFile(tab,file){const {root}=await tab.c('DOM.getDocument');const {nodeId}=await tab.c('DOM.querySelector',{nodeId:root.nodeId,selector:'#backup-file'});await tab.c('DOM.setFileInputFiles',{nodeId,files:[file]});}
  async function confirmImport(tab,file){await selectFile(tab,file);await until(()=>tab.evaluate('!!document.querySelector("#backup-commit")'));await tab.evaluate('document.querySelector("#backup-commit").click()');await until(()=>tab.evaluate('!!document.querySelector("#modal.show [data-r]:last-child")'));await tab.evaluate('document.querySelector("#modal [data-r]:last-child").click()');await until(()=>tab.evaluate('!!document.querySelector(".alert-success code")'));}
  await selectFile(destTab,zipPath);await until(()=>destTab.evaluate('!!document.querySelector("#backup-commit")'));
  assert.ok((await destTab.evaluate('document.querySelector("#backup-preview").textContent')).includes('متجر الورد'));
  assert.deepEqual((await request(dest.url,'GET','/api/data')).db,destinationBefore);
  await destTab.evaluate('document.querySelector("#backup-cancel").click()');await until(()=>destTab.evaluate('!document.querySelector("#backup-commit")'));
  await confirmImport(destTab,zipPath);
  assert.deepEqual((await request(dest.url,'GET','/api/data')).db,expected);
  assert.equal(await destTab.evaluate('document.documentElement.dir'),'rtl');
  const recovery=await destTab.evaluate('document.querySelector(".alert-success code").textContent');assert.ok(fs.existsSync(recovery));
  const sourceImage=Buffer.from(await (await fetch(source.url+'/images/'+image.name)).arrayBuffer());const destImage=Buffer.from(await (await fetch(dest.url+'/images/'+image.name)).arrayBuffer());assert.deepEqual(sourceImage,destImage);
  assert.equal(await staleTab.evaluate('api("POST","/api/products",{name:"stale overwrite",price:1,stock:1,images:[]}).then(()=>"unexpected success").catch(error=>error.key)'),'err.dataReplaced');
  const screenshot=await destTab.c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'backup-import-ar.png'),Buffer.from(screenshot.data,'base64'));
  // Restart the destination, preserving its imported state and counters.
  await new Promise(resolve=>{dest.child.once('exit',resolve);dest.child.kill();});dest=await launch('destination',destPort);
  assert.deepEqual((await request(dest.url,'GET','/api/data')).db,expected);
  const restartTab=await tab(dest.url+'/#/backup');
  const invalidPath=path.join(artifacts,'damaged.zip');fs.writeFileSync(invalidPath,fs.readFileSync(zipPath).subarray(0,100));
  await selectFile(restartTab,invalidPath);await until(()=>restartTab.evaluate('document.querySelector("#backup-status").classList.contains("text-danger")'));
  assert.deepEqual((await request(dest.url,'GET','/api/data')).db,expected);
  assert.equal(await restartTab.evaluate('!!document.querySelector("#backup-commit")'),false);
  await confirmImport(restartTab,recovery);
  assert.deepEqual((await request(dest.url,'GET','/api/data')).db,destinationBefore);
  assert.equal(events.filter(event=>event.method==='Runtime.exceptionThrown').length,0,JSON.stringify(events.filter(event=>event.method==='Runtime.exceptionThrown')));
  console.log(JSON.stringify({passed:true,artifacts,backupFilename:download.params.suggestedFilename,checks:'real app/browser: ZIP download, preview and cancel, replace confirmation, full Arabic data and image transfer, stale-tab rejection, restart persistence, damaged-file rejection, recovery ZIP undo'},null,2));
  await command('Browser.close');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();chrome?.kill();for(const process of processes)process.kill();});


