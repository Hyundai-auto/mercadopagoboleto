const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-YOUR-ACCESS-TOKEN' 
});
const payment = new Payment(client);

app.post('/api/boleto', async (req, res) => {
    try {
        const { payer_name, payer_cpf, payer_phone, amount } = req.body;

        // Separar nome e sobrenome
        const nameParts = payer_name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Sobrenome';

        const paymentData = {
            body: {
                transaction_amount: parseFloat(amount),
                description: 'Compra de Produto',
                payment_method_id: 'bolbradesco', // ID padrão para boleto no Brasil
                payer: {
                    email: 'comprador@email.com', // Email genérico ou capturado se necessário
                    first_name: firstName,
                    last_name: lastName,
                    identification: {
                        type: 'CPF',
                        number: payer_cpf.replace(/\D/g, '')
                    }
                }
            }
        };

        const result = await payment.create(paymentData);

        // O Mercado Pago retorna o link do boleto e o código de barras
        // No checkout transparente, geralmente exibimos o código de barras e o link para impressão
        res.json({
            success: true,
            barcode: result.barcode.content,
            external_resource_url: result.transaction_details.external_resource_url,
            id: result.id
        });

    } catch (error) {
        console.error('Erro ao gerar boleto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao processar pagamento'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
