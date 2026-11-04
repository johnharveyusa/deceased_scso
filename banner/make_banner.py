"""Redraw facebook-banner.png with the current number of officers.

Counts the officers listed in the memorial page (index.html), puts that number into banner/template.html, and takes a
1200x630 picture of it with headless Chrome. Run by the daily GitHub job.
"""
import pathlib, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HERE = ROOT / 'banner'

def officer_count():
    if len(sys.argv) > 1:
        return int(sys.argv[1])
    page = (ROOT / 'index.html').read_text(encoding='utf-8')
    return sum(1 for line in page.splitlines() if line.startswith('{n:"'))

def main():
    n = officer_count()
    if n < 50:
        sys.exit(f'Count looks wrong ({n}); leaving the banner alone.')
    page = HERE / 'banner_now.html'
    page.write_text((HERE / 'template.html').read_text(encoding='utf-8').replace('{{COUNT}}', str(n)), encoding='utf-8')
    chrome = next((c for c in ('google-chrome', 'chromium', 'chromium-browser') if shutil.which(c)), None)
    if not chrome:
        sys.exit('Chrome not found')
    out = ROOT / 'facebook-banner.png'
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
                    '--window-size=1200,630', '--virtual-time-budget=8000',
                    f'--screenshot={out}', page.as_uri()], check=True)
    page.unlink()
    (HERE / 'count.txt').write_text(str(n) + '\n')
    print('Banner drawn for', n, 'officers')

main()
