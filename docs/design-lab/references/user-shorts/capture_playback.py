import os
import time
from playwright.sync_api import sync_playwright

shorts_dir = os.path.abspath('docs/design-lab/references/user-shorts')

videos = [
    ('yVXsS59LYJ0', 'https://www.youtube.com/shorts/yVXsS59LYJ0'),
    ('sYGsqFtojDc', 'https://www.youtube.com/shorts/sYGsqFtojDc'),
    ('LQOona1NXrE', 'https://www.youtube.com/shorts/LQOona1NXrE'),
    ('Eo8G3CYWc', 'https://www.youtube.com/shorts/_-Eo8G3CYWc')
]

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    
    for vid_id, url in videos:
        print(f"=== Playing and capturing {vid_id} ===")
        v_folder = os.path.join(shorts_dir, vid_id)
        
        context = browser.new_context(
            viewport={'width': 1280, 'height': 850},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'
        )
        page = context.new_page()
        
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(2000)
            
            # Dismiss cookie consent
            try:
                for b in page.locator('button').all():
                    txt = b.inner_text().lower()
                    if 'agree' in txt or 'accept' in txt or 'đồng ý' in txt:
                        b.click()
                        page.wait_for_timeout(1000)
                        break
            except:
                pass
                
            # Click directly on video element to start playback
            v_el = page.locator('video').first
            if v_el.count() > 0:
                v_el.click()
                page.wait_for_timeout(800)
                # Unmute & play
                page.evaluate("() => { const v = document.querySelector('video'); if (v) { v.muted = true; v.play(); } }")
                page.wait_for_timeout(1000)
                
            v_state = page.evaluate("() => { const v = document.querySelector('video'); return v ? { currentTime: v.currentTime, paused: v.paused, duration: v.duration } : null; }")
            print(f"[{vid_id}] Initial video state: {v_state}")
            
            # Sample 5 distinct frames over time
            for step in range(1, 6):
                page.wait_for_timeout(2000)
                cur_t = page.evaluate("() => { const v = document.querySelector('video'); return v ? v.currentTime : 0; }")
                paused = page.evaluate("() => { const v = document.querySelector('video'); return v ? v.paused : true; }")
                
                frame_file = os.path.join(v_folder, f"playback_step{step}_{int(cur_t)}s.png")
                
                # Take screenshot of the video element or player
                if v_el.count() > 0:
                    v_el.screenshot(path=frame_file)
                else:
                    page.screenshot(path=frame_file)
                print(f"[{vid_id}] Step {step}: t={cur_t:.1f}s (paused={paused}) -> {frame_file}")
                
        except Exception as e:
            print(f"[{vid_id}] Error: {e}")
            
        context.close()

    browser.close()

print("All active playback frame captures finished!")
