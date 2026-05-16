const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const APPMAX_API_URL = 'https://api.appmax.com.br/v1';
const API_TOKEN = process.env.APPMAX_TOKEN;

app.post('/api/checkout', async (req, res) => {
    try {
        const { customer, product } = req.body;

        // 1. Criar ou atualizar o cliente
        const customerResponse = await axios.post(`${APPMAX_API_URL}/customers`, {
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            document_number: customer.document_number,
            ip: req.ip || '127.0.0.1'
        }, {
            headers: { 'access-token': API_TOKEN }
        });

        const customerId = customerResponse.data.data.customer.id;

        // 2. Criar o pedido
        const orderResponse = await axios.post(`${APPMAX_API_URL}/orders`, {
            customer_id: customerId,
            products: [
                {
                    sku: product.sku || 'default_sku',
                    name: product.name || 'Produto Checkout',
                    quantity: 1,
                    unit_value: product.price, // Valor em centavos
                    type: 'digital'
                }
            ],
            products_value: product.price,
            shipping_value: 0,
            discount_value: 0
        }, {
            headers: { 'access-token': API_TOKEN }
        });

        const orderId = orderResponse.data.data.order.id;

        // 3. Processar pagamento via Pix
        const paymentResponse = await axios.post(`${APPMAX_API_URL}/payments/pix`, {
            order_id: orderId,
            payment_data: {
                pix: {
                    document_number: customer.document_number
                }
            }
        }, {
            headers: { 'access-token': API_TOKEN }
        });

        res.json({
            success: true,
            pix_code: paymentResponse.data.data.pix_code,
            pix_qr_code: paymentResponse.data.data.pix_qr_code,
            order_id: orderId
        });

    } catch (error) {
        console.error('Erro no checkout:', error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar o pagamento',
            details: error.response ? error.response.data : error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
