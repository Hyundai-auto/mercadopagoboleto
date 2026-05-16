# Use a imagem oficial do Playwright que já vem com todas as dependências do sistema
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Instalar Node.js e Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do Playwright para Python globalmente
RUN pip3 install playwright

# Copiar arquivos de dependências do Node
COPY package*.json ./

# Instalar dependências do Node
RUN npm install

# Copiar o restante dos arquivos
COPY . .

# Expor a porta que o app usa
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
