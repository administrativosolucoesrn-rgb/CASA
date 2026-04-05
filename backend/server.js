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
const DIST_DIR = path.join(ROOT_DIR, "dist");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SORTEIOS_FILE = path.join(DATA_DIR, "sorteios.json");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(SORTEIOS_FILE)) {
    fs.writeFileSync(SORTEIOS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
ensureDirs();

app.use("/uploads", express.static(UPLOADS_DIR));

function readSorteios() {
  try {
    ensureDirs();
    const raw = fs.readFileSync(SORTEIOS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Erro ao ler sorteios:", error);
    return [];
  }
}

function saveSorteios(data) {
  ensureDirs();
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
  const mapa = new Map((existentes || []).map((n) => [Number(n.numero), n]));
  const lista = [];

  for (let i = 1; i <= Number(total || 0); i++) {
    const existente = mapa.get(i);
    lista.push({
      numero: i,
      status: existente?.status || "disponivel",
      compradorNome: existente?.compradorNome || "",
      compradorTelefone: existente?.compradorTelefone || "",
      reservadoEm: existente?.reservadoEm || null,
      pagoEm: existente?.pagoEm || null,
    });
  }

  return lista;
}

function normalizarSorteio(body = {}, atual = null) {
  const titulo = String(body.titulo || "").trim();
  const descricao = String(body.descricao || "").trim();
  const valorNumero = Number(body.valorNumero || 0);
  const totalNumeros = Number(body.totalNumeros || 0);
  const whatsapp = String(body.whatsapp || atual?.whatsapp || "").trim();
  const logoUrl = String(body.logoUrl || atual?.logoUrl || "").trim();
  const fotoPremio = String(body.fotoPremio || atual?.fotoPremio || "").trim();
  const status = String(body.status || atual?.status || "ativo").trim();
  const dataSorteio = String(body.dataSorteio || atual?.dataSorteio || "").trim();

  let slug = String(body.slug || "").trim();
  if (!slug) slug = slugify(titulo || `sorteio-${Date.now()}`);

  return {
    id: atual?.id || gerarId(),
    slug,
    titulo,
    descricao,
    valorNumero,
    totalNumeros,
    whatsapp,
    logoUrl,
    fotoPremio,
    status,
    dataSorteio,
    numeros: buildNumeros(totalNumeros, atual?.numeros || body.numeros || []),
    createdAt: atual?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function encontrarSorteio(valor, lista) {
  const busca = String(valor).trim();
  return lista.find(
    (s) => String(s.id) === busca || String(s.slug) === busca
  );
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage });

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/upload", upload.single("imagem"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }

    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error("Erro no upload:", error);
    res.status(500).json({ error: "Erro no upload." });
  }
});

app.get("/api/admin/sorteios", (req, res) => {
  try {
    const sorteios = readSorteios().sort((a, b) => Number(b.id) - Number(a.id));
    res.json(sorteios);
  } catch (error) {
    console.error("Erro ao listar sorteios:", error);
    res.status(500).json({ error: "Erro ao listar sorteios." });
  }
});

app.get("/api/admin/sorteios/:id", (req, res) => {
  try {
    const sorteios = readSorteios();
    const sorteio = encontrarSorteio(req.params.id, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    res.json(sorteio);
  } catch (error) {
    console.error("Erro ao buscar sorteio:", error);
    res.status(500).json({ error: "Erro ao buscar sorteio." });
  }
});

app.post("/api/admin/sorteios", (req, res) => {
  try {
    console.log("BODY RECEBIDO EM /api/admin/sorteios:", req.body);

    const sorteios = readSorteios();
    const novo = normalizarSorteio(req.body);

    if (!novo.titulo) {
      return res.status(400).json({ error: "Título é obrigatório." });
    }

    if (!novo.totalNumeros || novo.totalNumeros < 1) {
      return res.status(400).json({ error: "Total de números inválido." });
    }

    if (novo.valorNumero < 0) {
      return res.status(400).json({ error: "Valor inválido." });
    }

    const slugDuplicado = sorteios.some((s) => String(s.slug) === String(novo.slug));
    if (slugDuplicado) {
      novo.slug = `${novo.slug}-${novo.id}`;
    }

    sorteios.push(novo);
    saveSorteios(sorteios);

    res.status(201).json(novo);
  } catch (error) {
    console.error("Erro ao criar sorteio:", error);
    res.status(500).json({
      error: "Erro ao criar sorteio.",
      details: error.message,
    });
  }
});

app.put("/api/admin/sorteios/:id", (req, res) => {
  try {
    const sorteios = readSorteios();
    const index = sorteios.findIndex((s) => String(s.id) === String(req.params.id));

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

app.delete("/api/admin/sorteios/:id", (req, res) => {
  try {
    const sorteios = readSorteios();
    const filtrados = sorteios.filter((s) => String(s.id) !== String(req.params.id));

    if (filtrados.length === sorteios.length) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    saveSorteios(filtrados);
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir sorteio:", error);
    res.status(500).json({ error: "Erro ao excluir sorteio." });
  }
});

app.get("/api/admin/sorteios/:id/resumo", (req, res) => {
  try {
    const sorteios = readSorteios();
    const sorteio = encontrarSorteio(req.params.id, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const nums = sorteio.numeros || [];
    const vendidos = nums.filter((n) => n.status === "pago").length;
    const reservados = nums.filter((n) => n.status === "reservado").length;
    const disponiveis = nums.filter((n) => n.status === "disponivel").length;
    const arrecadado = vendidos * Number(sorteio.valorNumero || 0);

    res.json({ vendidos, reservados, disponiveis, arrecadado, total: nums.length });
  } catch (error) {
    console.error("Erro ao gerar resumo:", error);
    res.status(500).json({ error: "Erro ao gerar resumo." });
  }
});

app.get("/api/admin/sorteios/:id/participantes", (req, res) => {
  try {
    const sorteios = readSorteios();
    const sorteio = encontrarSorteio(req.params.id, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const agrupado = {};

    for (const item of sorteio.numeros || []) {
      if (!item.compradorNome && !item.compradorTelefone) continue;

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

app.get("/api/public/sorteios", (req, res) => {
  try {
    const sorteios = readSorteios()
      .filter((s) => s.status !== "inativo")
      .sort((a, b) => Number(b.id) - Number(a.id));

    res.json(sorteios);
  } catch (error) {
    console.error("Erro ao listar sorteios públicos:", error);
    res.status(500).json({ error: "Erro ao listar sorteios." });
  }
});

app.get("/api/public/sorteios/:slug", (req, res) => {
  try {
    const sorteios = readSorteios();
    const sorteio = encontrarSorteio(req.params.slug, sorteios);

    if (!sorteio) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    res.json(sorteio);
  } catch (error) {
    console.error("Erro ao buscar sorteio público:", error);
    res.status(500).json({ error: "Erro ao buscar sorteio." });
  }
});

app.post("/api/public/sorteios/:slug/reservar", (req, res) => {
  try {
    const { nome, telefone, numeros } = req.body;

    if (!nome || !telefone) {
      return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
    }

    if (!Array.isArray(numeros) || !numeros.length) {
      return res.status(400).json({ error: "Selecione pelo menos um número." });
    }

    const sorteios = readSorteios();
    const index = sorteios.findIndex(
      (s) =>
        String(s.id) === String(req.params.slug) ||
        String(s.slug) === String(req.params.slug)
    );

    if (index === -1) {
      return res.status(404).json({ error: "Sorteio não encontrado." });
    }

    const sorteio = sorteios[index];

    for (const numero of numeros) {
      const item = sorteio.numeros.find((n) => Number(n.numero) === Number(numero));
      if (!item) {
        return res.status(400).json({ error: `Número ${numero} não existe.` });
      }
      if (item.status !== "disponivel") {
        return res.status(400).json({ error: `Número ${numero} não está disponível.` });
      }
    }

    const agora = new Date().toISOString();

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

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(404).send("Frontend não encontrado.");
  });
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
