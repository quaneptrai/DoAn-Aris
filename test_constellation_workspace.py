import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5025"
EVIDENCE_DIR = os.path.abspath("docs/unified-theme/evidence/constellation-v2")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def test_workspace():
    print("=== Testing Constellation Workspace Elevation ===", flush=True)
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page_errors = []
        console_logs = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # Step 1: QuickLogin as candidate to authenticate
        print("\n--- 1. Authenticating via QuickLogin ---", flush=True)
        page.goto(f"{BASE_URL}/Account/QuickLogin", wait_until="networkidle")
        page.wait_for_timeout(600)
        assert "/Dashboard" in page.url or page.url.endswith(":5025/"), f"Unexpected URL after login: {page.url}"
        print(f"  [Pass] Authenticated. Current URL: {page.url}", flush=True)

        pages_to_test = [
            ("Dashboard", f"{BASE_URL}/Dashboard", "01_dashboard_stellar.png", "body:has(#postForm)"),
            ("Jobs", f"{BASE_URL}/Jobs", "02_jobs_stellar.png", "body:has(#jobsSearchForm)"),
            ("Profile", f"{BASE_URL}/Profile", "03_profile_stellar.png", "body:has(#btnEditBio)"),
            ("Settings", f"{BASE_URL}/Settings", "04_settings_stellar.png", "body:has(#activeStatusToggle)"),
            ("Resume", f"{BASE_URL}/Resume", "05_resume_stellar.png", "body:has(script[src*='resume-actions.js'])"),
            ("MyApplications", f"{BASE_URL}/JobApplications/MyApplications", "06_applications_stellar.png", "body:has(script[src*='application-actions.js'])"),
            ("Company", f"{BASE_URL}/Company", "07_company_stellar.png", "body:has(#companyListGrid)")
        ]

        for name, url, snap_name, hook in pages_to_test:
            print(f"\n--- Checking Surface: {name} ({url}) ---", flush=True)
            page_errors.clear()
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(1400) # allow self-drawing constellation, starfield, and telemetry to mount and animate

            # Assert no uncaught exceptions
            assert len(page_errors) == 0, f"Page errors found on {name}: {page_errors}"

            # Evaluate CSS, Typography & Dynamic Cosmos Elements
            metrics = page.evaluate("""() => {
                const bodyBg = window.getComputedStyle(document.body).backgroundColor;
                const h1 = document.querySelector('h1, h2, .dashboard-heading h1');
                const h1Font = h1 ? window.getComputedStyle(h1).fontFamily : 'N/A';
                const hasStage = !!document.getElementById('arisCosmicConstellationStage');
                const hasCanvas = !!document.getElementById('arisCosmicCanvas');
                const constellationName = document.querySelector('.constellation-name-label')?.textContent || 'N/A';
                const starCount = document.querySelectorAll('.constellation-star-node').length;
                const beamCount = document.querySelectorAll('.constellation-beam').length;
                const hasTelemetry = !!document.getElementById('dashMissionTelemetry');
                
                return {
                    bodyBg,
                    h1Font,
                    hasStage,
                    hasCanvas,
                    constellationName,
                    starCount,
                    beamCount,
                    hasTelemetry
                };
            }""")

            snap_path = os.path.join(EVIDENCE_DIR, snap_name)
            page.screenshot(path=snap_path)
            print(f"  [Pass] Captured {name}: {snap_path}", flush=True)
            print(f"         Stage: {metrics['hasStage']}, Canvas: {metrics['hasCanvas']}, Constellation: '{metrics['constellationName']}', Stars: {metrics['starCount']}, Beams: {metrics['beamCount']}, Telemetry: {metrics['hasTelemetry']}", flush=True)

            results.append({
                "surface": name,
                "url": url,
                "screenshot": snap_path,
                "metrics": metrics
            })

        browser.close()

    print("\n=== All Surface Tests Passed Successfully ===", flush=True)
    return results

if __name__ == "__main__":
    test_workspace()
