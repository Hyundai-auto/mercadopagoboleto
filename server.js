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

        const firstName = payer_name.split(' ')[0];
        const lastName = payer_name.split(' ').slice(1).join(' ') || 'Sobrenome';
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        // 1. Criar ou atualizar o cliente
        // Nota: A Appmax exige access_token no corpo da requisição para v1
        const customerResponse = await axios.post(`${APPMAX_API_URL}/customers`, {
            access_token: APPMAX_API_KEY,
            first_name: firstName,
            last_name: lastName,
            email: `cliente_${payer_cpf}@email.com`,
            phone: payer_phone.replace(/\D/g, ''),
            document_number: payer_cpf.replace(/\D/g, ''),
            ip: clientIp
        });

        if (!customerResponse.data.success) {
            console.error('Erro ao criar cliente:', customerResponse.data);
            throw new Error(customerResponse.data.message || 'Erro ao criar cliente na Appmax');
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
                    unit_value: Math.round(parseFloat(amount) * 100)
                }
            ],
            total_value: Math.round(parseFloat(amount) * 100)
        });

        if (!orderResponse.data.success) {
            console.error('Erro ao criar pedido:', orderResponse.data);
            throw new Error(orderResponse.data.message || 'Erro ao criar pedido na Appmax');
        }

        const orderId = orderResponse.data.data.id;

        // 3. Efetuar pagamento via Pix
        const paymentResponse = await axios.post(`${APPMAX_API_URL}/payments/pix`, {
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
                pixCode: paymentResponse.data.data.pix_code,
                qrCodeImage: paymentResponse.data.data.pix_qr_code
            });
        } else {
            console.error('Erro ao processar Pix:', paymentResponse.data);
            res.status(500).json({ success: false, message: paymentResponse.data.message || 'Erro ao processar pagamento Pix' });
        }

    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error('Erro na integração Appmax:', errorData);
        
        // Se o erro for Unauthorized, avisar o usuário sobre a chave de API
        if (error.response && error.response.status === 401) {
            return res.status(401).json({ 
                success: false, 
                message: 'Chave de API (access_token) inválida ou não autorizada. Verifique suas credenciais na Appmax.',
                details: errorData
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Erro interno no servidor ao processar com Appmax',
            details: errorData
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
