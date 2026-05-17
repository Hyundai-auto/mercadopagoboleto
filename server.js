const express = require('express');
const axios = require('axios');
const cors = require('cors');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json());
app.use(cors());

const PRODUCT_ID = '3198741739882';
const STORE_ID = '31987';

app.post('/generate-pix', async (req, res) => {
    const { name, email, document, phone } = req.body;

    if (!name || !email || !document || !phone) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    console.log(`Iniciando geração de PIX para: ${email}`);

    let browser;
    try {
        // No Render, o Puppeteer precisa de configurações específicas
        // Aqui usamos o puppeteer-core para ser mais leve
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        });

        const page = await browser.newPage();
        
        // 1. Acessar a URL de checkout inicial com os dados
        const checkoutUrl = `https://seguro.meuservicomei.com.br/api/public/shopify?product=${PRODUCT_ID}&store=${STORE_ID}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&document=${document}&phone=${phone}`;
        
        await page.goto(checkoutUrl, { waitUntil: 'networkidle2' });
        console.log('Página de checkout carregada');

        // 2. Clicar em "Ir Para Pagamento" (Etapa 1)
        // Esperamos o botão aparecer e clicamos
        await page.waitForSelector('#next-button-dados-pessoais', { timeout: 10000 });
        await page.click('#next-button-dados-pessoais');
        console.log('Clique em Ir Para Pagamento realizado');

        // 3. Selecionar PIX e Finalizar (Etapa 2)
        // A plataforma geralmente seleciona PIX por padrão se enviado na URL, 
        // mas vamos garantir e clicar no botão de finalizar.
        // O botão de finalizar costuma ter um texto como "Finalizar Compra" ou similar.
        
        // Esperar um pouco para a transição de etapa
        await new Promise(r => setTimeout(r, 1500));

        // Tentar encontrar o botão de finalizar compra
        const finalizeButtonSelector = 'button.bg-primary, button.w-full.py-4'; // Seletores comuns na plataforma
        await page.waitForSelector(finalizeButtonSelector, { timeout: 10000 });
        
        // Clicar no botão que contém o texto de finalizar
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const finalBtn = btns.find(b => b.innerText.toLowerCase().includes('finalizar') || b.innerText.toLowerCase().includes('pagar'));
            if (finalBtn) finalBtn.click();
        });
        console.log('Clique em Finalizar Compra realizado');

        // 4. Capturar o código PIX na tela final
        // Esperamos o elemento que contém o código PIX aparecer
        await page.waitForSelector('textarea, .pix-code, [readonly]', { timeout: 20000 });
        
        const pixData = await page.evaluate(() => {
            // Tenta pegar de um textarea (comum para copia e cola)
            const textarea = document.querySelector('textarea');
            if (textarea && textarea.value.length > 50) return { code: textarea.value };
            
            // Tenta pegar de elementos de texto
            const allElements = Array.from(document.querySelectorAll('*'));
            const pixElement = allElements.find(el => el.innerText.length > 100 && el.innerText.startsWith('000201'));
            if (pixElement) return { code: pixElement.innerText.trim() };

            return null;
        });

        if (pixData && pixData.code) {
            console.log('PIX capturado com sucesso');
            res.json({ success: true, pix_code: pixData.code });
        } else {
            throw new Error('Não foi possível localizar o código PIX na página final');
        }

    } catch (error) {
        console.error('Erro na automação:', error.message);
        res.status(500).json({ error: 'Falha ao gerar PIX', details: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
