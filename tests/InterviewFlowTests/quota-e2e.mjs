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
await config({ accounts: [{token_id:7,credits:10000,video_enabled:true}], credits:200, fail:'',delayMs:0,unavailableAccounts:[] });
async function prepare(email) {
 const client=session(base); await client('/Account/QuickLogin?email='+email);
 const body=new FormData(); body.append('__RequestVerificationToken',token(await client.html('/Employer/InterviewFlow/New')));
 for(const [k,v] of Object.entries({Title:'Per-account budget',Persona:'Nhân vật thân thiện.','Questions[0].Question':'Bạn biết C không?','Questions[0].AnswerKey':'Có.'}))body.append(k,v);
 const save=await client.form('/Employer/InterviewFlow/Save',body);assert.equal(save.status,302);const id=Number(save.headers.get('location').split('/').at(-1));
 const html=await client.html('/Employer/InterviewFlow/'+id), script=new FormData();
 script.append('__RequestVerificationToken',token(html)); script.append('approve','true'); for(const [i,kind] of ['intro','transition','outro'].entries()){ script.append(`lines[${i}].Kind`,kind);script.append(`lines[${i}].Line`,'Xin chào.'); }
 assert.equal((await client.form(`/Employer/InterviewFlow/${id}/Script/Save`,script)).status,302);
 return {client,id};
}
async function post(who,path,body={},headers={}) { const html=await who.client.html('/Employer/InterviewFlow/'+who.id);return(await who.client(`/Employer/InterviewFlow/${who.id}/${path}`,{method:'POST',headers:{'Content-Type':'application/json',RequestVerificationToken:token(html),...headers},body:JSON.stringify(body)})).json(); }
async function render(who,quote) {
 const job=await post(who,'Videos/Render',{quoteId:quote.quoteId});assert.ok(job.ok,job.error);
 for(let i=0;i<100;i++){const state=await(await who.client('/Employer/InterviewFlow/Jobs/'+job.jobId)).json();if(state.state!=='running')return state;await new Promise(r=>setTimeout(r,100));}throw new Error('job timeout');
}
const regular=await prepare('port.other@example.test');
const first=await post(regular,'Videos/Quote',{kind:'intro'});check('regular employer receives a 200-credit quote',first.ok&&first.cost===200);
check('approved regular render completes',(await render(regular,first)).state==='succeeded');
const balance=await(await regular.client('/Employer/InterviewFlow/Credits')).json();check('regular employer sees only their 300/day allowance and 100 remaining',balance.allowance.limit===300&&balance.allowance.used===200&&balance.allowance.remaining===100);
await config({credits:150});
const before=(await calls()).filter(c=>c.url==='/v1/chat/completions').length;
const denied=await post(regular,'Videos/Quote',{kind:'intro'},{'X-Aris-Account':'fake-owner','email':'port.owner@example.test'});
check('300/day cap refuses another 150 credits despite spoofed browser headers',!denied.ok&&denied.error.includes('hạn mức'));
check('refusal sends no paid request',(await calls()).filter(c=>c.url==='/v1/chat/completions').length===before);
const owner=await prepare('port.owner@example.test');await config({credits:350});
const unlimited=await post(owner,'Videos/Quote',{kind:'intro'});check('configured owner is exempt above 300 credits',unlimited.ok&&unlimited.cost===350);
check('owner render completes',(await render(owner,unlimited)).state==='succeeded');
check('owner sees unlimited allowance',(await(await owner.client('/Employer/InterviewFlow/Credits')).json()).allowance.limit===null);
await config({credits:10});
console.log(`QUOTA CHECKS PASSED (${passed})`);
