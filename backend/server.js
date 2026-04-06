const express = require("express");
const cors = require("cors");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const multer = require("multer");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3001;

/**
 * =========================================================
 * CONFIG
 * =========================================================
 */
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY || "";
const PAGARME_API_URL = "https://api.pagar.me/core/v5";
const PAGARME_DEFAULT_DOCUMENT = process.env.PAGARME_DEFAULT_DOCUMENT || "";
const PAGARME_DEFAULT_EMAIL =
  process.env.PAGARME_DEFAULT_EMAIL || "pagamento@casapremiada.com";

const PIX_KEY = process.env.PIX_KEY || "SEU_PIX_AQUI";
const PIX_MERCHANT_NAME =
  process.env.PIX_MERCHANT_NAME || "46.573.111 RAILANNY SILVA";
const PIX_MERCHANT_CITY =
  process.env.PIX_MERCHANT_CITY || "RIBEIRAO PRETO";
const PIX_DESCRIPTION =
  process.env.PIX_DESCRIPTION || "Pagamento Sorteio";
const RESERVATION_EXPIRES_MINUTES = Number(
  process.env.RESERVATION_EXPIRES_MINUTES || 15
);

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

/**
 * =========================================================
 * APP MIDDLEWARE
 * =========================================================
 */
app.use(
  cors({
    origin: FRONTEND_URL === "*" ? true : FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

/**
 * =========================================================
 * STARTUP FILES
 * =========================================================
 */
ensureFoldersAndDb();

/**
 * =========================================================
 * MULTER
 * =========================================================
 */
const storage = multer.diskStorage({
  destination: async (_, __, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeName = slugify(path.basename(file.originalname || "imagem", ext));
    cb(null, `${Date.now()}-${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */
function pagarmeBasicAuth() {
  return "Basic " + Buffer.from(`${PAGARME_SECRET_KEY}:`).toString("base64");
}

function normalizeDocument(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 14);
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getPhonePartsForPagarme(phoneDigits = "") {
  const digits = normalizePhone(phoneDigits);

  if (digits.length < 10) {
    return {
      country_code: "55",
      area_code: "",
      number: "",
    };
  }

  let local = digits;
  if (digits.startsWith("55") && digits.length >= 12) {
    local = digits.slice(2);
  }

  return {
    country_code: "55",
    area_code: local.slice(0, 2),
    number: local.slice(2),
  };
}

function getCustomerDocument(req) {
  return normalizeDocument(
    req.body.document ||
      req.body.cpf ||
      req.body.cnpj ||
      PAGARME_DEFAULT_DOCUMENT
  );
}

function getCustomerEmail(req, whatsapp) {
  const explicitEmail = normalizeEmail(req.body.email || "");
  if (explicitEmail) return explicitEmail;

  const digits = normalizePhone(whatsapp);
  if (digits) return `cliente${digits}@casapremiada.local`;

  return PAGARME_DEFAULT_EMAIL;
}

function getCustomerTypeFromDocument(document) {
  if (String(document).length === 14) return "company";
  return "individual";
}

function ensureFoldersAndDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  if (!fs.existsSync(DB_FILE)) {
    const initialDb = {
      sorteios: [],
      clientes: [],
      reservas: [],
      pagamentos: [],
      configuracoes: {
        companyName: "Casa Premiada Ribeirão",
        logoUrl: "",
        whatsapp: "",
      },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf-8");
  }
}

async function readDb() {
  const raw = await fsp.readFile(DB_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function nowIso() {
  return new Date().toISOString();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-6)}`;
}

function slugify(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function normalizePhone(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 13);
}

function normalizeName(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function toMoneyNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

function absoluteFileUrl(fileName) {
  if (!fileName) return "";
  if (/^https?:\/\//i.test(fileName)) return fileName;
  const clean = String(fileName).replace(/^\/+/, "");
  return `${BASE_URL}/${clean}`;
}

function sanitizeReservedNumbers(numbers) {
  if (!Array.isArray(numbers)) return [];
  return [...new Set(numbers.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

function parseNumbersAdvanced(input = "") {
  const source = String(input || "").trim();
  if (!source) return [];

  const result = new Set();

  source
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((part) => {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map((n) => Number(String(n).trim()));
        if (
          Number.isInteger(start) &&
          Number.isInteger(end) &&
          start > 0 &&
          end >= start
        ) {
          for (let i = start; i <= end; i += 1) result.add(i);
        }
      } else {
        const n = Number(part);
        if (Number.isInteger(n) && n > 0) result.add(n);
      }
    });

  return [...result].sort((a, b) => a - b);
}

function compactNumbers(numbers = []) {
  const arr = [...new Set(numbers.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort(
    (a, b) => a - b
  );

  if (!arr.length) return "";

  const ranges = [];
  let start = arr[0];
  let prev = arr[0];

  for (let i = 1; i < arr.length; i += 1) {
    const current = arr[i];

    if (current === prev + 1) {
      prev = current;
      continue;
    }

    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }

  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);

  return ranges.join(", ");
}

function inferReservaOrigin(reserva) {
  if (reserva.origem) return reserva.origem;
  const lower = String(reserva.nome || "").toLowerCase();

  if (lower.includes("mãe") || lower.includes("mae")) return "mae";
  if (lower.includes("pai")) return "pai";
  if (lower.includes("vó") || lower.includes("vo")) return "vo";
  if (lower.includes("site")) return "site";
  return "manual";
}

function inferReservaBlock(reserva) {
  if (typeof reserva.bloco === "boolean") return reserva.bloco;
  const lower = String(reserva.nome || "").toLowerCase();
  return lower.includes("vendas externas");
}

function migrateDb(db) {
  if (!Array.isArray(db.sorteios)) db.sorteios = [];
  if (!Array.isArray(db.clientes)) db.clientes = [];
  if (!Array.isArray(db.reservas)) db.reservas = [];
  if (!Array.isArray(db.pagamentos)) db.pagamentos = [];
  if (!db.configuracoes || typeof db.configuracoes !== "object") {
    db.configuracoes = {
      companyName: "Casa Premiada Ribeirão",
      logoUrl: "",
      whatsapp: "",
    };
  }

  db.reservas = db.reservas.map((reserva) => ({
    ...reserva,
    origem: inferReservaOrigin(reserva),
    bloco: inferReservaBlock(reserva),
    observacao: reserva.observacao || "",
    numerosTexto: reserva.numerosTexto || compactNumbers(reserva.numeros || []),
    updatedAt: reserva.updatedAt || reserva.createdAt || nowIso(),
  }));

  db.sorteios = db.sorteios.map((sorteio) => ({
    ...sorteio,
    logoUrl:
      sorteio.logoUrl !== undefined
        ? sorteio.logoUrl
        : db.configuracoes?.logoUrl || "",
  }));

  return db;
}

function getSorteioDisplay(sorteio, db) {
  cleanupExpiredReservationsForSorteio(sorteio, db);

  const reservedNumbers = db.reservas
    .filter(
      (r) =>
        r.sorteioId === sorteio.id &&
        r.status === "reservado" &&
        !isExpired(r.expiresAt)
    )
    .flatMap((r) => r.numeros);

  const paidNumbers = db.pagamentos
    .filter((p) => p.sorteioId === sorteio.id && p.status === "pago")
    .flatMap((p) => p.numeros);

  const uniqueReserved = [...new Set(reservedNumbers.map(Number))].sort((a, b) => a - b);
  const uniquePaid = [...new Set(paidNumbers.map(Number))].sort((a, b) => a - b);

  return {
    id: sorteio.id,
    slug: sorteio.slug,
    title: sorteio.title,
    subtitle: sorteio.subtitle || "",
    descricao: sorteio.descricao || "",
    companyName:
      sorteio.companyName || db.configuracoes?.companyName || "Casa Premiada Ribeirão",
    whatsapp: sorteio.whatsapp || db.configuracoes?.whatsapp || "",
    image: sorteio.image || "",
    logoUrl: sorteio.logoUrl || db.configuracoes?.logoUrl || "",
    drawDate: sorteio.drawDate || "",
    totalNumbers: sorteio.totalNumbers,
    price: sorteio.price,
    status: sorteio.status || "ativo",
    reservedNumbers: uniqueReserved,
    paidNumbers: uniquePaid,
    soldNumbers: uniquePaid,
    createdAt: sorteio.createdAt,
    updatedAt: sorteio.updatedAt,
  };
}

function getUnavailableNumbersForSorteio(sorteioId, db, ignoreReservaId = null) {
  cleanupExpiredReservations(db);

  const reserved = db.reservas
    .filter(
      (r) =>
        r.sorteioId === sorteioId &&
        r.status === "reservado" &&
        !isExpired(r.expiresAt) &&
        (ignoreReservaId ? r.id !== ignoreReservaId : true)
    )
    .flatMap((r) => r.numeros);

  const paid = db.pagamentos
    .filter((p) => p.sorteioId === sorteioId && p.status === "pago")
    .flatMap((p) => p.numeros);

  return [...new Set([...reserved, ...paid].map(Number))];
}

function cleanupExpiredReservations(db) {
  let changed = false;

  db.reservas = db.reservas.map((reserva) => {
    if (reserva.status === "reservado" && isExpired(reserva.expiresAt)) {
      changed = true;
      return {
        ...reserva,
        status: "expirado",
        updatedAt: nowIso(),
      };
    }
    return reserva;
  });

  db.pagamentos = db.pagamentos.map((pagamento) => {
    if (
      pagamento.status === "pendente" &&
      pagamento.expiresAt &&
      isExpired(pagamento.expiresAt)
    ) {
      changed = true;
      return {
        ...pagamento,
        status: "expirado",
        updatedAt: nowIso(),
      };
    }
    return pagamento;
  });

  return changed;
}

function cleanupExpiredReservationsForSorteio(sorteio, db) {
  if (!sorteio) return false;
  let changed = false;

  db.reservas = db.reservas.map((reserva) => {
    if (
      reserva.sorteioId === sorteio.id &&
      reserva.status === "reservado" &&
      isExpired(reserva.expiresAt)
    ) {
      changed = true;
      return {
        ...reserva,
        status: "expirado",
        updatedAt: nowIso(),
      };
    }
    return reserva;
  });

  db.pagamentos = db.pagamentos.map((pagamento) => {
    if (
      pagamento.sorteioId === sorteio.id &&
      pagamento.status === "pendente" &&
      pagamento.expiresAt &&
      isExpired(pagamento.expiresAt)
    ) {
      changed = true;
      return {
        ...pagamento,
        status: "expirado",
        updatedAt: nowIso(),
      };
    }
    return pagamento;
  });

  return changed;
}

function findClienteByPhone(db, whatsapp) {
  const normalized = normalizePhone(whatsapp);
  return db.clientes.find((c) => normalizePhone(c.whatsapp) === normalized) || null;
}

function upsertCliente(db, { nome, whatsapp }) {
  const normalizedPhone = normalizePhone(whatsapp);
  const normalizedName = normalizeName(nome);

  let cliente = db.clientes.find(
    (c) => normalizePhone(c.whatsapp) === normalizedPhone
  );

  if (cliente) {
    cliente.nome = normalizedName || cliente.nome;
    cliente.whatsapp = normalizedPhone;
    cliente.updatedAt = nowIso();
    return cliente;
  }

  cliente = {
    id: generateId("cli"),
    nome: normalizedName,
    whatsapp: normalizedPhone,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.clientes.push(cliente);
  return cliente;
}

function crc16(str) {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c += 1) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emv(id, value) {
  const stringValue = String(value);
  return `${id}${String(stringValue.length).padStart(2, "0")}${stringValue}`;
}

function buildPixPayload({
  pixKey,
  description,
  merchantName,
  merchantCity,
  txid,
  amount,
}) {
  const gui = emv("00", "BR.GOV.BCB.PIX");
  const key = emv("01", pixKey);
  const desc = description ? emv("02", description.slice(0, 99)) : "";
  const merchantAccountInfo = emv("26", `${gui}${key}${desc}`);

  const payloadWithoutCrc =
    emv("00", "01") +
    emv("01", "12") +
    merchantAccountInfo +
    emv("52", "0000") +
    emv("53", "986") +
    (amount ? emv("54", Number(amount).toFixed(2)) : "") +
    emv("58", "BR") +
    emv("59", (merchantName || "RECEBEDOR").slice(0, 25)) +
    emv("60", (merchantCity || "CIDADE").slice(0, 15)) +
    emv("62", emv("05", (txid || "***").slice(0, 25))) +
    "6304";

  const crc = crc16(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}

function formatImageField(req, file, fallback = "") {
  if (file?.filename) return absoluteFileUrl(`uploads/${file.filename}`);
  if (req.body?.image) return String(req.body.image).trim();
  if (req.body?.imagem) return String(req.body.imagem).trim();
  return fallback;
}

function formatLogoField(req, file, fallback = "") {
  if (file?.filename) return absoluteFileUrl(`uploads/${file.filename}`);
  if (req.body?.logoUrl) return String(req.body.logoUrl).trim();
  if (req.body?.logo) return String(req.body.logo).trim();
  return fallback;
}

function validateNumerosForSorteio(sorteio, numeros) {
  const invalidNumbers = numeros.filter(
    (n) => n < 1 || n > Number(sorteio.totalNumbers)
  );

  if (invalidNumbers.length) {
    return `Número(s) inválido(s): ${invalidNumbers.join(", ")}`;
  }

  return "";
}

function findActiveBlockReserva(db, sorteioId, origem) {
  return (
    db.reservas.find(
      (r) =>
        r.sorteioId === sorteioId &&
        r.bloco === true &&
        r.status === "reservado" &&
        !isExpired(r.expiresAt) &&
        String(r.origem || "").toLowerCase() === String(origem || "").toLowerCase()
    ) || null
  );
}

function removeNumbersFromBlockReserva(reserva, numerosVendidos) {
  const vendidos = new Set(numerosVendidos.map(Number));
  const restantes = (reserva.numeros || []).filter((n) => !vendidos.has(Number(n)));

  reserva.numeros = restantes;
  reserva.numerosTexto = compactNumbers(restantes);
  reserva.total = toMoneyNumber(restantes.length * Number(reserva.valorNumero || 0));

  return restantes.length > 0;
}

function splitBlockIfNeeded(db, sorteio, origem, numerosVendidos) {
  if (!origem || ["site", "manual"].includes(String(origem).toLowerCase())) {
    return;
  }

  const bloco = findActiveBlockReserva(db, sorteio.id, origem);
  if (!bloco) return;

  const soldSet = new Set(numerosVendidos.map(Number));
  const intersection = (bloco.numeros || []).filter((n) => soldSet.has(Number(n)));

  if (!intersection.length) return;

  const keep = removeNumbersFromBlockReserva(bloco, intersection);
  bloco.updatedAt = nowIso();

  if (!keep) {
    db.reservas = db.reservas.filter((r) => r.id !== bloco.id);
  }
}

function createReservaRecord({
  db,
  sorteio,
  cliente,
  nome,
  whatsapp,
  numeros,
  status = "reservado",
  origem = "site",
  bloco = false,
  observacao = "",
  expiresAt = null,
}) {
  const reserva = {
    id: generateId("res"),
    sorteioId: sorteio.id,
    clienteId: cliente?.id || null,
    nome,
    whatsapp,
    numeros,
    numerosTexto: compactNumbers(numeros),
    total: toMoneyNumber(numeros.length * Number(sorteio.price || 0)),
    valorNumero: Number(sorteio.price || 0),
    status,
    origem,
    bloco,
    observacao,
    expiresAt,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.reservas.push(reserva);
  return reserva;
}

async function buildQrCodeBase64(text) {
  if (!text) return "";
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 420,
    });
  } catch {
    return "";
  }
}

async function safeFetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function mapProviderStatus(input = "") {
  const status = String(input || "").toLowerCase();

  if (
    [
      "paid",
      "captured",
      "approved",
      "succeeded",
      "success",
      "processing_paid",
    ].includes(status)
  ) {
    return "pago";
  }

  if (
    [
      "canceled",
      "cancelled",
      "failed",
      "refused",
      "expired",
      "voided",
    ].includes(status)
  ) {
    return "cancelado";
  }

  if (
    [
      "pending",
      "waiting_payment",
      "generated",
      "processing",
      "created",
    ].includes(status)
  ) {
    return "pendente";
  }

  return "pendente";
}

async function syncPagamentoStatusFromProviderData(db, pagamento, providerPayload = {}) {
  const charge = providerPayload?.charges?.[0] || providerPayload?.charge || {};
  const lastTransaction = charge?.last_transaction || {};
  const providerStatusRaw =
    lastTransaction?.status ||
    charge?.status ||
    providerPayload?.status ||
    "";

  const nextStatus = mapProviderStatus(providerStatusRaw);
  const reserva = db.reservas.find((r) => r.id === pagamento.reservaId);

  pagamento.raw = providerPayload;
  pagamento.updatedAt = nowIso();

  const providerPixCode =
    lastTransaction?.qr_code ||
    lastTransaction?.qr_code_text ||
    pagamento.pixCopiaECola ||
    "";

  if (providerPixCode && !pagamento.pixCopiaECola) {
    pagamento.pixCopiaECola = providerPixCode;
  }

  const generatedQr = await buildQrCodeBase64(providerPixCode || pagamento.pixCopiaECola);
  if (generatedQr) {
    pagamento.qrCodeBase64 = generatedQr;
  }

  if (nextStatus === "pago") {
    pagamento.status = "pago";

    if (reserva) {
      reserva.status = "pago";
      reserva.updatedAt = nowIso();

      if (
        !reserva.bloco &&
        !["site", "manual"].includes(String(reserva.origem || "").toLowerCase())
      ) {
        splitBlockIfNeeded(
          db,
          { id: reserva.sorteioId, price: reserva.valorNumero || 0 },
          reserva.origem,
          reserva.numeros || []
        );
      }
    }
  } else if (nextStatus === "cancelado") {
    pagamento.status = isExpired(pagamento.expiresAt) ? "expirado" : "cancelado";

    if (reserva && reserva.status !== "pago") {
      reserva.status = isExpired(reserva.expiresAt) ? "expirado" : "cancelado";
      reserva.updatedAt = nowIso();
    }
  } else {
    pagamento.status = isExpired(pagamento.expiresAt) ? "expirado" : "pendente";

    if (reserva && reserva.status !== "pago") {
      reserva.status = isExpired(reserva.expiresAt) ? "expirado" : "reservado";
      reserva.updatedAt = nowIso();
    }
  }
}

async function fetchAndSyncPagarmePayment(db, pagamento) {
  if (!PAGARME_SECRET_KEY) return pagamento;

  let providerPayload = null;

  if (pagamento.providerOrderId) {
    const orderRes = await safeFetchJson(
      `${PAGARME_API_URL}/orders/${encodeURIComponent(pagamento.providerOrderId)}`,
      {
        method: "GET",
        headers: {
          Authorization: pagarmeBasicAuth(),
          accept: "application/json",
        },
      }
    );

    if (orderRes.ok) {
      providerPayload = orderRes.data;
    }
  }

  if (!providerPayload && pagamento.providerChargeId) {
    const chargeRes = await safeFetchJson(
      `${PAGARME_API_URL}/charges/${encodeURIComponent(pagamento.providerChargeId)}`,
      {
        method: "GET",
        headers: {
          Authorization: pagarmeBasicAuth(),
          accept: "application/json",
        },
      }
    );

    if (chargeRes.ok) {
      providerPayload = {
        charge: chargeRes.data,
        charges: [chargeRes.data],
        status: chargeRes.data?.status || "",
      };
    }
  }

  if (providerPayload) {
    await syncPagamentoStatusFromProviderData(db, pagamento, providerPayload);
  } else {
    pagamento.updatedAt = nowIso();
    if (isExpired(pagamento.expiresAt) && pagamento.status === "pendente") {
      pagamento.status = "expirado";
      const reserva = db.reservas.find((r) => r.id === pagamento.reservaId);
      if (reserva && reserva.status !== "pago") {
        reserva.status = "expirado";
        reserva.updatedAt = nowIso();
      }
    }
  }

  return pagamento;
}

/**
 * =========================================================
 * HEALTH
 * =========================================================
 */
app.get("/api/health", async (_, res) => {
  res.json({
    ok: true,
    message: "Servidor rodando",
    time: nowIso(),
  });
});

/**
 * =========================================================
 * CONFIGURAÇÕES GERAIS
 * =========================================================
 */
app.get("/api/configuracoes", async (_, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);
    await writeDb(db);
    res.json(db.configuracoes || {});
  } catch {
    res.status(500).json({ error: "Erro ao carregar configurações." });
  }
});

app.put(
  "/api/configuracoes",
  upload.single("logo"),
  async (req, res) => {
    try {
      let db = await readDb();
      db = migrateDb(db);

      db.configuracoes = {
        ...(db.configuracoes || {}),
        companyName:
          req.body.companyName?.trim() ||
          req.body.empresa?.trim() ||
          db.configuracoes.companyName ||
          "Casa Premiada Ribeirão",
        whatsapp:
          normalizePhone(req.body.whatsapp || req.body.telefone || "") ||
          db.configuracoes.whatsapp ||
          "",
        logoUrl: formatLogoField(req, req.file, db.configuracoes.logoUrl || ""),
      };

      await writeDb(db);

      res.json({
        success: true,
        configuracoes: db.configuracoes,
      });
    } catch {
      res.status(500).json({ error: "Erro ao salvar configurações." });
    }
  }
);

/**
 * =========================================================
 * SORTEIOS
 * =========================================================
 */
app.get("/api/sorteios", async (_, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const changed = cleanupExpiredReservations(db);
    if (changed) await writeDb(db);

    const sorteios = db.sorteios
      .map((s) => getSorteioDisplay(s, db))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(sorteios);
  } catch {
    res.status(500).json({ error: "Erro ao listar sorteios." });
  }
});

app.get("/api/sorteios/:slug", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { slug } = req.params;
    const sorteio = db.sorteios.find((s) => s.slug === slug || s.id === slug);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const changed = cleanupExpiredReservationsForSorteio(sorteio, db);
    if (changed) await writeDb(db);

    res.json(getSorteioDisplay(sorteio, db));
  } catch {
    res.status(500).json({ error: "Erro ao carregar sorteio." });
  }
});

app.post(
  "/api/sorteios",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      let db = await readDb();
      db = migrateDb(db);

      const imageFile = req.files?.image?.[0] || null;
      const logoFile = req.files?.logo?.[0] || null;

      const title = String(req.body.title || req.body.titulo || "").trim();
      const subtitle = String(req.body.subtitle || req.body.subtitulo || "").trim();
      const descricao = String(req.body.descricao || "").trim();
      const companyName =
        String(req.body.companyName || req.body.empresa || "").trim() ||
        db.configuracoes?.companyName ||
        "Casa Premiada Ribeirão";

      const whatsapp =
        normalizePhone(req.body.whatsapp || req.body.telefone || "") ||
        db.configuracoes?.whatsapp ||
        "";

      const totalNumbers = Number(
        req.body.totalNumbers || req.body.quantidadeNumeros || 100
      );
      const price = toMoneyNumber(req.body.price || req.body.valor || 0);
      const drawDate = String(req.body.drawDate || req.body.dataSorteio || "").trim();

      if (!title) {
        return res.status(400).json({ error: "Título é obrigatório." });
      }

      if (!Number.isInteger(totalNumbers) || totalNumbers <= 0) {
        return res.status(400).json({ error: "Quantidade de números inválida." });
      }

      if (price <= 0) {
        return res.status(400).json({ error: "Valor inválido." });
      }

      let slug = slugify(req.body.slug || title);
      if (!slug) slug = generateId("sorteio");

      const slugAlreadyExists = db.sorteios.some((s) => s.slug === slug);
      if (slugAlreadyExists) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }

      const sorteio = {
        id: generateId("sort"),
        slug,
        title,
        subtitle,
        descricao,
        companyName,
        whatsapp,
        image: formatImageField(req, imageFile, ""),
        logoUrl: formatLogoField(req, logoFile, db.configuracoes?.logoUrl || ""),
        totalNumbers,
        price,
        drawDate,
        status: String(req.body.status || "ativo").trim() || "ativo",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      db.sorteios.push(sorteio);

      const criarBloco = (inicio, fim, origem, nomeBloco) => {
        if (inicio > sorteio.totalNumbers) return;

        const limiteFinal = Math.min(fim, sorteio.totalNumbers);
        const numeros = [];
        for (let i = inicio; i <= limiteFinal; i += 1) {
          numeros.push(i);
        }

        if (!numeros.length) return;

        db.reservas.push({
          id: generateId("res"),
          sorteioId: sorteio.id,
          clienteId: null,
          nome: nomeBloco,
          whatsapp: "",
          numeros,
          numerosTexto: `${inicio}-${limiteFinal}`,
          total: 0,
          valorNumero: sorteio.price,
          status: "reservado",
          origem,
          bloco: true,
          observacao: "BLOCO AUTOMÁTICO",
          expiresAt: addMinutes(new Date(), 60 * 24 * 365).toISOString(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      };

      // Esses blocos também ficam indisponíveis no site público.
      criarBloco(151, 300, "mae", "Vendas externas mãe");
      criarBloco(301, 450, "pai", "Vendas externas pai");
      criarBloco(451, 550, "vo", "Vendas externas vó");

      await writeDb(db);

      res.status(201).json({
        success: true,
        sorteio: getSorteioDisplay(sorteio, db),
        publicUrl: `${req.protocol}://${req.get("host")}/sorteio/${sorteio.slug}`,
      });
    } catch {
      res.status(500).json({ error: "Erro ao criar sorteio." });
    }
  }
);

app.put(
  "/api/sorteios/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      let db = await readDb();
      db = migrateDb(db);

      const { id } = req.params;

      const sorteio = db.sorteios.find((s) => s.id === id || s.slug === id);

      if (!sorteio) {
        return res.status(404).json({ error: "Sorteio não encontrado." });
      }

      const imageFile = req.files?.image?.[0] || null;
      const logoFile = req.files?.logo?.[0] || null;

      const nextTitle =
        req.body.title !== undefined || req.body.titulo !== undefined
          ? String(req.body.title || req.body.titulo || "").trim()
          : sorteio.title;

      const nextSlugInput =
        req.body.slug !== undefined ? String(req.body.slug || "").trim() : sorteio.slug;

      const nextSlugBase = slugify(nextSlugInput || nextTitle || sorteio.title);
      let nextSlug = nextSlugBase || sorteio.slug;

      if (
        nextSlug !== sorteio.slug &&
        db.sorteios.some((s) => s.slug === nextSlug && s.id !== sorteio.id)
      ) {
        nextSlug = `${nextSlug}-${Date.now().toString().slice(-4)}`;
      }

      sorteio.title = nextTitle || sorteio.title;
      sorteio.subtitle =
        req.body.subtitle !== undefined || req.body.subtitulo !== undefined
          ? String(req.body.subtitle || req.body.subtitulo || "").trim()
          : sorteio.subtitle || "";

      sorteio.descricao =
        req.body.descricao !== undefined
          ? String(req.body.descricao || "").trim()
          : sorteio.descricao || "";

      sorteio.companyName =
        req.body.companyName !== undefined || req.body.empresa !== undefined
          ? String(req.body.companyName || req.body.empresa || "").trim() ||
            sorteio.companyName
          : sorteio.companyName;

      sorteio.whatsapp =
        req.body.whatsapp !== undefined || req.body.telefone !== undefined
          ? normalizePhone(req.body.whatsapp || req.body.telefone || "") ||
            sorteio.whatsapp
          : sorteio.whatsapp;

      sorteio.totalNumbers =
        req.body.totalNumbers !== undefined ||
        req.body.quantidadeNumeros !== undefined
          ? Number(req.body.totalNumbers || req.body.quantidadeNumeros || sorteio.totalNumbers)
          : sorteio.totalNumbers;

      sorteio.price =
        req.body.price !== undefined || req.body.valor !== undefined
          ? toMoneyNumber(req.body.price || req.body.valor || sorteio.price)
          : sorteio.price;

      sorteio.drawDate =
        req.body.drawDate !== undefined || req.body.dataSorteio !== undefined
          ? String(req.body.drawDate || req.body.dataSorteio || "").trim()
          : sorteio.drawDate;

      sorteio.status =
        req.body.status !== undefined
          ? String(req.body.status || "ativo").trim()
          : sorteio.status || "ativo";

      sorteio.slug = nextSlug;
      sorteio.image = formatImageField(req, imageFile, sorteio.image || "");
      sorteio.logoUrl = formatLogoField(req, logoFile, sorteio.logoUrl || "");
      sorteio.updatedAt = nowIso();

      await writeDb(db);

      res.json({
        success: true,
        sorteio: getSorteioDisplay(sorteio, db),
      });
    } catch {
      res.status(500).json({ error: "Erro ao atualizar sorteio." });
    }
  }
);

app.delete("/api/sorteios/:id", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { id } = req.params;

    const sorteio = db.sorteios.find((s) => s.id === id || s.slug === id);
    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    db.sorteios = db.sorteios.filter((s) => s.id !== sorteio.id);
    db.reservas = db.reservas.filter((r) => r.sorteioId !== sorteio.id);
    db.pagamentos = db.pagamentos.filter((p) => p.sorteioId !== sorteio.id);

    await writeDb(db);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao excluir sorteio." });
  }
});

/**
 * =========================================================
 * CLIENTES
 * =========================================================
 */
app.get("/api/clientes/buscar", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const whatsapp = normalizePhone(req.query.whatsapp || "");

    if (!whatsapp) {
      return res.status(400).json({ error: "WhatsApp é obrigatório." });
    }

    const cliente = findClienteByPhone(db, whatsapp);

    if (!cliente) {
      return res.json({ cliente: null });
    }

    res.json({ cliente });
  } catch {
    res.status(500).json({ error: "Erro ao buscar cliente." });
  }
});

/**
 * =========================================================
 * RESERVAS
 * =========================================================
 */
app.post("/api/reservas", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const slug = String(req.body.slug || "").trim();
    const nome = normalizeName(req.body.nome || "");
    const whatsapp = normalizePhone(req.body.whatsapp || "");
    const numeros = sanitizeReservedNumbers(req.body.numeros);
    const origem = String(req.body.origem || "site").trim() || "site";
    const bloco = Boolean(req.body.bloco);
    const observacao = String(req.body.observacao || "").trim();

    if (!slug) {
      return res.status(400).json({ error: "Slug do sorteio é obrigatório." });
    }

    if (!nome) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (whatsapp.length < 10) {
      return res.status(400).json({ error: "WhatsApp inválido." });
    }

    if (!numeros.length) {
      return res.status(400).json({ error: "Escolha ao menos um número." });
    }

    const sorteio = db.sorteios.find((s) => s.slug === slug || s.id === slug);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    if (sorteio.status && sorteio.status !== "ativo") {
      return res.status(400).json({ error: "Este sorteio não está disponível." });
    }

    const invalidMessage = validateNumerosForSorteio(sorteio, numeros);
    if (invalidMessage) {
      return res.status(400).json({ error: invalidMessage });
    }

    cleanupExpiredReservations(db);

    const unavailable = getUnavailableNumbersForSorteio(sorteio.id, db);
    const conflicts = numeros.filter((n) => unavailable.includes(n));

    if (conflicts.length) {
      return res.status(409).json({
        error: `Os números ${conflicts.join(", ")} não estão mais disponíveis.`,
        conflicts,
      });
    }

    const cliente = upsertCliente(db, { nome, whatsapp });

    const expiresAt = bloco
      ? addMinutes(new Date(), 60 * 24 * 365).toISOString()
      : addMinutes(new Date(), RESERVATION_EXPIRES_MINUTES).toISOString();

    const reserva = createReservaRecord({
      db,
      sorteio,
      cliente,
      nome,
      whatsapp,
      numeros,
      status: "reservado",
      origem,
      bloco,
      observacao,
      expiresAt,
    });

    await writeDb(db);

    res.status(201).json({
      success: true,
      reservaId: reserva.id,
      status: reserva.status,
      expiresAt: reserva.expiresAt,
      numeros: reserva.numeros,
      total: reserva.total,
      cliente: {
        nome: cliente.nome,
        whatsapp: cliente.whatsapp,
      },
    });
  } catch {
    res.status(500).json({ error: "Erro ao reservar números." });
  }
});

/**
 * =========================================================
 * PIX AUTOMÁTICO PAGAR.ME
 * =========================================================
 */
app.post("/api/pix", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    if (!PAGARME_SECRET_KEY) {
      return res.status(500).json({ error: "PAGARME_SECRET_KEY não configurada." });
    }

    const slug = String(req.body.slug || req.body.sorteioId || "").trim();
    const nome = normalizeName(req.body.nome || "");
    const whatsapp = normalizePhone(req.body.whatsapp || "");
    const numeros = sanitizeReservedNumbers(req.body.numeros || []);
    const document = getCustomerDocument(req);
    const email = getCustomerEmail(req, whatsapp);

    if (!slug) {
      return res.status(400).json({ error: "Slug do sorteio é obrigatório." });
    }

    if (!nome) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (whatsapp.length < 10) {
      return res.status(400).json({ error: "WhatsApp inválido." });
    }

    if (!numeros.length) {
      return res.status(400).json({ error: "Escolha ao menos um número." });
    }

    if (![11, 14].includes(String(document).length)) {
      return res.status(400).json({
        error: "CPF/CNPJ obrigatório para gerar PIX no Pagar.me.",
      });
    }

    const sorteio = db.sorteios.find((s) => s.slug === slug || s.id === slug);
    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    if (sorteio.status && sorteio.status !== "ativo") {
      return res.status(400).json({ error: "Este sorteio não está disponível." });
    }

    const invalidMessage = validateNumerosForSorteio(sorteio, numeros);
    if (invalidMessage) {
      return res.status(400).json({ error: invalidMessage });
    }

    cleanupExpiredReservations(db);

    const unavailable = getUnavailableNumbersForSorteio(sorteio.id, db);
    const conflicts = numeros.filter((n) => unavailable.includes(n));

    if (conflicts.length) {
      return res.status(409).json({
        error: `Os números ${conflicts.join(", ")} não estão mais disponíveis.`,
        conflicts,
      });
    }

    const cliente = upsertCliente(db, { nome, whatsapp });

    const expiresAt = addMinutes(
      new Date(),
      RESERVATION_EXPIRES_MINUTES
    ).toISOString();

    const reserva = createReservaRecord({
      db,
      sorteio,
      cliente,
      nome,
      whatsapp,
      numeros,
      status: "reservado",
      origem: "site",
      bloco: false,
      observacao: "",
      expiresAt,
    });

    const phoneParts = getPhonePartsForPagarme(whatsapp);
    const amount = Math.round(Number(reserva.total || 0) * 100);

    const orderBody = {
      items: [
        {
          amount,
          description: `Compra de números - ${sorteio.title}`,
          quantity: 1,
          code: reserva.id,
        },
      ],
      customer: {
        name: nome,
        email,
        document,
        type: getCustomerTypeFromDocument(document),
        phones: {
          mobile_phone: {
            country_code: phoneParts.country_code,
            area_code: phoneParts.area_code,
            number: phoneParts.number,
          },
        },
      },
      payments: [
        {
          payment_method: "pix",
          pix: {
            expires_in: RESERVATION_EXPIRES_MINUTES * 60,
            additional_information: [
              { name: "Sorteio", value: sorteio.title },
              { name: "Números", value: numeros.join(", ") },
            ],
          },
        },
      ],
      metadata: {
        reserva_id: reserva.id,
        sorteio_id: sorteio.id,
        sorteio_slug: sorteio.slug,
        numeros: numeros.join(","),
      },
    };

    const pagarmeRes = await safeFetchJson(`${PAGARME_API_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: pagarmeBasicAuth(),
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    const pagarmeData = pagarmeRes.data;

    if (!pagarmeRes.ok) {
      db.reservas = db.reservas.filter((r) => r.id !== reserva.id);
      await writeDb(db);

      return res.status(500).json({
        error: pagarmeData?.message || "Erro ao criar cobrança PIX no Pagar.me.",
        details: pagarmeData,
      });
    }

    const charge = pagarmeData?.charges?.[0] || {};
    const lastTransaction = charge?.last_transaction || {};

    const pixCode =
      lastTransaction?.qr_code ||
      lastTransaction?.qr_code_text ||
      "";

    const qrCodeBase64 = await buildQrCodeBase64(pixCode);

    const pagamento = {
      id: generateId("pag"),
      reservaId: reserva.id,
      sorteioId: sorteio.id,
      clienteId: cliente.id,
      nome,
      whatsapp,
      numeros,
      valor: reserva.total,
      forma: "pix",
      provider: "pagarme",
      providerOrderId: pagarmeData?.id || "",
      providerChargeId: charge?.id || "",
      providerTransactionId: lastTransaction?.id || "",
      pixCopiaECola: pixCode,
      qrCodeBase64,
      status: "pendente",
      raw: pagarmeData,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      expiresAt: reserva.expiresAt,
    };

    db.pagamentos.push(pagamento);
    await writeDb(db);

    return res.status(201).json({
      success: true,
      reservaId: reserva.id,
      pagamentoId: pagamento.id,
      paymentId: pagamento.id,
      pixId: pagamento.id,
      status: pagamento.status,
      pixCopiaECola: pagamento.pixCopiaECola,
      pixCode: pagamento.pixCopiaECola,
      copiaecola: pagamento.pixCopiaECola,
      qrCodeBase64: pagamento.qrCodeBase64,
      expirationDate: pagamento.expiresAt,
      expiresAt: pagamento.expiresAt,
      expiresInSeconds: RESERVATION_EXPIRES_MINUTES * 60,
      total: pagamento.valor,
      providerOrderId: pagamento.providerOrderId,
    });
  } catch (err) {
    console.error("Erro /api/pix:", err);
    return res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

/**
 * =========================================================
 * STATUS DO PIX / APROVAÇÃO AUTOMÁTICA
 * =========================================================
 */
app.get("/api/pix/status/:paymentId", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { paymentId } = req.params;

    const pagamento = db.pagamentos.find(
      (p) =>
        p.id === paymentId ||
        p.providerOrderId === paymentId ||
        p.providerChargeId === paymentId ||
        p.providerTransactionId === paymentId
    );

    if (!pagamento) {
      return res.status(404).json({ error: "Pagamento não encontrado." });
    }

    cleanupExpiredReservations(db);

    if (pagamento.status !== "pago" && pagamento.provider === "pagarme") {
      await fetchAndSyncPagarmePayment(db, pagamento);
    }

    if (pagamento.status === "pendente" && pagamento.expiresAt && isExpired(pagamento.expiresAt)) {
      pagamento.status = "expirado";
      pagamento.updatedAt = nowIso();

      const reserva = db.reservas.find((r) => r.id === pagamento.reservaId);
      if (reserva && reserva.status !== "pago") {
        reserva.status = "expirado";
        reserva.updatedAt = nowIso();
      }
    }

    await writeDb(db);

    const publicStatus =
      pagamento.status === "pago"
        ? "paid"
        : pagamento.status === "expirado"
        ? "expired"
        : pagamento.status === "cancelado"
        ? "cancelled"
        : "pending";

    return res.json({
      success: true,
      paymentId: pagamento.id,
      status: publicStatus,
      paymentStatus: publicStatus,
      pixStatus: publicStatus,
      reservaId: pagamento.reservaId,
      expiresAt: pagamento.expiresAt || null,
      total: pagamento.valor,
      numeros: pagamento.numeros || [],
      paid: publicStatus === "paid",
    });
  } catch (err) {
    console.error("Erro /api/pix/status/:paymentId:", err);
    return res.status(500).json({ error: "Erro ao consultar status do PIX." });
  }
});

/**
 * =========================================================
 * WEBHOOK PAGAR.ME
 * =========================================================
 */
app.post("/api/webhooks/pagarme", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const event = req.body;
    const eventType = event?.type || "";
    const data = event?.data || {};

    if (
      ![
        "order.paid",
        "charge.paid",
        "charge.processing",
        "charge.pending",
        "charge.canceled",
        "charge.failed",
        "order.canceled",
      ].includes(eventType)
    ) {
      return res.status(200).json({ received: true, ignored: true });
    }

    let providerOrderId = "";
    let providerChargeId = "";
    let providerPayload = null;

    if (eventType.startsWith("order.")) {
      providerOrderId = data?.id || "";
      providerChargeId = data?.charges?.[0]?.id || "";
      providerPayload = data;
    }

    if (eventType.startsWith("charge.")) {
      providerChargeId = data?.id || "";
      providerOrderId = data?.order?.id || "";
      providerPayload = {
        charge: data,
        charges: [data],
        status: data?.status || "",
      };
    }

    const pagamento = db.pagamentos.find(
      (p) =>
        (providerOrderId && p.providerOrderId === providerOrderId) ||
        (providerChargeId && p.providerChargeId === providerChargeId)
    );

    if (!pagamento) {
      return res.status(200).json({ received: true, matched: false });
    }

    await syncPagamentoStatusFromProviderData(db, pagamento, providerPayload || {});
    pagamento.webhookPayload = event;
    pagamento.updatedAt = nowIso();

    await writeDb(db);

    return res.status(200).json({ received: true, matched: true });
  } catch (error) {
    console.error("Webhook Pagar.me:", error);
    return res.status(500).json({ error: "Erro no webhook Pagar.me." });
  }
});

/**
 * =========================================================
 * CONFIRMAÇÃO MANUAL DE PAGAMENTO
 * =========================================================
 */
app.post("/api/pagamentos/:id/confirmar", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { id } = req.params;

    const pagamento = db.pagamentos.find((p) => p.id === id);
    if (!pagamento) {
      return res.status(404).json({ error: "Pagamento não encontrado." });
    }

    pagamento.status = "pago";
    pagamento.updatedAt = nowIso();

    const reserva = db.reservas.find((r) => r.id === pagamento.reservaId);
    if (reserva) {
      reserva.status = "pago";
      reserva.updatedAt = nowIso();

      if (!reserva.bloco && !["site", "manual"].includes(String(reserva.origem || "").toLowerCase())) {
        splitBlockIfNeeded(
          db,
          { id: reserva.sorteioId, price: reserva.valorNumero || 0 },
          reserva.origem,
          reserva.numeros || []
        );
      }
    }

    await writeDb(db);

    res.json({
      success: true,
      pagamento,
    });
  } catch {
    res.status(500).json({ error: "Erro ao confirmar pagamento." });
  }
});

/**
 * =========================================================
 * ADMIN / RESUMO
 * =========================================================
 */
app.get("/api/admin/sorteios/:id/resumo", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { id } = req.params;

    const sorteio = db.sorteios.find((s) => s.id === id || s.slug === id);
    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    cleanupExpiredReservations(db);
    await writeDb(db);

    const reservas = db.reservas.filter((r) => r.sorteioId === sorteio.id);
    const pagamentos = db.pagamentos.filter((p) => p.sorteioId === sorteio.id);

    const pagos = pagamentos.filter((p) => p.status === "pago");
    const pendentes = pagamentos.filter((p) => p.status === "pendente");
    const reservadosAtivos = reservas.filter(
      (r) => r.status === "reservado" && !isExpired(r.expiresAt)
    );

    const numerosPagos = [...new Set(pagos.flatMap((p) => p.numeros))];
    const numerosReservados = [...new Set(reservadosAtivos.flatMap((r) => r.numeros))];

    const arrecadado = pagos.reduce((acc, p) => acc + Number(p.valor || 0), 0);

    res.json({
      sorteio: getSorteioDisplay(sorteio, db),
      metricas: {
        totalNumeros: sorteio.totalNumbers,
        vendidos: numerosPagos.length,
        reservados: numerosReservados.length,
        disponiveis:
          Number(sorteio.totalNumbers) -
          [...new Set([...numerosPagos, ...numerosReservados])].length,
        arrecadado: Number(arrecadado.toFixed(2)),
        pagamentosPendentes: pendentes.length,
        pagamentosPagos: pagos.length,
      },
      participantes: [...reservas]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((r) => ({
          id: r.id,
          nome: r.nome,
          whatsapp: r.whatsapp,
          numeros: r.numeros,
          numerosTexto: r.numerosTexto || compactNumbers(r.numeros || []),
          total: r.total,
          status: r.status,
          origem: r.origem || "site",
          bloco: Boolean(r.bloco),
          observacao: r.observacao || "",
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
        })),
    });
  } catch {
    res.status(500).json({ error: "Erro ao carregar resumo do sorteio." });
  }
});

/**
 * =========================================================
 * LISTAGEM DE PAGAMENTOS
 * =========================================================
 */
app.get("/api/pagamentos", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const sorteioId = String(req.query.sorteioId || "").trim();

    let pagamentos = db.pagamentos;

    if (sorteioId) {
      const sorteio = db.sorteios.find((s) => s.id === sorteioId || s.slug === sorteioId);
      if (!sorteio) {
        return res.status(404).json({ error: "Sorteio não encontrado." });
      }
      pagamentos = pagamentos.filter((p) => p.sorteioId === sorteio.id);
    }

    pagamentos = pagamentos.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(pagamentos);
  } catch {
    res.status(500).json({ error: "Erro ao listar pagamentos." });
  }
});

/**
 * =========================================================
 * EXPORTAÇÃO / LISTA PARTICIPANTES
 * =========================================================
 */
app.get("/api/admin/sorteios/:id/participantes", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { id } = req.params;

    const sorteio = db.sorteios.find((s) => s.id === id || s.slug === id);
    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    cleanupExpiredReservations(db);
    await writeDb(db);

    const reservas = db.reservas
      .filter((r) => r.sorteioId === sorteio.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(
      reservas.map((r) => ({
        id: r.id,
        nome: r.nome,
        whatsapp: r.whatsapp,
        numeros: r.numeros,
        numerosTexto: r.numerosTexto || compactNumbers(r.numeros || []),
        total: r.total,
        status: r.status,
        origem: r.origem || "site",
        bloco: Boolean(r.bloco),
        observacao: r.observacao || "",
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      }))
    );
  } catch {
    res.status(500).json({ error: "Erro ao carregar participantes." });
  }
});

/**
 * =========================================================
 * ADMIN / PARTICIPANTE MANUAL COM BLOCOS
 * =========================================================
 */
app.post("/api/admin/sorteios/:id/participantes/manual", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { id } = req.params;

    const sorteio = db.sorteios.find((s) => s.id === id || s.slug === id);
    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const nome = normalizeName(req.body.nome || "");
    const whatsapp = normalizePhone(req.body.whatsapp || req.body.telefone || "");
    const origem = String(req.body.origem || "manual").trim().toLowerCase() || "manual";
    const bloco = Boolean(req.body.bloco);
    const observacao = String(req.body.observacao || "").trim();
    const status = String(req.body.status || "reservado").trim().toLowerCase() === "pago"
      ? "pago"
      : "reservado";

    let numeros = [];
    if (Array.isArray(req.body.numeros)) {
      numeros = sanitizeReservedNumbers(req.body.numeros);
    } else {
      numeros = parseNumbersAdvanced(req.body.numeros || "");
    }

    if (!nome) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (whatsapp.length < 8) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    if (!numeros.length) {
      return res.status(400).json({ error: "Informe os números." });
    }

    const invalidMessage = validateNumerosForSorteio(sorteio, numeros);
    if (invalidMessage) {
      return res.status(400).json({ error: invalidMessage });
    }

    cleanupExpiredReservations(db);

    if (!bloco && !["site", "manual"].includes(origem)) {
      splitBlockIfNeeded(db, sorteio, origem, numeros);
    }

    const unavailable = getUnavailableNumbersForSorteio(sorteio.id, db);
    const conflicts = numeros.filter((n) => unavailable.includes(n));

    if (conflicts.length) {
      return res.status(409).json({
        error: `Os números ${conflicts.join(", ")} não estão mais disponíveis.`,
        conflicts,
      });
    }

    const cliente = upsertCliente(db, { nome, whatsapp });

    const expiresAt =
      status === "reservado"
        ? bloco
          ? addMinutes(new Date(), 60 * 24 * 365).toISOString()
          : addMinutes(new Date(), RESERVATION_EXPIRES_MINUTES).toISOString()
        : null;

    const reserva = createReservaRecord({
      db,
      sorteio,
      cliente,
      nome,
      whatsapp,
      numeros,
      status,
      origem,
      bloco,
      observacao,
      expiresAt,
    });

    if (status === "pago") {
      db.pagamentos.push({
        id: generateId("pag"),
        reservaId: reserva.id,
        sorteioId: sorteio.id,
        clienteId: cliente.id,
        nome,
        whatsapp,
        numeros,
        valor: reserva.total,
        forma: "manual",
        pixCopiaECola: "",
        qrCodeBase64: "",
        status: "pago",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        expiresAt: null,
      });
    }

    await writeDb(db);

    res.status(201).json({
      success: true,
      reserva,
    });
  } catch {
    res.status(500).json({ error: "Erro ao cadastrar participante manual." });
  }
});

app.delete("/api/admin/participantes/:id", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { id } = req.params;
    const reserva = db.reservas.find((r) => r.id === id);

    if (!reserva) {
      return res.status(404).json({ error: "Participante não encontrado." });
    }

    db.reservas = db.reservas.filter((r) => r.id !== id);
    db.pagamentos = db.pagamentos.filter((p) => p.reservaId !== id);

    await writeDb(db);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao excluir participante." });
  }
});

/**
 * =========================================================
 * MEUS NÚMEROS
 * =========================================================
 */
app.get("/api/meus-numeros/:slug", async (req, res) => {
  try {
    let db = await readDb();
    db = migrateDb(db);

    const { slug } = req.params;
    const whatsapp = normalizePhone(req.query.whatsapp || "");

    const sorteio = db.sorteios.find((s) => s.slug === slug || s.id === slug);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    if (whatsapp.length < 8) {
      return res.status(400).json({ error: "Digite seu telefone." });
    }

    const items = db.reservas.filter(
      (r) =>
        r.sorteioId === sorteio.id &&
        normalizePhone(r.whatsapp) === whatsapp &&
        r.status !== "expirado"
    );

    const numeros = [...new Set(items.flatMap((i) => i.numeros || []).map(Number))].sort(
      (a, b) => a - b
    );

    res.json({
      nome: items[0]?.nome || "",
      numeros,
    });
  } catch {
    res.status(500).json({ error: "Erro ao consultar." });
  }
});

/**
 * =========================================================
 * FALLBACK PIX ESTÁTICO OPCIONAL
 * =========================================================
 * Use somente se quiser testar sem Pagar.me:
 * defina PIX_KEY no .env e comente a validação do PAGARME_SECRET_KEY.
 */
app.post("/api/pix-estatico-teste", async (req, res) => {
  try {
    if (!PIX_KEY || PIX_KEY === "SEU_PIX_AQUI") {
      return res.status(400).json({ error: "PIX_KEY não configurada." });
    }

    const valor = toMoneyNumber(req.body.valor || 0);
    const txid = `CP${Date.now()}`;

    const pixCode = buildPixPayload({
      pixKey: PIX_KEY,
      description: PIX_DESCRIPTION,
      merchantName: PIX_MERCHANT_NAME,
      merchantCity: PIX_MERCHANT_CITY,
      txid,
      amount: valor,
    });

    const qrCodeBase64 = await buildQrCodeBase64(pixCode);

    return res.json({
      success: true,
      paymentId: txid,
      status: "pending",
      pixCopiaECola: pixCode,
      pixCode,
      qrCodeBase64,
      expiresInSeconds: RESERVATION_EXPIRES_MINUTES * 60,
      expiresAt: addMinutes(new Date(), RESERVATION_EXPIRES_MINUTES).toISOString(),
    });
  } catch {
    return res.status(500).json({ error: "Erro ao gerar PIX estático." });
  }
});

/**
 * =========================================================
 * FALLBACK
 * =========================================================
 */
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

/**
 * =========================================================
 * START
 * =========================================================
 */
app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});
