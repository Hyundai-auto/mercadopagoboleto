const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const APPMAX_API_KEY = process.env.APPMAX_API_KEY;
const APPMAX_BASE_URL = 'https://api.appmax.com.br/v1';

// Rota para criar cliente e pedido (Fluxo Simplificado)
app.post('/api/checkout', async (req, res) => {
    try {
        const { customer, payment_method, card_data, amount, products } = req.body;

        // 1. Criar/Atualizar Cliente
        const customerResponse = await axios.post(`${APPMAX_BASE_URL}/customers`, {
            access_token: APPMAX_API_KEY,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            document_number: customer.cpf,
            ip: req.ip || '127.0.0.1'
        });

        const customer_id = customerResponse.data.data.id;

        // 2. Criar Pedido
        const orderResponse = await axios.post(`${APPMAX_BASE_URL}/orders`, {
            access_token: APPMAX_API_KEY,
            customer_id: customer_id,
            products: products || [{
                sku: "9000010",
                name: "Produto Digital",
                quantity: 1,
                unit_value: Math.round(amount * 100) // Appmax usa centavos
            }],
            total_value: Math.round(amount * 100)
        });

        const order_id = orderResponse.data.data.id;

        // 3. Efetuar Pagamento
        let paymentResponse;
        if (payment_method === 'pix') {
            paymentResponse = await axios.post(`${APPMAX_BASE_URL}/payments/pix`, {
                access_token: APPMAX_API_KEY,
                order_id: order_id
            });
            
            return res.json({
                success: true,
                payment_type: 'pix',
                pix_code: paymentResponse.data.data.pix_code,
                pix_qr_code: paymentResponse.data.data.pix_qr_code
            });
        } else if (payment_method === 'credit_card') {
            // Nota: Para cartão, o ideal é tokenizar no frontend com Appmax JS.
            // Aqui simulamos o envio dos dados para a API de pagamento.
            paymentResponse = await axios.post(`${APPMAX_BASE_URL}/payments/credit-card`, {
                access_token: APPMAX_API_KEY,
                order_id: order_id,
                cartao: {
                    numero: card_data.number,
                    cvv: card_data.cvv,
                    mes: card_data.month,
                    ano: card_data.year,
                    nome: card_data.holder
                },
                parcelas: card_data.installments || 1
            });

            return res.json({
                success: true,
                payment_type: 'credit_card',
                status: paymentResponse.data.data.status
            });
        }

    } catch (error) {
        console.error('Erro no checkout:', error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            error: error.response ? error.response.data : 'Erro interno no servidor'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
