const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// CONFIGURAÇÃO: Insira seu Access Token do Mercado Pago entre as aspas abaixo
const MP_ACCESS_TOKEN = "APP_USR-5824276345834591-043023-fdf41a17c3417b335770a38c0525254e-3346775579";

const client = new MercadoPagoConfig({ 
    accessToken: MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

app.post('/api/boleto', async (req, res) => {
    try {
        const { payer_name, payer_cpf, amount } = req.body;

        // Validação básica do token
        if (MP_ACCESS_TOKEN === "COLOQUE_SEU_ACCESS_TOKEN_AQUI") {
            return res.status(400).json({
                success: false,
                message: 'Erro: O Access Token não foi configurado no arquivo server.js'
            });
        }

        // Separar nome e sobrenome
        const nameParts = payer_name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Sobrenome';

        const paymentData = {
            body: {
                transaction_amount: parseFloat(amount),
                description: 'Compra de Produto',
                payment_method_id: 'bolbradesco',
                payer: {
                    email: 'comprador@email.com',
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
            message: 'Erro ao processar pagamento'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
