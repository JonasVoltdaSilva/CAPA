"""Exercise social screens with two Chromium contexts and a disposable SQLite database.

Run from any directory using a Python environment with Playwright and its Chromium browser.
"""
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PASSWORD = "som-de-teste-12345"


def sign_up(page, origin, username, back="/meu-perfil"):
    page.goto(f"{origin}/cadastro?voltar={back}")
    form = page.locator("form[data-sc-form='register']")
    form.get_by_label("Seu nome").fill(username.capitalize())
    form.get_by_label("Nome de usuário").fill(username)
    form.get_by_label("E-mail").fill(username + "@example.com")
    form.get_by_label("Senha").fill(PASSWORD)
    form.get_by_role("button", name="Criar conta").click()
    page.wait_for_url(origin + back)


def data(page):
    response = page.request.get(page.url.split("/", 3)[0] + "//" + urlparse(page.url).netloc + "/api/bootstrap")
    assert response.ok, response.status
    return response.json()


def no_horizontal_scroll(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), page.url


def run(origin, browser):
    desktop = browser.new_context(viewport={"width": 1280, "height": 820}, service_workers="block")
    mobile = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True,
                                 has_touch=True, service_workers="block")
    a = desktop.new_page()
    b = mobile.new_page()
    errors = []
    for p in (a, b):
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.on("console", lambda msg: errors.append(msg.text) if msg.type == "error"
             and "Failed to load resource" not in msg.text else None)
        p.set_default_timeout(9000)
    try:
        sign_up(a, origin, "vinil", "/diario")
        expect(a.get_by_role("heading", name="Diário musical")).to_be_visible()
        sign_up(b, origin, "agulha", "/meu-perfil")
        expect(b.get_by_role("heading", name="Agulha", exact=True)).to_be_visible()
        no_horizontal_scroll(b)

        a.get_by_role("button", name="Registrar escuta", exact=True).click()
        dialog = a.get_by_role("dialog")
        dialog.get_by_label("Sua nota").select_option("4.5")
        dialog.locator("[name='review']").fill("A dinâmica do arranjo marcou esta escuta.")
        dialog.get_by_role("button", name="Salvar escuta").click()
        a.get_by_role("link", name="Ver diário").click()
        a.get_by_role("link", name="Ver registro").click()
        entry_url = a.url
        expect(a.get_by_text("A dinâmica do arranjo marcou esta escuta.")).to_be_visible()
        a.get_by_role("button", name="Editar", exact=True).click()
        dialog.get_by_label("Sua nota").select_option("5")
        dialog.get_by_role("button", name="Salvar escuta").click()
        a.get_by_role("link", name="Ver diário").click()
        assert data(a)["entries"][0]["rating"] == 5
        a.locator(".sc-filters summary").click()
        a.get_by_label("Nota", exact=True).select_option("1")
        a.get_by_role("button", name="Aplicar").click()
        expect(a.get_by_text("Nenhuma escuta com esses filtros")).to_be_visible()
        a.get_by_role("link", name="Limpar filtros").click()

        a.goto(origin + "/configuracoes")
        a.get_by_label("Biografia").fill("Diário de discos brasileiros.")
        a.get_by_label("Disco 1", exact=True).select_option(index=1)
        a.get_by_label("Artista 1", exact=True).select_option(index=1)
        a.get_by_role("button", name="Salvar perfil").click()
        expect(a.get_by_text("Diário de discos brasileiros.")).to_be_visible()
        expect(a.get_by_role("heading", name="Discos favoritos")).to_be_visible()
        assert len(data(a)["user"]["favoriteAlbums"]) == 1

        a.goto(origin + "/listas?nova=1")
        a.get_by_label("Título", exact=True).fill("Discos de domingo")
        a.get_by_label("Disco", exact=True).select_option(index=1)
        a.get_by_role("button", name="Adicionar à lista").click()
        a.get_by_label("Faixa", exact=True).select_option(index=1)
        a.get_by_role("button", name="Adicionar à lista").click()
        a.get_by_role("button", name="Salvar lista").click()
        a.wait_for_url("**/lista/*")
        list_url = a.url
        assert len(data(a)["lists"][0]["items"]) == 2
        a.get_by_role("link", name="Editar lista").click()
        a.get_by_role("button", name="Subir", exact=False).last.click()
        a.get_by_role("button", name="Salvar lista").click()
        a.wait_for_url(list_url)
        assert data(a)["lists"][0]["items"][0]["trackId"]

        b.goto(origin + "/perfil/vinil")
        b.get_by_role("button", name="Seguir", exact=True).click()
        expect(b.get_by_role("button", name="Deixar de seguir")).to_be_visible()
        b.goto(origin + "/comunidade?aba=seguindo")
        expect(b.get_by_role("link", name="Ver registro")).to_be_visible()
        expect(b.get_by_text("Discos de domingo")).to_be_visible()
        b.goto(entry_url)
        b.get_by_role("button", name="Curtir", exact=False).click()
        expect(b.get_by_role("button", name="Curtido · 1")).to_be_visible()
        b.get_by_label("Seu comentário").fill("Também gostei deste disco.")
        b.get_by_role("button", name="Comentar", exact=True).click()
        expect(b.get_by_text("Também gostei deste disco.")).to_be_visible()
        b.get_by_role("button", name="Denunciar", exact=True).first.click()
        b.get_by_role("dialog").get_by_label("Motivo").fill("Exemplo de denúncia para teste isolado.")
        b.get_by_role("dialog").get_by_role("button", name="Enviar denúncia").click()
        expect(b.locator("#toast")).to_have_text("Denúncia recebida.")
        no_horizontal_scroll(b)
        b.goto(origin + "/perfil/vinil")
        b.get_by_role("button", name="Bloquear", exact=True).click()
        b.get_by_role("dialog").get_by_role("button", name="Bloquear").click()
        b.wait_for_url("**/comunidade?aba=pessoas")
        expect(b.get_by_text("Nenhum ouvinte encontrado.")).to_be_visible()
        assert data(b)["entries"] == []
        b.goto(origin + "/configuracoes")
        b.get_by_role("button", name="Desbloquear").click()
        expect(b.get_by_role("button", name="Desbloquear")).to_have_count(0)

        a.goto(origin + "/rankings")
        expect(a.locator(".sc-ranking-note")).to_have_text("★ 51 voto")
        a.goto(origin + "/estatisticas")
        expect(a.locator(".sc-metrics")).to_contain_text("1escutas")
        a.goto(origin + "/batalha")
        a.locator(".sc-contender button").first.click()
        expect(a.get_by_role("heading", name="Suas escolhas")).to_be_visible()
        assert len(data(a)["battles"]) == 1
        a.goto(origin + "/configuracoes")
        a.get_by_role("button", name="Sair da conta").click()
        a.wait_for_url(origin + "/")
        a.goto(origin + "/entrar?voltar=/diario")
        a.get_by_label("E-mail").fill("vinil@example.com")
        a.get_by_label("Senha", exact=True).fill(PASSWORD)
        a.locator("form").get_by_role("button", name="Entrar").click()
        a.wait_for_url(origin + "/diario")
        assert len(data(a)["entries"]) == 1
        a.goto(entry_url)
        a.get_by_role("button", name="Excluir", exact=True).click()
        a.get_by_role("dialog").get_by_role("button", name="Excluir", exact=True).click()
        a.wait_for_url(origin + "/diario")
        assert data(a)["entries"] == []
        a.goto(list_url)
        a.get_by_role("button", name="Excluir lista").click()
        a.get_by_role("dialog").get_by_role("button", name="Excluir", exact=True).click()
        a.wait_for_url("**/listas?aba=minhas")
        assert data(a)["lists"] == []
        b.goto(origin + "/configuracoes")
        b.get_by_text("Excluir conta e dados", exact=True).click()
        b.get_by_label("Confirme sua senha").fill(PASSWORD)
        b.get_by_role("button", name="Excluir minha conta").click()
        b.get_by_role("dialog").get_by_role("button", name="Excluir definitivamente").click()
        b.wait_for_url(origin + "/")
        assert data(b)["user"] is None
        assert not errors, errors
    finally:
        desktop.close()
        mobile.close()


if __name__ == "__main__":
    # Listen on an OS-assigned loopback port and keep every write in a fresh temporary folder.
    with tempfile.TemporaryDirectory(prefix="capa-social-") as temp:
        env = dict(os.environ, DATA_DIR=temp, PORT="0", HOST="127.0.0.1")
        env.pop("APP_ORIGIN", None)
        server = subprocess.Popen(["node", "src/server.mjs"], cwd=ROOT, env=env, stdout=subprocess.PIPE, text=True)
        try:
            url = server.stdout.readline().strip().rsplit(" ", 1)[-1]
            if not url.startswith("http://127.0.0.1:"):
                raise RuntimeError("O servidor de teste não iniciou.")
            with sync_playwright() as playwright:
                launch = dict(channel=os.environ.get("PLAYWRIGHT_CHANNEL"))
                shell = next(Path.home().joinpath("AppData", "Local", "ms-playwright").glob(
                    "chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"), None)
                if shell:
                    launch["executable_path"] = str(shell)
                browser = playwright.chromium.launch(**launch)
                try:
                    run(url, browser)
                finally:
                    browser.close()
            print("OK: conta, perfil, diário, listas, comunidade, moderação, rankings, estatísticas e batalha.")
        finally:
            server.terminate()
            server.wait(timeout=10)
