#!/usr/bin/env python3
import sys
import json
import os
import traceback

# O Dockerfile já deve garantir que isso esteja instalado
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    # Se falhar, tentamos uma última vez com a flag correta (embora o ideal seja o Docker resolver)
    try:
        os.system("pip3 install playwright --break-system-packages")
        from playwright.sync_api import sync_playwright
    except:
        print(json.dumps({"success": False, "message": "Erro de dependência: Playwright não encontrado no ambiente Python."}))
        sys.exit(1)

def generate_pix(name, cpf):
    try:
        with sync_playwright() as p:
            # Lançar navegador com flags de segurança para Docker
            browser = p.chromium.launch(
                headless=True, 
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            )
            page = browser.new_page()
            
            # Acessar checkout
            page.goto("https://pay.meuservicomei.com.br/r/a51L1PhTl58c6S86", wait_until="networkidle", timeout=30000)
            
            # Preencher formulário (seletores mais genéricos para evitar quebras)
            page.wait_for_selector('input', timeout=10000)
            
            # Preencher campos
            inputs = page.query_selector_all('input')
            for i in inputs:
                placeholder = (i.get_attribute('placeholder') or "").lower()
                if 'nome' in placeholder:
                    i.fill(name)
                elif 'email' in placeholder:
                    i.fill("cliente@servico.com.br")
                elif 'cpf' in placeholder:
                    i.fill(cpf)
                elif any(x in placeholder for x in ['tel', 'celular', 'whatsapp', 'phone']):
                    i.fill("11999999999")
            
            # Tentar clicar no botão de pagar ou dar Enter
            page.keyboard.press("Enter")
            
            # Capturar PIX (procurando pelo padrão 000201)
            pix_code = None
            for _ in range(20): # Esperar até 20 segundos
                page.wait_for_timeout(1000)
                content = page.content()
                if "000201" in content:
                    import re
                    # Regex para capturar o código PIX completo
                    match = re.search(r'000201[a-zA-Z0-9.*$#% \-]+', content)
                    if match:
                        # Limpar o código de possíveis quebras de linha ou espaços extras
                        pix_code = match.group(0).strip().split()[0]
                        if len(pix_code) > 50: # Garantir que é um código longo o suficiente
                            break
            
            browser.close()
            
            if pix_code:
                return {"success": True, "pixCode": pix_code}
            else:
                return {"success": False, "message": "Código PIX não foi gerado ou não foi encontrado na página."}
                
    except Exception as e:
        return {"success": False, "message": f"Erro na automação: {str(e)}", "trace": traceback.format_exc()}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "message": "Nome e CPF são necessários."}))
        sys.exit(1)
        
    name = sys.argv[1]
    cpf = sys.argv[2]
    
    result = generate_pix(name, cpf)
    print(json.dumps(result))
