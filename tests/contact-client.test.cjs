const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
const code=ts.transpileModule(fs.readFileSync(root+'/src/lib/contactApi.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const calls=[];const pending=[];const exportsObject={};let currentTimer;
const context={exports:exportsObject,AbortController,JSON,Number,Error,window:{setTimeout:(f,ms)=>{assert.equal(ms,90000);currentTimer=f;return 1;},clearTimeout:()=>{}},fetch:async(url,opts)=>{calls.push({url,opts});const next=pending.shift();if(next.throw)throw next.throw;return {ok:next.status===undefined,status:next.status||200,headers:new Headers(next.headers),json:async()=>next.body};}};
vm.runInNewContext(code,context);
(async()=>{
 const a=exportsObject;
 pending.push({body:{siteKey:'public-key',available:true}});assert.equal((await a.getContactConfig()).siteKey,'public-key');
 for(const body of [{available:false,siteKey:'key'},{available:true},{available:'true',siteKey:'key'},null]){pending.push({body});await assert.rejects(a.getContactConfig());}
 const payload={name:' Tester ',email:' test@example.invalid ',message:' Test message ',kind:'founder',website:' ',turnstileToken:'token'};
 assert.equal(a.validateContact(payload),null);assert.ok(a.validateContact({...payload,email:'bad'}));
 pending.push({body:{ok:true,verificationRequired:true,verificationId:'id'}});assert.equal((await a.submitContact(payload)).verificationId,'id');
 let last=calls.at(-1);assert.equal(last.url,'/api/contact');assert.equal(JSON.parse(last.opts.body).email,'test@example.invalid');assert.equal(JSON.parse(last.opts.body).turnstileToken,'token');
 for(const body of [{ok:true,sent:true},{ok:true,verificationRequired:true,verificationId:123},{ok:true,verificationRequired:true,verificationId:''}]){pending.push({body});await assert.rejects(a.submitContact(payload));}
 pending.push({body:{ok:true}});await assert.rejects(a.verifyContact('id','123456'));
 pending.push({body:{ok:true,sent:true}});await a.verifyContact('id','123456');assert.equal(calls.at(-1).url,'/api/contact/verify');assert.equal(JSON.parse(calls.at(-1).opts.body).code,'123456');
 pending.push({status:429,body:{error:'Wait a moment'},headers:{'Retry-After':'75'}});await assert.rejects(a.submitContact(payload),e=>e instanceof a.ContactApiError&&e.retryAfterSeconds===75&&e.message==='Wait a moment');
 const aborted=new Error('abort');aborted.name='AbortError';pending.push({throw:aborted});await assert.rejects(a.submitContact(payload),/timed out/);
 console.log('PASS React contact API: config fails closed; normalization; start/verify contract strictness; Retry-After; 90-second timeout; abort message');
})().catch(e=>{console.error(e);process.exitCode=1;});
