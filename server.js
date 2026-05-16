const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/generate-pix', (req, res) => {
    const { name, cpf } = req.body;
    if (!name || !cpf) return res.status(400).json({ success: false });

    console.log(`Gerando para: ${name}`);

    try {
        // Usamos execSync para garantir que esperamos a resposta do Python
        const stdout = execSync(`python3 generate_pix_script.py "${name}" "${cpf}"`, { encoding: 'utf8' });
        const result = JSON.parse(stdout.match(/\{.*\}/)[0]);
        res.json(result);
    } catch (error) {
        console.error('Erro:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server v5 rodando na porta ${PORT}`));
