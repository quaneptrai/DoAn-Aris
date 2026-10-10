import assert from 'node:assert/strict';
// Small HTTP helpers (cookie session, antiforgery token, HTML entity decoding), kept here so the test runs from a clean clone.
const decode = text => String(text ?? '').replace(/&#x([\dA-F]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function session(base) {
 const cookies = new Map();
 async function go(url, init = {}) { const headers = new Headers(init.headers); if (cookies.size) headers.set('Cookie', [...cookies].map(([k,v])=>`${k}=${v}`).join('; ')); const r = await fetch(base+url,{...init,headers,redirect:'manual'}); for(const c of r.headers.getSetCookie()){const kv=c.split(';')[0],i=kv.indexOf('=');cookies.set(kv.slice(0,i),kv.slice(i+1));}return r; }
 go.html=async url=>{const r=await go(url);assert.equal(r.status,200,`GET ${base}${url}`);return r.text();};
 go.form=(url,body)=>go(url,{method:'POST',body});
 return go;
}
const token = html => html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
const base=process.argv[2]||'http://localhost:5030', go=session(base);
await go('/Account/QuickLogin?email=port.owner@example.test');
const config=async data=>(await fetch('http://127.0.0.1:5302/__config',{method:'POST',body:JSON.stringify(data)})).json();
const calls=async()=>(await fetch('http://127.0.0.1:5302/__requests')).json();
let passed=0;const check=(name,value)=>{assert.ok(value,name);console.log('PASS '+name);passed++;};
const accounts=[{token_id:2,credits:500,video_enabled:true},{token_id:7,credits:1000,video_enabled:true},{token_id:9,credits:0,video_enabled:true},{token_id:11,credits:700,video_enabled:false}];
await config({accounts,credits:10,fail:'',delayMs:0,unavailableAccounts:[]});
const credit=await(await go('/Employer/InterviewFlow/Credits')).json();
check('sum eligible video balances without exposing credentials',credit.total===1500&&credit.accounts.length===3&&!JSON.stringify(credit).includes('email'));
await config({accounts:[...accounts,{token_id:13,credits:null,video_enabled:true}]});const unread=await (await go('/Employer/InterviewFlow/Credits')).json();check('account with an unreadable balance is left out, not a server error',unread.ok===true&&unread.total===1500&&unread.accounts.every(a=>a.id!==13));await config({accounts});
const candidate=session(base);await candidate('/Account/QuickLogin?email=credit.candidate@example.test');const denied=await candidate('/Employer/InterviewFlow/Credits');check('candidate cannot read provider credit accounts',denied.status===403||(denied.status===302&&denied.headers.get('location').includes('AccessDenied')));
async function kit(mode,account){
 const body=new FormData();body.append('__RequestVerificationToken',token(await go.html('/Employer/InterviewFlow/New')));body.append('Production.VoiceId','');
 for(const [k,v] of Object.entries({Title:'Credit regression',Persona:'Nhân vật hoạt hình thân thiện.','Production.CreditMode':mode,...(account?{'Production.CreditAccountId':account}:{}),'Questions[0].Question':'Bạn có biết C không?','Questions[0].AnswerKey':'Có.'}))body.append(k,v);
 const save=await go.form('/Employer/InterviewFlow/Save',body);assert.equal(save.status,302);const id=Number(save.headers.get('location').split('/').at(-1));
 let html=await go.html('/Employer/InterviewFlow/'+id);
 await go(`/Employer/InterviewFlow/${id}/Script/Write`,{method:'POST',headers:{'Content-Type':'application/json',RequestVerificationToken:token(html)},body:'{}'});
 html=await go.html('/Employer/InterviewFlow/'+id);const script=new FormData();script.append('__RequestVerificationToken',token(html));script.append('approve','true');
 for(const [,i,kind] of html.matchAll(/name="lines\[(\d+)\]\.Kind" value="([^"]+)"/g)){
  script.append(`lines[${i}].Kind`,kind);script.append(`lines[${i}].Line`,kind==='question'?'Bạn có biết C không?':'Xin chào bạn.');
  const qid=html.match(new RegExp(`name="lines\\[${i}\\]\\.QuestionId" value="(\\d+)"`))?.[1];if(qid)script.append(`lines[${i}].QuestionId`,qid);
 }
 assert.equal((await go.form(`/Employer/InterviewFlow/${id}/Script/Save`,script)).status,302);return id;
}
async function post(id,path,body={}){const html=await go.html('/Employer/InterviewFlow/'+id);return(await go(`/Employer/InterviewFlow/${id}/${path}`,{method:'POST',headers:{'Content-Type':'application/json',RequestVerificationToken:token(html)},body:JSON.stringify(body)})).json();}
const pool=await kit('pool');let start=(await calls()).length;
const batch=await post(pool,'Videos/QuoteAll',{replaceExisting:false});check('quote counts questions plus seven shared states',batch.ok&&batch.count===8);
let seen=(await calls()).slice(start).filter(c=>c.url==='/v1/generation/preview').map(c=>c.body.account_id);
check('round robin distributes previews evenly and excludes empty/disabled accounts',seen.length===8&&seen.filter(id=>id===2).length===4&&seen.filter(id=>id===7).length===4);
let running=await post(pool,'Videos/RenderAll',{batchId:batch.batchId||batch.id});
if(!running.ok) throw new Error(JSON.stringify({batch,running}));
for(let i=0;i<150;i++){const state=await(await go('/Employer/InterviewFlow/Batches/'+running.batchId)).json();if(state.state!=='running'){check('pool batch finishes using approved prices',state.state==='succeeded');break;}await new Promise(r=>setTimeout(r,100));}
let paid=(await calls()).slice(start).filter(c=>c.url==='/v1/chat/completions');check('each approved video uses one account with its exact quote',paid.length===8&&paid.every(c=>[2,7].includes(c.body.account_id)&&c.approval));
const single=await kit('single',7);start=(await calls()).length;check('single account prices successfully',(await post(single,'Videos/QuoteAll',{replaceExisting:false})).ok);check('single selection is respected for all slots',(await calls()).slice(start).filter(c=>c.url==='/v1/generation/preview').every(c=>c.body.account_id===7));
const paidBeforeFallback=(await calls()).filter(c=>c.url==='/v1/chat/completions').length;
await config({accounts:accounts.map(a=>a.token_id===2?{...a,credits:1}:a)});check('pool skips account that cannot cover the preview',(await post(pool,'Videos/QuoteAll',{replaceExisting:true})).ok);check('preview fallback does not generate paid video',(await calls()).filter(c=>c.url==='/v1/chat/completions').length===paidBeforeFallback);
await config({accounts,unavailableAccounts:[2]});check('pool skips funded account whose session is unavailable',(await post(pool,'Videos/QuoteAll',{replaceExisting:true})).ok);
await config({unavailableAccounts:[]});
await config({accounts,fail:'avatar-reference'});
const failed=await post(single,'Videos/QuoteAll',{replaceExisting:false});const job=await post(single,'Videos/RenderAll',{batchId:failed.batchId||failed.id});
for(let i=0;i<100;i++){const state=await(await go('/Employer/InterviewFlow/Batches/'+job.batchId)).json();if(state.state!=='running'){check('reference/model error reports unchanged balance and stops after zero clips',state.state==='failed'&&state.done===0&&state.message.includes('không bị trừ credit'));break;}await new Promise(r=>setTimeout(r,100));}
await config({accounts,fail:''});
console.log(`CREDIT CHECKS PASSED (${passed})`);
