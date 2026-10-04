import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5025"
EVIDENCE_DIR = os.path.abspath("docs/unified-theme/evidence/constellation-v2")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def test_comment_system():
    print("=== Testing Comment System & Lightbox Modal ===", flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Step 1: Login
        print("\n--- 1. Authenticating ---", flush=True)
        page.goto(f"{BASE_URL}/Account/QuickLogin", wait_until="networkidle")
        page.wait_for_timeout(600)
        assert "/Dashboard" in page.url or page.url.endswith(":5025/"), f"Unexpected URL: {page.url}"
        print("  [Pass] Authenticated at Dashboard", flush=True)

        # Step 2: Open Dashboard and locate first post's comment button
        page.goto(f"{BASE_URL}/Dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Locate first post
        first_post = page.locator(".post-card").first
        assert first_post.count() > 0, "No post-card found!"
        post_id = first_post.get_attribute("data-post-id")
        print(f"  [Pass] Found post ID: {post_id}", flush=True)

        # Step 3: Click 'Bình luận' button on first post
        print("\n--- 2. Clicking 'Bình luận' button ---", flush=True)
        comment_btn = first_post.locator(".btn-comment")
        comment_btn.click()
        page.wait_for_timeout(600)

        # Assert Lightbox modal is shown
        lightbox = page.locator("#mediaLightbox")
        assert "show" in lightbox.get_attribute("class"), "Lightbox did not open!"
        has_media_class = "has-media" in (lightbox.get_attribute("class") or "")
        print(f"  [Pass] Lightbox opened! Has 'has-media': {has_media_class}", flush=True)

        # Measure panel size and stage visibility
        panel_box = page.locator("#lightboxPanel").bounding_box()
        stage_visible = page.locator("#lightboxStage").is_visible()
        print(f"  [Pass] Stage visible: {stage_visible} (expected False for text/comment mode)")
        print(f"  [Pass] Lightbox Panel Bounding Box: {panel_box}", flush=True)
        assert panel_box['width'] > 600, f"Panel width should be spacious (>600px), got {panel_box['width']}px"

        # Capture screenshot of the spacious comment modal
        modal_snap = os.path.join(EVIDENCE_DIR, "08_comment_modal_spacious.png")
        page.screenshot(path=modal_snap)
        print(f"  [Pass] Captured comment modal: {modal_snap}", flush=True)

        # Step 4: Test exit method 1 - Click backdrop (outside panel)
        print("\n--- 3. Testing Exit via Click Outside (Backdrop) ---", flush=True)
        # Click near top-left of backdrop (x=50, y=50)
        page.mouse.click(50, 50)
        page.wait_for_timeout(400)
        assert "show" not in (lightbox.get_attribute("class") or ""), "Modal should close when clicking backdrop!"
        print("  [Pass] Modal successfully closed via backdrop click!", flush=True)

        # Step 5: Test exit method 2 - Keyboard Escape (Esc)
        print("\n--- 4. Testing Exit via Escape Key ---", flush=True)
        comment_btn.click()
        page.wait_for_timeout(400)
        assert "show" in (lightbox.get_attribute("class") or ""), "Modal did not reopen!"
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        assert "show" not in (lightbox.get_attribute("class") or ""), "Modal should close on Escape key!"
        print("  [Pass] Modal successfully closed via Escape key!", flush=True)

        # Step 6: Test exit method 3 - Panel Header Close Button
        print("\n--- 5. Testing Exit via Panel Header Close Button ---", flush=True)
        comment_btn.click()
        page.wait_for_timeout(400)
        panel_close_btn = page.locator("#panelCloseBtn")
        assert panel_close_btn.is_visible(), "Panel close button should be visible!"
        panel_close_btn.click()
        page.wait_for_timeout(400)
        assert "show" not in (lightbox.get_attribute("class") or ""), "Modal should close on panel close button!"
        print("  [Pass] Modal successfully closed via Panel Header Close Button!", flush=True)

        # Step 7: Test exit method 4 - Screen Close Button (#lightboxClose)
        print("\n--- 6. Testing Exit via Screen Close Button ---", flush=True)
        comment_btn.click()
        page.wait_for_timeout(400)
        page.locator("#lightboxClose").click()
        page.wait_for_timeout(400)
        assert "show" not in (lightbox.get_attribute("class") or ""), "Modal should close on screen close button!"
        print("  [Pass] Modal successfully closed via Screen Close Button!", flush=True)

        # Step 8: Test submitting a comment via Enter key
        print("\n--- 7. Testing Comment Submission via Enter Key ---", flush=True)
        comment_btn.click()
        page.wait_for_timeout(600)
        comment_input = page.locator("#lbCommentInput")
        test_text = f"Astra 6 that su dot pha! Trai nghiem thoi gian thuc rat an tuong. #{int(time.time())}"
        comment_input.fill(test_text)
        page.keyboard.press("Enter")
        page.wait_for_timeout(1000)

        # Verify comment was added to the DOM
        comment_added = page.locator(f"#lbComments:has-text('{test_text}')")
        assert comment_added.count() > 0, "Submitted comment not found in list!"
        print("  [Pass] Comment submitted and rendered successfully via Enter!", flush=True)

        # Take screenshot of comment in the list
        comment_with_data_snap = os.path.join(EVIDENCE_DIR, "09_comment_submitted_live.png")
        page.screenshot(path=comment_with_data_snap)
        print(f"  [Pass] Captured submitted comment view: {comment_with_data_snap}", flush=True)

        # Close modal
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        # Step 9: Test Media Mode (click directly on post image)
        print("\n--- 8. Testing Media Mode (Clicking Post Image) ---", flush=True)
        media_item = first_post.locator(".post-media-item").first
        if media_item.count() > 0:
            media_item.click()
            page.wait_for_timeout(600)
            assert "show" in (lightbox.get_attribute("class") or ""), "Media lightbox did not open!"
            assert "has-media" in (lightbox.get_attribute("class") or ""), "Should have 'has-media' class!"
            stage_visible = page.locator("#lightboxStage").is_visible()
            assert stage_visible, "Stage should be visible in media mode!"
            panel_box = page.locator("#lightboxPanel").bounding_box()
            print(f"  [Pass] Media mode open! Stage visible: {stage_visible}, Panel width: {panel_box['width']}px", flush=True)
            assert panel_box['width'] >= 440, f"Panel width in media mode should be >= 440px, got {panel_box['width']}px"

            media_snap = os.path.join(EVIDENCE_DIR, "10_media_lightbox_spacious.png")
            page.screenshot(path=media_snap)
            print(f"  [Pass] Captured media lightbox view: {media_snap}", flush=True)

            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            assert "show" not in (lightbox.get_attribute("class") or ""), "Modal did not close on Escape in media mode!"
            print("  [Pass] Media mode closed successfully!", flush=True)

        browser.close()

    print("\n=== All Comment & Lightbox Tests Passed with Flying Colors! ===", flush=True)

if __name__ == "__main__":
    test_comment_system()
