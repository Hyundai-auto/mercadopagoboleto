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

const APPMAX_API_URL = 'https://api.appmax.com.br/v1';
const APPMAX_API_KEY = process.env.APPMAX_API_KEY;

// Função auxiliar para fazer requisições à Appmax tentando diferentes métodos de autenticação
async function appmaxRequest(endpoint, data) {
    const url = `${APPMAX_API_URL}${endpoint}`;
    
    // Tentativa 1: access_token no corpo (Padrão documentado para v1)
    try {
        const response = await axios.post(url, {
            ...data,
            access_token: APPMAX_API_KEY
        });
        return response.data;
    } catch (error) {
        // Se falhar com 401, tentamos o método Bearer Token
        if (error.response && error.response.status === 401) {
            try {
                const response = await axios.post(url, data, {
                    headers: { 'Authorization': `Bearer ${APPMAX_API_KEY}` }
                });
                return response.data;
            } catch (innerError) {
                // Se ambos falharem, lançamos o erro original
                throw error;
            }
        }
        throw error;
    }
}

// Endpoint para gerar o Pix
app.post('/api/pix', async (req, res) => {
    try {
        const { payer_name, payer_cpf, payer_phone, amount } = req.body;

        if (!payer_name || !payer_cpf || !amount) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }

        const firstName = payer_name.split(' ')[0];
        const lastName = payer_name.split(' ').slice(1).join(' ') || 'Sobrenome';
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        console.log(`Iniciando processamento Pix para: ${payer_name} - CPF: ${payer_cpf}`);

        // 1. Criar ou atualizar o cliente
        const customerData = await appmaxRequest('/customers', {
            first_name: firstName,
            last_name: lastName,
            email: `cliente_${payer_cpf.replace(/\D/g, '')}@email.com`,
            phone: payer_phone.replace(/\D/g, ''),
            document_number: payer_cpf.replace(/\D/g, ''),
            ip: clientIp
        });

        if (!customerData.success) {
            throw new Error(customerData.message || 'Erro ao criar cliente na Appmax');
        }

        const customerId = customerData.data.id;

        // 2. Criar o pedido
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

        if (!orderData.success) {
            throw new Error(orderData.message || 'Erro ao criar pedido na Appmax');
        }

        const orderId = orderData.data.id;

        // 3. Efetuar pagamento via Pix
        const paymentData = await appmaxRequest('/payments/pix', {
            order_id: orderId,
            payment_data: {
                pix: {
                    document_number: payer_cpf.replace(/\D/g, '')
                }
            }
        });

        if (paymentData.success) {
            console.log('Pix gerado com sucesso!');
            res.json({
                success: true,
                pixCode: paymentData.data.pix_code,
                qrCodeImage: paymentData.data.pix_qr_code
            });
        } else {
            throw new Error(paymentData.message || 'Erro ao processar pagamento Pix');
        }

    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error('Erro na integração Appmax:', JSON.stringify(errorData));
        
        let userMessage = 'Erro ao processar com Appmax';
        if (error.response && error.response.status === 401) {
            userMessage = 'Erro de Autenticação: Sua chave de API (access_token) parece ser inválida ou não tem permissão para esta operação.';
        }

        res.status(error.response ? error.response.status : 500).json({ 
            success: false, 
            message: userMessage,
            details: errorData
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
