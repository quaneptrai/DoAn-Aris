from pathlib import Path
from playwright.sync_api import sync_playwright
import json

out_dir = Path("docs/unified-theme/evidence")
out_dir.mkdir(parents=True, exist_ok=True)

targets = [
    {"name": "baseline-login-desktop", "url": "http://localhost:5025/Account/Login", "viewport": {"width": 1440, "height": 900}},
    {"name": "baseline-login-mobile", "url": "http://localhost:5025/Account/Login", "viewport": {"width": 390, "height": 844}},
    {"name": "baseline-register-desktop", "url": "http://localhost:5025/Account/Register", "viewport": {"width": 1440, "height": 900}},
    {"name": "baseline-register-mobile", "url": "http://localhost:5025/Account/Register", "viewport": {"width": 390, "height": 844}},
]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    
    # 1. Capture Login and Register
    for item in targets:
        page = browser.new_page(viewport=item["viewport"])
        try:
            page.goto(item["url"], wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(500)
            file_path = out_dir / f"{item['name']}.png"
            page.screenshot(path=str(file_path), full_page=True)
            print(f"Captured {item['name']} -> {file_path}")
        except Exception as ex:
            print(f"Failed {item['name']}: {ex}")
        finally:
            page.close()

    # 2. Capture Authenticated Dashboard
    for vp_name, vp in [("desktop", {"width": 1440, "height": 900}), ("mobile", {"width": 390, "height": 844})]:
        page = browser.new_page(viewport=vp)
        try:
            # Login via QuickLogin
            page.goto("http://localhost:5025/Account/QuickLogin?email=ungvien@aris.vn", wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(1000)
            file_path = out_dir / f"baseline-dashboard-{vp_name}.png"
            page.screenshot(path=str(file_path), full_page=True)
            print(f"Captured baseline-dashboard-{vp_name} -> {file_path}")
        except Exception as ex:
            print(f"Failed baseline-dashboard-{vp_name}: {ex}")
        finally:
            page.close()

    browser.close()

print("Baseline capture completed successfully.")
