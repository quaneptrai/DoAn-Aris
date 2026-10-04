import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.goto('http://localhost:5025/Account/QuickLogin')
    page.wait_for_timeout(600)
    page.goto('http://localhost:5025/Settings')
    page.wait_for_timeout(1000)

    html = page.evaluate("""() => {
        function dump(el, depth = 0) {
            if (depth > 6) return '';
            const tag = el.tagName;
            const cls = (typeof el.className === 'string' && el.className) ? '.' + el.className.trim().replace(/\s+/g, '.') : '';
            let s = '  '.repeat(depth) + tag + cls + '\n';
            for (let i = 0; i < el.children.length; i++) {
                s += dump(el.children[i], depth + 1);
            }
            return s;
        }
        const root = document.querySelector('.aris-container.py-4') || document.body;
        return dump(root);
    }""")
    print("=== DOM TREE ===")
    print(html)
    browser.close()
