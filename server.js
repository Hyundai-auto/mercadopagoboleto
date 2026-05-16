const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cookieParser = require("cookie-parser");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/**
 * Configuração do Checkout Alvo
 * O endpoint inicial redireciona para um token de checkout dinâmico.
 */
const CHECKOUT_URL = "https://seguro.meuservicomei.com.br/api/public/shopify?product=3198741739882&store=31987";
const BASE_DOMAIN = "https://seguro.meuservicomei.com.br";

const axiosInstance = axios.create({
  baseURL: BASE_DOMAIN,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
  },
  withCredentials: true,
  maxRedirects: 5
});

// Helper para gerar e-mail padrão se não fornecido
function generateDefaultEmail(cpf) {
  const cleanCpf = (cpf || "").replace(/\D/g, "");
  return `user_${cleanCpf || Date.now()}@gmail.com`;
}

// Helper para formatar cookies
function formatCookies(setCookieArray) {
  if (!setCookieArray) return "";
  // Pega apenas a parte "chave=valor" antes do primeiro ponto e vírgula
  return setCookieArray.map(cookieStr => cookieStr.split(";")[0]).join("; ");
}

// Rota para processar o PIX
app.post("/proxy/pix", async (req, res) => {
  console.log("--- Nova requisição PIX recebida ---");
  const { payer_name, payer_cpf } = req.body;

  if (!payer_name || !payer_cpf) {
    return res.status(400).json({ error: "Nome e CPF são obrigatórios." });
  }

  try {
    // 1. Acessar a URL inicial para obter o token de checkout e os cookies de sessão
    console.log("Obtendo sessão de checkout...");
    const initialResponse = await axiosInstance.get(CHECKOUT_URL);
    
    // O redirecionamento final nos dá a URL com o token: /checkout/TOKEN
    const checkoutPath = initialResponse.request.path;
    const token = checkoutPath.split("/").pop();
    console.log(`Token de checkout obtido: ${token}`);

    // Extrair e formatar cookies da resposta inicial
    const formattedCookies = formatCookies(initialResponse.headers["set-cookie"]);

    // 2. Finalizar a compra para gerar PIX
    // ATENÇÃO: Esta requisição ainda é HIPOTÉTICA. O site alvo pode exigir
    // um payload diferente ou um endpoint específico para finalizar com PIX.
    // É crucial inspecionar as requisições reais do site para replicá-las corretamente.
    console.log("Tentando finalizar compra para gerar PIX com os dados fornecidos...");
    const finishResponse = await axiosInstance.post(`${BASE_DOMAIN}/api/checkout/finish`, {
        token: token,
        paymentMethod: 'PIX',
        payer_name: payer_name,
        payer_cpf: payer_cpf
        // Removido payer_email, pois era hipotético e pode não ser esperado pela API alvo
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Referer': `${BASE_DOMAIN}${checkoutPath}`,
            'Cookie': formattedCookies
        }
    });
    console.log(`Resposta da finalização da compra (status: ${finishResponse.status}):\n${JSON.stringify(finishResponse.data, null, 2)}`);

    // 3. Acessar a página de pedido para extrair o código PIX
    console.log("Acessando página do pedido...");
    const orderUrl = `${BASE_DOMAIN}/order/${token}`;
    const orderPageResponse = await axiosInstance.get(orderUrl, {
        headers: {
            'Cookie': formattedCookies
        }
    });

    const $ = cheerio.load(orderPageResponse.data);
    
    let pixCode = $("input[type=\'text\"][value^=\'0002\"]").val();

    if (!pixCode) {
        pixCode = $("input").filter((i, el) => $(el).val().startsWith("0002")).val();
    }

    if (!pixCode) {
      console.error("Não foi possível extrair o código PIX da página de pedido. Verifique o seletor ou o HTML da página.");
      return res.status(500).json({ error: "Erro ao extrair PIX do novo checkout." });
    }

    console.log("Código PIX extraído com sucesso.");
    res.status(200).json({ success: true, pixCode: pixCode });

  } catch (err) {
    console.error("Erro ao processar PIX:", err.message);
    if (err.response) {
        console.error(`Detalhes do erro da resposta do servidor alvo (status ${err.response.status}):\n${JSON.stringify(err.response.data, null, 2)}`);
    } else if (err.request) {
        console.error("Nenhuma resposta recebida do servidor alvo. Requisição feita:", err.request);
    } else {
        console.error("Erro na configuração da requisição:", err.config);
    }
    res.status(500).json({ 
        error: "Erro interno ao integrar com o novo checkout", 
        details: err.message, 
        server_status: err.response ? err.response.status : "N/A",
        server_response_data: err.response ? err.response.data : "N/A"
    });
  }
});

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// Servir arquivos estáticos (se houver)
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
