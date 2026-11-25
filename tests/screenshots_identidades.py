"""Capturas de tela das identidades visuais por álbum para revisão de design."""
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright

ORIGIN = "http://127.0.0.1:3000"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"
BRAT = "mb-0aa87f3e-a91a-4355-ad9e-6d60be378841"
SWEETENER = "mb-029bb5e7-f051-4a0f-8c57-a5b89d914300"
POSITIONS = "mb-9ad6641b-e9c6-462e-a039-f3255ded0c2c"


def run(browser):
    OUT.mkdir(exist_ok=True)
    desktop = browser.new_context(viewport={"width": 1280, "height": 860}, service_workers="block")
    mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                 has_touch=True, service_workers="block")
    a = desktop.new_page()
    m = mobile.new_page()

    a.goto(f"{ORIGIN}/album/{BRAT}")
    a.wait_for_timeout(700)
    a.screenshot(path=str(OUT / "revisao-album-brat-desktop.png"), full_page=False)

    m.goto(f"{ORIGIN}/album/{SWEETENER}")
    m.wait_for_timeout(700)
    m.screenshot(path=str(OUT / "revisao-album-sweetener-mobile.png"), full_page=False)

    for album, nome in ((BRAT, "brat"), (SWEETENER, "sweetener"), (POSITIONS, "positions")):
        a.goto(f"{ORIGIN}/estudio?album={album}")
        a.wait_for_timeout(900)
        a.screenshot(path=str(OUT / f"revisao-estudio-{nome}-album.png"), full_page=False)
        a.select_option("#st-model", "editorial")
        a.wait_for_timeout(600)
        a.screenshot(path=str(OUT / f"revisao-estudio-{nome}-editorial.png"), full_page=False)

    m.goto(f"{ORIGIN}/estudio?album={BRAT}")
    m.wait_for_timeout(900)
    m.screenshot(path=str(OUT / "revisao-estudio-brat-mobile.png"), full_page=False)

    for p in (a, m):
        p.close()
    desktop.close()
    mobile.close()
    print("capturas salvas em test-results/")
    return 0


if __name__ == "__main__":
    cache = Path.home() / "AppData" / "Local" / "ms-playwright"
    shell = next(cache.glob("chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"), None)
    launch = {"executable_path": str(shell)} if shell else {}
    with sync_playwright() as pw:
        sys.exit(run(pw.chromium.launch(**launch)))
