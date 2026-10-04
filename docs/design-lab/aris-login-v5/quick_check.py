import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:5183"
EVIDENCE_DIR = os.path.abspath("docs/design-lab/aris-login-v5/evidence")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def run_quick_checks():
    print("=== Running Short Awaited Checks for V5 ===")
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        # 1. Check ARIS legible shape (at 2100ms)
        page.goto(f"{BASE_URL}/index.html?clean=true")
        page.wait_for_timeout(2100)
        p_aris = os.path.join(EVIDENCE_DIR, "check_1_aris_legible.png")
        page.screenshot(path=p_aris)
        results["aris_image"] = p_aris
        print("1. Captured check_1_aris_legible.png")

        # 2. Check Transparent Login Card (at 4400ms)
        page.wait_for_timeout(2300)
        p_card = os.path.join(EVIDENCE_DIR, "check_2_transparent_card.png")
        page.screenshot(path=p_card)
        results["card_image"] = p_card
        print("2. Captured check_2_transparent_card.png")

        # 3. Type email and switch to Registration
        page.fill("#userEmail", "test.nguyen@aris.vn")
        page.wait_for_timeout(100)
        page.click("button:has-text('Đăng ký ngay')")
        page.wait_for_timeout(700) # wait for staged morph & layout settle
        p_reg = os.path.join(EVIDENCE_DIR, "check_3_registration_mode.png")
        page.screenshot(path=p_reg)
        results["reg_image"] = p_reg

        reg_email_val = page.input_value("#regEmail")
        results["reg_email_carried"] = reg_email_val
        print(f"3. Captured check_3_registration_mode.png. Carried email: '{reg_email_val}'")

        # Edit email in registration and check reverse switch
        page.fill("#regName", "Nguyễn Văn Test")
        page.fill("#regEmail", "updated.email@aris.vn")
        page.wait_for_timeout(100)
        page.click("button:has-text('Đăng nhập ngay')")
        page.wait_for_timeout(700)
        p_rev = os.path.join(EVIDENCE_DIR, "check_4_reverse_login.png")
        page.screenshot(path=p_rev)
        results["rev_image"] = p_rev

        login_email_val = page.input_value("#userEmail")
        results["login_email_updated"] = login_email_val
        print(f"4. Captured check_4_reverse_login.png. Updated login email: '{login_email_val}'")

        # Switch back to registration to verify name draft was preserved
        page.click("button:has-text('Đăng ký ngay')")
        page.wait_for_timeout(600)
        reg_name_val = page.input_value("#regName")
        results["reg_name_preserved"] = reg_name_val
        print(f"5. Name draft preserved on return: '{reg_name_val}'")

        # 6. Mobile 390x844 view
        mpage = browser.new_page(viewport={"width": 390, "height": 844})
        mpage.goto(f"{BASE_URL}/index.html?clean=true")
        mpage.wait_for_timeout(4200)
        p_mob = os.path.join(EVIDENCE_DIR, "check_5_mobile_transparent.png")
        mpage.screenshot(path=p_mob)
        results["mobile_image"] = p_mob
        print("6. Captured check_5_mobile_transparent.png")
        mpage.close()

        page.close()
        browser.close()

    results["errors"] = page_errors
    print(f"=== Checks Finished. Page exceptions: {len(page_errors)} ===")
    return results

if __name__ == "__main__":
    run_quick_checks()
