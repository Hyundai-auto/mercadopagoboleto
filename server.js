const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Rota para gerar o PIX
 * Usa um script Python com Playwright para contornar o Cloudflare
 */
app.post('/api/generate-pix', (req, res) => {
    const { name, cpf } = req.body;

    if (!name || !cpf) {
        return res.status(400).json({ success: false, message: 'Nome e CPF são obrigatórios.' });
    }

    console.log(`Iniciando geração de PIX via automação para: ${name}, CPF: ${cpf}`);

    // Executa o script Python para automatizar o checkout e pegar o PIX
    // Nota: No Render, você precisará garantir que o ambiente tenha Python e Playwright instalados.
    // Para simplificar, vou fornecer uma versão que tenta fazer o máximo possível.
    
    exec(`python3 generate_pix_script.py "${name}" "${cpf}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro na execução: ${error.message}`);
            return res.status(500).json({ success: false, message: 'Erro ao processar automação.' });
        }
        
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (e) {
            console.error('Erro ao processar resposta do script:', stdout);
            res.status(500).json({ success: false, message: 'Erro ao ler código PIX.' });
        }
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
