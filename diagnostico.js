const axios = require('axios');
require('dotenv').config();

const KEY = (process.env.APPMAX_API_KEY || '').trim();
const ENV = process.env.APPMAX_ENV || 'production';
const URL = ENV === 'sandbox' ? 'https://api.sandboxappmax.com.br/v1' : 'https://api.appmax.com.br/v1';

async function runTest(name, config) {
    console.log(`\n--- TESTE: ${name} ---`);
    try {
        const response = await axios({
            method: 'post',
            url: `${URL}/customers`,
            data: {
                ...config.data,
                first_name: 'Teste',
                last_name: 'Diagnostico',
                email: 'teste@email.com',
                phone: '11999999999',
                document_number: '12345678909',
                ip: '127.0.0.1'
            },
            headers: config.headers,
            timeout: 5000
        }).catch(e => e.response);

        console.log(`Status: ${response ? response.status : 'TIMEOUT'}`);
        console.log(`Resposta: ${JSON.stringify(response ? response.data : 'SEM RESPOSTA')}`);
    } catch (e) {
        console.log(`Erro: ${e.message}`);
    }
}

async function start() {
    console.log(`INICIANDO DIAGNÓSTICO APPMAX`);
    console.log(`Ambiente: ${ENV}`);
    console.log(`Chave: ${KEY.substring(0, 5)}...${KEY.substring(KEY.length - 5)}`);

    // Teste 1: Padrão Documentado
    await runTest('PADRÃO (access_token no body)', {
        headers: { 'Content-Type': 'application/json' },
        data: { access_token: KEY }
    });

    // Teste 2: Bearer Header (Sem Content-Type)
    await runTest('BEARER HEADER (Sem Content-Type)', {
        headers: { 'Authorization': `Bearer ${KEY}` },
        data: {}
    });

    // Teste 3: Bearer Header (Com Content-Type)
    await runTest('BEARER HEADER (Com Content-Type)', {
        headers: { 
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        data: {}
    });

    // Teste 4: access_token na URL
    await runTest('ACCESS_TOKEN NA URL', {
        headers: { 'Content-Type': 'application/json' },
        data: {}
    });
    // Ajuste manual para o teste 4
    try {
        const res4 = await axios.post(`${URL}/customers?access_token=${KEY}`, {
            first_name: 'Teste',
            last_name: 'URL',
            email: 'teste@email.com',
            phone: '11999999999',
            document_number: '12345678909',
            ip: '127.0.0.1'
        }).catch(e => e.response);
        console.log(`\n--- TESTE: ACCESS_TOKEN NA URL ---`);
        console.log(`Status: ${res4.status}`);
        console.log(`Resposta: ${JSON.stringify(res4.data)}`);
    } catch(e) {}

    console.log('\nDIAGNÓSTICO CONCLUÍDO. POR FAVOR, ENVIE ESTES RESULTADOS.');
}

start();
