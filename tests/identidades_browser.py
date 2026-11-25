"""Verifica as identidades visuais por álbum no navegador (faixa na página do disco, Estúdio, exportação).

Executa com um Python que tenha Playwright e Chromium, por exemplo o ambiente da coleção de skills:
  "..\\SKILLS PARA O CODEX\\.venv\\Scripts\\python.exe" tests/identidades_browser.py
O servidor do CAPA deve estar ativo em http://127.0.0.1:3000 (npm start na raiz do projeto).
"""
from pathlib import Path
import struct
import sys

from playwright.sync_api import expect, sync_playwright

ORIGIN = "http://127.0.0.1:3000"
ROOT = Path(__file__).resolve().parents[1]
BRAT = "mb-0aa87f3e-a91a-4355-ad9e-6d60be378841"
SWEETENER = "mb-029bb5e7-f051-4a0f-8c57-a5b89d914300"
CLUBE = "clube-da-esquina"
ANCESTRAL = "ancestral"


def png_size(png_bytes):
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n", "PNG inválido"
    width, height = struct.unpack(">II", png_bytes[16:24])
    return width, height


def run(browser):
    errors = []
    desktop = browser.new_context(viewport={"width": 1280, "height": 860}, service_workers="block")
    mobile = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True,
                                 has_touch=True, service_workers="block")
    a = desktop.new_page()
    m = mobile.new_page()
    for p in (a, m):
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.on("console", lambda msg: errors.append(msg.text) if msg.type == "error"
             and "Failed to load resource" not in msg.text else None)
        p.set_default_timeout(9000)

    # 1. Faixa de identidade na página do álbum (nível 1) — desktop e celular.
    for page in (a, m):
        page.goto(f"{ORIGIN}/album/{BRAT}")
        band = page.locator(".identity-band")
        expect(band).to_be_visible()
        expect(band).to_contain_text("Identidade visual")
        expect(band).to_contain_text("BRAT")
        assert band.evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(138, 206, 0)", \
            band.evaluate("el => getComputedStyle(el).backgroundColor")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), page.url

    # 2. Álbum sem identidade não recebe faixa.
    a.goto(f"{ORIGIN}/album/{CLUBE}")
    expect(a.locator(".identity-band")).to_have_count(0)

    # 3. Estúdio: modo padrão é "Estética do álbum" quando há identidade.
    a.goto(f"{ORIGIN}/estudio?album={BRAT}")
    expect(a.get_by_role("heading", name="Estúdio")).to_be_visible()
    expect(a.locator("#st-theme")).to_have_value("album")
    expect(a.locator("#st-theme-note")).to_contain_text("Estética de BRAT")
    a.wait_for_function("() => document.fonts.check('700 42px Instrument')")
    fundo_brat = a.evaluate("() => document.querySelector('#st-canvas').getContext('2d').getImageData(12,12,1,1).data.join(',')")
    assert fundo_brat.replace(",", " ").startswith("138 206 0"), fundo_brat

    # 4. Troca para "Tema do CAPA": fundo grafite do design system.
    a.select_option("#st-theme", "capa")
    a.wait_for_timeout(350)
    fundo_capa = a.evaluate("() => document.querySelector('#st-canvas').getContext('2d').getImageData(12,12,1,1).data.join(',')")
    assert fundo_capa.replace(",", " ").startswith("25 28 24"), fundo_capa

    # 5. Sweetener: papel claro e serifada; Positions: grafite quente.
    a.goto(f"{ORIGIN}/estudio?album={SWEETENER}")
    expect(a.locator("#st-theme")).to_have_value("album")
    a.wait_for_timeout(500)
    fundo_sweet = a.evaluate("() => document.querySelector('#st-canvas').getContext('2d').getImageData(12,12,1,1).data.join(',')")
    assert fundo_sweet.replace(",", " ").startswith("246 231 219"), fundo_sweet
    assert a.evaluate("() => document.fonts.check('400 42px InstrumentSerif')"), "Instrument Serif não carregou"

    a.goto(f"{ORIGIN}/estudio?album={BRAT}")
    a.wait_for_timeout(500)
    assert a.evaluate("() => document.fonts.check('700 42px Instrument')")

    # 6. Modo personalizado mantém os controles manuais.
    a.select_option("#st-theme", "custom")
    expect(a.locator("#st-bg")).to_be_visible()
    expect(a.locator("#st-color")).to_be_visible()
    a.select_option("#st-theme", "album")
    expect(a.locator("#st-bg")).to_be_hidden()

    # 7. Exportação PNG do tema do álbum: 1080 × 1350 no formato feed.
    a.goto(f"{ORIGIN}/estudio?album={BRAT}&tema=album")
    a.wait_for_timeout(600)
    a.select_option("#st-theme", "album")
    expect(a.locator("#st-dimensions")).to_have_text("1080 × 1350 px")
    with a.expect_download() as download_info:
        a.click("#st-save")
    download = download_info.value
    assert download.suggested_filename.startswith("capa-")
    path = ROOT / "test-results" / "identidade-brat-feed.png"
    download.save_as(str(path))
    width, height = png_size(path.read_bytes())
    assert (width, height) == (1080, 1350), (width, height)

    # 8. Formato quadrado e stories medidos pelo canvas.
    for fmt, dims in (("quadrado", "1080 × 1080 px"), ("stories", "1080 × 1920 px")):
        a.goto(f"{ORIGIN}/estudio?album={SWEETENER}&tema=album")
        a.select_option("#st-format", fmt)
        a.wait_for_timeout(400)
        expect(a.locator("#st-dimensions")).to_have_text(dims)
        assert a.evaluate("() => [document.querySelector('#st-canvas').width, document.querySelector('#st-canvas').height]") \
            == [int(dims.split(" ")[0]), int(dims.split(" ")[-2])]

    # 9. Nível 2: álbum sem identidade e com capa local usa paleta extraída.
    a.goto(f"{ORIGIN}/estudio?album={ANCESTRAL}&tema=album")
    expect(a.locator("#st-theme-note")).to_contain_text("cor dominante da capa")
    a.wait_for_timeout(600)
    fundo_nivel2 = a.evaluate("() => document.querySelector('#st-canvas').getContext('2d').getImageData(12,12,1,1).data.join(',')")
    assert not fundo_nivel2.replace(",", " ").startswith("138 206 0"), fundo_nivel2

    # 9b. Título longo com acentos: quebra de linha sem cortes e exportação íntegra.
    a.goto(f"{ORIGIN}/estudio?album={BRAT}&tema=album")
    a.wait_for_timeout(400)
    a.fill("#st-title", "Capturas del Único Camino — Uma Audição Muito Longa com Acentuação")
    a.wait_for_timeout(400)
    with a.expect_download() as long_download:
        a.click("#st-save")
    long_path = ROOT / "test-results" / "identidade-titulo-longo.png"
    long_download.value.save_as(str(long_path))
    assert png_size(long_path.read_bytes()) == (1080, 1350)

    # 10. Celular: estúdio e página do disco sem rolagem horizontal.
    m.goto(f"{ORIGIN}/estudio?album={BRAT}")
    expect(m.locator("#st-canvas")).to_be_visible()
    assert m.evaluate("document.documentElement.scrollWidth <= innerWidth")
    m.goto(f"{ORIGIN}/album/{SWEETENER}")
    expect(m.locator(".identity-band")).to_be_visible()
    assert m.evaluate("document.documentElement.scrollWidth <= innerWidth")

    for p in (a, m):
        p.close()
    desktop.close()
    mobile.close()
    if errors:
        print("ERROS DE CONSOLE/PÁGINA:")
        for e in errors:
            print(" -", e)
        return 1
    print("estúdio e identidades OK")
    return 0


if __name__ == "__main__":
    cache = Path.home() / "AppData" / "Local" / "ms-playwright"
    shell = next(cache.glob("chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"), None)
    launch = {"executable_path": str(shell)} if shell else {}
    with sync_playwright() as pw:
        sys.exit(run(pw.chromium.launch(**launch)))