from pathlib import Path
from playwright.sync_api import sync_playwright
import json
out=Path('docs/unified-theme/evidence')
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 records=[]
 for label,url in [('current-login','http://127.0.0.1:5025/Account/Login'),('current-v5','http://127.0.0.1:5183/')]:
  try:
   response=page.goto(url,wait_until='domcontentloaded',timeout=20000)
   page.wait_for_timeout(1200 if label=='current-login' else 14000)
   page.screenshot(path=str(out/(label+'.png')),full_page=True)
   records.append({'name':label,'url':page.url,'status':response.status,'title':page.title(),'width':page.evaluate('document.documentElement.scrollWidth')})
  except Exception as e: records.append({'name':label,'error':str(e)})
 browser.close()
(out/'baseline.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False))
