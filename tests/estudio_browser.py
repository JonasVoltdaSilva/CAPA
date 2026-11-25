"""Valida o caminho do catálogo até os PNGs do Estúdio em um banco descartável."""
import os
import re
from pathlib import Path
import struct
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright
from social_browser import sign_up

ROOT = Path(__file__).resolve().parents[1]
DIMENSIONS = {"feed": (1080, 1350), "stories": (1080, 1920), "quadrado": (1080, 1080)}
WIDTHS = (320, 375, 667, 768, 1024, 1280, 1440, 1920)


def register_listen(page, rating, review, private=False):
    page.get_by_role("button", name="Registrar escuta", exact=True).click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("Sua nota").select_option(rating)
    dialog.locator("[name=review]").fill(review)
    if private:
        dialog.get_by_label("Visibilidade").select_option("private")
    dialog.get_by_role("button", name="Salvar escuta").click()
    expect(dialog.get_by_role("heading", name="Avaliado!")).to_be_visible()
    dialog.get_by_role("link", name="Outros formatos").click()
    expect(page.locator("#st-canvas")).to_be_visible()


def download_png(page, dimensions):
    save = page.get_by_role("button", name="Baixar PNG")
    expect(save).to_be_enabled()
    with page.expect_download() as result:
        save.click()
    png = Path(result.value.path()).read_bytes()
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    assert struct.unpack_from(">II", png, 16) == dimensions
    assert len(png) > 10000
    return png


def viewport_checks(page):
    for width in WIDTHS:
        page.set_viewport_size({"width": width, "height": 840})
        geometry = page.evaluate("""() => {
            const bounds = [...document.querySelectorAll(
                '.st-proof, #st-canvas, .st-panel, #st-model, #st-format, #st-save'
            )].map(el => el.getBoundingClientRect());
            return {
                fits: bounds.every(rect => rect.left >= -1 && rect.right <= innerWidth + 1),
                documentFits: document.documentElement.scrollWidth <= innerWidth,
                panelFits: bounds.slice(3).every(rect => rect.right <= bounds[2].right),
                ratio: bounds[1].width / bounds[1].height
            }
        }""")
        assert geometry["fits"] and geometry["documentFits"] and geometry["panelFits"], (width, geometry)
        assert abs(geometry["ratio"] - 0.8) < 0.015, (width, geometry)


def run(origin, browser):
    errors = []
    page = browser.new_page(viewport={"width": 1280, "height": 840}, service_workers="block")
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: errors.append((response.status, response.url))
            if response.url.startswith(origin + "/") and response.status >= 400 else None)

    sign_up(page, origin, "ensaio", "/diario")
    page.goto(origin + "/explorar?q=sertanilia")
    page.get_by_role("link", name="Ancestral", exact=False).first.click()
    expect(page.get_by_role("heading", name="Ancestral", exact=True)).to_be_visible()
    album_url = page.url
    track_url = page.locator(".track-row a").first.get_attribute("href")

    page.goto(origin + track_url)
    register_listen(page, "4.5", "Escuta de faixa privada para validar a retrospectiva.", private=True)
    expect(page.locator("#st-link")).to_be_hidden()
    expect(page.locator("#st-notice")).to_contain_text("privado")

    page.goto(album_url)
    register_listen(page, "5", "Arranjos que respiram. " * 20)
    entry_url = page.url
    expect(page.locator("#st-link")).to_be_visible()
    viewport_checks(page)
    page.set_viewport_size({"width": 375, "height": 812})

    exports = []
    for model in ("album", "editorial", "faixas", "top", "mensal", "anual"):
        page.select_option("#st-model", model)
        if model == "top":
            for album in ("ancestral", "polygondwanaland", "reviver"):
                page.select_option("#st-add", album)
        for fmt, dimensions in DIMENSIONS.items():
            page.select_option("#st-format", fmt)
            expect(page.locator("#st-dimensions")).to_have_text(f"1080 × {dimensions[1]} px")
            png = download_png(page, dimensions)
            if model in {"album", "faixas", "top"}:
                assert b"Attribution" in png, model
            exports.append(png)
    assert len(set(exports)) == 18

    page.goto(entry_url)
    page.select_option("#st-theme", "custom")
    page.get_by_role("button", name="Extrair da capa").click()
    expect(page.locator("#st-color")).not_to_have_value("#e9ae76")
    page.fill("#st-title", "Uma composição com palavras acentuadas e um título musical muito comprido")
    page.get_by_label("Estrelas", exact=True).uncheck()
    page.get_by_label("Crítica", exact=True).uncheck()
    page.get_by_label("Nome de usuário", exact=True).uncheck()
    page.select_option("#st-bg", "claro")
    download_png(page, DIMENSIONS["feed"])
    page.select_option("#st-theme", "capa")
    expect(page.locator("#st-save")).to_be_enabled()
    assert page.locator("#st-canvas").evaluate(
        "canvas => [...canvas.getContext('2d').getImageData(12,12,1,1).data].join(',')"
    ) == "25,28,24,255"

    catalog = page.request.get(origin + "/api/bootstrap").json()["albums"]
    release = next(album for album in catalog if album["id"] == "ancestral")
    works = [{"albumId": release["id"]}] + [
        {"albumId": release["id"], "trackId": track["id"]} for track in release["tracks"][:10]
    ]
    response = page.request.post(origin + "/api/lists", data={"title": "Seleção de teste", "items": works})
    assert response.ok, response.text()
    page.goto(origin + "/lista/" + response.json()["list"]["id"])
    page.get_by_role("link", name="Criar arte").click()
    expect(page.locator("#st-model")).to_have_value("lista")
    expect(page.locator("#st-link")).to_be_visible()
    expect(page.locator("#st-canvas")).to_have_attribute("aria-label", re.compile(r"1\. Ancestral"))
    first = download_png(page, DIMENSIONS["feed"])
    page.select_option("#st-list-page", "1")
    expect(page.locator("#st-canvas")).to_have_attribute("aria-label", re.compile(r"10\. "))
    assert first != download_png(page, DIMENSIONS["feed"])

    page.goto(origin + "/estudio?modelo=mensal&mes=1900-01")
    expect(page.locator("#st-notice")).to_contain_text("não tem escutas")
    expect(page.locator("#st-save")).to_be_disabled()
    assert not errors, errors
    page.close()
    print("OK: catálogo, registro de álbum e faixa, 8 larguras, 18 PNGs, personalização, lista paginada e diário vazio.")


def launch_options():
    chrome = Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe"
    return {"executable_path": str(chrome)} if chrome.is_file() else {}


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="capa-estudio-") as directory:
        env = dict(os.environ, DATA_DIR=directory, HOST="127.0.0.1", PORT="0")
        env.pop("APP_ORIGIN", None)
        server = subprocess.Popen(
            ["node", "src/server.mjs"], cwd=ROOT, env=env,
            stdout=subprocess.PIPE, encoding="utf-8",
        )
        try:
            origin = server.stdout.readline().strip().rsplit(" ", 1)[-1]
            if not origin.startswith("http://127.0.0.1:"):
                raise RuntimeError("O servidor de teste não iniciou.")
            with sync_playwright() as pw:
                browser = pw.chromium.launch(**launch_options())
                try:
                    run(origin, browser)
                finally:
                    browser.close()
        finally:
            server.terminate()
            server.wait(timeout=10)

