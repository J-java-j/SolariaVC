const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'..');
const source=fs.readFileSync(root+'/public/card/contact-exchange.js','utf8');
function createApp(card,mode='ok') {
 const nodes=new Map();let active;let now=Date.now();
 const timers=new Map();let nextTimer=1;
 function node(id){
  if(nodes.has(id)) return nodes.get(id);
  const classes=new Set();
  const n={id,hidden:false,disabled:false,value:'',textContent:'',dataset:{},attrs:{},listeners:{},classList:{contains:x=>classes.has(x),add:x=>classes.add(x),toggle(x,enabled){const v=enabled===undefined?!classes.has(x):enabled;v?classes.add(x):classes.delete(x);return v;}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.listeners[k]=v;},focus(){active=id;},replaceChildren(){this.textContent='';},remove(){},fire(k){return this.listeners[k]?.({preventDefault(){}});}};
  nodes.set(id,n);return n;
 }
 const ids=['xhPanel','xhToggle','xhForm','xhDetails','xhVerification','xhSend','xhVerify','xhChange','xhStatus','xhCode','xhRecipient','xhSecurity','xhSecurityStatus','xhSecurityRetry','xhRestartHint','xhStamp','xhDone'];
 ids.forEach(node);
 node('xhVerification').hidden=true;
 node('xhForm').dataset={cardId:card,recipient:card==='karl-li'?'Karl':'Johnson'};
 node('xhForm').elements={name:node('name'),email:node('email'),phone:node('phone'),note:node('note'),website:node('website')};
 node('name').value=' Test Name ';node('email').value=' test@example.invalid ';node('note').value='test note';
 const calls=[];const widgets=[];const removed=[];const queued=[];let configuration=mode==='unavailable'?{available:false,siteKey:''}:{available:true,siteKey:mode==='local'?'':'mock-site-key'};
 let configRequestCount=0;
 const fakeDate=class extends Date{static now(){return now;}};
 const sandbox={console,Date:fakeDate,AbortController,Number,Promise,Error,
  setTimeout,clearTimeout,setInterval:f=>{let id=nextTimer++;timers.set(id,f);return id;},clearInterval:id=>timers.delete(id),
  document:{getElementById:node,createElement:()=>node('script'),head:{appendChild(){throw new Error('No external scripts allowed');}}},
  fetch:async(path,options)=>{
   if(path==='/api/contact/config'){configRequestCount++;return {ok:true,json:async()=>configuration,headers:new Headers()};}
   const payload=JSON.parse(options.body);calls.push({path,payload});
   await new Promise(resolve=>setTimeout(resolve,5));
   let reply=queued.shift();
   if(!reply) reply=path.endsWith('/verify')?{ok:true,sent:true}:{ok:true,verificationRequired:true,verificationId:'verify-id'};
   return {ok:!reply.status,json:async()=>reply,headers:new Headers(reply.retryAfter?{'Retry-After':reply.retryAfter}:undefined)};
  }
 };
 sandbox.window=sandbox;
 sandbox.turnstile={ready:f=>f(),render:(el,opts)=>{widgets.push(opts);return ''+widgets.length;},remove:id=>removed.push(id)};
 vm.runInNewContext(source,sandbox);
 return {node,calls,widgets,removed,queued,timers,get active(){return active;},get configRequests(){return configRequestCount;},setConfig:x=>configuration=x,advance(ms){now+=ms;for(const f of timers.values())f();}};
}
const flush=()=>new Promise(r=>setTimeout(r,20));
async function open(app){app.node('xhToggle').fire('click');await flush();}
(async()=>{
 const passed=[];
 for(const card of ['johnson-jiang','karl-li']){
  const a=createApp(card);assert.equal(a.node('xhSend').disabled,true);await open(a);
  assert.equal(a.widgets.length,1);assert.equal(a.widgets[0].action,'contact');assert.equal(a.node('xhSend').disabled,true);
  a.widgets[0].callback('token-1');assert.equal(a.node('xhSend').disabled,false);
  const one=a.node('xhForm').fire('submit');const two=a.node('xhForm').fire('submit');await Promise.all([one,two]);
  assert.equal(a.calls.length,1);assert.equal(a.calls[0].payload.cardId,card);assert.equal(a.calls[0].payload.kind,'card');assert.equal(a.calls[0].payload.email,'test@example.invalid');assert.equal(a.calls[0].payload.turnstileToken,'token-1');
  assert.equal(a.node('xhDetails').hidden,true);assert.equal(a.node('xhVerification').hidden,false);assert.equal(a.node('xhRecipient').textContent,'test@example.invalid');assert.equal(a.active,'xhCode');assert.equal(a.node('xhPanel').classList.contains('sent'),false);assert.equal(a.removed.length,1);
  a.node('xhCode').value='12 3456X';a.node('xhCode').fire('input');assert.equal(a.node('xhCode').value,'123456');
  a.queued.push({status:400,error:'Invalid or expired verification code.'});await a.node('xhForm').fire('submit');assert.equal(a.node('xhPanel').classList.contains('sent'),false);assert.equal(a.node('xhStatus').textContent,'Invalid or expired verification code.');
  const v1=a.node('xhForm').fire('submit');const v2=a.node('xhForm').fire('submit');await Promise.all([v1,v2]);assert.equal(a.calls.length,3);assert.equal(a.node('xhPanel').classList.contains('sent'),true);assert.equal(a.active,'xhDone');
  await a.node('xhForm').fire('submit');assert.equal(a.calls.length,3,'No repeat after success');
  passed.push(card+': two-step success, duplicate guards, code sanitization, wrong-code retry, exact routing, focus, hidden details');
 }
 {
  const a=createApp('karl-li');await open(a);a.widgets[0].callback('token');await a.node('xhForm').fire('submit');a.node('xhChange').fire('click');await flush();
  assert.equal(a.node('xhDetails').hidden,false);assert.equal(a.node('email').value,' test@example.invalid ');assert.equal(a.node('xhSend').disabled,true);assert.equal(a.widgets.length,2);assert.equal(a.active,'name');
  a.widgets[1]['expired-callback']();assert.match(a.node('xhSecurityStatus').textContent,/expired/);assert.equal(a.node('xhSecurityRetry').hidden,false);a.node('xhSecurityRetry').fire('click');await flush();assert.equal(a.widgets.length,3);a.widgets[2].callback('token2');assert.equal(a.node('xhSend').disabled,true);a.advance(61000);assert.equal(a.node('xhSend').disabled,false);
  a.node('xhToggle').fire('click');a.node('xhToggle').fire('click');await flush();assert.equal(a.widgets.length,3,'Close/reopen does not add a widget');assert.equal(a.configRequests,1);
  passed.push('change details, cooldown, token expiration/retry, close/reopen');
 }
 {
  const a=createApp('johnson-jiang','unavailable');await open(a);assert.equal(a.node('xhSend').disabled,true);assert.equal(a.widgets.length,0);await a.node('xhForm').fire('submit');assert.equal(a.calls.length,0);a.setConfig({available:true,siteKey:'key'});a.node('xhSecurityRetry').fire('click');await flush();assert.equal(a.widgets.length,1);passed.push('unavailable config fails closed and retry recovers');
 }
 {
  const a=createApp('johnson-jiang');await open(a);a.widgets[0].callback('token');a.queued.push({ok:true,sent:true});await a.node('xhForm').fire('submit');await flush();assert.equal(a.node('xhPanel').classList.contains('sent'),false);assert.equal(a.node('xhVerification').hidden,true);assert.match(a.node('xhStatus').textContent,/could not be started/);assert.equal(a.widgets.length,2);assert.equal(a.node('xhSend').disabled,true);passed.push('legacy/malformed success cannot bypass verification, used token reset');
 }
 {
  const a=createApp('johnson-jiang');await open(a);a.widgets[0].callback('token');a.queued.push({status:429,error:'Wait before requesting another code.',retryAfter:'90'});await a.node('xhForm').fire('submit');await flush();a.widgets.at(-1).callback('token2');assert.match(a.node('xhSend').textContent,/90s/);a.advance(91000);assert.equal(a.node('xhSend').disabled,false);passed.push('server Retry-After cooldown enforced');
 }
 {
  const a=createApp('johnson-jiang','local');await open(a);assert.equal(a.widgets.length,0);assert.equal(a.node('xhSend').disabled,false);passed.push('explicit local config requires no external widget');
 }
 for(const path of ['/public/card/index.html','/public/card/karl/index.html']){
  const html=fs.readFileSync(root+path,'utf8');assert.equal((html.match(/src="\/card\/contact-exchange.js"/g)||[]).length,1);assert.equal(html.includes("fetch('/api/contact'"),false);assert.match(html,/id="xhVerification" hidden/);assert.match(html,/\.xh \[hidden\] \{ display: none !important; \}/);
 }
 console.log(passed.map(x=>'PASS '+x).join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1;});
