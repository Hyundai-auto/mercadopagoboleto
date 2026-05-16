import sys
import json
from playwright.sync_api import sync_playwright

def generate_pix(name, cpf):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        try:
            # Acessar a URL do checkout
            page.goto("https://pay.meuservicomei.com.br/r/a51L1PhTl58c6S86")
            page.wait_for_selector('input[placeholder="Digite seu nome completo"]')
            
            # Preencher os dados
            page.fill('input[placeholder="Digite seu nome completo"]', name)
            page.fill('input[placeholder="Digite seu email para receber a compra"]', "cliente@servico.com.br")
            page.fill('input[placeholder="Digite o número do seu CPF"]', cpf)
            page.fill('input[placeholder="(###) ###-####"]', "11999999999")
            
            # Clicar no botão de pagar
            page.click('#general-submit-button-container')
            
            # Aguardar o redirecionamento ou o código PIX aparecer
            # Geralmente o código PIX aparece em um elemento específico após o processamento
            # Vamos aguardar por um tempo ou por um seletor comum de PIX
            page.wait_for_timeout(5000) # Aguarda 5 segundos para processar
            
            # Tentar extrair o código PIX da página
            # Muitos checkouts usam o Appmax ou similar, vamos procurar por textos comuns
            content = page.content()
            
            # Lógica para extrair o código PIX (ajustar conforme o que aparece na tela)
            # Geralmente é um campo de input ou um texto longo começando com 000201
            pix_code = None
            
            # Tentar encontrar via seletor de input ou texto
            pix_elements = page.query_selector_all('input, textarea, span, p')
            for el in pix_elements:
                text = el.inner_text() or el.get_attribute('value') or ""
                if text.startswith('000201'):
                    pix_code = text
                    break
            
            if pix_code:
                return {"success": True, "pixCode": pix_code}
            else:
                # Se não achou, tirar um print para debug (em ambiente real) ou retornar erro
                return {"success": False, "message": "Código PIX não encontrado na página final."}
                
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            browser.close()

if __name__ == "__main__":
    name = sys.argv[1]
    cpf = sys.argv[2]
    result = generate_pix(name, cpf)
    print(json.dumps(result))
