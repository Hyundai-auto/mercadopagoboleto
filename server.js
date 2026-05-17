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

// Endpoint para gerar o Pix
app.post('/api/pix', async (req, res) => {
    try {
        const { payer_name, payer_cpf, payer_phone, amount } = req.body;

        if (!payer_name || !payer_cpf || !amount) {
            return res.status(400).json({ success: false, message: 'Dados incompletos' });
        }

        // 1. Criar ou atualizar o cliente
        const customerResponse = await axios.post(`${APPMAX_API_URL}/customers`, {
            access_token: APPMAX_API_KEY,
            first_name: payer_name.split(' ')[0],
            last_name: payer_name.split(' ').slice(1).join(' ') || 'Sobrenome',
            email: `cliente_${payer_cpf}@email.com`, // Email fictício baseado no CPF se não fornecido
            phone: payer_phone,
            document_number: payer_cpf
        });

        if (!customerResponse.data.success) {
            throw new Error('Erro ao criar cliente na Appmax');
        }

        const customerId = customerResponse.data.data.id;

        // 2. Criar o pedido
        const orderResponse = await axios.post(`${APPMAX_API_URL}/orders`, {
            access_token: APPMAX_API_KEY,
            customer_id: customerId,
            products: [
                {
                    sku: 'PRODUTO_PIX',
                    name: 'Produto Checkout Pix',
                    quantity: 1,
                    unit_value: Math.round(parseFloat(amount) * 100) // Appmax usa centavos
                }
            ],
            total_value: Math.round(parseFloat(amount) * 100)
        });

        if (!orderResponse.data.success) {
            throw new Error('Erro ao criar pedido na Appmax');
        }

        const orderId = orderResponse.data.data.id;

        // 3. Efetuar pagamento via Pix
        const paymentResponse = await axios.post(`${APPMAX_API_URL}/payments/pix`, {
            access_token: APPMAX_API_KEY,
            order_id: orderId,
            payment_data: {
                pix: {
                    document_number: payer_cpf
                }
            }
        });

        if (paymentResponse.data.success) {
            res.json({
                success: true,
                pixCode: paymentResponse.data.data.pix_code,
                qrCodeImage: paymentResponse.data.data.pix_qr_code
            });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao processar pagamento Pix' });
        }

    } catch (error) {
        console.error('Erro na integração Appmax:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno no servidor',
            details: error.response ? error.response.data : error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
