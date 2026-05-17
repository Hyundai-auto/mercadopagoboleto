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

app.post('/process-payment', async (req, res) => {
    const { name, email, cpf, phone } = req.body;

    if (!name || !cpf) {
        return res.status(400).json({ success: false, message: 'Nome e CPF são obrigatórios.' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        console.log(`Navegando para: ${CHECKOUT_URL}`);
        await page.goto(CHECKOUT_URL, { waitUntil: 'networkidle2' });

        // Esperar o botão "Prefiro preencher meus dados" se ele aparecer (comum em checkouts que lembram dados)
        try {
            const fillManualBtn = await page.waitForSelector('button, a', { timeout: 5000 });
            const text = await page.evaluate(el => el.innerText, fillManualBtn);
            if (text.includes('preencher meus dados')) {
                await fillManualBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {
            console.log("Botão de preenchimento manual não encontrado ou não necessário.");
        }

        // Preencher os campos
        // Nota: Os seletores abaixo são baseados na estrutura comum desses checkouts. 
        // Se falhar, precisaremos ajustar.
        
        const selectors = {
            name: 'input[placeholder*="Nome"], input[name*="name"]',
            email: 'input[placeholder*="mail"], input[name*="email"]',
            cpf: 'input[placeholder*="CPF"], input[name*="cpf"]',
            phone: 'input[placeholder*="Celular"], input[placeholder*="Whatsapp"], input[name*="phone"]',
            payBtn: 'button:not([disabled])' // O botão de pagar
        };

        await page.waitForSelector(selectors.name);
        await page.type(selectors.name, name, { delay: 50 });
        
        if (email) {
            await page.type(selectors.email, email, { delay: 50 });
        }
        
        await page.type(selectors.cpf, cpf, { delay: 50 });
        
        if (phone) {
            await page.type(selectors.phone, phone, { delay: 50 });
        }

        console.log("Campos preenchidos. Clicando em Pagar...");

        // Clicar no botão de pagar
        // Procurar especificamente pelo botão que contém "PAGAR"
        const payButton = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => btn.innerText.includes('PAGAR'));
        });

        if (payButton) {
            await payButton.click();
        } else {
            throw new Error("Botão PAGAR não encontrado");
        }

        // Esperar a navegação ou a mudança de URL para a tela do PIX
        console.log("Aguardando redirecionamento para a tela do PIX...");
        
        // Esperar até que a URL mude ou um elemento da tela de PIX apareça
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        
        const pixUrl = page.url();
        console.log(`URL do PIX capturada: ${pixUrl}`);

        await browser.close();
        res.json({ success: true, pixUrl: pixUrl });

    } catch (error) {
        console.error('Erro na automação:', error);
        if (browser) await browser.close();
        res.status(500).json({ success: false, message: 'Erro ao processar o pagamento.', error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
