#!/usr/bin/env python3
import sys
import json
import os

# Forçar a instalação/verificação do módulo caso necessário (último recurso)
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    # Se falhar, tenta instalar em tempo de execução para o usuário atual
    os.system("pip3 install playwright")
    from playwright.sync_api import sync_playwright

def generate_pix(name, cpf):
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True, 
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        )
        page = browser.new_page()
        
        try:
            # Acessar checkout
            page.goto("https://pay.meuservicomei.com.br/r/a51L1PhTl58c6S86", wait_until="networkidle")
            
            # Preencher formulário
            page.fill('input[placeholder*="nome"]', name)
            page.fill('input[placeholder*="email"]', "cliente@servico.com.br")
            page.fill('input[placeholder*="CPF"]', cpf)
            
            # Telefone
            phone = page.query_selector('input[type="tel"]')
            if phone: phone.fill("11999999999")
            
            # Pagar
            page.keyboard.press("Enter")
            
            # Capturar PIX
            pix_code = None
            for _ in range(15):
                page.wait_for_timeout(1000)
                # Busca por qualquer texto que pareça um código PIX
                content = page.content()
                if "000201" in content:
                    # Tenta extrair o código exato
                    import re
                    match = re.search(r'000201[a-zA-Z0-9.*$#% \-]+', content)
                    if match:
                        pix_code = match.group(0).split(' ')[0].split('\n')[0]
                        break
            
            if pix_code:
                return {"success": True, "pixCode": pix_code}
            else:
                return {"success": False, "message": "PIX não gerado a tempo."}
                
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            browser.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "message": "Faltam dados"}))
    else:
        print(json.dumps(generate_pix(sys.argv[1], sys.argv[2])))
