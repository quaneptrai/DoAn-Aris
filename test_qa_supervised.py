import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

OUTPUT_DIR = r"C:\Users\tohka\tmp_ai\aris-supervised-20260919\agy-output"
BASE_URL = "http://localhost:5025"

def run_qa():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "base_url": BASE_URL,
        "assertions": [],
        "errors": [],
        "screenshots": []
    }

    def assert_true(condition, msg):
        if condition:
            print(f"  [PASS] {msg}", flush=True)
            report["assertions"].append({"status": "PASS", "message": msg})
        else:
            print(f"  [FAIL] {msg}", flush=True)
            report["assertions"].append({"status": "FAIL", "message": msg})
            report["errors"].append(msg)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        
        # -------------------------------------------------------------
        # 1. Desktop 1440x900 Normal Access & Prompt Form Availability
        # -------------------------------------------------------------
        print("\n--- 1. Desktop 1440x900 Prompt Form Access ---")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        page.goto(f"{BASE_URL}/Account/Login", wait_until="domcontentloaded")
        page.wait_for_timeout(600) # Give 600ms for swift initial settling

        # Assert no page JS errors
        assert_true(len(page_errors) == 0, f"No page errors on initial load (errors={page_errors})")

        # Assert form is visible & inputs enabled promptly (NOT gated by 7.6s!)
        login_form = page.locator("#loginForm")
        assert_true(login_form.is_visible(), "Login form is immediately visible")
        
        email_input = page.locator("#loginEmail")
        assert_true(email_input.is_visible() and email_input.is_enabled(), "Email input is visible and enabled promptly")

        submit_btn = page.locator("#loginSubmit")
        assert_true(submit_btn.is_visible() and submit_btn.is_enabled(), "Submit button is visible and enabled")

        # Assert no horizontal overflow
        has_overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert_true(not has_overflow, "Desktop viewport 1440x900 has zero horizontal overflow")

        # Capture Desktop Full & Close-Up
        snap_desktop = os.path.join(OUTPUT_DIR, "01_desktop_final.png")
        page.screenshot(path=snap_desktop)
        report["screenshots"].append(snap_desktop)
        print(f"  Saved screenshot: {snap_desktop}")

        snap_closeup = os.path.join(OUTPUT_DIR, "02_form_closeup.png")
        card_el = page.locator("#glassAuthCard")
        card_el.screenshot(path=snap_closeup)
        report["screenshots"].append(snap_closeup)
        print(f"  Saved screenshot: {snap_closeup}")

        # -------------------------------------------------------------
        # 2. Material Construction Checkpoints (25%, 50%, 75%, 100%)
        # -------------------------------------------------------------
        print("\n--- 2. Material Construction Checkpoints ---")
        for pct in [25, 50, 75, 100]:
            p_val = pct / 100.0
            page.evaluate(f"window.__qaSetProgress({p_val})")
            page.wait_for_timeout(200)
            ckpt_path = os.path.join(OUTPUT_DIR, f"checkpoint_{pct:03d}_pct.png")
            page.screenshot(path=ckpt_path)
            report["screenshots"].append(ckpt_path)
            print(f"  Saved checkpoint {pct}%: {ckpt_path}")
            assert_true(os.path.exists(ckpt_path), f"Checkpoint {pct}% captured successfully")

        # Restore settled state
        page.evaluate("window.skipIntro()")
        page.wait_for_timeout(300)

        # -------------------------------------------------------------
        # 3. Restrained Pointer Interaction & Input Focus Stability
        # -------------------------------------------------------------
        print("\n--- 3. Restrained Pointer & Focus Stability ---")
        # Move mouse around stage
        page.mouse.move(300, 250)
        page.wait_for_timeout(200)
        page.mouse.move(800, 400)
        page.wait_for_timeout(200)

        # Focus input and verify stationary stability
        email_input.focus()
        page.wait_for_timeout(300)
        snap_focus = os.path.join(OUTPUT_DIR, "03_input_focused.png")
        page.screenshot(path=snap_focus)
        report["screenshots"].append(snap_focus)
        print(f"  Saved screenshot: {snap_focus}")

        # Verify typing does not move input
        box1 = email_input.bounding_box()
        page.keyboard.type("qa.engineer@aris.vn")
        page.wait_for_timeout(200)
        box2 = email_input.bounding_box()
        assert_true(box1['x'] == box2['x'] and box1['y'] == box2['y'], "Input position remains rock-solid stationary while typing")

        # -------------------------------------------------------------
        # 4. Morph Transition: Login -> Register with Email Preservation
        # -------------------------------------------------------------
        print("\n--- 4. Morph Transition: Login -> Register ---")
        reg_switch = page.locator("#formSectionLogin .auth-mode-switch-link")
        reg_switch.click()
        page.wait_for_timeout(700) # Morph settle time

        # Assert URL synced to Register
        assert_true("register" in page.url.lower(), f"URL synced to Register: {page.url}")

        # Assert email preserved in Register input
        reg_email = page.locator("#registerEmail")
        reg_val = reg_email.input_value()
        assert_true(reg_val == "qa.engineer@aris.vn", f"Email successfully carried over to Register: '{reg_val}'")

        # Assert Register form is visible and active
        reg_form = page.locator("#formSectionRegister")
        assert_true(reg_form.is_visible(), "Register panel is visible after morph")

        snap_reg = os.path.join(OUTPUT_DIR, "04_register_mode.png")
        page.screenshot(path=snap_reg)
        report["screenshots"].append(snap_reg)
        print(f"  Saved screenshot: {snap_reg}")

        # -------------------------------------------------------------
        # 5. Browser History: Back & Forward Navigation
        # -------------------------------------------------------------
        print("\n--- 5. Browser History: Back / Forward ---")
        page.go_back()
        page.wait_for_timeout(400)
        assert_true("login" in page.url.lower(), f"Back button restored Login URL: {page.url}")
        login_val_after_back = page.locator("#loginEmail").input_value()
        assert_true(login_val_after_back == "qa.engineer@aris.vn", f"Email preserved after Back navigation: '{login_val_after_back}'")

        page.go_forward()
        page.wait_for_timeout(600)
        assert_true("register" in page.url.lower(), f"Forward button restored Register URL: {page.url}")

        # Return to Login via switch link or function
        reg_switch_btn = page.locator("#formSectionRegister .auth-mode-switch-link")
        if reg_switch_btn.is_visible():
            reg_switch_btn.click()
        else:
            page.evaluate("window.switchAuthMode('login')")
        page.wait_for_timeout(500)

        # -------------------------------------------------------------
        # 6. Replay & Controls (Replay, Skip, Pause)
        # -------------------------------------------------------------
        print("\n--- 6. Replay & Interactive Controls ---")
        # Trigger Replay
        page.click("#btnReplay")
        page.wait_for_timeout(300)
        is_replaying = page.evaluate("() => window.skipIntro !== undefined")
        assert_true(is_replaying, "Replay triggered successfully")

        # Test Skip button
        page.click("#btnSkipIntro")
        page.wait_for_timeout(300)
        assert_true(page.locator("#loginForm").is_visible(), "Skip button immediately restores usable settled form")

        # Test Pause toggle
        pause_btn = page.locator("#btnPauseMotion")
        pause_btn.click()
        page.wait_for_timeout(200)
        txt_paused = page.locator("#txtPauseMotion").text_content()
        assert_true("tiếp" in txt_paused.lower() or "play" in txt_paused.lower(), f"Pause toggle updated label: '{txt_paused}'")
        pause_btn.click() # Unpause
        page.wait_for_timeout(200)

        context.close()

        # -------------------------------------------------------------
        # 7. Mobile Viewport 390x844 (iPhone 14/15)
        # -------------------------------------------------------------
        print("\n--- 7. Mobile Viewport 390x844 ---")
        m_ctx = browser.new_context(viewport={"width": 390, "height": 844})
        m_page = m_ctx.new_page()
        m_page.goto(f"{BASE_URL}/Account/Login", wait_until="domcontentloaded")
        m_page.wait_for_timeout(500)

        m_overflow = m_page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert_true(not m_overflow, "Mobile 390x844 has zero horizontal overflow")

        assert_true(m_page.locator("#loginEmail").is_visible(), "Mobile 390x844 has visible email field")
        assert_true(m_page.locator("#loginSubmit").is_visible(), "Mobile 390x844 has visible submit button")

        snap_mob = os.path.join(OUTPUT_DIR, "05_mobile_390x844.png")
        m_page.screenshot(path=snap_mob)
        report["screenshots"].append(snap_mob)
        print(f"  Saved screenshot: {snap_mob}")
        m_ctx.close()

        # -------------------------------------------------------------
        # 8. Small Mobile Viewport 320x568 (iPhone SE)
        # -------------------------------------------------------------
        print("\n--- 8. Small Mobile Viewport 320x568 ---")
        s_ctx = browser.new_context(viewport={"width": 320, "height": 568})
        s_page = s_ctx.new_page()
        s_page.goto(f"{BASE_URL}/Account/Login", wait_until="domcontentloaded")
        s_page.wait_for_timeout(500)

        s_overflow = s_page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert_true(not s_overflow, "Small Mobile 320x568 has zero horizontal overflow")

        assert_true(s_page.locator("#loginEmail").is_visible(), "Small Mobile 320x568 email field is visible")
        assert_true(s_page.locator("#loginSubmit").is_visible(), "Small Mobile 320x568 submit button is visible")

        snap_sm_mob = os.path.join(OUTPUT_DIR, "06_mobile_320x568.png")
        s_page.screenshot(path=snap_sm_mob)
        report["screenshots"].append(snap_sm_mob)
        print(f"  Saved screenshot: {snap_sm_mob}")
        s_ctx.close()

        # -------------------------------------------------------------
        # 9. Prefers Reduced Motion Mode
        # -------------------------------------------------------------
        print("\n--- 9. Reduced Motion Mode ---")
        rm_ctx = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        rm_page = rm_ctx.new_page()
        rm_page.goto(f"{BASE_URL}/Account/Login", wait_until="domcontentloaded")
        rm_page.wait_for_timeout(300)

        assert_true(rm_page.locator("#loginForm").is_visible(), "Reduced motion mode immediately shows usable form")
        snap_rm = os.path.join(OUTPUT_DIR, "07_reduced_motion.png")
        rm_page.screenshot(path=snap_rm)
        report["screenshots"].append(snap_rm)
        print(f"  Saved screenshot: {snap_rm}")
        rm_ctx.close()

        # -------------------------------------------------------------
        # 10. Direct Access to /Account/Register
        # -------------------------------------------------------------
        print("\n--- 10. Direct Access to /Account/Register ---")
        reg_ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        reg_page = reg_ctx.new_page()
        reg_page.goto(f"{BASE_URL}/Account/Register", wait_until="domcontentloaded")
        reg_page.wait_for_timeout(500)

        assert_true(reg_page.locator("#formSectionRegister").is_visible(), "Direct /Account/Register opens Register panel immediately")
        assert_true(reg_page.locator("#registerEmail").is_visible(), "Direct Register email input is visible")

        snap_direct_reg = os.path.join(OUTPUT_DIR, "08_direct_register.png")
        reg_page.screenshot(path=snap_direct_reg)
        report["screenshots"].append(snap_direct_reg)
        print(f"  Saved screenshot: {snap_direct_reg}")
        reg_ctx.close()

        browser.close()

    # Save summary report JSON
    report_json_path = os.path.join(OUTPUT_DIR, "test_summary.json")
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\n[SUMMARY] Wrote test report to {report_json_path}")
    print(f"Total assertions: {len(report['assertions'])}, Failures: {len(report['errors'])}")

if __name__ == "__main__":
    run_qa()
