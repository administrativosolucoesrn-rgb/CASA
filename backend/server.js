import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

const dataDir = fs.existsSync(path.join(__dirname, "dados"))
  ? path.join(__dirname, "dados")
  : path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const CAMPAIGNS_FILE = path.join(dataDir, "campaigns.json");
const ORDERS_FILE = path.join(dataDir, "orders.json");

function ensureJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf-8");
  }
}

ensureJsonFile(CAMPAIGNS_FILE, []);
ensureJsonFile(ORDERS_FILE, []);

function readJson(filePath, fallbackValue) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    console.error(`Erro ao ler ${filePath}:`, error);
    return fallbackValue;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readCampaigns() {
  return readJson(CAMPAIGNS_FILE, []);
}

function saveCampaigns(campaigns) {
  writeJson(CAMPAIGNS_FILE, campaigns);
}

function readOrders() {
  return readJson(ORDERS_FILE, []);
}

function saveOrders(orders) {
  writeJson(ORDERS_FILE, orders);
}

function slugify(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeNumbers(numbers) {
  if (!Array.isArray(numbers)) return [];
  return [...new Set(numbers.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))];
}

function getCampaignBySlug(slug) {
  return readCampaigns().find((c) => c.slug === slug);
}

function getCampaignIndexBySlug(slug) {
  return readCampaigns().findIndex((c) => c.slug === slug);
}

function isPaidStatus(status) {
  return ["approved", "authorized"].includes(String(status || "").toLowerCase());
}

function isPendingStatus(status) {
  return ["pending", "in_process"].includes(String(status || "").toLowerCase());
}

function buildNumbersMap(campaign, orders) {
  const result = {};
  const maxNumbers = Number(campaign.totalNumbers || 0);

  for (let i = 1; i <= maxNumbers; i += 1) {
    result[i] = { status: "available", orderId: null };
  }

  for (const order of orders) {
    if (order.campaignSlug !== campaign.slug) continue;

    const numbers = normalizeNumbers(order.selectedNumbers);

    for (const num of numbers) {
      if (!result[num]) continue;

      if (isPaidStatus(order.status)) {
        result[num] = { status: "paid", orderId: order.id };
      } else if (isPendingStatus(order.status) && result[num].status === "available") {
        result[num] = { status: "reserved", orderId: order.id };
      }
    }
  }

  return result;
}

function getUnavailableNumbers(campaign, orders) {
  const map = buildNumbersMap(campaign, orders);
  return Object.entries(map)
    .filter(([, value]) => value.status !== "available")
    .map(([num]) => Number(num));
}

function validateNumbersAvailable(campaign, requestedNumbers, orders, ignoreOrderId = null) {
  const map = buildNumbersMap(campaign, orders);

  for (const num of requestedNumbers) {
    if (num < 1 || num > Number(campaign.totalNumbers)) {
      return `Número inválido: ${num}`;
    }

    const slot = map[num];
    if (!slot) return `Número inválido: ${num}`;

    if (slot.status !== "available" && slot.orderId !== ignoreOrderId) {
      return `Número indisponível: ${num}`;
    }
  }

  return null;
}

function createAdminToken() {
  return jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Não autorizado." });
    }

    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido." });
  }
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

function saveOrderAndCampaignStatus(order) {
  const orders = readOrders();
  const campaigns = readCampaigns();

  const existingOrderIndex = orders.findIndex((o) => o.id === order.id);
  if (existingOrderIndex >= 0) {
    orders[existingOrderIndex] = order;
  } else {
    orders.unshift(order);
  }
  saveOrders(orders);

  const campaignIndex = campaigns.findIndex((c) => c.slug === order.campaignSlug);
  if (campaignIndex >= 0) {
    const campaign = campaigns[campaignIndex];
    const allOrders = readOrders();
    const numbersMap = buildNumbersMap(campaign, allOrders);

    campaign.numbersStatus = numbersMap;
    campaign.updatedAt = new Date().toISOString();

    campaigns[campaignIndex] = campaign;
    saveCampaigns(campaigns);
  }
}

async function markOrderPaidFromPayment(paymentData) {
  const externalReference = paymentData.external_reference;
  if (!externalReference) return false;

  const orders = readOrders();
  const orderIndex = orders.findIndex((o) => o.id === externalReference);

  if (orderIndex === -1) return false;

  const order = orders[orderIndex];
  order.status = paymentData.status || order.status;
  order.statusDetail = paymentData.status_detail || order.statusDetail || "";
  order.mpPaymentId = paymentData.id || order.mpPaymentId || null;
  order.approvedAt = new Date().toISOString();
  order.paymentDetails = {
    id: paymentData.id,
    status: paymentData.status,
    status_detail: paymentData.status_detail,
    date_approved: paymentData.date_approved || null,
    transaction_amount: paymentData.transaction_amount || null,
  };

  orders[orderIndex] = order;
  saveOrders(orders);

  saveOrderAndCampaignStatus(order);
  return true;
}

/**
 * HEALTH
 */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * FRONTEND BUILD
 */
const frontendDist = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

/**
 * AUTH
 */
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(500).json({ error: "Configuração do servidor incompleta." });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Senha inválida." });
  }

  return res.json({
    token: createAdminToken(),
  });
});

/**
 * CAMPAIGNS - PUBLIC
 */
app.get("/api/campaigns", (_req, res) => {
  const campaigns = readCampaigns().map((campaign) => {
    const orders = readOrders();
    const unavailableNumbers = getUnavailableNumbers(campaign, orders);

    return {
      ...campaign,
      unavailableNumbers,
    };
  });

  res.json(campaigns);
});

app.get("/api/campaigns/:slug", (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);

  if (!campaign) {
    return res.status(404).json({ error: "Campanha não encontrada." });
  }

  const orders = readOrders();
  const numbersMap = buildNumbersMap(campaign, orders);

  return res.json({
    ...campaign,
    numbersStatus: numbersMap,
  });
});

/**
 * CAMPAIGNS - ADMIN
 */
app.get("/api/admin/campaigns", authMiddleware, (_req, res) => {
  res.json(readCampaigns());
});

app.post("/api/admin/campaigns", authMiddleware, (req, res) => {
  const body = req.body || {};
  const campaigns = readCampaigns();

  const title = String(body.title || "").trim();
  if (!title) {
    return res.status(400).json({ error: "Título é obrigatório." });
  }

  const slug = body.slug ? slugify(body.slug) : slugify(title);
  if (campaigns.some((c) => c.slug === slug)) {
    return res.status(400).json({ error: "Já existe uma campanha com esse slug." });
  }

  const totalNumbers = Number(body.totalNumbers || 0);
  const pricePerNumber = Number(body.pricePerNumber || 0);

  const campaign = {
    id: uuidv4(),
    slug,
    title,
    siteName: body.siteName || "Casa Premiada Ribeirão",
    description: body.description || "",
    imageUrl: body.imageUrl || "",
    logoUrl: body.logoUrl || "",
    drawDate: body.drawDate || "",
    totalNumbers,
    pricePerNumber,
    active: body.active !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    numbersStatus: {},
  };

  campaigns.unshift(campaign);
  saveCampaigns(campaigns);

  return res.status(201).json(campaign);
});

app.put("/api/admin/campaigns/:slug", authMiddleware, (req, res) => {
  const campaigns = readCampaigns();
  const index = campaigns.findIndex((c) => c.slug === req.params.slug);

  if (index === -1) {
    return res.status(404).json({ error: "Campanha não encontrada." });
  }

  const current = campaigns[index];
  const nextSlug = req.body.slug ? slugify(req.body.slug) : current.slug;

  if (
    nextSlug !== current.slug &&
    campaigns.some((c) => c.slug === nextSlug)
  ) {
    return res.status(400).json({ error: "Slug já está em uso." });
  }

  campaigns[index] = {
    ...current,
    ...req.body,
    slug: nextSlug,
    updatedAt: new Date().toISOString(),
  };

  saveCampaigns(campaigns);
  return res.json(campaigns[index]);
});

app.delete("/api/admin/campaigns/:slug", authMiddleware, (req, res) => {
  const campaigns = readCampaigns();
  const filtered = campaigns.filter((c) => c.slug !== req.params.slug);

  if (filtered.length === campaigns.length) {
    return res.status(404).json({ error: "Campanha não encontrada." });
  }

  saveCampaigns(filtered);
  return res.json({ ok: true });
});

/**
 * ORDERS - ADMIN
 */
app.get("/api/admin/orders", authMiddleware, (_req, res) => {
  res.json(readOrders());
});

/**
 * CREATE CHECKOUT PRO
 */
app.post("/api/create-checkout-pro", async (req, res) => {
  try {
    const { campaignSlug, customer, numbers } = req.body || {};

    const cleanNumbers = normalizeNumbers(numbers);

    if (!campaignSlug || !cleanNumbers.length) {
      return res.status(400).json({ error: "Dados inválidos." });
    }

    const campaign = getCampaignBySlug(campaignSlug);
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }

    if (!campaign.active) {
      return res.status(400).json({ error: "Campanha inativa." });
    }

    const customerName = String(customer?.name || "").trim();
    const customerPhone = String(customer?.phone || "").trim();

    if (!customerName || !customerPhone) {
      return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
    }

    const orders = readOrders();
    const availabilityError = validateNumbersAvailable(campaign, cleanNumbers, orders);
    if (availabilityError) {
      return res.status(400).json({ error: availabilityError });
    }

    const orderId = `order_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const unitPrice = Number(campaign.pricePerNumber || 0);
    const totalAmount = Number((unitPrice * cleanNumbers.length).toFixed(2));

    const orderBase = {
      id: orderId,
      campaignSlug,
      customer: {
        name: customerName,
        phone: customerPhone,
      },
      selectedNumbers: cleanNumbers,
      amount: totalAmount,
      unitPrice,
      status: "pending",
      statusDetail: "checkout_created",
      mpPreferenceId: null,
      mpPaymentId: null,
      createdAt: new Date().toISOString(),
      approvedAt: null,
      paymentDetails: null,
    };

    const preference = await preferenceClient.create({
      body: {
        external_reference: orderId,
        items: [
          {
            id: campaignSlug,
            title: `${campaign.siteName || "Casa Premiada Ribeirão"} - ${campaign.title}`,
            description: `Números: ${cleanNumbers.join(", ")}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: totalAmount,
          },
        ],
        payer: {
          name: customerName,
          email: "administrativo.solucoes.rn@gmail.com",
        },
        metadata: {
          campaignSlug,
          selectedNumbers: cleanNumbers,
          phone: customerPhone,
          customerName,
        },
        notification_url: process.env.WEBHOOK_BASE_URL
          ? `${process.env.WEBHOOK_BASE_URL}/api/webhook`
          : undefined,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pagamento/sucesso`,
          pending: `${process.env.FRONTEND_URL}/pagamento/pendente`,
          failure: `${process.env.FRONTEND_URL}/pagamento/falha`,
        },
        auto_return: "approved",
      },
      requestOptions: {
        idempotencyKey: uuidv4(),
      },
    });

    const createdOrder = {
      ...orderBase,
      mpPreferenceId: preference.id || null,
      checkoutUrl: preference.init_point || null,
      checkoutSandboxUrl: preference.sandbox_init_point || null,
    };

    saveOrderAndCampaignStatus(createdOrder);

    return res.json({
      orderId: createdOrder.id,
      preferenceId: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    });
  } catch (error) {
    console.error("Erro ao criar Checkout Pro:", error);
    return res.status(500).json({
      error: "Falha ao criar Checkout Pro.",
      detail: error?.message || "Erro interno.",
    });
  }
});

/**
 * ORDER STATUS
 */
app.get("/api/orders/:orderId/status", (req, res) => {
  const orders = readOrders();
  const order = orders.find((o) => o.id === req.params.orderId);

  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }

  return res.json({
    id: order.id,
    status: order.status,
    statusDetail: order.statusDetail,
    approvedAt: order.approvedAt,
    mpPaymentId: order.mpPaymentId,
  });
});

/**
 * WEBHOOK
 */
app.post("/api/webhook", async (req, res) => {
  try {
    const body = req.body || {};
    console.log("Webhook recebido:", JSON.stringify(body));

    const paymentId =
      body?.data?.id ||
      body?.resource?.id ||
      req.query["data.id"] ||
      req.query.id;

    const type =
      body?.type ||
      body?.topic ||
      req.query.type ||
      req.query.topic;

    if (!paymentId || (type !== "payment" && type !== "merchant_order")) {
      return res.sendStatus(200);
    }

    const payment = await paymentClient.get({ id: String(paymentId) });

    if (payment && isPaidStatus(payment.status)) {
      await markOrderPaidFromPayment(payment);
      console.log("Pagamento aprovado:", payment.id, payment.external_reference);
    } else {
      console.log("Pagamento ainda não aprovado:", paymentId, payment?.status);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.sendStatus(200);
  }
});

/**
 * OPTIONAL: RETURN PAGES
 */
app.get("/pagamento/sucesso", (_req, res) => {
  if (fs.existsSync(frontendDist)) {
    return res.sendFile(path.join(frontendDist, "index.html"));
  }
  return res.send("Pagamento aprovado.");
});

app.get("/pagamento/pendente", (_req, res) => {
  if (fs.existsSync(frontendDist)) {
    return res.sendFile(path.join(frontendDist, "index.html"));
  }
  return res.send("Pagamento pendente.");
});

app.get("/pagamento/falha", (_req, res) => {
  if (fs.existsSync(frontendDist)) {
    return res.sendFile(path.join(frontendDist, "index.html"));
  }
  return res.send("Pagamento não concluído.");
});

/**
 * SPA FALLBACK
 */
if (fs.existsSync(frontendDist)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
