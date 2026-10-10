// Uses only a freshly seeded ephemeral Aris DB and fake gateway services.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const base=process.argv[2]??'http://localhost:5030';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Admin tests must use an isolated local server');
let checks=0;
const check=(name,condition)=>{assert.ok(condition,name);checks++;console.log('PASS '+name);};
const token=html=>html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
function session(){
 const cookies=new Map();
 async function go(url,init={}){const headers=new Headers(init.headers);if(cookies.size)headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));const response=await fetch(base+url,{...init,headers,redirect:'manual'});for(const raw of response.headers.getSetCookie()){const kv=raw.split(';')[0],i=kv.indexOf('=');cookies.set(kv.slice(0,i),kv.slice(i+1));}return response;}
 go.html=async url=>{const reply=await go(url);assert.equal(reply.status,200,'GET '+url);return reply.text();};
 go.form=(url,values,t)=>go(url,{method:'POST',headers:{RequestVerificationToken:t},body:new URLSearchParams(values)});
 go.json=async url=>(await go(url,{headers:{Accept:'application/json'}})).json();return go;
}
async function admin(email){const go=session();const payload=Buffer.from(email+'|'+(Math.floor(Date.now()/1000)+300)+'|1');const signature=crypto.createHmac('sha256','admin-fixture-secret-for-isolated-tests-only').update(payload).digest('base64url');const result=await go('/Account/ConfirmMagicLink?token='+payload.toString('base64url')+'.'+signature+'&returnUrl=%2FAdmin');check('fixture admin authenticated '+email,result.status===302);return go;}
const owner=session(),other=session(),anonymous=session();
await owner('/Account/QuickLogin?email=port.owner@example.test');await other('/Account/QuickLogin?email=port.other@example.test');
const first=await admin('xuanthangmuoi@gmail.com'),second=await admin('tohkadangyeu@gmail.com');
const denied=result=>result.status===403 || result.status===302&&result.headers.get('location')?.includes('AccessDenied');
check('anonymous admin requires login',(await anonymous('/Admin')).status===302);
check('business account cannot view admin',denied(await owner('/Admin')));
const home=await owner.html('/Employer/InterviewFlow');check('employer index has support request button',home.includes('/Employer/InterviewFlow/Support'));
check('non-admin sidebar hides admin link',!home.includes('href="/Admin"'));
let page=await first.html('/Admin');check('designated admin sidebar exposes portal',page.includes('href="/Admin"'));
for(const tab of ['requests','accounts','interviews','system','audit'])check('admin tab '+tab+' renders',(await first('/Admin?tab='+tab)).status===200);
check('second admin can access account management',(await second('/Admin?tab=accounts')).status===200);
check('admin with personal profile keeps sidebar admin link',(await second.html('/Admin')).includes('href="/Admin"'));
check('admin personal profile can start employer setup',(await second('/Account/BecomeEmployer')).status===200);
let t=token(await owner.html('/Employer/InterviewFlow/Support'));
check('non-admin cannot invoke admin state change',denied(await owner.form('/Admin/Accounts/2/State',{suspended:'true'},t)));
check('admin mutations reject missing CSRF',(await first.form('/Admin/Services/Pause',{paused:'true'},'')).status===400);
let reply=await owner.form('/Employer/InterviewFlow/Support',{Kind:'credits',Credits:'-2',Message:'fixture invalid credit request'},t);check('invalid credit request shows validation',reply.status===200);
reply=await owner.form('/Employer/InterviewFlow/Support',{Kind:'credits',Credits:'100',Message:'fixture-credit-request <img src=x onerror=alert(1)>'},t);check('valid credit request accepted',reply.status===302);
reply=await owner.form('/Employer/InterviewFlow/Support',{Kind:'bug',Message:'fixture duplicate submission'},t);check('rapid duplicate does not create another ticket',reply.status===200);
const ownerHistory=await owner.html('/Employer/InterviewFlow/Support');check('request history contains own ticket and escapes HTML',ownerHistory.includes('fixture-credit-request')&&!ownerHistory.includes('<img src=x onerror'));
check('other employer cannot see requester history',!(await other.html('/Employer/InterviewFlow/Support')).includes('fixture-credit-request'));
for(const go of [first,second]){const notifications=await go.json('/Notifications/GetNotifications');check('both admins receive request bell notification',notifications.notifications.some(n=>n.type==='SupportRequest'&&n.link.includes('/Admin')));}
page=await first.html('/Admin');check('admin renders escaped requester content',page.includes('fixture-credit-request')&&!page.includes('<img src=x onerror'));
const requestId=Number(page.match(/action="\/Admin\/Requests\/(\d+)"/)?.[1]);let version=page.match(/name="version" value="([^"]+)"/)?.[1];assert.ok(requestId&&version);
t=token(page);
check('pending request processed', (await first.form('/Admin/Requests/'+requestId,{version,status:'processing',reply:'fixture looking into request'},t)).status===302);
reply=await second.form('/Admin/Requests/'+requestId,{version,status:'resolved',reply:'fixture stale approval',credits:'100'},token(await second.html('/Admin')));check('stale request version does not grant credits',reply.status===302);
let allowance=(await owner.json('/Employer/InterviewFlow/Credits')).allowance;check('stale approval preserves original 300 limit',allowance.limit===300);
page=await first.html('/Admin');version=page.match(/name="version" value="([^"]+)"/)?.[1];t=token(page);
reply=await first.form('/Admin/Requests/'+requestId,{version,status:'resolved',reply:'fixture approved seventy five credits',credits:'75'},t);check('credit approval accepted',reply.status===302);
allowance=(await owner.json('/Employer/InterviewFlow/Credits')).allowance;check('approved credits affect actual employer allowance',allowance.limit===375&&allowance.remaining===375);
reply=await first.form('/Admin/Requests/'+requestId,{version,status:'resolved',reply:'fixture same approval again',credits:'75'},t);check('approval replay redirected with safe feedback',reply.status===302);
allowance=(await owner.json('/Employer/InterviewFlow/Credits')).allowance;check('approval replay does not double grant',allowance.limit===375);
const ownerNotices=await owner.json('/Notifications/GetNotifications');check('requester receives admin response',ownerNotices.notifications.some(n=>n.type==='SupportResponse'));
check('response is visible in requester history',(await owner.html('/Employer/InterviewFlow/Support')).includes('fixture approved seventy five credits'));
let tt=token(await other.html('/Employer/InterviewFlow/Support'));
reply=await other.form('/Employer/InterviewFlow/Support',{Kind:'bug',Message:'fixture bug affecting the interview page'},tt);check('bug request accepted',reply.status===302);
tt=token(await first.html('/Employer/InterviewFlow/Support'));
reply=await first.form('/Employer/InterviewFlow/Support',{Kind:'support',Message:'fixture general assistance request'},tt);check('general support request accepted',reply.status===302);
page=await first.html('/Admin?tab=accounts');t=token(page);
check('non-designated account cannot become Admin',(await first.form('/Admin/Accounts/2/Role',{role:'Admin'},t)).status===302);
check('Admin forgery was not applied',!(await other.html('/Employer/InterviewFlow')).includes('href="/Admin"'));
check('designated admin protected from suspension',(await first.form('/Admin/Accounts/4/State',{suspended:'true'},t)).status===302);
check('protected second admin still authenticated',(await second('/Admin')).status===200);
check('account downgrade accepted',(await first.form('/Admin/Accounts/2/Role',{role:'Employee'},t)).status===302);
check('downgraded employer loses employer API access',denied(await other('/Employer/InterviewFlow/Support')));
check('downgraded account cannot open employer dashboard',(await other('/Employer')).headers.get('location')?.includes('/Account/BecomeEmployer'));
check('downgraded account cannot edit company profile',(await other('/Company/Edit')).headers.get('location')?.includes('/Account/BecomeEmployer'));
page=await other.html('/Account/BecomeEmployer');check('downgraded account is told the rights were revoked, without the upgrade form',page.includes('Quyền đăng tuyển đang bị thu hồi')&&!page.includes('id="beForm"'));
reply=await other('/Account/UpgradeToBusiness',{method:'POST',body:new URLSearchParams({CompanyName:'fixture self restore',Industry:'IT',__RequestVerificationToken:token(page)})});check('downgraded account cannot restore itself',(await reply.json()).success===false);
check('downgraded account cannot invoke job editing',!(await other.json('/Jobs/GetJobPostingForEdit?id=1')).success);

check('account restored to business without deleting profile',(await first.form('/Admin/Accounts/2/Role',{role:'Business'},t)).status===302);
check('restored account can view existing support history',(await other.html('/Employer/InterviewFlow/Support')).includes('fixture bug'));
check('suspension accepted',(await first.form('/Admin/Accounts/2/State',{suspended:'true'},t)).status===302);
reply=await other('/Employer/InterviewFlow/Support');check('suspension invalidates existing login',reply.status===302&&reply.headers.get('location').includes('/Account/Login'));
check('restore accepted',(await first.form('/Admin/Accounts/2/State',{suspended:'false'},t)).status===302);
await other('/Account/QuickLogin?email=port.other@example.test');check('restored account can sign in again',(await other('/Employer/InterviewFlow/Support')).status===200);
let state=await first.json('/Admin/Services');check('admin service status uses fake gateway',state.ok&&state.status.video&&state.status.ffmpeg);
await first.form('/Admin/Services/Pause',{paused:'true'},t);check('pause changes gateway state',(await first.json('/Admin/Services')).status.paused===true);
await first.form('/Admin/Services/Pause',{paused:'false'},t);check('resume changes gateway state',(await first.json('/Admin/Services')).status.paused===false);
const log=await first.html('/Admin?tab=audit');check('admin actions have persistent audit history',log.includes('support.resolved')&&log.includes('account.suspend')&&log.includes('account.role')&&log.includes('service.resume'));
console.log(`ADMIN E2E PASSED (${checks})`);
