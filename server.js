import express from 'express';
import axios from 'axios';
import cors from 'cors';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

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
        const options = {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            headless: "new",
        };

        // Detecção inteligente do executável do Chrome no Render
        const chromePaths = [
            process.env.PUPPETEER_EXECUTABLE_PATH,
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/opt/google/chrome/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
        ];

        let foundPath = null;
        for (const p of chromePaths) {
            if (p && fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (foundPath) {
            console.log(`Usando Chrome em: ${foundPath}`);
            options.executablePath = foundPath;
        } else {
            console.log('Aviso: Nenhum caminho de Chrome fixo encontrado. Tentando lançamento padrão.');
        }

        browser = await puppeteer.launch(options);
        const page = await browser.newPage();
        
        const checkoutUrl = `https://seguro.meuservicomei.com.br/api/public/shopify?product=${PRODUCT_ID}&store=${STORE_ID}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&document=${document}&phone=${phone}`;
        
        await page.goto(checkoutUrl, { waitUntil: 'networkidle2' });
        console.log('Página de checkout carregada');

        await page.waitForSelector('#next-button-dados-pessoais', { timeout: 10000 });
        await page.click('#next-button-dados-pessoais');
        console.log('Clique em Ir Para Pagamento realizado');

        await new Promise(r => setTimeout(r, 1500));

        const finalizeButtonSelector = 'button.bg-primary, button.w-full.py-4';
        await page.waitForSelector(finalizeButtonSelector, { timeout: 10000 });
        
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const finalBtn = btns.find(b => b.innerText.toLowerCase().includes('finalizar') || b.innerText.toLowerCase().includes('pagar'));
            if (finalBtn) finalBtn.click();
        });
        console.log('Clique em Finalizar Compra realizado');

        await page.waitForSelector('textarea, .pix-code, [readonly]', { timeout: 20000 });
        
        const pixData = await page.evaluate(() => {
            const textarea = document.querySelector('textarea');
            if (textarea && textarea.value.length > 50) return { code: textarea.value };
            
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
