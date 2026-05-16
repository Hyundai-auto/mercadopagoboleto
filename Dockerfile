# Imagem base robusta com Playwright e dependências
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Instalar Python, Pip e Node.js
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Instalar Playwright para Python usando a flag para ignorar o bloqueio de pacotes do sistema
# Isso é seguro dentro de um container Docker
RUN pip3 install --upgrade pip
RUN pip3 install playwright --break-system-packages

# Copiar arquivos de dependências do Node
COPY package*.json ./
RUN npm install

# Copiar todos os arquivos do projeto
COPY . .

# Garantir que o script Python tenha permissão de execução
RUN chmod +x generate_pix_script.py

# Expor a porta
EXPOSE 3000

# Iniciar
CMD ["npm", "start"]
