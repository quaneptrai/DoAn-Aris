from pathlib import Path
from playwright.sync_api import sync_playwright

out_dir = Path("docs/unified-theme/evidence")
out_dir.mkdir(parents=True, exist_ok=True)

auth_targets = [
    {"name": "redesign-login-desktop", "url": "http://localhost:5025/Account/Login", "width": 1440, "height": 900},
    {"name": "redesign-login-mobile", "url": "http://localhost:5025/Account/Login", "width": 390, "height": 844},
    {"name": "redesign-register-desktop", "url": "http://localhost:5025/Account/Register", "width": 1440, "height": 900},
    {"name": "redesign-register-mobile", "url": "http://localhost:5025/Account/Register", "width": 390, "height": 844},
]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)

    # 1. Capture Login & Register
    for target in auth_targets:
        page = browser.new_page(viewport={"width": target["width"], "height": target["height"]})
        try:
            page.goto(target["url"], wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(600)
            file_path = out_dir / f"{target['name']}.png"
            page.screenshot(path=str(file_path), full_page=True)
            print(f"Captured {target['name']} -> {file_path}")
        finally:
            page.close()

    # 2. Capture Dashboard Desktop
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    try:
        page.goto("http://localhost:5025/Account/QuickLogin?email=ungvien@aris.vn", wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(1000)
        
        # Viewport screenshot
        vp_file = out_dir / "redesign-dashboard-desktop-viewport.png"
        page.screenshot(path=str(vp_file), full_page=False)
        print(f"Captured redesign-dashboard-desktop-viewport -> {vp_file}")
        
        # Full page by sizing viewport to document height
        doc_height = page.evaluate("document.documentElement.scrollHeight")
        page.set_viewport_size({"width": 1440, "height": max(doc_height, 900)})
        page.wait_for_timeout(300)
        fp_file = out_dir / "redesign-dashboard-desktop.png"
        page.screenshot(path=str(fp_file), full_page=False)
        print(f"Captured redesign-dashboard-desktop -> {fp_file}")
    finally:
        page.close()

    # 3. Capture Dashboard Mobile
    page = browser.new_page(viewport={"width": 390, "height": 844})
    try:
        page.goto("http://localhost:5025/Account/QuickLogin?email=ungvien@aris.vn", wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(1000)
        
        # Viewport screenshot
        vp_file = out_dir / "redesign-dashboard-mobile-viewport.png"
        page.screenshot(path=str(vp_file), full_page=False)
        print(f"Captured redesign-dashboard-mobile-viewport -> {vp_file}")
        
        # Full page by sizing viewport to document height
        doc_height = page.evaluate("document.documentElement.scrollHeight")
        page.set_viewport_size({"width": 390, "height": max(doc_height, 844)})
        page.wait_for_timeout(300)
        fp_file = out_dir / "redesign-dashboard-mobile.png"
        page.screenshot(path=str(fp_file), full_page=False)
        print(f"Captured redesign-dashboard-mobile -> {fp_file}")
    finally:
        page.close()

    browser.close()

print("All screenshots generated successfully!")
