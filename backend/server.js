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
const BASE_URL =
  process.env.BASE_URL || `http://localhost:${PORT}`;

const PIX_KEY = process.env.PIX_KEY || "SEU_PIX_AQUI";
const PIX_MERCHANT_NAME = process.env.PIX_MERCHANT_NAME || "CASA PREMIADA";
const PIX_MERCHANT_CITY = process.env.PIX_MERCHANT_CITY || "RIBEIRAO PRETO";
const PIX_DESCRIPTION =
  process.env.PIX_DESCRIPTION || "Pagamento Sorteio";
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
  destination: async (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
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
  return `${BASE_URL}/uploads/${fileName}`;
}

function sanitizeReservedNumbers(numbers) {
  if (!Array.isArray(numbers)) return [];
  return [...new Set(numbers.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
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
    whatsapp:
      sorteio.whatsapp || db.configuracoes?.whatsapp || "",
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

function getUnavailableNumbersForSorteio(sorteioId, db) {
  cleanupExpiredReservations(db);

  const reserved = db.reservas
    .filter(
      (r) =>
        r.sorteioId === sorteioId &&
        r.status === "reservado" &&
        !isExpired(r.expiresAt)
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
  if (file?.filename) return absoluteFileUrl(file.filename);
  if (req.body?.image) return String(req.body.image).trim();
  if (req.body?.imagem) return String(req.body.imagem).trim();
  return fallback;
}

/**
 * =========================================================
 * HEALTH
 * =========================================================
 */
app.get("/api/health", async (req, res) => {
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
app.get("/api/configuracoes", async (req, res) => {
  try {
    const db = await readDb();
    res.json(db.configuracoes || {});
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar configurações." });
  }
});

app.put("/api/configuracoes", upload.single("logo"), async (req, res) => {
  try {
    const db = await readDb();

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
      logoUrl: formatImageField(req, req.file, db.configuracoes.logoUrl || ""),
    };

    await writeDb(db);

    res.json({
      success: true,
      configuracoes: db.configuracoes,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar configurações." });
  }
});

/**
 * =========================================================
 * SORTEIOS
 * =========================================================
 */
app.get("/api/sorteios", async (req, res) => {
  try {
    const db = await readDb();

    const changed = cleanupExpiredReservations(db);
    if (changed) await writeDb(db);

    const sorteios = db.sorteios
      .map((s) => getSorteioDisplay(s, db))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(sorteios);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar sorteios." });
  }
});

app.get("/api/sorteios/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const db = await readDb();

    const sorteio = db.sorteios.find((s) => s.slug === slug || s.id === slug);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const changed = cleanupExpiredReservationsForSorteio(sorteio, db);
    if (changed) await writeDb(db);

    res.json(getSorteioDisplay(sorteio, db));
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar sorteio." });
  }
});

app.post("/api/sorteios", upload.single("image"), async (req, res) => {
  try {
    const db = await readDb();

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
      return res
        .status(400)
        .json({ error: "Quantidade de números inválida." });
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
      image: formatImageField(req, req.file, ""),
      logoUrl: String(req.body.logoUrl || "").trim() || db.configuracoes?.logoUrl || "",
      totalNumbers,
      price,
      drawDate,
      status: "ativo",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.sorteios.push(sorteio);
    await writeDb(db);

    res.status(201).json({
      success: true,
      sorteio: getSorteioDisplay(sorteio, db),
      publicUrl: `${req.protocol}://${req.get("host")}/sorteio/${sorteio.slug}`,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar sorteio." });
  }
});

app.put("/api/sorteios/:id", upload.single("image"), async (req, res) => {
  try {
    const db = await readDb();
    const { id } = req.params;

    const sorteio = db.sorteios.find((s) => s.id === id || s.slug === id);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

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
    sorteio.image = formatImageField(req, req.file, sorteio.image || "");
    sorteio.updatedAt = nowIso();

    await writeDb(db);

    res.json({
      success: true,
      sorteio: getSorteioDisplay(sorteio, db),
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar sorteio." });
  }
});

app.delete("/api/sorteios/:id", async (req, res) => {
  try {
    const db = await readDb();
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
  } catch (error) {
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
    const db = await readDb();
    const whatsapp = normalizePhone(req.query.whatsapp || "");

    if (!whatsapp) {
      return res.status(400).json({ error: "WhatsApp é obrigatório." });
    }

    const cliente = findClienteByPhone(db, whatsapp);

    if (!cliente) {
      return res.json({ cliente: null });
    }

    res.json({ cliente });
  } catch (error) {
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
    const db = await readDb();

    const slug = String(req.body.slug || "").trim();
    const nome = normalizeName(req.body.nome || "");
    const whatsapp = normalizePhone(req.body.whatsapp || "");
    const numeros = sanitizeReservedNumbers(req.body.numeros);

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

    const invalidNumbers = numeros.filter(
      (n) => n < 1 || n > Number(sorteio.totalNumbers)
    );

    if (invalidNumbers.length) {
      return res.status(400).json({
        error: `Número(s) inválido(s): ${invalidNumbers.join(", ")}`,
      });
    }

    const changed = cleanupExpiredReservations(db);
    if (changed) {
      await writeDb(db);
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

    const expiresAt = addMinutes(new Date(), RESERVATION_EXPIRES_MINUTES).toISOString();

    const reserva = {
      id: generateId("res"),
      sorteioId: sorteio.id,
      clienteId: cliente.id,
      nome,
      whatsapp,
      numeros,
      total: toMoneyNumber(numeros.length * Number(sorteio.price || 0)),
      status: "reservado",
      expiresAt,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.reservas.push(reserva);
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
  } catch (error) {
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

    const slug = String(req.body.slug || "").trim();
    const nome = normalizeName(req.body.nome || "");
    const whatsapp = normalizePhone(req.body.whatsapp || "");
    const numeros = sanitizeReservedNumbers(req.body.numeros);

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

    const invalidNumbers = numeros.filter(
      (n) => n < 1 || n > Number(sorteio.totalNumbers)
    );

    if (invalidNumbers.length) {
      return res.status(400).json({
        error: `Número(s) inválido(s): ${invalidNumbers.join(", ")}`,
      });
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

    const reserva = {
      id: generateId("res"),
      sorteioId: sorteio.id,
      clienteId: cliente.id,
      nome,
      whatsapp,
      numeros,
      total: toMoneyNumber(numeros.length * Number(sorteio.price || 0)),
      status: "reservado",
      expiresAt: addMinutes(
        new Date(),
        RESERVATION_EXPIRES_MINUTES
      ).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.reservas.push(reserva);

    const pixCode = buildPixPayload({
      pixKey: PIX_KEY,
      description: `${PIX_DESCRIPTION} ${sorteio.title}`.slice(0, 99),
      merchantName: PIX_MERCHANT_NAME,
      merchantCity: PIX_MERCHANT_CITY,
      txid: reserva.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***",
      amount: reserva.total,
    });

    const qrCodeBase64 = await QRCode.toDataURL(pixCode);

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
      pixCopiaECola: pixCode,
      qrCodeBase64,
      status: "pendente",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      expiresAt: reserva.expiresAt,
    };

    db.pagamentos.push(pagamento);
    await writeDb(db);

    res.status(201).json({
      success: true,
      reservaId: reserva.id,
      pagamentoId: pagamento.id,
      status: pagamento.status,
      pixCopiaECola: pagamento.pixCopiaECola,
      pixCode: pagamento.pixCopiaECola,
      copiaecola: pagamento.pixCopiaECola,
      qrCodeBase64: pagamento.qrCodeBase64,
      expirationDate: pagamento.expiresAt,
      total: pagamento.valor,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar Pix." });
  }
});

/**
 * =========================================================
 * CONFIRMAÇÃO MANUAL DE PAGAMENTO
 * use no admin até integrar baixa automática
 * =========================================================
 */
app.post("/api/pagamentos/:id/confirmar", async (req, res) => {
  try {
    const db = await readDb();
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
    }

    await writeDb(db);

    res.json({
      success: true,
      pagamento,
    });
  } catch (error) {
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
    const db = await readDb();
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
      participantes: [
        ...reservas.map((r) => ({
          id: r.id,
          nome: r.nome,
          whatsapp: r.whatsapp,
          numeros: r.numeros,
          total: r.total,
          status: r.status,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
        })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (error) {
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
    const db = await readDb();
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
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar pagamentos." });
  }
});

/**
 * =========================================================
 * EXPORTAÇÃO SIMPLES DOS PARTICIPANTES
 * =========================================================
 */
app.get("/api/admin/sorteios/:id/participantes", async (req, res) => {
  try {
    const db = await readDb();
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
        nome: r.nome,
        whatsapp: r.whatsapp,
        numeros: r.numeros,
        total: r.total,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar participantes." });
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
