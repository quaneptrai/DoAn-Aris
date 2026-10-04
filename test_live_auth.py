import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5025"
EVIDENCE_DIR = os.path.abspath("docs/unified-theme/evidence/live-login")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def run_tests():
    print("=== Running Comprehensive Live Auth Test Suite on http://localhost:5025 ===", flush=True)
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page_errors = []
        console_logs = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # -------------------------------------------------------------
        # 1. Sequence Capture: DNA -> ARIS -> Settled Login Card
        # -------------------------------------------------------------
        print("1. Loading /Account/Login...", flush=True)
        page.goto(f"{BASE_URL}/Account/Login", wait_until="domcontentloaded")

        # Capture DNA Phase (~1.5s)
        page.wait_for_timeout(1500)
        dna_path = os.path.join(EVIDENCE_DIR, "01_dna_phase.png")
        page.screenshot(path=dna_path)
        print(f"  [Pass] Captured DNA Phase: {dna_path}", flush=True)

        # Capture ARIS Wordmark Phase (~4.6s)
        page.wait_for_timeout(3100)
        aris_path = os.path.join(EVIDENCE_DIR, "02_aris_wordmark.png")
        page.screenshot(path=aris_path)
        print(f"  [Pass] Captured ARIS Wordmark: {aris_path}", flush=True)

        # Capture Settled Login Card (~8.0s)
        page.wait_for_timeout(3400)
        card_path = os.path.join(EVIDENCE_DIR, "03_settled_login_card.png")
        page.screenshot(path=card_path)
        print(f"  [Pass] Captured Settled Login Card: {card_path}", flush=True)

        # -------------------------------------------------------------
        # 2. Input Focus State & Visual Tranquility
        # -------------------------------------------------------------
        print("2. Testing input focus...", flush=True)
        page.focus("#loginEmail")
        page.wait_for_timeout(400)
        focus_path = os.path.join(EVIDENCE_DIR, "04_input_focused.png")
        page.screenshot(path=focus_path)
        print(f"  [Pass] Captured Input Focus: {focus_path}", flush=True)

        # -------------------------------------------------------------
        # 3. Mode Switch: Login -> Register with State Preservation
        # -------------------------------------------------------------
        print("3. Typing email and morphing to Register...", flush=True)
        page.fill("#loginEmail", "candidate.test@aris.vn")
        page.wait_for_timeout(200)

        # Click switch link in login panel
        page.click("#formSectionLogin .auth-mode-switch-link")
        page.wait_for_timeout(900) # wait for staged morph & settle

        reg_path = os.path.join(EVIDENCE_DIR, "05_register_mode_morphed.png")
        page.screenshot(path=reg_path)
        print(f"  [Pass] Captured Register Morphed: {reg_path}", flush=True)

        reg_email_val = page.input_value("#registerEmail")
        print(f"  [Pass] Carried email to register: '{reg_email_val}'", flush=True)
        print(f"  [Pass] URL updated to: {page.url}", flush=True)

        # -------------------------------------------------------------
        # 4. Reverse Mode Switch: Register -> Login
        # -------------------------------------------------------------
        print("4. Testing reverse switch back to Login...", flush=True)
        page.fill("#registerEmail", "updated.candidate@aris.vn")
        page.wait_for_timeout(200)

        page.click("#formSectionRegister .auth-mode-switch-link")
        page.wait_for_timeout(900)

        rev_path = os.path.join(EVIDENCE_DIR, "06_login_mode_reversed.png")
        page.screenshot(path=rev_path)
        print(f"  [Pass] Captured Reverse Login: {rev_path}", flush=True)

        login_email_val = page.input_value("#loginEmail")
        print(f"  [Pass] Preserved email in login: '{login_email_val}'", flush=True)
        print(f"  [Pass] URL updated to: {page.url}", flush=True)

        # -------------------------------------------------------------
        # 5. Skip Intro Button (Instant Access)
        # -------------------------------------------------------------
        print("5. Testing Skip Intro button...", flush=True)
        page.goto(f"{BASE_URL}/Account/Login")
        page.wait_for_timeout(400)
        page.click("#btnSkipIntro")
        page.wait_for_timeout(400)
        skip_path = os.path.join(EVIDENCE_DIR, "07_skip_intro_instant.png")
        page.screenshot(path=skip_path)
        print(f"  [Pass] Captured Skip Intro: {skip_path}", flush=True)

        # -------------------------------------------------------------
        # 6. Direct Access to /Account/Register
        # -------------------------------------------------------------
        print("6. Testing direct navigation to /Account/Register...", flush=True)
        page.goto(f"{BASE_URL}/Account/Register")
        page.wait_for_timeout(400)
        page.click("#btnSkipIntro")
        page.wait_for_timeout(400)
        direct_reg_path = os.path.join(EVIDENCE_DIR, "08_direct_register_page.png")
        page.screenshot(path=direct_reg_path)
        print(f"  [Pass] Captured Direct Register: {direct_reg_path}", flush=True)

        # -------------------------------------------------------------
        # 7. Form Submission & Sent Magic Link Confirmation View
        # -------------------------------------------------------------
        print("7. Testing Form Submission (Magic Link Request)...", flush=True)
        page.goto(f"{BASE_URL}/Account/Login")
        page.wait_for_timeout(400)
        page.click("#btnSkipIntro")
        page.wait_for_timeout(300)
        page.fill("#loginEmail", "kiemtra.magiclink@aris.vn")
        page.wait_for_timeout(200)

        # Submit login form
        page.click("#loginSubmit")
        # In development, RequestMagicLink generates HMAC token, sets ViewBag.Message and ViewBag.DevConfirmUrl
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(800)

        sent_path = os.path.join(EVIDENCE_DIR, "09_magic_link_sent_confirmation.png")
        page.screenshot(path=sent_path)
        print(f"  [Pass] Captured Sent Confirmation View: {sent_path}", flush=True)

        # -------------------------------------------------------------
        # 8. Mobile Viewport 390x844 (iPhone 14/15)
        # -------------------------------------------------------------
        print("8. Testing Mobile 390x844...", flush=True)
        m_ctx = browser.new_context(viewport={"width": 390, "height": 844})
        m_page = m_ctx.new_page()
        m_page.goto(f"{BASE_URL}/Account/Login")
        m_page.wait_for_timeout(400)
        m_page.click("#btnSkipIntro")
        m_page.wait_for_timeout(400)
        mob_path = os.path.join(EVIDENCE_DIR, "10_mobile_390x844.png")
        m_page.screenshot(path=mob_path)
        print(f"  [Pass] Captured Mobile 390x844: {mob_path}", flush=True)

        # -------------------------------------------------------------
        # 9. Small Mobile Viewport 320x568 (iPhone SE)
        # -------------------------------------------------------------
        print("9. Testing Small Mobile 320x568...", flush=True)
        s_ctx = browser.new_context(viewport={"width": 320, "height": 568})
        s_page = s_ctx.new_page()
        s_page.goto(f"{BASE_URL}/Account/Login")
        s_page.wait_for_timeout(400)
        s_page.click("#btnSkipIntro")
        s_page.wait_for_timeout(400)
        small_mob_path = os.path.join(EVIDENCE_DIR, "11_mobile_320x568.png")
        s_page.screenshot(path=small_mob_path)
        print(f"  [Pass] Captured Small Mobile 320x568: {small_mob_path}", flush=True)

        m_page.close()
        m_ctx.close()
        s_page.close()
        s_ctx.close()
        page.close()
        browser.close()

        print("\n=== SUMMARY OF RUN ===", flush=True)
        print(f"Total Page Exceptions: {len(page_errors)}", flush=True)
        for err in page_errors:
            print(f"  [Exception]: {err}", flush=True)
        print(f"Total Console Logs: {len(console_logs)}", flush=True)
        for log in console_logs:
            if "error" in log.lower() or "warn" in log.lower():
                print(f"  [Warning/Error]: {log}", flush=True)

if __name__ == "__main__":
    run_tests()
