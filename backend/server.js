const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;

/*
  =========================================
  PASTAS
  =========================================
*/
const uploadsDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
const rafflesFile = path.join(dataDir, "raffles.json");
const participantsFile = path.join(dataDir, "participants.json");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(rafflesFile)) fs.writeFileSync(rafflesFile, JSON.stringify([]));
if (!fs.existsSync(participantsFile)) fs.writeFileSync(participantsFile, JSON.stringify([]));

/*
  =========================================
  MIDDLEWARES
  =========================================
*/
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));

/*
  =========================================
  FUNÇÕES AUXILIARES
  =========================================
*/
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content || "[]");
  } catch (error) {
    console.error(`Erro ao ler ${filePath}:`, error);
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function slugify(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function normalizeNumberArray(numbers) {
  if (!Array.isArray(numbers)) return [];

  const clean = numbers
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);

  return [...new Set(clean)].sort((a, b) => a - b);
}

function getParticipantsByRaffleId(raffleId) {
  const participants = readJSON(participantsFile);
  return participants.filter((p) => p.raffleId === raffleId);
}

function calcRaffleMetrics(raffle) {
  const participants = getParticipantsByRaffleId(raffle.id);

  let soldNumbers = 0;
  let reservedNumbers = 0;
  let paidNumbers = 0;
  let amountRaised = 0;

  for (const participant of participants) {
    const qty = Array.isArray(participant.numbers) ? participant.numbers.length : 0;
    const amountPaid = Number(participant.amountPaid || 0);

    if (participant.status === "reserved") {
      reservedNumbers += qty;
    }

    if (participant.status === "paid") {
      soldNumbers += qty;
      paidNumbers += qty;
      amountRaised += amountPaid;
    }

    if (participant.status === "sold") {
      soldNumbers += qty;
      amountRaised += amountPaid;
    }
  }

  return {
    soldNumbers,
    reservedNumbers,
    paidNumbers,
    amountRaised,
  };
}

function enrichRaffle(raffle) {
  const metrics = calcRaffleMetrics(raffle);
  return {
    ...raffle,
    ...metrics,
    publicLink: `${raffle.baseUrl || "http://localhost:5173"}/sorteio/${raffle.slug || raffle.id}`,
  };
}

function numberAlreadyTaken(raffleId, numbers, ignoreParticipantId = null) {
  const participants = getParticipantsByRaffleId(raffleId);

  const taken = new Set();

  for (const participant of participants) {
    if (ignoreParticipantId && participant.id === ignoreParticipantId) continue;

    const participantNumbers = Array.isArray(participant.numbers) ? participant.numbers : [];
    participantNumbers.forEach((n) => taken.add(n));
  }

  return numbers.some((n) => taken.has(n));
}

/*
  =========================================
  MULTER / UPLOAD
  =========================================
*/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const filename = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/*
  =========================================
  ROTAS DE TESTE
  =========================================
*/
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "API da Casa Premiada funcionando.",
  });
});

/*
  =========================================
  UPLOAD
  =========================================
*/
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    return res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      url,
    });
  } catch (error) {
    console.error("Erro no upload:", error);
    return res.status(500).json({ error: "Erro ao enviar arquivo." });
  }
});

/*
  =========================================
  ADMIN - SORTEIOS
  =========================================
*/
app.get("/api/admin/raffles", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const enriched = raffles
      .map(enrichRaffle)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.json(enriched);
  } catch (error) {
    console.error("Erro ao listar sorteios:", error);
    return res.status(500).json({ error: "Erro ao listar sorteios." });
  }
});

app.get("/api/admin/raffles/:id", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const raffle = raffles.find((r) => r.id === req.params.id);

    if (!raffle) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    return res.json(enrichRaffle(raffle));
  } catch (error) {
    console.error("Erro ao buscar sorteio:", error);
    return res.status(500).json({ error: "Erro ao buscar sorteio." });
  }
});

app.post("/api/admin/raffles", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);

    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const drawDate = req.body.drawDate || "";
    const pricePerNumber = Number(req.body.pricePerNumber || 0);
    const totalNumbers = Number(req.body.totalNumbers || 0);
    const whatsapp = onlyDigits(req.body.whatsapp || "");
    const status = req.body.status || "draft";
    const logoUrl = req.body.logoUrl || "";
    const prizeImageUrl = req.body.prizeImageUrl || "";
    const coverImageUrl = req.body.coverImageUrl || "";
    const baseUrl = req.body.baseUrl || "http://localhost:5173";

    if (!title) {
      return res.status(400).json({ error: "Título é obrigatório." });
    }

    if (!pricePerNumber || pricePerNumber <= 0) {
      return res.status(400).json({ error: "Valor por número inválido." });
    }

    if (!totalNumbers || totalNumbers <= 0) {
      return res.status(400).json({ error: "Quantidade de números inválida." });
    }

    const slugBase = slugify(title);
    let slug = slugBase;
    let count = 1;

    while (raffles.some((r) => r.slug === slug)) {
      count += 1;
      slug = `${slugBase}-${count}`;
    }

    const raffle = {
      id: uuidv4(),
      title,
      description,
      drawDate,
      pricePerNumber,
      totalNumbers,
      whatsapp,
      status,
      logoUrl,
      prizeImageUrl,
      coverImageUrl,
      slug,
      baseUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    raffles.push(raffle);
    writeJSON(rafflesFile, raffles);

    return res.status(201).json(enrichRaffle(raffle));
  } catch (error) {
    console.error("Erro ao criar sorteio:", error);
    return res.status(500).json({ error: "Erro ao criar sorteio." });
  }
});

app.put("/api/admin/raffles/:id", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const index = raffles.findIndex((r) => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const current = raffles[index];

    const title = String(req.body.title || current.title || "").trim();
    const description = String(req.body.description ?? current.description ?? "").trim();
    const drawDate = req.body.drawDate ?? current.drawDate ?? "";
    const pricePerNumber = Number(req.body.pricePerNumber ?? current.pricePerNumber ?? 0);
    const totalNumbers = Number(req.body.totalNumbers ?? current.totalNumbers ?? 0);
    const whatsapp = onlyDigits(req.body.whatsapp ?? current.whatsapp ?? "");
    const status = req.body.status ?? current.status ?? "draft";
    const logoUrl = req.body.logoUrl ?? current.logoUrl ?? "";
    const prizeImageUrl = req.body.prizeImageUrl ?? current.prizeImageUrl ?? "";
    const coverImageUrl = req.body.coverImageUrl ?? current.coverImageUrl ?? "";
    const baseUrl = req.body.baseUrl ?? current.baseUrl ?? "http://localhost:5173";

    if (!title) {
      return res.status(400).json({ error: "Título é obrigatório." });
    }

    if (!pricePerNumber || pricePerNumber <= 0) {
      return res.status(400).json({ error: "Valor por número inválido." });
    }

    if (!totalNumbers || totalNumbers <= 0) {
      return res.status(400).json({ error: "Quantidade de números inválida." });
    }

    let slug = current.slug || slugify(title);

    if (title !== current.title) {
      const slugBase = slugify(title);
      slug = slugBase;
      let count = 1;

      while (raffles.some((r) => r.id !== current.id && r.slug === slug)) {
        count += 1;
        slug = `${slugBase}-${count}`;
      }
    }

    const updated = {
      ...current,
      title,
      description,
      drawDate,
      pricePerNumber,
      totalNumbers,
      whatsapp,
      status,
      logoUrl,
      prizeImageUrl,
      coverImageUrl,
      baseUrl,
      slug,
      updatedAt: new Date().toISOString(),
    };

    raffles[index] = updated;
    writeJSON(rafflesFile, raffles);

    return res.json(enrichRaffle(updated));
  } catch (error) {
    console.error("Erro ao atualizar sorteio:", error);
    return res.status(500).json({ error: "Erro ao atualizar sorteio." });
  }
});

app.delete("/api/admin/raffles/:id", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const participants = readJSON(participantsFile);

    const exists = raffles.some((r) => r.id === req.params.id);
    if (!exists) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const newRaffles = raffles.filter((r) => r.id !== req.params.id);
    const newParticipants = participants.filter((p) => p.raffleId !== req.params.id);

    writeJSON(rafflesFile, newRaffles);
    writeJSON(participantsFile, newParticipants);

    return res.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir sorteio:", error);
    return res.status(500).json({ error: "Erro ao excluir sorteio." });
  }
});

/*
  =========================================
  ADMIN - PARTICIPANTES
  =========================================
*/
app.get("/api/admin/raffles/:id/participants", (req, res) => {
  try {
    const participants = getParticipantsByRaffleId(req.params.id).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    return res.json(participants);
  } catch (error) {
    console.error("Erro ao listar participantes:", error);
    return res.status(500).json({ error: "Erro ao listar participantes." });
  }
});

app.post("/api/admin/raffles/:id/participants", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const raffle = raffles.find((r) => r.id === req.params.id);

    if (!raffle) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const participants = readJSON(participantsFile);

    const name = String(req.body.name || "").trim();
    const phone = onlyDigits(req.body.phone || "");
    const numbers = normalizeNumberArray(req.body.numbers || []);
    const status = req.body.status || "reserved";
    const amountPaid =
      req.body.amountPaid != null
        ? Number(req.body.amountPaid)
        : numbers.length * Number(raffle.pricePerNumber || 0);

    if (!name) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (!phone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    if (!numbers.length) {
      return res.status(400).json({ error: "Selecione ao menos um número." });
    }

    const invalidNumber = numbers.find((n) => n < 1 || n > Number(raffle.totalNumbers));
    if (invalidNumber) {
      return res.status(400).json({
        error: `Número ${invalidNumber} está fora do intervalo permitido.`,
      });
    }

    if (numberAlreadyTaken(raffle.id, numbers)) {
      return res.status(400).json({
        error: "Um ou mais números já foram reservados ou pagos.",
      });
    }

    const participant = {
      id: uuidv4(),
      raffleId: raffle.id,
      name,
      phone,
      numbers,
      status,
      amountPaid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    participants.push(participant);
    writeJSON(participantsFile, participants);

    return res.status(201).json(participant);
  } catch (error) {
    console.error("Erro ao criar participante:", error);
    return res.status(500).json({ error: "Erro ao criar participante." });
  }
});

app.put("/api/admin/raffles/:raffleId/participants/:participantId", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const raffle = raffles.find((r) => r.id === req.params.raffleId);

    if (!raffle) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const participants = readJSON(participantsFile);
    const index = participants.findIndex(
      (p) => p.id === req.params.participantId && p.raffleId === req.params.raffleId
    );

    if (index === -1) {
      return res.status(404).json({ error: "Participante não encontrado." });
    }

    const current = participants[index];

    const name = String(req.body.name ?? current.name ?? "").trim();
    const phone = onlyDigits(req.body.phone ?? current.phone ?? "");
    const numbers = req.body.numbers
      ? normalizeNumberArray(req.body.numbers)
      : current.numbers || [];
    const status = req.body.status ?? current.status ?? "reserved";
    const amountPaid =
      req.body.amountPaid != null
        ? Number(req.body.amountPaid)
        : Number(current.amountPaid || 0);

    if (!name) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (!phone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    if (!numbers.length) {
      return res.status(400).json({ error: "Selecione ao menos um número." });
    }

    const invalidNumber = numbers.find((n) => n < 1 || n > Number(raffle.totalNumbers));
    if (invalidNumber) {
      return res.status(400).json({
        error: `Número ${invalidNumber} está fora do intervalo permitido.`,
      });
    }

    if (numberAlreadyTaken(raffle.id, numbers, current.id)) {
      return res.status(400).json({
        error: "Um ou mais números já foram reservados ou pagos.",
      });
    }

    const updated = {
      ...current,
      name,
      phone,
      numbers,
      status,
      amountPaid,
      updatedAt: new Date().toISOString(),
    };

    participants[index] = updated;
    writeJSON(participantsFile, participants);

    return res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar participante:", error);
    return res.status(500).json({ error: "Erro ao atualizar participante." });
  }
});

app.delete("/api/admin/raffles/:raffleId/participants/:participantId", (req, res) => {
  try {
    const participants = readJSON(participantsFile);

    const exists = participants.some(
      (p) => p.id === req.params.participantId && p.raffleId === req.params.raffleId
    );

    if (!exists) {
      return res.status(404).json({ error: "Participante não encontrado." });
    }

    const filtered = participants.filter(
      (p) => !(p.id === req.params.participantId && p.raffleId === req.params.raffleId)
    );

    writeJSON(participantsFile, filtered);

    return res.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir participante:", error);
    return res.status(500).json({ error: "Erro ao excluir participante." });
  }
});

/*
  =========================================
  ROTA PÚBLICA DO SORTEIO
  =========================================
*/
app.get("/api/raffles/:slug", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const raffle = raffles.find((r) => r.slug === req.params.slug || r.id === req.params.slug);

    if (!raffle) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const participants = getParticipantsByRaffleId(raffle.id);

    const takenNumbers = participants.flatMap((p) => {
      const nums = Array.isArray(p.numbers) ? p.numbers : [];
      return nums.map((n) => ({
        number: n,
        status: p.status || "reserved",
      }));
    });

    return res.json({
      ...enrichRaffle(raffle),
      takenNumbers,
    });
  } catch (error) {
    console.error("Erro ao buscar sorteio público:", error);
    return res.status(500).json({ error: "Erro ao buscar sorteio." });
  }
});

/*
  =========================================
  RESERVA / COMPRA PÚBLICA
  =========================================
*/
app.post("/api/raffles/:slug/reserve", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const raffle = raffles.find((r) => r.slug === req.params.slug || r.id === req.params.slug);

    if (!raffle) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const name = String(req.body.name || "").trim();
    const phone = onlyDigits(req.body.phone || "");
    const numbers = normalizeNumberArray(req.body.numbers || []);
    const status = req.body.status || "reserved";

    if (!name) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (!phone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    if (!numbers.length) {
      return res.status(400).json({ error: "Escolha ao menos um número." });
    }

    const invalidNumber = numbers.find((n) => n < 1 || n > Number(raffle.totalNumbers));
    if (invalidNumber) {
      return res.status(400).json({
        error: `Número ${invalidNumber} inválido para este sorteio.`,
      });
    }

    if (numberAlreadyTaken(raffle.id, numbers)) {
      return res.status(400).json({
        error: "Um ou mais números escolhidos já não estão disponíveis.",
      });
    }

    const participants = readJSON(participantsFile);

    const participant = {
      id: uuidv4(),
      raffleId: raffle.id,
      name,
      phone,
      numbers,
      status,
      amountPaid: numbers.length * Number(raffle.pricePerNumber || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    participants.push(participant);
    writeJSON(participantsFile, participants);

    return res.status(201).json({
      success: true,
      participant,
      message: "Reserva realizada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao reservar números:", error);
    return res.status(500).json({ error: "Erro ao reservar números." });
  }
});

/*
  =========================================
  MARCAR PAGAMENTO
  =========================================
*/
app.post("/api/admin/raffles/:raffleId/participants/:participantId/pay", (req, res) => {
  try {
    const participants = readJSON(participantsFile);

    const index = participants.findIndex(
      (p) => p.id === req.params.participantId && p.raffleId === req.params.raffleId
    );

    if (index === -1) {
      return res.status(404).json({ error: "Participante não encontrado." });
    }

    participants[index] = {
      ...participants[index],
      status: "paid",
      amountPaid:
        req.body.amountPaid != null
          ? Number(req.body.amountPaid)
          : Number(participants[index].amountPaid || 0),
      updatedAt: new Date().toISOString(),
    };

    writeJSON(participantsFile, participants);

    return res.json({
      success: true,
      participant: participants[index],
    });
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error);
    return res.status(500).json({ error: "Erro ao confirmar pagamento." });
  }
});

/*
  =========================================
  MÉTRICAS GERAIS
  =========================================
*/
app.get("/api/admin/dashboard", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const participants = readJSON(participantsFile);

    let totalRaised = 0;
    let totalSold = 0;
    let totalReserved = 0;
    let totalPaid = 0;

    for (const participant of participants) {
      const qty = Array.isArray(participant.numbers) ? participant.numbers.length : 0;

      if (participant.status === "reserved") totalReserved += qty;
      if (participant.status === "paid") {
        totalPaid += qty;
        totalSold += qty;
        totalRaised += Number(participant.amountPaid || 0);
      }
      if (participant.status === "sold") {
        totalSold += qty;
        totalRaised += Number(participant.amountPaid || 0);
      }
    }

    return res.json({
      rafflesCount: raffles.length,
      participantsCount: participants.length,
      totalRaised,
      totalSold,
      totalReserved,
      totalPaid,
    });
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
    return res.status(500).json({ error: "Erro ao carregar dashboard." });
  }
});

/*
  =========================================
  EXPORTAÇÃO CSV SIMPLES
  =========================================
*/
app.get("/api/admin/raffles/:id/participants/csv", (req, res) => {
  try {
    const raffles = readJSON(rafflesFile);
    const raffle = raffles.find((r) => r.id === req.params.id);

    if (!raffle) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const participants = getParticipantsByRaffleId(raffle.id);

    let csv = "Nome;Telefone;Números Comprados;Status;Valor Pago\n";

    participants.forEach((p) => {
      const name = (p.name || "").replace(/;/g, ",");
      const phone = (p.phone || "").replace(/;/g, ",");
      const numbers = Array.isArray(p.numbers) ? p.numbers.join(", ") : "";
      const status = (p.status || "").replace(/;/g, ",");
      const amountPaid = Number(p.amountPaid || 0);

      csv += `"${name}";"${phone}";"${numbers}";"${status}";"${amountPaid}"\n`;
    });

    const filename = `${slugify(raffle.title || "participantes")}-participantes.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.send("\uFEFF" + csv);
  } catch (error) {
    console.error("Erro ao exportar CSV:", error);
    return res.status(500).json({ error: "Erro ao exportar CSV." });
  }
});

/*
  =========================================
  INICIAR
  =========================================
*/
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
