from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
root=Path.cwd()
out=root/'docs/unified-theme/evidence/v5-reference-review'
report={'reference':str(root/'docs/design-lab/aris-login-v5/index.html'),'errors':[],'frames':[]}
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=True)
 context=b.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,record_video_dir=str(out/'video'),record_video_size={'width':1440,'height':900})
 page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.goto((root/'docs/design-lab/aris-login-v5/index.html').as_uri() + '?clean=true',wait_until='domcontentloaded',timeout=30000)
 start=time.monotonic()
 for t,label in [(2.7,'01-dna'),(4.8,'02-aris'),(9.5,'03-login')]:
  remain=t-(time.monotonic()-start)
  if remain>0:page.wait_for_timeout(remain*1000)
  page.screenshot(path=str(out/(label+'.png')))
  report['frames'].append({'frame':label,'elapsed':round(time.monotonic()-start,2)})
 page.mouse.move(480,400);page.wait_for_timeout(650);page.mouse.move(970,520);page.wait_for_timeout(650)
 page.get_by_role('button',name='Đăng ký ngay',exact=True).click(timeout=15000)
 page.wait_for_timeout(1200);page.screenshot(path=str(out/'04-register.png'),full_page=True)
 report['register_visible']=page.locator('#formSectionRegister').is_visible()
 report['desktop_scroll_width']=page.evaluate('document.documentElement.scrollWidth')
 page.get_by_role('button',name='Đăng nhập ngay',exact=True).click(timeout=5000)
 page.wait_for_timeout(1200);page.screenshot(path=str(out/'05-back-login.png'))
 report['login_visible_after_reverse']=page.locator('#formSectionLogin').is_visible()
 page.locator('#userEmail').fill('review@example.test');page.screenshot(path=str(out/'06-focused.png'))
 context.close()
 mobile=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,reduced_motion='reduce')
 mp=mobile.new_page();mp.goto((root/'docs/design-lab/aris-login-v5/index.html').as_uri() + '?clean=true',wait_until='domcontentloaded',timeout=30000);mp.wait_for_timeout(1500)
 mp.screenshot(path=str(out/'07-mobile-reduced-motion.png'),full_page=True)
 report['mobile_scroll_width']=mp.evaluate('document.documentElement.scrollWidth')
 mobile.close();b.close()
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
