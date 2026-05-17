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

console.log(`[Appmax] Modo: ${IS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO'}`);
console.log(`[Appmax] URL: ${APPMAX_API_URL}`);

/**
 * Função centralizada para requisições Appmax com Headers de compatibilidade
 */
async function appmaxRequest(endpoint, data) {
    const baseUrl = `${APPMAX_API_URL}${endpoint}`;
    
    // Headers padrão para evitar 403 e garantir JSON
    const defaultHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Appmax-Checkout-Integration/1.0'
    };

    const strategies = [
        {
            name: 'BODY (access_token)',
            fn: () => axios.post(baseUrl, { ...data, access_token: APPMAX_API_KEY }, { headers: defaultHeaders })
        },
        {
            name: 'QUERY PARAM (?access_token=)',
            fn: () => axios.post(`${baseUrl}?access_token=${APPMAX_API_KEY}`, data, { headers: defaultHeaders })
        },
        {
            name: 'HEADER (Bearer Token)',
            fn: () => axios.post(baseUrl, data, { headers: { ...defaultHeaders, 'Authorization': `Bearer ${APPMAX_API_KEY}` } })
        }
    ];

    let lastError;
    for (const strategy of strategies) {
        try {
            console.log(`[Appmax] Tentando: ${strategy.name}...`);
            const response = await strategy.fn();
            
            if (response.data && response.data.success) {
                console.log(`[Appmax] Sucesso: ${strategy.name}`);
                return response.data;
            }
            
            lastError = new Error(response.data.message || 'Erro na resposta');
            lastError.response = response;
        } catch (error) {
            lastError = error;
            const status = error.response ? error.response.status : 'ERRO REDE';
            console.log(`[Appmax] Falha: ${strategy.name} (Status: ${status})`);
            
            // Se o erro for 400 (Bad Request), o problema são os dados, não a chave
            if (status === 400) {
                console.log(`[Appmax] Dados inválidos detectados. Detalhes:`, JSON.stringify(error.response.data));
                break;
            }
            
            // Se não for 401 ou 403, paramos
            if (status !== 401 && status !== 403) break;
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

        // 1. Criar Cliente (Mínimo de campos para teste)
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
            products: [{
                sku: 'PIX_PROD',
                name: 'Pagamento Pix',
                quantity: 1,
                unit_value: Math.round(parseFloat(amount) * 100)
            }],
            total_value: Math.round(parseFloat(amount) * 100)
        });

        const orderId = orderData.data.id;

        // 3. Gerar Pix
        const paymentData = await appmaxRequest('/payments/pix', {
            order_id: orderId,
            payment_data: {
                pix: { document_number: payer_cpf.replace(/\D/g, '') }
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
            message: 'Erro na integração. Verifique se sua chave de API está correta e ativa.',
            details: errorData
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
