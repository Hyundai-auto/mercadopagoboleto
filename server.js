const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuração de Ambiente
const IS_SANDBOX = process.env.APPMAX_ENV === 'sandbox';
const APPMAX_API_URL = IS_SANDBOX 
    ? 'https://api.sandboxappmax.com.br/v1' 
    : 'https://api.appmax.com.br/v1';
const APPMAX_API_KEY = process.env.APPMAX_API_KEY;

console.log(`[Appmax] Iniciando em modo: ${IS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO'}`);
console.log(`[Appmax] URL da API: ${APPMAX_API_URL}`);

/**
 * Função centralizada para requisições Appmax
 * Tenta múltiplos formatos de autenticação para garantir compatibilidade
 */
async function appmaxRequest(endpoint, data) {
    const url = `${APPMAX_API_URL}${endpoint}`;
    
    // Lista de estratégias de autenticação para tentar
    const strategies = [
        // Estratégia 1: access_token no corpo (Padrão v1)
        () => axios.post(url, { ...data, access_token: APPMAX_API_KEY }),
        // Estratégia 2: Bearer Token no Header (Padrão OAuth2)
        () => axios.post(url, data, { headers: { 'Authorization': `Bearer ${APPMAX_API_KEY}` } }),
        // Estratégia 3: client_key no corpo (Algumas rotas legadas)
        () => axios.post(url, { ...data, client_key: APPMAX_API_KEY })
    ];

    let lastError;
    for (let i = 0; i < strategies.length; i++) {
        try {
            const response = await strategies[i]();
            if (response.data && response.data.success) {
                return response.data;
            }
            // Se a API retornar success: false, consideramos erro
            lastError = new Error(response.data.message || 'Erro na resposta da Appmax');
            lastError.response = response;
        } catch (error) {
            lastError = error;
            // Se não for erro de autenticação (401), não adianta tentar outras estratégias
            if (!error.response || error.response.status !== 401) {
                break;
            }
            console.log(`[Appmax] Estratégia ${i + 1} falhou com 401, tentando próxima...`);
        }
    }
    throw lastError;
}

app.post('/api/pix', async (req, res) => {
    try {
        const { payer_name, payer_cpf, payer_phone, amount } = req.body;

        if (!payer_name || !payer_cpf || !amount) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }

        const firstName = payer_name.split(' ')[0];
        const lastName = payer_name.split(' ').slice(1).join(' ') || 'Sobrenome';
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        console.log(`[Appmax] Processando Pix: ${payer_name} (${payer_cpf})`);

        // 1. Criar/Atualizar Cliente
        const customerData = await appmaxRequest('/customers', {
            first_name: firstName,
            last_name: lastName,
            email: `cliente_${payer_cpf.replace(/\D/g, '')}@email.com`,
            phone: payer_phone.replace(/\D/g, ''),
            document_number: payer_cpf.replace(/\D/g, ''),
            ip: clientIp
        });

        const customerId = customerData.data.id;

        // 2. Criar Pedido
        const orderData = await appmaxRequest('/orders', {
            customer_id: customerId,
            products: [
                {
                    sku: 'PRODUTO_PIX',
                    name: 'Produto Checkout Pix',
                    quantity: 1,
                    unit_value: Math.round(parseFloat(amount) * 100)
                }
            ],
            total_value: Math.round(parseFloat(amount) * 100)
        });

        const orderId = orderData.data.id;

        // 3. Gerar Pix
        const paymentData = await appmaxRequest('/payments/pix', {
            order_id: orderId,
            payment_data: {
                pix: {
                    document_number: payer_cpf.replace(/\D/g, '')
                }
            }
        });

        console.log(`[Appmax] Pix gerado com sucesso para Pedido #${orderId}`);
        res.json({
            success: true,
            pixCode: paymentData.data.pix_code,
            qrCodeImage: paymentData.data.pix_qr_code
        });

    } catch (error) {
        const errorData = error.response ? error.response.data : { message: error.message };
        console.error('[Appmax] Erro Crítico:', JSON.stringify(errorData));
        
        let status = error.response ? error.response.status : 500;
        let message = 'Erro ao processar pagamento';

        if (status === 401) {
            message = 'Erro de Autenticação: A chave de API fornecida é inválida para o ambiente selecionado.';
        }

        res.status(status).json({ success: false, message, details: errorData });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
