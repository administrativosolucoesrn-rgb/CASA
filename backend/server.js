const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const SORTEIOS_FILE = path.join(DATA_DIR, "sorteios.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use("/uploads", express.static(UPLOADS_DIR));

function ensureDataFile() {
  if (!fs.existsSync(SORTEIOS_FILE)) {
    fs.writeFileSync(SORTEIOS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
ensureDataFile();

function readSorteios() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(SORTEIOS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Erro ao ler sorteios.json:", error);
    return [];
  }
}

function saveSorteios(data) {
  fs.writeFileSync(SORTEIOS_FILE, JSON.stringify(data, null, 2), "utf-8");
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

function gerarId() {
  return Date.now();
}

function buildNumeros(total, existentes = []) {
  const mapaExistente = new Map(
    (existentes || []).map((n) => [Number(n.numero), n])
  );

  const numeros = [];
  for (let i = 1; i <= Number(total || 0); i++) {
    const existente = mapaExistente.get(i);
    numeros.push({
      numero: i,
      status: existente?.status || "disponivel",
      compradorNome: existente?.compradorNome || "",
      compradorTelefone: existente?.compradorTelefone || "",
      reservadoEm: existente?.reservadoEm || null,
      pagoEm: existente?.pagoEm || null,
    });
  }
  return numeros;
}

function normalizarSorteio(body, sorteioAtual = null) {
  const titulo = body.titulo?.trim() || "";
  const totalNumeros = Number(body.totalNumeros || 0);
  const valorNumero = Number(body.valorNumero || 0);

  let slug = body.slug?.trim() || "";
  if (!slug) slug = slugify(titulo || `sorteio-${Date.now()}`);

  const numeros = buildNumeros(
    totalNumeros,
    sorteioAtual?.numeros || body.numeros || []
  );

  return {
    id: sorteioAtual?.id || gerarId(),
    slug,
    titulo,
    descricao: body.descricao || "",
    valorNumero,
    totalNumeros,
    fotoPremio: body.fotoPremio || sorteioAtual?.fotoPremio || "",
    logoUrl: body.logoUrl || sorteioAtual?.logoUrl || "",
    whatsapp: body.whatsapp || sorteioAtual?.whatsapp || "",
    status: body.status || sorteioAtual?.status || "ativo",
    dataSorteio: body.dataSorteio || sorteioAtual?.dataSorteio || "",
    numeros,
    createdAt: sorteioAtual?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function encontrarSorteioPorSlugOuId(valor, lista) {
  const busca = String(valor).trim();

  return lista.find((s) => {
    return (
      String(s.id) === busca ||
      String(s.slug) === busca
    );
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const nome = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, nome);
  },
});

const upload = multer({ storage });

/* =========================
   HEALTH
========================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   UPLOAD
========================= */
app.post("/api/upload", upload.single("imagem"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }

    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error("Erro no upload:", error);
    res.status(500).json({ error: "Erro ao enviar imagem." });
  }
});

/* =========================
   ADMIN
========================= */

// listar sorteios
app.get("/api/admin/sorteios", (req, res) => {
  try {
    const sorteios = readSorteios().sort((a, b) => b.id - a.id);
    res.json(sorteios);
  } catch (error) {
    console.error("Erro ao listar sorteios:", error);
    res.status(500).json({ error: "Erro ao listar sorteios." });
  }
});

// buscar 1 sorteio no admin
app.get("/api/admin/sorteios/:id", (req, res) => {
  try {
    const sorteios = readSorteios();
    const sorteio = encontrarSorteioPorSlugOuId(req.params.id, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    res.json(sorteio);
  } catch (error) {
    console.error("Erro ao buscar sorteio admin:", error);
    res.status(500).json({ error: "Erro ao buscar sorteio." });
  }
});

// criar sorteio
app.post("/api/admin/sorteios", (req, res) => {
  try {
    const sorteios = readSorteios();

    const novo = normalizarSorteio(req.body);

    const slugJaExiste = sorteios.some(
      (s) => String(s.slug) === String(novo.slug)
    );

    if (slugJaExiste) {
      novo.slug = `${novo.slug}-${novo.id}`;
    }

    sorteios.push(novo);
    saveSorteios(sorteios);

    res.status(201).json(novo);
  } catch (error) {
    console.error("Erro ao criar sorteio:", error);
    res.status(500).json({ error: "Erro ao criar sorteio." });
  }
});

// editar sorteio
app.put("/api/admin/sorteios/:id", (req, res) => {
  try {
    const sorteios = readSorteios();
    const index = sorteios.findIndex(
      (s) => String(s.id) === String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const atual = sorteios[index];
    const atualizado = normalizarSorteio(req.body, atual);

    const slugDuplicado = sorteios.some(
      (s, i) => i !== index && String(s.slug) === String(atualizado.slug)
    );

    if (slugDuplicado) {
      atualizado.slug = `${atualizado.slug}-${atualizado.id}`;
    }

    sorteios[index] = atualizado;
    saveSorteios(sorteios);

    res.json(atualizado);
  } catch (error) {
    console.error("Erro ao editar sorteio:", error);
    res.status(500).json({ error: "Erro ao editar sorteio." });
  }
});

// excluir sorteio
app.delete("/api/admin/sorteios/:id", (req, res) => {
  try {
    const sorteios = readSorteios();
    const novos = sorteios.filter(
      (s) => String(s.id) !== String(req.params.id)
    );

    if (novos.length === sorteios.length) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    saveSorteios(novos);
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir sorteio:", error);
    res.status(500).json({ error: "Erro ao excluir sorteio." });
  }
});

// resumo admin
app.get("/api/admin/sorteios/:id/resumo", (req, res) => {
  try {
    const sorteios = readSorteios();
    const sorteio = encontrarSorteioPorSlugOuId(req.params.id, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const numeros = sorteio.numeros || [];
    const vendidos = numeros.filter((n) => n.status === "pago").length;
    const reservados = numeros.filter((n) => n.status === "reservado").length;
    const disponiveis = numeros.filter((n) => n.status === "disponivel").length;
    const arrecadado = vendidos * Number(sorteio.valorNumero || 0);

    res.json({
      vendidos,
      reservados,
      disponiveis,
      arrecadado,
      total: numeros.length,
    });
  } catch (error) {
    console.error("Erro ao gerar resumo:", error);
    res.status(500).json({ error: "Erro ao gerar resumo." });
  }
});

// participantes simples
app.get("/api/admin/sorteios/:id/participantes", (req, res) => {
  try {
    const sorteios = readSorteios();
    const sorteio = encontrarSorteioPorSlugOuId(req.params.id, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const agrupado = {};

    for (const item of sorteio.numeros || []) {
      if (!item.compradorTelefone && !item.compradorNome) continue;

      const chave = `${item.compradorNome}__${item.compradorTelefone}`;
      if (!agrupado[chave]) {
        agrupado[chave] = {
          nome: item.compradorNome || "",
          telefone: item.compradorTelefone || "",
          numeros: [],
          status: [],
        };
      }

      agrupado[chave].numeros.push(item.numero);
      agrupado[chave].status.push(item.status);
    }

    res.json(Object.values(agrupado));
  } catch (error) {
    console.error("Erro ao buscar participantes:", error);
    res.status(500).json({ error: "Erro ao buscar participantes." });
  }
});

/* =========================
   PÚBLICO
========================= */

// listar sorteios ativos
app.get("/api/public/sorteios", (req, res) => {
  try {
    const sorteios = readSorteios()
      .filter((s) => s.status !== "inativo")
      .sort((a, b) => b.id - a.id);

    res.json(sorteios);
  } catch (error) {
    console.error("Erro ao listar sorteios públicos:", error);
    res.status(500).json({ error: "Erro ao listar sorteios." });
  }
});

// buscar sorteio público por slug OU id
app.get("/api/public/sorteios/:slug", (req, res) => {
  try {
    const valor = req.params.slug;
    const sorteios = readSorteios();
    const sorteio = encontrarSorteioPorSlugOuId(valor, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    res.json(sorteio);
  } catch (error) {
    console.error("Erro ao buscar sorteio público:", error);
    res.status(500).json({ error: "Erro ao buscar sorteio." });
  }
});

// reservar números
app.post("/api/public/sorteios/:slug/reservar", (req, res) => {
  try {
    const valor = req.params.slug;
    const { nome, telefone, numeros } = req.body;

    if (!nome || !telefone) {
      return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
    }

    if (!Array.isArray(numeros) || !numeros.length) {
      return res.status(400).json({ error: "Selecione pelo menos um número." });
    }

    const sorteios = readSorteios();
    const index = sorteios.findIndex(
      (s) => String(s.id) === String(valor) || String(s.slug) === String(valor)
    );

    if (index === -1) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const sorteio = sorteios[index];
    const agora = new Date().toISOString();

    for (const numero of numeros) {
      const item = sorteio.numeros.find((n) => Number(n.numero) === Number(numero));

      if (!item) {
        return res.status(400).json({ error: `Número ${numero} não existe.` });
      }

      if (item.status !== "disponivel") {
        return res.status(400).json({ error: `Número ${numero} não está disponível.` });
      }
    }

    for (const numero of numeros) {
      const item = sorteio.numeros.find((n) => Number(n.numero) === Number(numero));
      item.status = "reservado";
      item.compradorNome = nome;
      item.compradorTelefone = telefone;
      item.reservadoEm = agora;
    }

    sorteio.updatedAt = agora;
    sorteios[index] = sorteio;
    saveSorteios(sorteios);

    // aqui depois a gente pluga Mercado Pago / Pagar.me / Pix automático
    res.json({
      success: true,
      message: "Reserva realizada com sucesso.",
      sorteioId: sorteio.id,
      slug: sorteio.slug,
      numeros,
      total: numeros.length * Number(sorteio.valorNumero || 0),
    });
  } catch (error) {
    console.error("Erro ao reservar números:", error);
    res.status(500).json({ error: "Erro ao reservar números." });
  }
});

/* =========================
   SERVIR FRONTEND
========================= */

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));

  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));

  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    res.status(404).send("Frontend não encontrado.");
  });
}

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
