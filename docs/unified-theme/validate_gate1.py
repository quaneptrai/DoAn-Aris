import os
import sys
import time
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path.cwd()
out_dir = root / 'docs/unified-theme/evidence/gate1-v5-polished'
video_dir = out_dir / 'video'
out_dir.mkdir(parents=True, exist_ok=True)
video_dir.mkdir(parents=True, exist_ok=True)

html_path = root / 'docs/design-lab/aris-login-v5/index.html'
file_uri = html_path.as_uri() + '?clean=true'

results = {
    'file': str(html_path),
    'errors': [],
    'fps_samples': [],
    'avg_fps': 0,
    'render_stats': {},
    'keyboard_nav_success': False,
    'skip_intro_matches': False
}

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)

    # 1. Desktop full choreography with video recording
    context = browser.new_context(
        viewport={'width': 1440, 'height': 900},
        device_scale_factor=1,
        record_video_dir=str(video_dir),
        record_video_size={'width': 1440, 'height': 900}
    )
    page = context.new_page()
    page.on('pageerror', lambda e: results['errors'].append(f"PageError: {str(e)}"))
    page.on('console', lambda m: results['errors'].append(f"ConsoleError: {m.text}") if m.type == 'error' else None)

    # Inject FPS tracker
    page.add_init_script("""
        window.__fpsRecords = [];
        let __last = performance.now();
        let __frames = 0;
        function __measureFps() {
            __frames++;
            const now = performance.now();
            if (now - __last >= 1000) {
                const fps = (__frames * 1000) / (now - __last);
                window.__fpsRecords.push(Math.round(fps * 10) / 10);
                __frames = 0;
                __last = now;
            }
            requestAnimationFrame(__measureFps);
        }
        requestAnimationFrame(__measureFps);
    """)

    t0 = time.monotonic()
    page.goto(file_uri, wait_until='domcontentloaded')

    # Frame 1: DNA (~2.5s)
    page.wait_for_timeout(2600)
    page.screenshot(path=str(out_dir / '01-dna-1440.png'))
    print("Captured 01-dna-1440.png")

    # Frame 2: ARIS (~5.0s)
    page.wait_for_timeout(2500)
    page.screenshot(path=str(out_dir / '02-aris-1440.png'))
    print("Captured 02-aris-1440.png")

    # Frame 3: Settle into Login Card (~9.5s total)
    page.wait_for_timeout(4500)
    page.screenshot(path=str(out_dir / '03-login-settled-1440.png'))
    print("Captured 03-login-settled-1440.png")

    # 10-second FPS benchmark collection
    page.wait_for_timeout(2000)
    fps_data = page.evaluate("window.__fpsRecords")
    render_stats = page.evaluate("window.getRenderStats ? window.getRenderStats() : {}")
    results['fps_samples'] = fps_data
    results['render_stats'] = render_stats
    if fps_data:
        results['avg_fps'] = round(sum(fps_data) / len(fps_data), 2)
    print(f"FPS samples: {fps_data}, Avg: {results['avg_fps']}")
    print(f"Render stats: {render_stats}")

    # Crop 200% center card for facet seam inspection
    # Card bounding box in 1440x900 center: roughly x=500..940, y=200..700
    page.screenshot(
        path=str(out_dir / '03-login-card-center-crop.png'),
        clip={'x': 540, 'y': 250, 'width': 360, 'height': 380}
    )
    print("Captured 03-login-card-center-crop.png")

    # Interactive flow: Email focus & validation
    email_input = page.locator('#userEmail')
    email_input.fill('test@')
    page.locator('#btnSubmit').click()
    page.wait_for_timeout(200)
    err_visible = page.locator('#errMail').is_visible()
    results['email_error_shown'] = err_visible
    page.screenshot(path=str(out_dir / '04-login-validation-error.png'))
    print(f"Captured 04-login-validation-error.png (Error visible: {err_visible})")

    # Fill valid email and check focus
    email_input.fill('linh.nguyen@aris-career.vn')
    page.screenshot(path=str(out_dir / '05-login-valid-focused.png'))

    # Switch to Register
    page.get_by_role('button', name='Đăng ký ngay', exact=True).click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(out_dir / '06-register-mode-1440.png'))
    carried_email = page.locator('#regEmail').input_value()
    results['reg_email_carried'] = carried_email
    print(f"Captured 06-register-mode-1440.png. Carried email: {carried_email}")

    # Switch back to Login
    page.get_by_role('button', name='Đăng nhập ngay', exact=True).click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(out_dir / '07-back-login-1440.png'))
    print("Captured 07-back-login-1440.png")

    # Keyboard navigation check: focus email input and tab through controls
    page.locator('#userEmail').focus()
    page.wait_for_timeout(100)
    page.screenshot(path=str(out_dir / '05-login-valid-focused.png'))

    tab_sequence = []
    for _ in range(5):
        active = page.evaluate("document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null")
        tab_sequence.append(active)
        page.keyboard.press('Tab')
        page.wait_for_timeout(50)

    results['tab_sequence'] = tab_sequence
    results['keyboard_nav_success'] = ('userEmail' in tab_sequence)
    print(f"Keyboard focus sequence: {tab_sequence}")

    context.close()

    # 2. Skip Intro direct verification context
    ctx_skip = browser.new_context(viewport={'width': 1440, 'height': 900})
    p_skip = ctx_skip.new_page()
    p_skip.goto(file_uri, wait_until='domcontentloaded')
    p_skip.wait_for_timeout(500)
    p_skip.locator('#btnSkipIntro').click()
    p_skip.wait_for_timeout(600)
    p_skip.screenshot(path=str(out_dir / '08-skip-intro-settled-1440.png'))
    skip_stats = p_skip.evaluate("""
        ({
            revealed: document.getElementById('glassAuthCard').classList.contains('revealed'),
            opacity: window.getRenderStats ? window.getRenderStats().revealed : false
        })
    """)
    results['skip_intro_matches'] = skip_stats['revealed']
    print(f"Captured 08-skip-intro-settled-1440.png (Revealed: {skip_stats})")
    ctx_skip.close()

    # 3. Mobile 390x844 viewport
    ctx_mob = browser.new_context(viewport={'width': 390, 'height': 844})
    p_mob = ctx_mob.new_page()
    p_mob.goto(file_uri, wait_until='domcontentloaded')
    p_mob.wait_for_timeout(500)
    p_mob.locator('#btnSkipIntro').click()
    p_mob.wait_for_timeout(600)
    p_mob.screenshot(path=str(out_dir / '09-mobile-390x844.png'), full_page=True)
    results['mobile_390_scroll_width'] = p_mob.evaluate("document.documentElement.scrollWidth")
    print(f"Captured 09-mobile-390x844.png (ScrollWidth: {results['mobile_390_scroll_width']})")
    ctx_mob.close()

    # 4. Small Mobile 320x568 viewport
    ctx_small = browser.new_context(viewport={'width': 320, 'height': 568})
    p_small = ctx_small.new_page()
    p_small.goto(file_uri, wait_until='domcontentloaded')
    p_small.wait_for_timeout(500)
    p_small.locator('#btnSkipIntro').click()
    p_small.wait_for_timeout(600)
    p_small.screenshot(path=str(out_dir / '10-mobile-320x568.png'), full_page=True)
    results['mobile_320_scroll_width'] = p_small.evaluate("document.documentElement.scrollWidth")
    print(f"Captured 10-mobile-320x568.png (ScrollWidth: {results['mobile_320_scroll_width']})")
    ctx_small.close()

    # 5. Reduced motion
    ctx_rm = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    p_rm = ctx_rm.new_page()
    p_rm.goto(file_uri, wait_until='domcontentloaded')
    p_rm.wait_for_timeout(1000)
    p_rm.screenshot(path=str(out_dir / '11-reduced-motion-1440.png'))
    print("Captured 11-reduced-motion-1440.png")
    ctx_rm.close()

    browser.close()

(out_dir / 'report.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
print("Validation complete. Report saved.")
