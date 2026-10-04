import os
import time
from playwright.sync_api import sync_playwright

shorts_dir = os.path.abspath('docs/design-lab/references/user-shorts')
os.makedirs(shorts_dir, exist_ok=True)

videos = [
    ('yVXsS59LYJ0', 'https://www.youtube.com/shorts/yVXsS59LYJ0'),
    ('sYGsqFtojDc', 'https://www.youtube.com/shorts/sYGsqFtojDc'),
    ('LQOona1NXrE', 'https://www.youtube.com/shorts/LQOona1NXrE'),
    ('Eo8G3CYWc', 'https://www.youtube.com/shorts/_-Eo8G3CYWc')
]

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    
    for vid_id, url in videos:
        print(f"=== Inspecting {vid_id}: {url} ===")
        v_folder = os.path.join(shorts_dir, vid_id)
        os.makedirs(v_folder, exist_ok=True)
        
        context = browser.new_context(
            viewport={'width': 1280, 'height': 850},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'
        )
        page = context.new_page()
        
        try:
            resp = page.goto(url, wait_until='domcontentloaded', timeout=35000)
            page.wait_for_timeout(3000)
            
            # Dismiss cookie consent dialog if present
            try:
                consent_btns = page.locator('button')
                for b in consent_btns.all():
                    txt = b.inner_text().lower()
                    if 'agree' in txt or 'accept' in txt or 'đồng ý' in txt:
                        b.click()
                        page.wait_for_timeout(1000)
                        break
            except Exception as e:
                pass
                
            title = page.title()
            print(f"[{vid_id}] Page Title: {title}")
            
            # Try to get video player details
            video_el = page.locator('video').first
            is_video_present = video_el.count() > 0
            print(f"[{vid_id}] Video element present: {is_video_present}")
            
            # Play the video if paused
            page.keyboard.press('k')
            
            # Sample frames at 1s, 3s, 6s, 9s, 12s
            intervals = [1, 3, 6, 9, 12]
            for sec in intervals:
                page.wait_for_timeout(2500)
                frame_path = os.path.join(v_folder, f"frame_{sec}s.png")
                page.screenshot(path=frame_path)
                print(f"[{vid_id}] Captured frame at step {sec}: {frame_path}")
                
            # Also capture cropped player screenshot
            try:
                player_el = page.locator('#shorts-player, #player, ytd-shorts').first
                if player_el.count() > 0:
                    player_path = os.path.join(v_folder, "player_crop.png")
                    player_el.screenshot(path=player_path)
                    print(f"[{vid_id}] Captured player crop: {player_path}")
            except Exception as pe:
                print(f"[{vid_id}] Player crop error: {pe}")
                
        except Exception as e:
            print(f"[{vid_id}] Navigation/Inspection error: {e}")
            with open(os.path.join(v_folder, 'error.txt'), 'w', encoding='utf-8') as ef:
                ef.write(str(e))
                
        context.close()

    browser.close()

print("All shorts inspection script completed.")
