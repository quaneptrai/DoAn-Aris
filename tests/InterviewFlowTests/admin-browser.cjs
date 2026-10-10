const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const puppeteer=require('../../ArisSkyve/node_modules/puppeteer-core');
const base=process.argv[2]??'http://localhost:5030';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const dir=path.resolve('.local/admin-browser');fs.mkdirSync(dir,{recursive:true});let checks=0;
function check(name,value){assert.ok(value,name);checks++;console.log('PASS '+name);}
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const ownerContext=await browser.createBrowserContext(),adminContext=await browser.createBrowserContext();
  const owner=await ownerContext.newPage(),admin=await adminContext.newPage(),errors=[];
  for(const page of [owner,admin])page.on('pageerror',e=>errors.push(e.message));
  await owner.setViewport({width:1280,height:900});await admin.setViewport({width:1280,height:900});
  await owner.goto(base+'/Account/QuickLogin?email=port.owner@example.test');await owner.goto(base+'/Employer/InterviewFlow');
  check('visible employer support button',await owner.$eval('a[href="/Employer/InterviewFlow/Support"]',e=>e.getBoundingClientRect().width>0));
  await Promise.all([owner.waitForNavigation(),owner.click('a[href="/Employer/InterviewFlow/Support"]')]);
  await owner.select('#kind','credits');await owner.type('#credits','50');await owner.type('#message','Chrome fixture requests extra credits for an interview.');
  await Promise.all([owner.waitForNavigation(),owner.click('.adm-form button[type=submit]')]);
  check('form submission shows saved status',await owner.$eval('.adm-alert[role=status]',e=>e.textContent.includes('Đã gửi')));
  const email='xuanthangmuoi@gmail.com',payload=Buffer.from(email+'|'+(Math.floor(Date.now()/1000)+300)+'|1');const sig=crypto.createHmac('sha256','admin-fixture-secret-for-isolated-tests-only').update(payload).digest('base64url');
  await admin.goto(base+'/Account/ConfirmMagicLink?token='+payload.toString('base64url')+'.'+sig+'&returnUrl=%2FAdmin');
  check('admin sidebar visible',await admin.$eval('.a-side a[href="/Admin"]',e=>e.getBoundingClientRect().width>0));
  check('request appears in admin',await admin.$eval('.adm-history',e=>e.textContent.includes('Chrome fixture')));
  await admin.screenshot({path:path.join(dir,'admin-request-desktop.png'),fullPage:true});
  await admin.type('textarea[name=reply]','Chrome fixture approval: 25 credits for today.');
  await admin.$eval('input[name=credits]',e=>{e.value='25';});
  await Promise.all([admin.waitForNavigation(),admin.click('button[value=resolved]')]);
  check('admin approval confirmation',await admin.$eval('.adm-alert[role=status]',e=>e.textContent.includes('Đã duyệt')));
  await owner.reload();check('requester sees credit approval',await owner.$eval('.adm-history',e=>e.textContent.includes('25 credit')));
  await admin.goto(base+'/Admin?tab=accounts');await admin.click('[data-allowance="1"]');await admin.waitForFunction(()=>document.querySelector('[data-allowance-result="1"]').textContent.includes('325'));
  check('live allowance button reflects approved credit',await admin.$eval('[data-allowance-result="1"]',e=>e.textContent.includes('325')));
  await admin.goto(base+'/Admin?tab=system');await admin.waitForFunction(()=>document.querySelector('#adminServices').textContent.includes('Sẵn sàng'));
  check('service status loads without provider details',await admin.$eval('#adminServices',e=>!e.textContent.includes('127.0.0.1')&&!e.textContent.includes('Bearer')));
  await admin.setViewport({width:390,height:844});await admin.goto(base+'/Admin?tab=accounts');
  check('mobile admin navigation is visible',await admin.$eval('.a-tabbar a[href="/Admin"]',e=>e.getBoundingClientRect().width>0));
  check('mobile admin page does not overflow',await admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await admin.screenshot({path:path.join(dir,'admin-accounts-mobile.png'),fullPage:true});
  await owner.setViewport({width:390,height:844});await owner.reload();check('mobile support page does not overflow',await owner.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await owner.screenshot({path:path.join(dir,'support-mobile.png'),fullPage:true});
  check('Chrome has no page errors',errors.length===0);
  console.log(`ADMIN CHROME PASSED (${checks})`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
