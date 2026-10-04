import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:5183"
EVIDENCE_DIR = os.path.abspath("docs/design-lab/aris-login-v5/evidence")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def run_captures():
    print("=== Starting ARIS Wordmark & Living Login <-> Register Card Capture ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)

        # -------------------------------------------------------------
        # 1. Step 1: Readable ARIS Wordmark (2300ms)
        # -------------------------------------------------------------
        print("1. Capturing Readable ARIS Wordmark (2300ms)...")
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.goto(f"{BASE_URL}/index.html?clean=true")
        page.wait_for_timeout(2300)
        p1 = os.path.join(EVIDENCE_DIR, "seq_1_readable_aris.png")
        page.screenshot(path=p1)
        print(f" -> Saved seq_1_readable_aris.png (Page exceptions: {len(page_errors)})")

        # -------------------------------------------------------------
        # 2. Step 2: ARIS-to-Card Midpoint (3300ms)
        # -------------------------------------------------------------
        print("2. Capturing ARIS-to-Card Midpoint (3300ms)...")
        page.wait_for_timeout(1000) # now at 3300ms
        p2 = os.path.join(EVIDENCE_DIR, "seq_2_aris_to_card_midpoint.png")
        page.screenshot(path=p2)
        print(" -> Saved seq_2_aris_to_card_midpoint.png")

        # -------------------------------------------------------------
        # 3. Step 3: Final Transparent Login Card (4600ms)
        # -------------------------------------------------------------
        print("3. Capturing Final Transparent Login Card (4600ms)...")
        page.wait_for_timeout(1300) # now at 4600ms
        p3 = os.path.join(EVIDENCE_DIR, "seq_3_transparent_login_final.png")
        page.screenshot(path=p3)
        page.screenshot(path=os.path.join(EVIDENCE_DIR, "desktop_settled.png"))
        print(" -> Saved seq_3_transparent_login_final.png & desktop_settled.png")

        # -------------------------------------------------------------
        # 4. Type email into Login form
        # -------------------------------------------------------------
        print("4. Typing email into Login form...")
        page.fill("#userEmail", "tran.thi.b@aris.vn")
        page.wait_for_timeout(200)

        # -------------------------------------------------------------
        # 5. Step 4: Login-to-Registration Midpoint Morph
        # -------------------------------------------------------------
        print("5. Clicking Register link and capturing Morph Midpoint...")
        page.click("button:has-text('Đăng ký ngay')")
        page.wait_for_timeout(350) # mid-morph at 350ms
        p4 = os.path.join(EVIDENCE_DIR, "seq_4_login_to_reg_midpoint.png")
        page.screenshot(path=p4)
        print(" -> Saved seq_4_login_to_reg_midpoint.png")

        # -------------------------------------------------------------
        # 6. Step 5: Final Settled Registration Mode (Showing preserved email)
        # -------------------------------------------------------------
        print("6. Capturing Final Settled Registration Mode...")
        page.wait_for_timeout(800) # settled
        p5 = os.path.join(EVIDENCE_DIR, "seq_5_registration_final.png")
        page.screenshot(path=p5)
        print(" -> Saved seq_5_registration_final.png")

        # Verify preserved email in registration field
        reg_email_val = page.input_value("#regEmail")
        print(f" -> Preserved email in registration mode: {reg_email_val}")

        # -------------------------------------------------------------
        # 7. Step 6: Reverse Morph Back to Login Mode
        # -------------------------------------------------------------
        print("7. Clicking Login link and capturing Reverse Morph back to Login...")
        page.click("button:has-text('Đăng nhập ngay')")
        page.wait_for_timeout(950) # settled back
        p6 = os.path.join(EVIDENCE_DIR, "seq_6_reverse_to_login.png")
        page.screenshot(path=p6)
        print(" -> Saved seq_6_reverse_to_login.png")

        # -------------------------------------------------------------
        # 8. Step 7: Registration Submit & Accepted State
        # -------------------------------------------------------------
        print("8. Testing Registration Form Submit & Accepted State...")
        page.click("button:has-text('Đăng ký ngay')")
        page.wait_for_timeout(500)
        page.fill("#regName", "Trần Thị B")
        page.wait_for_timeout(200)
        page.click("#btnSubmitReg")
        page.wait_for_timeout(1400)
        p7 = os.path.join(EVIDENCE_DIR, "seq_10_accepted_register.png")
        page.screenshot(path=p7)
        print(" -> Saved seq_10_accepted_register.png")
        page.close()

        # -------------------------------------------------------------
        # 9. Step 8: Mobile Viewports (Login & Registration Modes)
        # -------------------------------------------------------------
        print("9. Capturing Mobile 390x844 Viewports...")
        mpage = browser.new_page(viewport={"width": 390, "height": 844})
        mpage.goto(f"{BASE_URL}/index.html?clean=true")
        mpage.wait_for_timeout(4500) # settled login card
        mpage.screenshot(path=os.path.join(EVIDENCE_DIR, "seq_7_mobile_login.png"))
        mpage.screenshot(path=os.path.join(EVIDENCE_DIR, "mobile_settled.png"))
        print(" -> Saved seq_7_mobile_login.png & mobile_settled.png")

        # Switch to Registration on Mobile & test scroll
        mpage.click("button:has-text('Đăng ký ngay')")
        mpage.wait_for_timeout(900)
        mpage.screenshot(path=os.path.join(EVIDENCE_DIR, "seq_8_mobile_register.png"))
        print(" -> Saved seq_8_mobile_register.png")

        # Scroll to confirm bottom actions are accessible
        mpage.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        mpage.wait_for_timeout(300)
        mpage.screenshot(path=os.path.join(EVIDENCE_DIR, "seq_8b_mobile_register_scrolled.png"))
        print(" -> Saved seq_8b_mobile_register_scrolled.png")
        mpage.close()

        # Mobile Narrow (320x568)
        print("10. Capturing Mobile Narrow 320x568...")
        npage = browser.new_page(viewport={"width": 320, "height": 568})
        npage.goto(f"{BASE_URL}/index.html?clean=true")
        npage.wait_for_timeout(4500)
        npage.screenshot(path=os.path.join(EVIDENCE_DIR, "seq_9_mobile_narrow.png"))
        print(" -> Saved seq_9_mobile_narrow.png")
        npage.close()

        # -------------------------------------------------------------
        # 10. Step 9: Full Continuous Video Recording (18s)
        # -------------------------------------------------------------
        print("11. Recording Full Motion Continuous Video (18s)...")
        temp_video_dir = os.path.join(EVIDENCE_DIR, "raw_video")
        os.makedirs(temp_video_dir, exist_ok=True)

        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=temp_video_dir,
            record_video_size={"width": 1440, "height": 900}
        )
        vpage = context.new_page()

        # Phase A: Initial swarm -> ARIS wordmark (0-2.2s) -> Hold (2.2-2.8s) -> Peel to login card (2.8-4.0s)
        vpage.goto(f"{BASE_URL}/index.html?clean=true")
        vpage.wait_for_timeout(4600)

        # Phase B: Type email in Login mode
        vpage.click("#userEmail")
        vpage.type("#userEmail", "nguyen.hoang.aris@gmail.com", delay=50)
        vpage.wait_for_timeout(500)

        # Phase C: Trigger Morph to Registration Mode
        vpage.click("button:has-text('Đăng ký ngay')")
        vpage.wait_for_timeout(1400) # observe particle detachment arc and card growth

        # Phase D: Type Full Name in Registration mode
        vpage.click("#regName")
        vpage.type("#regName", "Nguyễn Hoàng", delay=50)
        vpage.wait_for_timeout(600)

        # Phase E: Reverse Morph back to Login Mode
        vpage.click("button:has-text('Đăng nhập ngay')")
        vpage.wait_for_timeout(1400) # observe reverse morph & preserved email

        # Phase F: Submit Login form & transition to Accepted Check Email
        vpage.click("#btnSubmit")
        vpage.wait_for_timeout(2200)

        vpage.close()
        context.close()

        raw_files = [f for f in os.listdir(temp_video_dir) if f.endswith(".webm")]
        if raw_files:
            latest_video = os.path.join(temp_video_dir, raw_files[0])
            dest_video = os.path.join(EVIDENCE_DIR, "v5_full_choreography.webm")
            dest_legacy = os.path.join(EVIDENCE_DIR, "v5_motion_recording.webm")
            if os.path.exists(dest_video):
                os.remove(dest_video)
            os.replace(latest_video, dest_video)
            import shutil
            shutil.copyfile(dest_video, dest_legacy)
            print(f" -> Successfully saved final video: {dest_video} ({os.path.getsize(dest_video)} bytes)")

        browser.close()

    print("=== All ARIS Morph Captures Completed Successfully! ===")

if __name__ == "__main__":
    run_captures()
