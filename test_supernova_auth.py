import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5025"
EVIDENCE_DIR = os.path.abspath("docs/unified-theme/evidence/supernova-auth")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def run_tests():
    print("=== Running Supernova Intro & High-Contrast Live Auth Test Suite ===", flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page_errors = []
        console_logs = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # Clear sessionStorage so intro runs fully
        page.goto(f"{BASE_URL}/Account/Login", wait_until="domcontentloaded")
        page.evaluate("sessionStorage.clear()")
        page.reload(wait_until="domcontentloaded")

        # 1. Capture Inward Vortex Coiling Phase (~850ms)
        page.wait_for_timeout(850)
        vortex_path = os.path.join(EVIDENCE_DIR, "01_vortex_coiling.png")
        page.screenshot(path=vortex_path)
        print(f"  [Pass] Captured Inward Vortex: {vortex_path}", flush=True)

        # 2. Capture Supernova Detonation & Brightness Flash (~1750ms total, +900ms)
        page.wait_for_timeout(900)
        supernova_path = os.path.join(EVIDENCE_DIR, "02_supernova_flash.png")
        page.screenshot(path=supernova_path)
        print(f"  [Pass] Captured Supernova Detonation Flash: {supernova_path}", flush=True)

        # 3. Capture DNA Crystallization from Supernova Debris (~3500ms total, +1750ms)
        page.wait_for_timeout(1750)
        dna_path = os.path.join(EVIDENCE_DIR, "03_dna_crystallization.png")
        page.screenshot(path=dna_path)
        print(f"  [Pass] Captured DNA Formation from Debris: {dna_path}", flush=True)

        # 4. Capture ARIS Wordmark Phase (~6200ms total, +2700ms)
        page.wait_for_timeout(2700)
        aris_path = os.path.join(EVIDENCE_DIR, "04_aris_wordmark.png")
        page.screenshot(path=aris_path)
        print(f"  [Pass] Captured ARIS Wordmark: {aris_path}", flush=True)

        # 5. Capture Settled Form with High-Contrast Typography (~12800ms total, +6600ms)
        page.wait_for_timeout(6600)
        settled_path = os.path.join(EVIDENCE_DIR, "05_settled_form_high_contrast.png")
        page.screenshot(path=settled_path)
        print(f"  [Pass] Captured Settled High-Contrast Form: {settled_path}", flush=True)

        # 6. Test Input Focus & Form Typing Contrast
        print("Testing form input focus & contrast...", flush=True)
        page.focus("#loginEmail")
        page.fill("#loginEmail", "ungvien.test@aris.vn")
        page.wait_for_timeout(350)
        focus_path = os.path.join(EVIDENCE_DIR, "06_input_focus_contrast.png")
        page.screenshot(path=focus_path)
        print(f"  [Pass] Captured Input Focus & Typing: {focus_path}", flush=True)

        # 7. Test Mode Switch to Register
        print("Testing mode morph to Register...", flush=True)
        page.click("#formSectionLogin .auth-mode-switch-link")
        page.wait_for_timeout(1400)
        reg_path = os.path.join(EVIDENCE_DIR, "07_register_mode_contrast.png")
        page.screenshot(path=reg_path)
        print(f"  [Pass] Captured Register Mode High-Contrast: {reg_path}", flush=True)

        # 8. Test Direct Register route
        print("Testing direct /Account/Register route...", flush=True)
        page.goto(f"{BASE_URL}/Account/Register")
        page.wait_for_timeout(400)
        page.click("#btnSkipIntro")
        page.wait_for_timeout(400)
        direct_reg_path = os.path.join(EVIDENCE_DIR, "08_direct_register_contrast.png")
        page.screenshot(path=direct_reg_path)
        print(f"  [Pass] Captured Direct Register: {direct_reg_path}", flush=True)

        # 9. Test Mobile 390x844
        print("Testing Mobile 390x844...", flush=True)
        m_ctx = browser.new_context(viewport={"width": 390, "height": 844})
        m_page = m_ctx.new_page()
        m_page.goto(f"{BASE_URL}/Account/Login")
        m_page.wait_for_timeout(400)
        m_page.click("#btnSkipIntro")
        m_page.wait_for_timeout(400)
        mob_path = os.path.join(EVIDENCE_DIR, "09_mobile_390x844.png")
        m_page.screenshot(path=mob_path)
        print(f"  [Pass] Captured Mobile 390x844: {mob_path}", flush=True)

        m_page.close()
        m_ctx.close()
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
