"""Fluxos de continuidade em servidor isolado, sem contas ou gravações no banco do usuário."""
import base64, json, os, struct, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"test-results"
OUT.mkdir(exist_ok=True)
R="33333333-3333-4333-8333-333333333333"
V="55555555-5555-4555-8555-555555555555"
A="11111111-1111-4111-8111-111111111111"
server=subprocess.Popen(["node","tests/continuity-server.mjs"],cwd=ROOT,stdout=subprocess.PIPE,text=True)
try:
    origin=server.stdout.readline().strip()
    assert origin.startswith("http://127.0.0.1:"),origin
    with sync_playwright() as pw:
        shell=next((Path.home()/"AppData/Local/ms-playwright").glob("chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"),None)
        browser=pw.chromium.launch(**({"executable_path":str(shell)} if shell else {}))
        context=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,service_workers="block")
        context.add_init_script("""window.drawnText=[];const fill=CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.drawnText.push(String(text));return fill.call(this,text,...args);};""")
        context.route("https://upload.wikimedia.org/**",lambda route:route.abort())
        page=context.new_page()
        page.set_default_timeout(15000)
        errors=[]
        page.on("pageerror",lambda e: errors.append(str(e)))
        def data():
            return page.request.get(origin+"/api/bootstrap").json()
        def export_story(name):
            expect(page.locator("#ig-download")).to_be_enabled()
            assert page.locator("#st-canvas").evaluate("(c)=>[c.width,c.height]")==[1080,1920]
            preview=base64.b64decode(page.locator("#st-canvas").evaluate("(c)=>c.toDataURL('image/png').split(',')[1]"))
            with page.expect_download() as download:
                page.locator("#ig-download").click()
            path=OUT/(name+".png")
            download.value.save_as(str(path))
            png=path.read_bytes()
            assert struct.unpack(">II",png[16:24])==(1080,1920)
            assert png[:len(preview)-12]==preview[:-12],"Prévia diverge do PNG"
            texts=page.evaluate("window.drawnText")
            assert "capa." in texts,texts
            assert not any("ALBUM REVIEW" in t for t in texts),texts
            expected=page.locator("#st-canvas").get_attribute("aria-label").split(" · ")[1].replace(" de 5 estrelas","/5")
            if expected!="Sem nota": assert expected in texts,texts
            return png
        def save_review(path,rating,edit=False):
            page.goto(origin+path)
            page.get_by_role("button",name="Editar avaliação" if edit else "Registrar escuta",exact=True).click()
            dialog=page.get_by_role("dialog")
            dialog.get_by_label("Sua nota").select_option(rating)
            dialog.get_by_role("button",name="Salvar escuta").click()
            expect(dialog.get_by_role("heading",name="Avaliado!" if rating else "Escuta salva!")).to_be_visible()
            if rating: expect(dialog.get_by_role("img",name=rating.replace(".",",")+" de 5 estrelas")).to_be_visible()
            dialog.get_by_role("link",name="Compartilhar nos Stories").click()
            expect(page.locator("#ig-download")).to_be_enabled()

        registration=page.request.post(origin+"/api/auth/register",data={"username":"continuidade","email":"continuidade@example.test","name":"Continuidade","password":"teste-musical-12345"})
        assert registration.ok,registration.text()
        state=data()
        album=next(a for a in state["albums"] if a["id"]=="ancestral")
        for name,path,first,edited in [
            ("album","/album/ancestral","4.5","5"),
            ("faixa","/musica/ancestral/"+album["tracks"][0]["id"],"0.5","4.5")
        ]:
            before=len(data()["entries"])
            save_review(path,first)
            first_data=data()["entries"][0]
            assert first_data["rating"]==float(first)
            first_png=export_story("story_"+name)
            page.goto(origin+path)
            expect(page.locator(".estado-avaliado")).to_be_visible()
            page.reload()
            expect(page.locator(".estado-avaliado").get_by_role("img",name=first.replace(".",",")+" de 5 estrelas")).to_be_visible()
            save_review(path,edited,True)
            updated=next(e for e in data()["entries"] if e["id"]==first_data["id"])
            assert updated["rating"]==float(edited)
            assert len(data()["entries"])==before+1,"Edição duplicou registro"
            assert export_story("story_"+name+"_editado")!=first_png
            page.goto(origin+"/avaliacao/"+first_data["id"])
            page.get_by_role("button",name="Excluir",exact=True).click()
            page.get_by_role("dialog").get_by_role("button",name="Excluir",exact=True).click()
            page.wait_for_url(origin+"/diario")
            page.goto(origin+path)
            expect(page.get_by_role("button",name="Registrar escuta",exact=True)).to_be_visible()

        # Escuta sem nota e erro real de gravação mantêm o formulário coerente.
        save_review("/album/ancestral","")
        expect(page.locator("#st-canvas")).to_have_attribute("aria-label","Ancestral · Sem nota · Capa do lançamento")
        page.goto(origin+"/album/bona-fortuna")
        page.get_by_role("button",name="Registrar escuta",exact=True).click()
        page.get_by_role("dialog").get_by_label("Sua nota").select_option("4.5")
        page.route("**/api/entries",lambda route:route.fulfill(status=503,json={"error":"Falha de teste ao salvar"}))
        page.get_by_role("dialog").get_by_role("button",name="Salvar escuta").click()
        expect(page.get_by_role("alert")).to_have_text("Falha de teste ao salvar")
        expect(page.get_by_role("dialog").get_by_label("Sua nota")).to_have_value("4.5")
        page.unroute("**/api/entries")
        page.get_by_role("dialog").get_by_role("button",name="Fechar",exact=True).click()

        # Navegação remota, nomes homônimos, faixas e paginação em respostas controladas.
        page.goto(origin+"/explorar?q=teste&categoria=Discos")
        page.get_by_role("link",name="Próxima página").click()
        expect(page).to_have_url(origin+"/explorar?q=teste&categoria=Discos&page=2")
        page.locator(".album-card a.card-link").first.click()
        expect(page.get_by_role("heading",name="Edição de teste",exact=True)).to_be_visible()
        page.wait_for_url(origin+"/album/mb-"+R)
        page.get_by_role("button",name="Ver edições deste lançamento").click()
        expect(page.locator(".edition-row")).to_have_count(2)
        page.locator(".edition-row").nth(1).click()
        expect(page.get_by_role("heading",name="Edição de teste deluxe")).to_be_visible()
        page.goto(origin+"/explorar?q=teste&categoria=Faixas")
        page.locator(".track-list a").first.click()
        expect(page.get_by_role("heading",name="Canção de teste",exact=True)).to_be_visible()
        page.wait_for_url(origin+"/musica/mb-"+R+"/track-test")
        page.goto(origin+"/artista/mb-"+A)
        expect(page.get_by_role("heading",name="Primeira página")).to_be_visible()
        page.get_by_role("link",name="Próxima página").click()
        expect(page.get_by_role("heading",name="Segunda página")).to_be_visible()
        page.goto(origin+"/explorar?q=indisponivel")
        expect(page.locator("#page").get_by_role("status")).to_contain_text("fonte externa está indisponível")
        page.goto(origin+"/explorar")
        page.get_by_role("searchbox",name="Pesquisar no catálogo").fill("teste")
        expect(page.locator(".suggestion").first).to_be_visible()

        # Capa alternativa validada: arte muda; nota, obra e edição avaliadas permanecem.
        entry=page.request.post(origin+"/api/entries",data={"albumId":"mb-"+R,"rating":4.5}).json()["entry"]
        page.goto(origin+"/estudio?destino=instagram&entry="+entry["id"])
        first=export_story("story_edicao_padrao")
        page.get_by_role("button",name="Escolher capa de outra edição").click()
        page.locator("#ig-edition").select_option(V)
        expect(page.locator("#ig-download")).to_be_enabled()
        alternate=export_story("story_edicao_alternativa")
        assert alternate!=first
        unchanged=next(e for e in data()["entries"] if e["id"]==entry["id"])
        assert unchanged["albumId"]=="mb-"+R and unchanged["rating"]==4.5
        for width in [320,375,667,768,1024,1280,1440,1920]:
            page.set_viewport_size({"width":width,"height":900})
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"),width
            expect(page.locator("#ig-download")).to_be_visible()
        page.evaluate("window.scrollTo(0,0)")
        page.screenshot(path=str(OUT/"story_desktop.png"),full_page=True)
        page.set_viewport_size({"width":390,"height":844})
        page.evaluate("window.scrollTo(0,0)")
        page.screenshot(path=str(OUT/"story_mobile.png"),full_page=True)

        # Web Share: contrato simulado do sistema, sem abrir ou publicar no Instagram.
        page.evaluate("""() => {
          window.shareMode='ok';window.shareCalls=0;
          Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files[0]?.type==='image/png'});
          Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{
            window.shareCalls++;if(files.length!==1||files[0].size<1000)throw Error('PNG ausente');
            if(window.shareMode==='cancel')throw new DOMException('cancelado','AbortError');
            if(window.shareMode==='error')throw new DOMException('falha','NotAllowedError');
          }});
        }""")
        page.get_by_role("button",name="Preparar novamente").click()
        expect(page.locator("#ig-share")).to_be_enabled()
        assert page.evaluate("window.shareCalls")==0
        page.locator("#ig-share").click()
        expect(page.locator("#ig-status")).to_contain_text("aplicativo escolhido")
        page.evaluate("window.shareMode='cancel'")
        page.locator("#ig-share").click()
        expect(page.locator("#ig-status")).to_contain_text("cancelado")
        expect(page.locator("#ig-download")).to_be_enabled()
        page.evaluate("window.shareMode='error'")
        page.locator("#ig-share").click()
        expect(page.locator("#ig-status")).to_contain_text("indisponível")
        # Confirmação do servidor prevalece mesmo se a atualização geral falhar em seguida.
        page.goto(origin+"/album/capturas")
        page.get_by_role("button",name="Registrar escuta",exact=True).click()
        page.get_by_role("dialog").get_by_label("Sua nota").select_option("3.5")
        page.route("**/api/bootstrap",lambda route:route.fulfill(status=503,json={"error":"Falha de atualização"}))
        page.get_by_role("dialog").get_by_role("button",name="Salvar escuta").click()
        expect(page.get_by_role("heading",name="Avaliado!")).to_be_visible()
        page.unroute("**/api/bootstrap")
        assert len([e for e in data()["entries"] if e["albumId"]=="capturas"])==1

        # Diversidade de capas reais locais e título comprido (somente no servidor de teste).
        for slug in ["polygondwanaland","the-slip","bona-fortuna","reviver","the-sour-truth","capturas"]:
            item=next((a for a in data()["albums"] if a["id"]==slug),None)
            if not item: continue
            e=page.request.post(origin+"/api/entries",data={"albumId":slug,"rating":.5}).json()["entry"]
            page.goto(origin+"/estudio?destino=instagram&entry="+e["id"])
            export_story("story_visual_"+slug)
        e=page.request.post(origin+"/api/entries",data={"albumId":"titulo-longo","rating":5}).json()["entry"]
        page.goto(origin+"/estudio?destino=instagram&entry="+e["id"])
        export_story("story_titulo_longo")
        drawn=" ".join(page.evaluate("window.drawnText"))
        assert "Canções" in drawn and "terminou" in drawn
        # Resolução é medida na imagem real, não confiada ao catálogo.
        image_quality=page.evaluate("""async()=>{const {storyCover}=await import('/cover-art.js');
          const data=await storyCover({cover:'/assets/covers/ancestral.jpg',exportCover:true});
          const missing=await storyCover({cover:'',exportCover:true});
          return {width:data.image.width,height:data.image.height,message:data.message,missing:missing.image===null};
        }""")
        assert image_quality["width"]==500 and "menos nitidez" in image_quality["message"] and image_quality["missing"]
        # Ausência de permissão é explícita e mantém o download utilizável.
        e=page.request.post(origin+"/api/entries",data={"albumId":"mb-0aa87f3e-a91a-4355-ad9e-6d60be378841","rating":5}).json()["entry"]
        page.goto(origin+"/estudio?destino=instagram&entry="+e["id"])
        expect(page.locator("#ig-art-note")).to_contain_text("sem autorização de exportação")
        export_story("story_sem_permissao")
        # Petal usa exatamente o lançamento clean identificado no banco, sem pedir imagem não autorizada.
        petal="mb-29dcf4d0-196a-412d-8e0e-badd4cf478cb"
        forbidden=[]
        page.on("request",lambda r:forbidden.append(r.url) if "29dcf4d0-196a-412d-8e0e-badd4cf478cb/front" in r.url else None)
        e=page.request.post(origin+"/api/entries",data={"albumId":petal,"rating":4.5}).json()["entry"]
        page.goto(origin+"/estudio?destino=instagram&entry="+e["id"])
        expect(page.locator("#ig-download")).to_be_enabled()
        expect(page.locator("#ig-art-note")).to_contain_text("não há fundo desfocado")
        expect(page.locator("#st-canvas")).to_have_attribute("data-cover","editorial")
        petal_png=export_story("story_petal_diagnosticado")
        assert not forbidden,forbidden
        page.reload()
        assert export_story("story_petal_recompartilhado")==petal_png
        page.goto(origin+"/estudio?entry="+e["id"]+"&formato=stories")
        page.select_option("#st-format","stories")
        expect(page.locator("#st-save")).to_be_enabled()
        assert page.locator("#st-canvas").evaluate("(c)=>c.toDataURL()").split(",")[1]==base64.b64encode(petal_png).decode()

        # EP sem imagem: composição íntegra e limitação explícita.
        e=page.request.post(origin+"/api/entries",data={"albumId":"cru","rating":3}).json()["entry"]
        page.goto(origin+"/estudio?destino=instagram&entry="+e["id"])
        export_story("story_ep_sem_imagem")
        expect(page.locator("#st-canvas")).to_have_attribute("data-cover","editorial")

        # Falha de uma fonte não invalida outra fonte autorizada da MESMA edição.
        page.route("**/assets/covers/falha-teste.jpg",lambda route:route.fulfill(status=503,body="indisponivel"))
        recovery=page.evaluate("""async()=>{const {storyCover}=await import('/cover-art.js');const states=[];
          const album={id:'mesmo-album',cover:'/assets/covers/falha-teste.jpg',exportCover:true};
          const result=await storyCover(album,{report:(text,state)=>states.push(state),lookupSources:async()=>[
            {albumId:'outro-album',url:'/assets/covers/reviver.jpg',exportAllowed:true,derivativesAllowed:true,license:'CC BY-SA',evidence:'teste'},
            {albumId:'mesmo-album',url:'/assets/covers/ancestral.jpg',exportAllowed:true,derivativesAllowed:true,license:'CC BY-SA 3.0',evidence:'teste'}
          ]});
          return {source:result.origem,width:result.image.width,states,attempts:result.attempts,credit:result.creditAlbum.license};
        }""")
        assert recovery["source"]=="/assets/covers/ancestral.jpg" and recovery["width"]==500
        assert "buscando" in recovery["states"] and len(recovery["attempts"])==2
        assert recovery["credit"]=="CC BY-SA 3.0"
        assert not errors,errors
        print("OK: álbum e faixa, 4,5/0,5/5, persistência, edição sem duplicação, exclusão, escuta sem nota, erro ao salvar, PNG idêntico à prévia, edições, sugestões, paginação, fallback e 8 larguras.")
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
