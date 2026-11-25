"""Fluxo completo: avaliar -> confirmar -> compartilhar Stories -> exportar PNG."""
import struct, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ORIGIN = "http://127.0.0.1:3000"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"
OUT.mkdir(exist_ok=True)

cache = Path.home() / "AppData" / "Local" / "ms-playwright"
shell = next(cache.glob("chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"), None)
launch = {"executable_path": str(shell)} if shell else {}

errors = []

with sync_playwright() as pw:
    browser = pw.chromium.launch(**launch)
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block")
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # Fazer login/cadastro via API (mantém cookies)
    page.request.post(ORIGIN + "/api/auth/register", data={"username": "fluxo", "email": "fluxo@capa.local", "name": "Fluxo User", "password": "fluxosenha12345"})
    page.request.post(ORIGIN + "/api/auth/login", data={"identifier": "fluxo", "password": "fluxosenha12345"})

    # 1. Abrir álbum ainda não avaliado (Ancestral - capa local)
    page.goto(ORIGIN + "/album/ancestral")
    page.get_by_role("button", name="Registrar escuta").wait_for(state="visible", timeout=10000)

    # 2. Selecionar 4,5 estrelas
    page.get_by_role("button", name="Registrar escuta").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    dialog.get_by_label("Sua nota").select_option("4.5")
    dialog.get_by_label("Visibilidade").select_option("public")
    dialog.get_by_role("button", name="Salvar escuta").click()

    # 3. Confirmar que a avaliação foi persistida e oferta de compartilhar apareceu
    confirm = page.get_by_role("dialog")
    expect(confirm.get_by_text("Sua avaliação foi publicada!")).to_be_visible(timeout=10000)
    expect(confirm.get_by_text("4,5/5")).to_be_visible()
    expect(confirm.get_by_role("link", name="Compartilhar nos Stories")).to_be_visible()

    # 4. Abrir a pré-visualização do Story
    confirm.get_by_role("link", name="Compartilhar nos Stories").click()
    page.wait_for_timeout(1200)

    # 5. Confirmar canvas 1080x1920
    canvas = page.locator("#st-canvas")
    expect(canvas).to_be_visible()
    dims = page.evaluate("() => [document.querySelector('#st-canvas').width, document.querySelector('#st-canvas').height]")
    assert dims == [1080, 1920], f"Dimensões erradas: {dims}"

    # 6. Verificar elementos proibidos (não deve haver nota numérica nem crédito de capa)
    html = page.content()
    assert "Capa e fundo adaptado" not in html, "Crédito de capa não deve aparecer"
    assert "/ 5" not in html, "A nota deve usar o formato 4,5/5, sem espaços"

    # 7. Exportar PNG
    with page.expect_download() as dl:
        page.click("#ig-download")
    download = dl.value
    path = OUT / "story_fluxo.png"
    download.save_as(str(path))
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "Não é PNG válido"
    w, h = struct.unpack(">II", data[16:24])
    assert (w, h) == (1080, 1920), f"PNG {w}x{h}"
    print(f"PNG exportado: {w}x{h}, {len(data)} bytes")

    # 8. Screenshot para revisão visual
    page.screenshot(path=str(OUT / "revisao_story_fluxo.png"), full_page=True)

    # 9. Atualizar a página - avaliação deve permanecer
    page.goto(ORIGIN + "/album/ancestral")
    page.get_by_role("button", name="Registrar escuta").wait_for(state="hidden", timeout=10000)
    estado = page.locator(".estado-avaliado")
    expect(estado).to_be_visible()
    expect(estado.get_by_text("Avaliado")).to_be_visible()
    expect(estado.get_by_text("4,5/5")).to_be_visible()
    expect(estado.get_by_role("link", name="Compartilhar nos Stories")).to_be_visible()

    # 10. Compartilhar novamente
    estado.get_by_role("link", name="Compartilhar nos Stories").click()
    page.wait_for_timeout(1200)
    expect(page.locator("#st-canvas")).to_be_visible()

    if errors:
        print("ERROS:", errors[:6])
        sys.exit(1)
    print("FLUXO COMPLETO OK: avaliou 4,5 -> confirmou -> compartilhou -> exportou PNG 1080x1920 -> persistiu -> compartilhou novamente")
    browser.close()
