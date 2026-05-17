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
const APPMAX_API_KEY = (process.env.APPMAX_API_KEY || '').trim();

console.log(`[Appmax] Iniciando em modo: ${IS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO'}`);
console.log(`[Appmax] URL da API: ${APPMAX_API_URL}`);
console.log(`[Appmax] Chave configurada: ${APPMAX_API_KEY ? 'SIM (Tamanho: ' + APPMAX_API_KEY.length + ')' : 'NÃO'}`);

/**
 * Função centralizada para requisições Appmax
 */
async function appmaxRequest(endpoint, data) {
    const baseUrl = `${APPMAX_API_URL}${endpoint}`;
    
    // Lista de estratégias de autenticação
    const strategies = [
        {
            name: 'BODY (access_token)',
            fn: () => axios.post(baseUrl, { ...data, access_token: APPMAX_API_KEY })
        },
        {
            name: 'QUERY PARAM (?access_token=)',
            fn: () => axios.post(`${baseUrl}?access_token=${APPMAX_API_KEY}`, data)
        },
        {
            name: 'HEADER (Bearer Token)',
            fn: () => axios.post(baseUrl, data, { headers: { 'Authorization': `Bearer ${APPMAX_API_KEY}` } })
        },
        {
            name: 'BODY (client_key)',
            fn: () => axios.post(baseUrl, { ...data, client_key: APPMAX_API_KEY })
        }
    ];

    let lastError;
    for (const strategy of strategies) {
        try {
            console.log(`[Appmax] Tentando estratégia: ${strategy.name}...`);
            const response = await strategy.fn();
            
            if (response.data && (response.data.success || response.status === 200 || response.status === 201)) {
                console.log(`[Appmax] Sucesso com a estratégia: ${strategy.name}`);
                return response.data;
            }
            
            lastError = new Error(response.data.message || 'Erro na resposta da Appmax');
            lastError.response = response;
        } catch (error) {
            lastError = error;
            const status = error.response ? error.response.status : 'SEM STATUS';
            console.log(`[Appmax] Falha na estratégia ${strategy.name} (Status: ${status})`);
            
            // Se não for 401, o erro é outro (ex: dados inválidos), então paramos aqui
            if (status !== 401) {
                console.log(`[Appmax] Erro não é 401, interrompendo tentativas.`);
                break;
            }
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

        console.log(`[Appmax] Processando Pix para: ${payer_name}`);

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

        res.json({
            success: true,
            pixCode: paymentData.data.pix_code,
            qrCodeImage: paymentData.data.pix_qr_code
        });

    } catch (error) {
        const errorData = error.response ? error.response.data : { message: error.message };
        console.error('[Appmax] Erro Final:', JSON.stringify(errorData));
        
        res.status(error.response ? error.response.status : 500).json({ 
            success: false, 
            message: 'Erro na integração com Appmax. Verifique os logs do servidor.',
            details: errorData
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
