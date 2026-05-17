const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(bodyParser.json());

const CHECKOUT_URL = 'https://pay.meuservicomei.com.br/r/a51L1PhTl58c6S86';

// Rota inicial para evitar o erro "Cannot GET /"
app.get('/', (req, res) => {
    res.send('Servidor de Automação de Checkout está ATIVO! Use a rota POST /process-payment para enviar os dados.');
});

app.post('/process-payment', async (req, res) => {
    const { name, email, cpf, phone } = req.body;

    console.log(`Recebida requisição para: ${name}, CPF: ${cpf}`);

    if (!name || !cpf) {
        return res.status(400).json({ success: false, message: 'Nome e CPF são obrigatórios.' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        // Configurar timeout maior para conexões lentas
        page.setDefaultNavigationTimeout(60000);
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        console.log(`Navegando para: ${CHECKOUT_URL}`);
        await page.goto(CHECKOUT_URL, { waitUntil: 'networkidle2' });

        // Tentar pular telas de "lembrar dados" se existirem
        try {
            const buttons = await page.$$('button, a');
            for (const btn of buttons) {
                const text = await page.evaluate(el => el.innerText, btn);
                if (text.toLowerCase().includes('preencher meus dados') || text.toLowerCase().includes('continuar')) {
                    await btn.click();
                    await new Promise(r => setTimeout(r, 1500));
                    break;
                }
            }
        } catch (e) {
            console.log("Nenhuma tela de interrupção encontrada.");
        }

        // Seletores baseados na estrutura comum
        const selectors = {
            name: 'input[placeholder*="Nome"], input[name*="name"], input[id*="name"]',
            email: 'input[placeholder*="mail"], input[name*="email"], input[id*="email"]',
            cpf: 'input[placeholder*="CPF"], input[name*="cpf"], input[id*="cpf"]',
            phone: 'input[placeholder*="Celular"], input[placeholder*="Whatsapp"], input[name*="phone"]'
        };

        // Preenchimento com espera
        await page.waitForSelector(selectors.name, { timeout: 10000 });
        await page.type(selectors.name, name, { delay: 30 });
        
        if (email) {
            await page.type(selectors.email, email, { delay: 30 });
        }
        
        await page.type(selectors.cpf, cpf, { delay: 30 });
        
        if (phone) {
            await page.type(selectors.phone, phone, { delay: 30 });
        }

        console.log("Campos preenchidos. Clicando em PAGAR...");

        // Clicar no botão de pagar
        const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const payBtn = buttons.find(btn => btn.innerText.toUpperCase().includes('PAGAR'));
            if (payBtn) {
                payBtn.click();
                return true;
            }
            return false;
        });

        if (!clicked) throw new Error("Botão PAGAR não encontrado na página.");

        console.log("Aguardando redirecionamento para o PIX...");
        
        // Esperar a URL mudar para algo que contenha pix ou sucesso, ou apenas esperar a navegação
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 });
        
        const pixUrl = page.url();
        console.log(`Sucesso! URL capturada: ${pixUrl}`);

        await browser.close();
        res.json({ success: true, pixUrl: pixUrl });

    } catch (error) {
        console.error('Erro na automação:', error.message);
        if (browser) await browser.close();
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao processar pagamento.', 
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
