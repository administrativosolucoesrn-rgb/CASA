const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY || "";
const PAGARME_API_URL = "https://api.pagar.me/core/v5";

function pagarmeBasicAuth() {
  return "Basic " + Buffer.from(`${PAGARME_SECRET_KEY}:`).toString("base64");
}
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

const PIX_KEY = process.env.PIX_KEY || "SEU_PIX_AQUI";
const PIX_MERCHANT_NAME = process.env.PIX_MERCHANT_NAME || "CASA PREMIADA";
const PIX_MERCHANT_CITY = process.env.PIX_MERCHANT_CITY || "RIBEIRAO PRETO";
const PIX_DESCRIPTION = process.env.PIX_DESCRIPTION || "Pagamento Sorteio";
const RESERVATION_EXPIRES_MINUTES = Number(
  process.env.RESERVATION_EXPIRES_MINUTES || 30
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
      !r.bloco && // 🔥 IGNORA BLOCOS
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

// ===== CRIAR BLOCOS AUTOMÁTICOS =====
const criarBloco = (inicio, fim, origem, nomeBloco) => {
  const numeros = [];
  for (let i = inicio; i <= fim; i += 1) {
    numeros.push(i);
  }

  db.reservas.push({
  id: generateId("res"),
  sorteioId: sorteio.id,
  clienteId: null,
  nome: nomeBloco,
  whatsapp: "",
  numeros,
  numerosTexto: `${inicio}-${fim}`,
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

// SITE = 1 até 150 fica livre

criarBloco(151, 300, "mae", "Vendas externas mãe");
criarBloco(301, 450, "pai", "Vendas externas pai");
criarBloco(451, 550, "vo", "Vendas externas vó");

await writeDb(db)
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
 * PIX
 * =========================================================
 */
app.post("/api/pix", async (req, res) => {
  try {
    const db = await readDb();

    const { nome, whatsapp, numeros, sorteioId } = req.body;

    if (!nome || !whatsapp || !numeros?.length) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const sorteio = db.sorteios.find(s => s.id === sorteioId);
    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado" });
    }

    cleanupExpiredReservations(db);

    const indisponiveis = getUnavailableNumbersForSorteio(sorteioId, db);
    const conflito = numeros.find(n => indisponiveis.includes(n));

    if (conflito) {
      return res.status(409).json({ error: "Número já vendido" });
    }

    const cliente = upsertCliente(db, { nome, whatsapp });

    const reserva = {
      id: generateId("res"),
      sorteioId,
      clienteId: cliente.id,
      nome,
      whatsapp,
      numeros,
      total: numeros.length * sorteio.price,
      status: "reservado",
      createdAt: nowIso(),
      expiresAt: addMinutes(new Date(), 60).toISOString()
    };

    db.reservas.push(reserva);

    const amount = Math.round(reserva.total * 100);

    const area = whatsapp.substring(0,2);
    const numero = whatsapp.substring(2);

    const response = await fetch(`${PAGARME_API_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: pagarmeBasicAuth(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [{
          amount,
          description: `Compra de números`,
          quantity: 1,
          code: reserva.id
        }],
        customer: {
          name: nome,
          type: "individual",
          phones: {
            mobile_phone: {
              country_code: "55",
              area_code: area,
              number: numero
            }
          }
        },
        payments: [{
          payment_method: "pix",
          pix: { expires_in: 3600 }
        }],
        metadata: {
          reservaId: reserva.id
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: "Erro Pagar.me", data });
    }

    const charge = data.charges[0];
    const pix = charge.last_transaction;

    const pagamento = {
      id: generateId("pag"),
      reservaId: reserva.id,
      sorteioId,
      nome,
      whatsapp,
      numeros,
      valor: reserva.total,
      status: "pendente",
      providerOrderId: data.id,
      providerChargeId: charge.id,
      pix: pix.qr_code,
      createdAt: nowIso()
    };

    db.pagamentos.push(pagamento);

    await writeDb(db);

    res.json({
      copiaecola: pix.qr_code,
      qrCodeBase64: pix.qr_code_url,
      pagamentoId: pagamento.id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});
