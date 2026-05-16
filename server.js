const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const APPMAX_API_KEY = process.env.APPMAX_API_KEY;
const APPMAX_URL = 'https://api.appmax.com.br/v1';

// Endpoint para gerar o Pix
app.post('/api/pix', async (req, res) => {
    try {
        const { payer_name, payer_cpf, payer_phone, amount } = req.body;

        // 1. Criar ou Atualizar Cliente
        const customerResponse = await axios.post(`${APPMAX_URL}/customers`, {
            access_token: APPMAX_API_KEY,
            first_name: payer_name.split(' ')[0],
            last_name: payer_name.split(' ').slice(1).join(' ') || 'Silva',
            email: `cliente_${Date.now()}@email.com`, // Email genérico se não fornecido
            phone: payer_phone.replace(/\D/g, ''),
            document_number: payer_cpf.replace(/\D/g, '')
        });

        if (!customerResponse.data.success) {
            return res.status(400).json({ success: false, message: 'Erro ao criar cliente na Appmax' });
        }

        const customerId = customerResponse.data.data.id;

        // 2. Criar Pedido
        const orderResponse = await axios.post(`${APPMAX_URL}/orders`, {
            access_token: APPMAX_API_KEY,
            customer_id: customerId,
            products: [
                {
                    sku: 'PROD001',
                    name: 'Produto Checkout',
                    qty: 1,
                    unit_value: Math.round(parseFloat(amount) * 100) // Appmax usa centavos em alguns endpoints, mas v1/orders parece usar valor real ou centavos dependendo da config. Ajustando para centavos se necessário.
                }
            ],
            total_value: Math.round(parseFloat(amount) * 100)
        });

        if (!orderResponse.data.success) {
            return res.status(400).json({ success: false, message: 'Erro ao criar pedido na Appmax' });
        }

        const orderId = orderResponse.data.data.id;

        // 3. Efetuar Pagamento Pix
        const paymentResponse = await axios.post(`${APPMAX_URL}/payments/pix`, {
            access_token: APPMAX_API_KEY,
            order_id: orderId,
            payment_data: {
                pix: {
                    document_number: payer_cpf.replace(/\D/g, '')
                }
            }
        });

        if (paymentResponse.data.success) {
            res.json({
                success: true,
                pixCode: paymentResponse.data.data.pix_code_emv,
                qrCode: paymentResponse.data.data.pix_qrcode
            });
        } else {
            res.status(400).json({ success: false, message: 'Erro ao gerar Pix na Appmax' });
        }

    } catch (error) {
        console.error('Erro na integração Appmax:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
