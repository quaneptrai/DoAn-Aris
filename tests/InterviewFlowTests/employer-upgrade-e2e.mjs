// Candidate → employer, which needs an administrator's approval (owner's rule, 11/10/2026): the request from
// Account/BecomeEmployer, pending state, rejection with a reason and resubmission, approval, the employer sign-in path,
// accounts left half-upgraded before the 09/10 fix, the Accounts tab (upgrade / downgrade / restore), and an
// administrator switching their own profile directly. Needs a fresh isolated server (it changes fixtures):
//   powershell -File tests/InterviewFlowTests/start-test-server.ps1 -Port 5030 -AdminFixtures
//   node tests/InterviewFlowTests/employer-upgrade-e2e.mjs http://localhost:5030
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const base = process.argv[2] ?? 'http://localhost:5030';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Upgrade tests must use an isolated local server');
let checks = 0;
const check = (name, condition, detail = '') => { assert.ok(condition, name + (detail ? ' — ' + detail : '')); checks++; console.log('PASS ' + name); };
const token = html => html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
const where = reply => reply.headers.get('location') ?? '';
function session() {
  const cookies = new Map();
  async function go(url, init = {}) {
    const headers = new Headers(init.headers);
    if (cookies.size) headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const response = await fetch(base + url, { ...init, headers, redirect: 'manual' });
    for (const raw of response.headers.getSetCookie()) { const kv = raw.split(';')[0], i = kv.indexOf('='); cookies.set(kv.slice(0, i), kv.slice(i + 1)); }
    return response;
  }
  // Razor writes non-ASCII values from expressions as &#x...; (e.g. a Vietnamese company name): decode before matching.
  go.html = async url => { const reply = await go(url); assert.equal(reply.status, 200, 'GET ' + url + ' → ' + reply.status + ' ' + where(reply)); return (await reply.text()).replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))); };
  go.form = (url, values, t) => go(url, { method: 'POST', headers: { RequestVerificationToken: t }, body: new URLSearchParams(values) });
  go.json = async url => (await go(url, { headers: { Accept: 'application/json' } })).json();
  // Same request as wwwroot/js/pages/become-employer.js.
  go.upgrade = async (t, values) => (await go('/Account/UpgradeToBusiness', { method: 'POST', body: new URLSearchParams({ __RequestVerificationToken: t, ...values }) })).json();
  return go;
}
const signedLink = (email, query = '') => {
  const payload = Buffer.from(email + '|' + (Math.floor(Date.now() / 1000) + 300) + '|1');
  const signature = crypto.createHmac('sha256', 'admin-fixture-secret-for-isolated-tests-only').update(payload).digest('base64url');
  return '/Account/ConfirmMagicLink?token=' + payload.toString('base64url') + '.' + signature + query;
};
const quick = async email => { const go = session(); check('signed in ' + email, (await go('/Account/QuickLogin?email=' + encodeURIComponent(email))).status === 302); return go; };
const company = name => ({ CompanyName: name, Industry: 'Logistics – Vận tải biển', CompanySize: '11-50', TaxCode: '0312345678', Description: 'Cảng biển thử nghiệm cho kiểm thử tự động.' });
const accountId = page => Number(page.match(/action="\/Admin\/Accounts\/(\d+)\/Role"/)?.[1]);
const notices = async go => (await go.json('/Notifications/GetNotifications')).notifications ?? [];
const admin = session();
check('fixture admin authenticated', (await admin(signedLink('xuanthangmuoi@gmail.com', '&returnUrl=%2FAdmin'))).status === 302);
async function review(requestId, status, reply) {
  const page = await admin.html('/Admin?tab=requests&requestId=' + requestId);
  const version = page.match(/name="version" value="([^"]+)"/)?.[1];
  assert.ok(version, 'request #' + requestId + ' is open in the admin list');
  return admin.form('/Admin/Requests/' + requestId, { version, status, reply }, token(page));
}

// 1. A candidate finds the upgrade and sends a request; nothing changes until an administrator decides.
const seeker = await quick('upgrade.seeker@example.test');
let html = await seeker.html('/Settings');
check('candidate menu links to the upgrade page', html.includes('href="/Account/BecomeEmployer"'));
check('settings offers the upgrade and says an administrator approves it', html.includes('Chuyển sang nhà tuyển dụng') && html.includes('quản trị viên Aris duyệt'));
check('/Employer sends a candidate to the upgrade page', where(await seeker('/Employer')).includes('/Account/BecomeEmployer'));
check('/Company/Edit sends a candidate to the upgrade page', where(await seeker('/Company/Edit')).includes('/Account/BecomeEmployer'));
let page = await seeker.html('/Account/BecomeEmployer');
check('upgrade form renders and asks for approval', page.includes('id="beForm"') && page.includes('data-needs-approval="true"') && page.includes('Kiểm tra lại trước khi gửi duyệt'));
const seekerToken = token(page);
let result = await seeker.upgrade(seekerToken, company(''));
check('company name is required', result.success === false);
result = await seeker.upgrade(seekerToken, company('Cảng Xanh Thử Nghiệm'));
check('request sent and pending', result.success === true && result.pending === true && result.requestId > 0, JSON.stringify(result));
const firstRequest = result.requestId;
check('a pending request gives no employer access', where(await seeker('/Employer')).includes('/Account/BecomeEmployer'));
page = await seeker.html('/Account/BecomeEmployer');
check('upgrade page shows the pending request instead of the form', page.includes('Đang chờ quản trị viên duyệt') && page.includes('Cảng Xanh Thử Nghiệm') && !page.includes('id="beForm"'));
result = await seeker.upgrade(seekerToken, company('Cảng Xanh Thử Nghiệm'));
check('sending again does not create a second request', result.pending === true && result.requestId === firstRequest);
check('settings shows the pending request', (await seeker.html('/Settings')).includes('đang chờ quản trị viên duyệt'));
check('administrator is notified with a link to the request', (await notices(admin)).some(n => n.type === 'SupportRequest' && n.link.includes('requestId=' + firstRequest)));
page = await admin.html('/Admin?tab=requests&requestId=' + firstRequest);
check('admin sees the company details and the approve button', page.includes('Xin chuyển sang nhà tuyển dụng') && page.includes('Cảng Xanh Thử Nghiệm') && page.includes('MST 0312345678') && page.includes('Duyệt nhà tuyển dụng'));

// 2. Rejection with a reason, resubmission, approval.
check('admin rejection accepted', (await review(firstRequest, 'rejected', 'Thiếu website công ty, bổ sung rồi gửi lại.')).status === 302);
check('rejected request gives no employer access', where(await seeker('/Employer')).includes('/Account/BecomeEmployer'));
check('candidate is notified of the rejection', (await notices(seeker)).some(n => n.type === 'SupportResponse' && n.link.includes('/Account/BecomeEmployer')));
page = await seeker.html('/Account/BecomeEmployer');
check('upgrade page shows the reason and the form again', page.includes('Yêu cầu trước chưa được duyệt') && page.includes('Thiếu website công ty') && page.includes('id="beForm"'));
result = await seeker.upgrade(token(page), { ...company('Cảng Xanh Thử Nghiệm'), WebsiteUrl: 'cangxanh.example' });
check('resubmitted request is a new one', result.pending === true && result.requestId > firstRequest, JSON.stringify(result));
const secondRequest = result.requestId;
check('admin sees the added website', (await admin.html('/Admin?tab=requests&requestId=' + secondRequest)).includes('https://cangxanh.example'));
check('admin approval accepted', (await review(secondRequest, 'resolved', 'Đã duyệt thông tin công ty.')).status === 302);
check('employer dashboard opens after approval', (await seeker('/Employer')).status === 200);
check('upgrade page forwards to the dashboard now', where(await seeker('/Account/BecomeEmployer')).includes('/Employer'));
check('company profile editor opens', (await seeker('/Company/Edit')).status === 200);
check('video interview flow opens', (await seeker('/Employer/InterviewFlow')).status === 200);
html = await seeker.html('/Settings');
check('settings shows the approved company', html.includes('Nhà tuyển dụng · Cảng Xanh Thử Nghiệm'));
check('navbar switched to the employer menu', html.includes('Bảng tuyển dụng') && !html.includes('href="/Account/BecomeEmployer"'));
check('candidate is notified of the approval', (await notices(seeker)).some(n => n.type === 'SupportResponse' && n.content?.includes('đã được duyệt')));
check('a decided request cannot be decided again', (await admin.form('/Admin/Requests/' + secondRequest, { version: 'stale', status: 'rejected', reply: 'late reply' }, token(await admin.html('/Admin')))).status === 302
  && (await seeker('/Employer')).status === 200);

// 3. "Nhà tuyển dụng" on the sign-in page with an existing candidate account.
const returning = await quick('upgrade.returning@example.test');
check('employer sign-in with a candidate account opens the upgrade page', where(await session()(signedLink('upgrade.returning@example.test', '&intent=business'))).includes('/Account/BecomeEmployer'));
check('plain sign-in still opens the home feed', where(await session()(signedLink('upgrade.returning@example.test'))).includes('/Dashboard'));
check('an explicit returnUrl wins over the employer choice', where(await session()(signedLink('upgrade.returning@example.test', '&intent=business&returnUrl=%2FJobs'))) === '/Jobs');
check('employer sign-in with an employer account opens the home feed', where(await session()(signedLink('port.owner@example.test', '&intent=business'))).includes('/Dashboard'));
check('signed-in candidate choosing employer sign-up goes to the upgrade page', where(await returning('/Account/Register?intent=business')).includes('/Account/BecomeEmployer'));

// 4. Half-upgraded before 09/10 (Role=Business, candidate profile): no redirect loop; the request goes through approval.
const legacy = await quick('legacy.self@example.test');
html = await legacy.html('/Settings');
check('half-upgraded account gets the candidate menu with the upgrade entry', html.includes('href="/Account/BecomeEmployer"'));
check('half-upgraded account is sent to the upgrade page', where(await legacy('/Employer')).includes('/Account/BecomeEmployer'));
page = await legacy.html('/Account/BecomeEmployer');
check('half-upgraded account sees the form instead of bouncing back', page.includes('id="beForm"'));
result = await legacy.upgrade(token(page), company('Legacy Self Co'));
check('half-upgraded account sends a request', result.pending === true, JSON.stringify(result));
check('approval of the half-upgraded account accepted', (await review(result.requestId, 'resolved', 'Đã duyệt.')).status === 302);
check('finished account opens the dashboard', (await legacy('/Employer')).status === 200);

// 5. Accounts tab: direct upgrade, downgrade (rights revoked, no self-service way back), restore, finish a half-upgrade.
const target = await quick('upgrade.byadmin@example.test');
page = await admin.html('/Admin?tab=accounts&search=upgrade.byadmin');
const targetId = accountId(page), adminToken = token(page);
check('admin finds the candidate', targetId > 0);
await admin.form(`/Admin/Accounts/${targetId}/Role`, { role: 'Business', companyName: '' }, adminToken);
check('admin upgrade needs a company name', where(await target('/Employer')).includes('/Account/BecomeEmployer'));
check('admin upgrade accepted', (await admin.form(`/Admin/Accounts/${targetId}/Role`, { role: 'Business', companyName: 'Admin Made Co' }, adminToken)).status === 302);
check('admin-upgraded account opens the dashboard', (await target('/Employer')).status === 200);
check('admin downgrade accepted', (await admin.form(`/Admin/Accounts/${targetId}/Role`, { role: 'Employee' }, adminToken)).status === 302);
check('downgraded account is sent to the upgrade page', where(await target('/Employer')).includes('/Account/BecomeEmployer'));
page = await target.html('/Account/BecomeEmployer');
check('downgraded account is told the rights were revoked, without the form', page.includes('Quyền đăng tuyển đang bị thu hồi') && !page.includes('id="beForm"'));
result = await target.upgrade(token(page), company('Self Restore Co'));
check('downgraded account cannot request its way back', result.success === false && /thu hồi/.test(result.message ?? ''), JSON.stringify(result));
check('settings explains the revoked rights', (await target.html('/Settings')).includes('đang bị quản trị viên thu hồi'));
check('admin restore accepted', (await admin.form(`/Admin/Accounts/${targetId}/Role`, { role: 'Business' }, adminToken)).status === 302);
check('restored account keeps its company', (await target('/Employer')).status === 200 && (await target.html('/Settings')).includes('Nhà tuyển dụng · Admin Made Co'));

const legacyAdmin = await quick('legacy.admin@example.test');
page = await admin.html('/Admin?tab=accounts&search=legacy.admin');
check('admin list flags the missing company profile', page.includes('chưa có hồ sơ công ty'));
check('admin finishes a half-upgraded account', (await admin.form(`/Admin/Accounts/${accountId(page)}/Role`, { role: 'Business', companyName: 'Legacy Admin Co' }, token(page))).status === 302);
check('finished account opens the dashboard', (await legacyAdmin('/Employer')).status === 200);
check('admin list no longer flags it', !(await admin.html('/Admin?tab=accounts&search=legacy.admin')).includes('chưa có hồ sơ công ty'));

// 6. An administrator with a personal profile (like the owner's own account) switches directly, no request.
const second = session();
check('second fixture admin authenticated', (await second(signedLink('tohkadangyeu@gmail.com', '&returnUrl=%2FAdmin'))).status === 302);
page = await second.html('/Account/BecomeEmployer');
check('admin sees the direct form, not the approval one', page.includes('data-needs-approval="false"'));
result = await second.upgrade(token(page), company('Admin Own Co'));
check('admin switches their own profile at once', result.success === true && !result.pending, JSON.stringify(result));
check('admin opens the employer dashboard', (await second('/Employer')).status === 200);
check('admin keeps the admin portal', (await second('/Admin')).status === 200);
console.log(`EMPLOYER UPGRADE E2E PASSED (${checks})`);
