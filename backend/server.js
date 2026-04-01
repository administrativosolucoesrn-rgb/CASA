import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: "2mb" }));

const dataDir = path.join(__dirname, "data");
const campaignsFile = path.join(dataDir, "campaigns.json");
const ordersFile = path.join(dataDir, "orders.json");

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || ""
});
const paymentClient = new Payment(mpClient);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Não autorizado." });

  try {
    jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido." });
  }
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Senha obrigatória." });

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Senha incorreta." });
  }

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET || "dev-secret", {
    expiresIn: "12h",
  });

  res.json({ token });
});

app.get("/api/campaigns", (req, res) => {
  const campaigns = readJson(campaignsFile);
  res.json(campaigns);
});

app.get("/api/campaigns/:slug", (req, res) => {
  const campaigns = readJson(campaignsFile);
  const item = campaigns.find((c) => c.slug === req.params.slug);
  if (!item) return res.status(404).json({ error: "Campanha não encontrada." });
  res.json(item);
});

app.get("/api/admin/campaigns", auth, (req, res) => {
  const campaigns = readJson(campaignsFile);
  res.json(campaigns);
});

app.post("/api/admin/campaigns", auth, (req, res) => {
  const campaigns = readJson(campaignsFile);
  const payload = req.body || {};

  const slug = String(payload.slug || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!payload.title || !slug) {
    return res.status(400).json({ error: "Título e slug são obrigatórios." });
  }

  if (campaigns.some((c) => c.slug === slug)) {
    return res.status(400).json({ error: "Já existe uma campanha com esse link." });
  }

  const newCampaign = {
    id: uuidv4(),
    siteName: payload.siteName || "CASAPREMIADARIBEIRAO",
    title: payload.title,
    slug,
    description: payload.description || "",
    pricePerNumber: Number(payload.pricePerNumber || 0),
    rangeStart: Number(payload.rangeStart || 1),
    rangeEnd: Number(payload.rangeEnd || 100),
    drawDate: payload.drawDate || "",
    coverImage: payload.coverImage || "",
    theme: payload.theme || {
      primary: "#b40019",
      secondary: "#ffffff",
      accent: "#d4af37"
    },
    reservedNumbers: [],
    paidNumbers: []
  };

  campaigns.unshift(newCampaign);
  writeJson(campaignsFile, campaigns);
  res.status(201).json(newCampaign);
});

app.put("/api/admin/campaigns/:id", auth, (req, res) => {
  const campaigns = readJson(campaignsFile);
  const index = campaigns.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Campanha não encontrada." });

  campaigns[index] = {
    ...campaigns[index],
    ...req.body,
    pricePerNumber: Number(req.body.pricePerNumber ?? campaigns[index].pricePerNumber),
    rangeStart: Number(req.body.rangeStart ?? campaigns[index].rangeStart),
    rangeEnd: Number(req.body.rangeEnd ?? campaigns[index].rangeEnd),
  };

  writeJson(campaignsFile, campaigns);
  res.json(campaigns[index]);
});

app.get("/api/admin/orders", auth, (req, res) => {
  const orders = readJson(ordersFile);
  res.json(orders);
});

app.post("/api/create-pix", async (req, res) => {
  try {
    const { campaignSlug, selectedNumbers = [], customer = {}, amount } = req.body || {};
    const campaigns = readJson(campaignsFile);
    const campaign = campaigns.find((c) => c.slug === campaignSlug);
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });

    if (!selectedNumbers.length) {
      return res.status(400).json({ error: "Selecione ao menos um número." });
    }

    for (const n of selectedNumbers) {
      if (campaign.reservedNumbers.includes(n) || campaign.paidNumbers.includes(n)) {
        return res.status(400).json({ error: `O número ${n} não está mais disponível.` });
      }
    }

    if (!customer.name || !customer.phone) {
      return res.status(400).json({ error: "Nome e WhatsApp são obrigatórios." });
    }

    const orders = readJson(ordersFile);
    const orderId = uuidv4();

    // Reserva local simples
    campaign.reservedNumbers = [...new Set([...campaign.reservedNumbers, ...selectedNumbers])];
    writeJson(campaignsFile, campaigns);

    const orderBase = {
      id: orderId,
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      customer,
      selectedNumbers,
      amount: Number(amount),
      status: "reserved",
      createdAt: new Date().toISOString()
    };

    if (!process.env.MP_ACCESS_TOKEN) {
      orders.unshift({
        ...orderBase,
        status: "pending_mp",
      });
      writeJson(ordersFile, orders);

      return res.json({
        mode: "demo",
        orderId,
        status: "pending_mp",
        qr_code: "CONFIGURE_O_ACCESS_TOKEN_DO_MERCADO_PAGO",
        qr_code_base64: null,
        ticket_url: null
      });
    }

    const payment = await paymentClient.create({
      body: {
        transaction_amount: Number(amount),
        description: `${campaign.siteName} - ${campaign.title} - Números: ${selectedNumbers.join(", ")}`,
        payment_method_id: "pix",
        external_reference: orderId,
        notification_url: process.env.WEBHOOK_BASE_URL
          ? `${process.env.WEBHOOK_BASE_URL}/api/webhook`
          : undefined,
        payer: {
          email: customer.email || `cliente-${Date.now()}@exemplo.com`,
          first_name: customer.name,
          identification: customer.cpf ? {
            type: "CPF",
            number: String(customer.cpf).replace(/\D/g, "")
          } : undefined
        },
        metadata: {
          campaignSlug,
          selectedNumbers,
          phone: customer.phone || ""
        }
      },
      requestOptions: {
        idempotencyKey: uuidv4()
      }
    });

    orders.unshift({
      ...orderBase,
      status: payment.status || "pending",
      mpPaymentId: payment.id
    });
    writeJson(ordersFile, orders);

    return res.json({
      mode: "mercadopago",
      orderId,
      status: payment.status,
      qr_code: payment?.point_of_interaction?.transaction_data?.qr_code || "",
      qr_code_base64: payment?.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      ticket_url: payment?.point_of_interaction?.transaction_data?.ticket_url || null
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao gerar Pix.",
      details: error?.message || "Erro interno"
    });
  }
});

app.post("/api/webhook", (req, res) => {
  console.log("Webhook recebido:", JSON.stringify(req.body, null, 2));
  // Aqui entra a confirmação real do pagamento consultando a API do Mercado Pago
  // e atualizando orders.json / campaigns.json
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
