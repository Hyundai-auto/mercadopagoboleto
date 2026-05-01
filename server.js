const express = require('express');
const bodyParser = require('body-parser');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuração do Mercado Pago usando o Access Token das variáveis de ambiente
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

app.post('/process_payment', async (req, res) => {
    try {
        const { transaction_amount, description, payer } = req.body;

        const paymentData = {
            body: {
                transaction_amount: parseFloat(transaction_amount),
                description: description || 'Pagamento de Pedido',
                payment_method_id: 'boleto',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: payer.identification.type,
                        number: payer.identification.number
                    },
                    address: {
                        zip_code: payer.address.zip_code,
                        street_name: payer.address.street_name,
                        street_number: payer.address.street_number,
                        neighborhood: payer.address.neighborhood,
                        city: payer.address.city,
                        federal_unit: payer.address.federal_unit
                    }
                }
            }
        };

        const result = await payment.create(paymentData);
        
        // Retorna os dados do boleto gerado
        res.status(201).json({
            id: result.id,
            status: result.status,
            barcode: result.point_of_interaction.transaction_data.barcode.content,
            digitable_line: result.point_of_interaction.transaction_data.transaction_id,
            ticket_url: result.point_of_interaction.transaction_data.ticket_url
        });

    } catch (error) {
        console.error('Erro MP:', error);
        res.status(500).json({ error: 'Erro ao gerar boleto' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
