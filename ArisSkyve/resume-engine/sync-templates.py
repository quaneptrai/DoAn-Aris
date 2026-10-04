"""Refresh public template metadata. This never installs or executes third-party packages."""
import html
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEADERS = {'User-Agent': 'ArisResumeCatalog/1.0 (public metadata index)'}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as response:
        return response.read(8_000_000)

def safe_url(value):
    if not isinstance(value, str):
        return None
    value = value.replace('git+https://', 'https://').removesuffix('.git')
    parsed = urllib.parse.urlparse(value)
    return value if parsed.scheme in ('http', 'https') and parsed.hostname else None

def category(name, description):
    text = (name + ' ' + description).lower()
    for label, words in [('Academic', ('academic', 'research', 'university', 'scholar')), ('Student', ('student', 'graduate', 'intern')),
                         ('Technology', ('developer', 'stack', 'tech', 'programmer', 'engineer', 'github', 'terminal')),
                         ('Creative', ('creative', 'design', 'art', 'portfolio', 'color')), ('ATS & Corporate', ('ats', 'professional', 'executive', 'corporate', 'simple', 'minimal'))]:
        if any(word in text for word in words):
            return label
    return 'Community'

def main():
    entries = {}
    official_html = fetch('https://www.jsonresume.org/themes').decode('utf-8')
    previews = {}
    for encoded in re.findall(r'href="([^"]+)"', official_html):
        url = html.unescape(encoded)
        parsed = urllib.parse.urlparse(url)
        theme = urllib.parse.parse_qs(parsed.query).get('theme', [None])[0]
        if parsed.hostname == 'registry.jsonresume.org' and theme:
            previews[theme] = url
    for offset in range(0, 1500, 250):
        result = json.loads(fetch(f'https://registry.npmjs.org/-/v1/search?text=jsonresume-theme&size=250&from={offset}'))
        count = 0
        for item in result.get('objects', []):
            package = item['package']
            name = package['name']
            if not re.fullmatch(r'(?:@[a-z0-9._-]+/)?jsonresume-theme-[a-zA-Z0-9._-]+', name):
                continue
            count += 1
            slug = name.split('jsonresume-theme-', 1)[1]
            description = re.sub(r'\s+', ' ', package.get('description', '')).strip()[:180]
            links = package.get('links', {})
            entries[name] = {'id': name, 'name': slug.replace('-', ' ').title(), 'packageName': name,
                'version': package.get('version', ''), 'description': description, 'category': category(slug, description),
                'license': package.get('license') or 'Not declared', 'source': 'JSON Resume / npm',
                'sourceUrl': f'https://www.npmjs.com/package/{name}', 'repositoryUrl': safe_url(links.get('repository')),
                'homepageUrl': safe_url(links.get('homepage')), 'previewUrl': previews.get(slug),
                'officialPreview': slug in previews}
        if offset > 250 and count == 0:
            break
    for slug, preview in previews.items():
        if any(x['previewUrl'] == preview for x in entries.values()):
            continue
        key = f'jsonresume-official:{slug}'
        entries[key] = {'id': key, 'name': slug.replace('-', ' ').title(), 'packageName': None, 'version': '',
            'description': 'Template được liệt kê trong thư viện JSON Resume.', 'category': category(slug, ''),
            'license': 'See source repository', 'source': 'JSON Resume official', 'sourceUrl': 'https://www.jsonresume.org/themes',
            'repositoryUrl': 'https://github.com/jsonresume/jsonresume.org/tree/master/packages/themes',
            'homepageUrl': None, 'previewUrl': preview, 'officialPreview': True}
    catalog = {'updatedAt': datetime.now(timezone.utc).isoformat(), 'sources': ['https://www.jsonresume.org/themes', 'https://registry.npmjs.org/-/v1/search'],
               'entries': sorted(entries.values(), key=lambda x: (not x['officialPreview'], x['name'].lower()))}
    target = ROOT / 'catalog' / 'external-templates.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Indexed {len(entries)} external templates; {sum(x['officialPreview'] for x in entries.values())} official previews.")

if __name__ == '__main__':
    main()
