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

const dataDir = fs.existsSync(path.join(__dirname, "dados"))
  ? path.join(__dirname, "dados")
  : path.join(__dirname, "data");

const campaignsFile = path.join(dataDir, "campaigns.json");
const ordersFile = path.join(dataDir, "orders.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(campaignsFile)) {
  fs.writeFileSync(campaignsFile, "[]");
}
if (!fs.existsSync(ordersFile)) {
  fs.writeFileSync(ordersFile, "[]");
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
});
const paymentClient = new Payment(mpClient);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
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

function sanitizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureArrayNumbers(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((n) => Number(n)).filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b
  );
}

function findCampaignBySlug(slug) {
  const campaigns = readJson(campaignsFile);
  const campaign = campaigns.find((c) => c.slug === slug);
  return { campaigns, campaign };
}

function removeNumbers(list = [], numbers = []) {
  const toRemove = new Set(numbers.map(Number));
  return ensureArrayNumbers(list).filter((n) => !toRemove.has(Number(n)));
}

function addNumbers(list = [], numbers = []) {
  return ensureArrayNumbers([...(list || []), ...(numbers || [])]);
}

function updateCampaignNumbersByOrderStatus(campaign, order, status) {
  const selectedNumbers = ensureArrayNumbers(order.selectedNumbers || []);
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "approved") {
    campaign.reservedNumbers = removeNumbers(campaign.reservedNumbers, selectedNumbers);
    campaign.paidNumbers = addNumbers(campaign.paidNumbers, selectedNumbers);
    return;
  }

  if (
    [
      "rejected",
      "cancelled",
      "cancelled_by_user",
      "refunded",
      "charged_back",
    ].includes(normalizedStatus)
  ) {
    campaign.reservedNumbers = removeNumbers(campaign.reservedNumbers, selectedNumbers);
    campaign.paidNumbers = removeNumbers(campaign.paidNumbers, selectedNumbers);
    return;
  }

  // pending / in_process / authorized: mantém reservado
  campaign.reservedNumbers = addNumbers(campaign.reservedNumbers, selectedNumbers);
}

function saveOrderAndCampaignStatus({
  mpPaymentId,
  externalReference,
  paymentStatus,
  paymentRaw,
}) {
  const orders = readJson(ordersFile);
  const campaigns = readJson(campaignsFile);

  const orderIndex = orders.findIndex(
    (o) =>
      String(o.mpPaymentId || "") === String(mpPaymentId || "") ||
      String(o.id || "") === String(externalReference || "")
  );

  if (orderIndex === -1) {
    return { updated: false, reason: "Pedido não encontrado." };
  }

  const order = orders[orderIndex];
  const campaignIndex = campaigns.findIndex((c) => c.slug === order.campaignSlug);

  if (campaignIndex === -1) {
    return { updated: false, reason: "Campanha não encontrada." };
  }

  orders[orderIndex] = {
    ...order,
    status: paymentStatus,
    mpPaymentId: mpPaymentId || order.mpPaymentId || null,
    paidAt: paymentStatus === "approved" ? new Date().toISOString() : order.paidAt || null,
    updatedAt: new Date().toISOString(),
    paymentDetails: {
      id: paymentRaw?.id || null,
      status: paymentRaw?.status || paymentStatus,
      status_detail: paymentRaw?.status_detail || null,
      transaction_amount: paymentRaw?.transaction_amount || null,
      date_approved: paymentRaw?.date_approved || null,
      date_created: paymentRaw?.date_created || null,
    },
  };

  const campaign = campaigns[campaignIndex];
  updateCampaignNumbersByOrderStatus(campaign, orders[orderIndex], paymentStatus);

  campaigns[campaignIndex] = {
    ...campaign,
    reservedNumbers: ensureArrayNumbers(campaign.reservedNumbers),
    paidNumbers: ensureArrayNumbers(campaign.paidNumbers),
  };

  writeJson(ordersFile, orders);
  writeJson(campaignsFile, campaigns);

  return { updated: true, order: orders[orderIndex], campaign: campaigns[campaignIndex] };
}

async function fetchMercadoPagoPayment(paymentId) {
  return paymentClient.get({ id: String(paymentId) });
}

app.get("/", (_, res) => {
  res.send("API funcionando 🚀");
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Senha obrigatória." });

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Senha incorreta." });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "12h" }
  );

  res.json({ token });
});

app.get("/api/campaigns", (_, res) => {
  const campaigns = readJson(campaignsFile);
  res.json(campaigns);
});

app.get("/api/campaigns/:slug", (req, res) => {
  const campaigns = readJson(campaignsFile);
  const item = campaigns.find((c) => c.slug === req.params.slug);
  if (!item) return res.status(404).json({ error: "Campanha não encontrada." });
  res.json(item);
});

app.get("/api/admin/campaigns", auth, (_, res) => {
  const campaigns = readJson(campaignsFile);
  res.json(campaigns);
});

app.post("/api/admin/campaigns", auth, (req, res) => {
  const campaigns = readJson(campaignsFile);
  const payload = req.body || {};
  const slug = sanitizeSlug(payload.slug);

  if (!payload.title || !slug) {
    return res.status(400).json({ error: "Título e slug são obrigatórios." });
  }

  if (campaigns.some((c) => c.slug === slug)) {
    return res.status(400).json({ error: "Já existe uma campanha com esse link." });
  }

  const newCampaign = {
    id: uuidv4(),
    siteName: payload.siteName || "Casa Premiada Ribeirão",
    logoImage: payload.logoImage || "",
    title: payload.title,
    slug,
    shortDescription: payload.shortDescription || "",
    description: payload.description || "",
    company: payload.company || payload.siteName || "Casa Premiada Ribeirão",
    organizerPhone: payload.organizerPhone || "",
    whatsapp: payload.whatsapp || "",
    pricePerNumber: Number(payload.pricePerNumber || 0),
    rangeStart: Number(payload.rangeStart || 1),
    rangeEnd: Number(payload.rangeEnd || 300),
    drawDate: payload.drawDate || "",
    coverImage: payload.coverImage || "",
    theme: payload.theme || {
      primary: "#b40019",
      secondary: "#ffffff",
      accent: "#d4af37",
    },
    reservedNumbers: [],
    paidNumbers: [],
    createdAt: new Date().toISOString(),
  };

  campaigns.unshift(newCampaign);
  writeJson(campaignsFile, campaigns);
  res.status(201).json(newCampaign);
});

app.put("/api/admin/campaigns/:id", auth, (req, res) => {
  const campaigns = readJson(campaignsFile);
  const index = campaigns.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Campanha não encontrada." });
  }

  campaigns[index] = {
    ...campaigns[index],
    ...req.body,
    slug: req.body.slug ? sanitizeSlug(req.body.slug) : campaigns[index].slug,
    pricePerNumber: Number(req.body.pricePerNumber ?? campaigns[index].pricePerNumber),
    rangeStart: Number(req.body.rangeStart ?? campaigns[index].rangeStart),
    rangeEnd: Number(req.body.rangeEnd ?? campaigns[index].rangeEnd),
    reservedNumbers: ensureArrayNumbers(
      req.body.reservedNumbers ?? campaigns[index].reservedNumbers
    ),
    paidNumbers: ensureArrayNumbers(req.body.paidNumbers ?? campaigns[index].paidNumbers),
    updatedAt: new Date().toISOString(),
  };

  writeJson(campaignsFile, campaigns);
  res.json(campaigns[index]);
});

app.get("/api/admin/orders", auth, (_, res) => {
  const orders = readJson(ordersFile);
  res.json(orders);
});

app.post("/api/create-pix", async (req, res) => {
  try {
    const { campaignSlug, selectedNumbers = [], customer = {}, amount } = req.body || {};
    const { campaigns, campaign } = findCampaignBySlug(campaignSlug);

    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }

    const cleanNumbers = ensureArrayNumbers(selectedNumbers);

    if (!cleanNumbers.length) {
      return res.status(400).json({ error: "Selecione ao menos um número." });
    }

    for (const n of cleanNumbers) {
      if (
        ensureArrayNumbers(campaign.reservedNumbers).includes(n) ||
        ensureArrayNumbers(campaign.paidNumbers).includes(n)
      ) {
        return res.status(400).json({ error: `O número ${n} não está mais disponível.` });
      }
    }

    if (!customer.name || !customer.phone) {
      return res.status(400).json({ error: "Nome e WhatsApp são obrigatórios." });
    }

    const orders = readJson(ordersFile);
    const orderId = uuidv4();

    const campaignIndex = campaigns.findIndex((c) => c.slug === campaignSlug);
    campaigns[campaignIndex].reservedNumbers = addNumbers(
      campaigns[campaignIndex].reservedNumbers,
      cleanNumbers
    );
    writeJson(campaignsFile, campaigns);

    const orderBase = {
      id: orderId,
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      customer: {
        name: customer.name,
        phone: customer.phone,
      },
      selectedNumbers: cleanNumbers,
      amount: Number(amount || cleanNumbers.length * Number(campaign.pricePerNumber || 0)),
      status: "reserved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
        ticket_url: null,
      });
    }

    const payment = await paymentClient.create({
      body: {
        transaction_amount: Number(orderBase.amount),
        description: `${campaign.siteName || "Casa Premiada Ribeirão"} - ${campaign.title} - Números: ${cleanNumbers.join(", ")}`,
        payment_method_id: "pix",
        external_reference: orderId,
        notification_url: process.env.WEBHOOK_BASE_URL
          ? `${process.env.WEBHOOK_BASE_URL}/api/webhook`
          : undefined,
        payer: {
          email: `cliente-${Date.now()}@casapremiada.local`,
          first_name: customer.name,
        },
        metadata: {
          campaignSlug,
          selectedNumbers: cleanNumbers,
          phone: customer.phone || "",
        },
      },
      requestOptions: {
        idempotencyKey: uuidv4(),
      },
    });

    orders.unshift({
      ...orderBase,
      status: payment.status || "pending",
      mpPaymentId: payment.id,
      paymentDetails: {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail || null,
      },
    });
    writeJson(ordersFile, orders);

    return res.json({
      mode: "mercadopago",
      orderId,
      status: payment.status,
      qr_code: payment?.point_of_interaction?.transaction_data?.qr_code || "",
      qr_code_base64:
        payment?.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      ticket_url:
        payment?.point_of_interaction?.transaction_data?.ticket_url || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao gerar Pix.",
      details: error?.message || "Erro interno",
    });
  }
});

app.post("/api/webhook", async (req, res) => {
  try {
    console.log("Webhook recebido:", JSON.stringify(req.body, null, 2));

    const body = req.body || {};
    const paymentId =
      body?.data?.id ||
      body?.resource?.id ||
      body?.id ||
      req.query["data.id"] ||
      req.query.id;

    const topic = body?.type || body?.topic || req.query.type || req.query.topic;

    if (!paymentId) {
      return res.sendStatus(200);
    }

    if (topic && topic !== "payment") {
      return res.sendStatus(200);
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return res.sendStatus(200);
    }

    const payment = await fetchMercadoPagoPayment(paymentId);

    const paymentStatus = String(payment?.status || "").toLowerCase();
    const externalReference = payment?.external_reference || "";
    const mpPaymentId = payment?.id || paymentId;

    const result = saveOrderAndCampaignStatus({
      mpPaymentId,
      externalReference,
      paymentStatus,
      paymentRaw: payment,
    });

    if (!result.updated) {
      console.warn("Webhook processado sem atualização:", result.reason);
    } else {
      console.log(
        `Pedido atualizado com sucesso. status=${paymentStatus} mpPaymentId=${mpPaymentId}`
      );
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err?.message || err);
    return res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
