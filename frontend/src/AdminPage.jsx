import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

const emptySorteioForm = {
  id: null,
  titulo: "",
  descricao: "",
  dataSorteio: "",
  valorNumero: "",
  totalNumeros: "",
  whatsapp: "",
  status: "ativo",
  imagemFile: null,
  imagemPreview: "",
  logoFile: null,
  logoPreview: "",
};

const emptyParticipantForm = {
  nome: "",
  telefone: "",
  numeros: "",
  status: "reservado",
  origem: "site",
  bloco: false,
  observacao: "",
};

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function currencyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function formatDateInput(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseNumbersInput(input = "") {
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
          for (let i = start; i <= end; i += 1) {
            result.add(i);
          }
        }
      } else {
        const n = Number(part);
        if (Number.isInteger(n) && n > 0) {
          result.add(n);
        }
      }
    });

  return [...result].sort((a, b) => a - b);
}

function formatNumbersCompact(numbers = []) {
  const arr = [...new Set((numbers || []).map(Number).filter((n) => n > 0))].sort(
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

function downloadCSV(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text) {
  if (!navigator.clipboard) {
    throw new Error("Seu navegador não permite copiar automaticamente.");
  }

  await navigator.clipboard.writeText(text);
}

export default function AdminPage() {
  const [sorteios, setSorteios] = useState([]);
  const [selectedSorteioId, setSelectedSorteioId] = useState(null);

  const [sorteioForm, setSorteioForm] = useState(emptySorteioForm);
  const [participantForm, setParticipantForm] = useState(emptyParticipantForm);

  const [participants, setParticipants] = useState([]);
  const [resumo, setResumo] = useState(null);

  const [loadingSorteios, setLoadingSorteios] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [savingSorteio, setSavingSorteio] = useState(false);
  const [savingParticipant, setSavingParticipant] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSorteios();
  }, []);

  useEffect(() => {
    if (selectedSorteioId) {
      loadParticipants(selectedSorteioId);
      loadResumo(selectedSorteioId);
    } else {
      setParticipants([]);
      setResumo(null);
    }
  }, [selectedSorteioId]);

  async function safeJson(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function loadSorteios() {
    try {
      setLoadingSorteios(true);
      setError("");

      const res = await fetch(`${API_BASE}/api/sorteios`);
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar sorteios.");
      }

      const list = Array.isArray(data) ? data : [];
      setSorteios(list);

      if (list.length && !selectedSorteioId) {
        setSelectedSorteioId(list[0].id);
      }

      if (!list.length) {
        setSelectedSorteioId(null);
      }
    } catch (err) {
      setError(err.message || "Erro ao carregar sorteios.");
    } finally {
      setLoadingSorteios(false);
    }
  }

  async function loadParticipants(sorteioId) {
    try {
      setLoadingParticipants(true);
      setError("");

      const res = await fetch(
        `${API_BASE}/api/admin/sorteios/${sorteioId}/participantes`
      );
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar participantes.");
      }

      const list = Array.isArray(data) ? data : [];
      const normalized = list.map((item, index) => ({
        id: item.id || `${item.nome || "p"}-${item.whatsapp || "w"}-${index}`,
        nome: item.nome || "",
        telefone: item.whatsapp ? formatPhone(item.whatsapp) : "",
        numeros: Array.isArray(item.numeros) ? item.numeros : [],
        numerosTexto:
          item.numerosTexto ||
          formatNumbersCompact(Array.isArray(item.numeros) ? item.numeros : []),
        status: item.status || "",
        origem: item.origem || "site",
        bloco: Boolean(item.bloco),
        observacao: item.observacao || "",
        valorPago: item.total || 0,
        createdAt: item.createdAt || null,
      }));

      setParticipants(normalized);
    } catch (err) {
      setError(err.message || "Erro ao carregar participantes.");
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  }

  async function loadResumo(sorteioId) {
    try {
      setLoadingResumo(true);
      setError("");

      const res = await fetch(
        `${API_BASE}/api/admin/sorteios/${sorteioId}/resumo`
      );
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar resumo.");
      }

      setResumo(data);
    } catch {
      setResumo(null);
    } finally {
      setLoadingResumo(false);
    }
  }

  function resetSorteioForm() {
    setSorteioForm(emptySorteioForm);
  }

  function resetParticipantForm() {
    setParticipantForm(emptyParticipantForm);
  }

  const selectedSorteio = useMemo(() => {
    return sorteios.find((item) => item.id === selectedSorteioId) || null;
  }, [sorteios, selectedSorteioId]);

  const sorteioMetrics = useMemo(() => {
    const metricas = resumo?.metricas || {};

    return {
      arrecadado: Number(metricas.arrecadado || 0),
      vendidos: Number(metricas.vendidos || 0),
      reservados: Number(metricas.reservados || 0),
      disponiveis: Number(metricas.disponiveis || 0),
    };
  }, [resumo]);

  const groupedParticipants = useMemo(() => {
    const groups = {
      mae: [],
      pai: [],
      vo: [],
      site: [],
      manual: [],
      outros: [],
    };

    participants.forEach((p) => {
      const key = String(p.origem || "").toLowerCase();
      if (groups[key]) {
        groups[key].push(p);
      } else {
        groups.outros.push(p);
      }
    });

    return groups;
  }, [participants]);

  function handleImageFileChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    const preview = URL.createObjectURL(file);

    setSorteioForm((prev) => ({
      ...prev,
      imagemFile: file,
      imagemPreview: preview,
    }));

    setMessage("Imagem selecionada com sucesso.");
    setError("");
  }

  function handleLogoFileChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    const preview = URL.createObjectURL(file);

    setSorteioForm((prev) => ({
      ...prev,
      logoFile: file,
      logoPreview: preview,
    }));

    setMessage("Logo selecionada com sucesso.");
    setError("");
  }

  function handleSorteioChange(field, value) {
    if (field === "whatsapp") {
      setSorteioForm((prev) => ({
        ...prev,
        whatsapp: formatPhone(value),
      }));
      return;
    }

    setSorteioForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleParticipantChange(field, value) {
    if (field === "telefone") {
      setParticipantForm((prev) => ({
        ...prev,
        telefone: formatPhone(value),
      }));
      return;
    }

    if (field === "bloco") {
      setParticipantForm((prev) => ({
        ...prev,
        bloco: Boolean(value),
      }));
      return;
    }

    setParticipantForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSaveSorteio(e) {
    e.preventDefault();

    try {
      setSavingSorteio(true);
      setMessage("");
      setError("");

      const formData = new FormData();
      formData.append("titulo", sorteioForm.titulo.trim());
      formData.append("descricao", sorteioForm.descricao.trim());
      formData.append("dataSorteio", sorteioForm.dataSorteio || "");
      formData.append("valor", Number(sorteioForm.valorNumero || 0));
      formData.append("totalNumbers", Number(sorteioForm.totalNumeros || 0));
      formData.append("whatsapp", onlyDigits(sorteioForm.whatsapp));
      formData.append("status", sorteioForm.status);

      if (sorteioForm.imagemFile) {
        formData.append("image", sorteioForm.imagemFile);
      }

      if (sorteioForm.logoFile) {
        formData.append("logo", sorteioForm.logoFile);
      }

      const isEdit = Boolean(sorteioForm.id);

      const res = await fetch(
        isEdit
          ? `${API_BASE}/api/sorteios/${sorteioForm.id}`
          : `${API_BASE}/api/sorteios`,
        {
          method: isEdit ? "PUT" : "POST",
          body: formData,
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao salvar sorteio.");
      }

      const sorteioSalvo = data?.sorteio || null;

      setMessage(
        isEdit ? "Sorteio atualizado com sucesso." : "Sorteio criado com sucesso."
      );

      resetSorteioForm();
      await loadSorteios();

      if (sorteioSalvo?.id) {
        setSelectedSorteioId(sorteioSalvo.id);
        await loadResumo(sorteioSalvo.id);
        await loadParticipants(sorteioSalvo.id);
      }
    } catch (err) {
      setError(err.message || "Erro ao salvar sorteio.");
    } finally {
      setSavingSorteio(false);
    }
  }

  function handleEditSorteio(sorteio) {
    setSorteioForm({
      id: sorteio.id || null,
      titulo: sorteio.title || "",
      descricao: sorteio.descricao || "",
      dataSorteio: formatDateInput(sorteio.drawDate),
      valorNumero: sorteio.price || "",
      totalNumeros: sorteio.totalNumbers || "",
      whatsapp: formatPhone(sorteio.whatsapp || ""),
      status: sorteio.status || "ativo",
      imagemFile: null,
      imagemPreview: sorteio.image || "",
      logoFile: null,
      logoPreview: sorteio.logoUrl || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteSorteio(id) {
    const confirmed = window.confirm("Deseja realmente excluir este sorteio?");
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/api/sorteios/${id}`, {
        method: "DELETE",
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao excluir sorteio.");
      }

      setMessage("Sorteio excluído com sucesso.");

      if (selectedSorteioId === id) {
        setSelectedSorteioId(null);
      }

      await loadSorteios();
      resetSorteioForm();
      setParticipants([]);
      setResumo(null);
    } catch (err) {
      setError(err.message || "Erro ao excluir sorteio.");
    }
  }

  async function handleSaveParticipant(e) {
    e.preventDefault();

    if (!selectedSorteio) {
      setError("Selecione um sorteio.");
      return;
    }

    try {
      setSavingParticipant(true);
      setError("");
      setMessage("");

      const numeros = parseNumbersInput(participantForm.numeros);
      const nome = participantForm.nome.trim();
      const whatsapp = onlyDigits(participantForm.telefone);

      if (!nome) {
        throw new Error("Nome é obrigatório.");
      }

      if (!whatsapp) {
        throw new Error("Telefone é obrigatório.");
      }

      if (!numeros.length) {
        throw new Error("Informe os números.");
      }

      const totalNumbers = Number(selectedSorteio.totalNumbers || 0);
      const invalid = numeros.filter((n) => n < 1 || n > totalNumbers);
      if (invalid.length) {
        throw new Error(`Números fora do intervalo do sorteio: ${invalid.join(", ")}`);
      }

      const payload = {
        nome,
        whatsapp,
        numeros,
        status: participantForm.status,
        origem: participantForm.origem,
        bloco: participantForm.bloco,
        observacao: participantForm.observacao.trim(),
      };

      const res = await fetch(
        `${API_BASE}/api/admin/sorteios/${selectedSorteio.id}/participantes/manual`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao cadastrar participante.");
      }

      setMessage(
        participantForm.bloco
          ? "Bloco cadastrado com sucesso."
          : "Participante cadastrado com sucesso."
      );

      resetParticipantForm();
      await loadParticipants(selectedSorteio.id);
      await loadResumo(selectedSorteio.id);
    } catch (err) {
      setError(err.message || "Erro ao cadastrar participante.");
    } finally {
      setSavingParticipant(false);
    }
  }

  async function handleDeleteParticipant(id) {
    const confirmed = window.confirm("Deseja excluir este participante?");
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/api/admin/participantes/${id}`, {
        method: "DELETE",
      });
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao excluir participante.");
      }

      setMessage("Participante excluído com sucesso.");
      if (selectedSorteioId) {
        await loadParticipants(selectedSorteioId);
        await loadResumo(selectedSorteioId);
      }
    } catch (err) {
      setError(err.message || "Erro ao excluir participante.");
    }
  }

  async function handleQuickCreateBlocks() {
    if (!selectedSorteio) {
      setError("Selecione um sorteio primeiro.");
      return;
    }

    const confirmed = window.confirm(
      "Criar blocos padrão?\n\nMãe: 151-300\nPai: 301-450\nVó: 451-550"
    );
    if (!confirmed) return;

    const blocks = [
      {
        nome: "Vendas externas mãe",
        whatsapp: onlyDigits(selectedSorteio.whatsapp || "16993537516"),
        numeros: "150-300",
        status: "reservado",
        origem: "mae",
        bloco: true,
        observacao: "Bloco externo da mãe",
      },
      {
        nome: "Vendas externas pai",
        whatsapp: onlyDigits(selectedSorteio.whatsapp || "16993537516"),
        numeros: "301-450",
        status: "reservado",
        origem: "pai",
        bloco: true,
        observacao: "Bloco externo do pai",
      },
      {
        nome: "Vendas externas vó",
        whatsapp: onlyDigits(selectedSorteio.whatsapp || "16993537516"),
        numeros: "451-550",
        status: "reservado",
        origem: "vo",
        bloco: true,
        observacao: "Bloco externo da vó",
      },
    ];

    try {
      setError("");
      setMessage("");

      for (const block of blocks) {
        const res = await fetch(
          `${API_BASE}/api/admin/sorteios/${selectedSorteio.id}/participantes/manual`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(block),
          }
        );

        const data = await safeJson(res);

        if (!res.ok) {
          throw new Error(data?.error || `Erro ao criar bloco ${block.nome}.`);
        }
      }

      setMessage("Blocos padrão criados com sucesso.");
      await loadParticipants(selectedSorteio.id);
      await loadResumo(selectedSorteio.id);
    } catch (err) {
      setError(err.message || "Erro ao criar blocos.");
    }
  }

  async function handleCopyLink() {
    if (!selectedSorteio) return;

    const link = `${window.location.origin}/#/sorteio/${
      selectedSorteio.slug || selectedSorteio.id
    }`;

    try {
      await copyToClipboard(link);
      setMessage("Link copiado com sucesso.");
      setError("");
    } catch (err) {
      setError(err.message || "Não foi possível copiar o link.");
    }
  }

  async function handleShare() {
    if (!selectedSorteio) return;

    const link = `${window.location.origin}/#/sorteio/${
      selectedSorteio.slug || selectedSorteio.id
    }`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedSorteio.title || "Sorteio",
          text: `Participe do sorteio ${selectedSorteio.title || ""}`,
          url: link,
        });
        setMessage("Link compartilhado com sucesso.");
        setError("");
      } else {
        await copyToClipboard(link);
        setMessage("Compartilhamento não disponível. Link copiado.");
        setError("");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError("Não foi possível compartilhar agora.");
      }
    }
  }

  function handleExportParticipants() {
    if (!selectedSorteio) return;

    const rows = [
      [
        "Nome",
        "Telefone",
        "Números",
        "Números compactos",
        "Status",
        "Origem",
        "Bloco",
        "Observação",
        "Total",
        "Criado em",
      ],
      ...participants.map((p) => [
        p.nome || "",
        p.telefone || "",
        Array.isArray(p.numeros) ? p.numeros.join(", ") : "",
        p.numerosTexto || "",
        p.status || "",
        p.origem || "",
        p.bloco ? "Sim" : "Não",
        p.observacao || "",
        p.valorPago || "",
        p.createdAt ? formatDate(p.createdAt) : "",
      ]),
    ];

    const safeName = (selectedSorteio.title || "participantes")
      .toLowerCase()
      .replace(/\s+/g, "-");

    downloadCSV(`${safeName}-participantes.csv`, rows);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Painel Administrativo</h1>
            <p style={styles.subtitle}>Casa Premiada Ribeirão</p>
          </div>

          <button style={styles.darkButton} onClick={resetSorteioForm}>
            + Novo sorteio
          </button>
        </header>

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {message ? <div style={styles.successBox}>{message}</div> : null}

        <section style={styles.mainGrid}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              {sorteioForm.id ? "Editar sorteio" : "Criar sorteio"}
            </h2>

            <form onSubmit={handleSaveSorteio} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Título</label>
                <input
                  style={styles.input}
                  value={sorteioForm.titulo}
                  onChange={(e) => handleSorteioChange("titulo", e.target.value)}
                  placeholder="Ex: Casa Premiada Ribeirão"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Descrição</label>
                <textarea
                  style={styles.textarea}
                  value={sorteioForm.descricao}
                  onChange={(e) => handleSorteioChange("descricao", e.target.value)}
                  placeholder="Descreva o prêmio e regras"
                  rows={4}
                />
              </div>

              <div style={styles.twoCols}>
                <div style={styles.field}>
                  <label style={styles.label}>Data do sorteio</label>
                  <input
                    type="datetime-local"
                    style={styles.input}
                    value={sorteioForm.dataSorteio}
                    onChange={(e) => handleSorteioChange("dataSorteio", e.target.value)}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>WhatsApp</label>
                  <input
                    style={styles.input}
                    value={sorteioForm.whatsapp}
                    onChange={(e) => handleSorteioChange("whatsapp", e.target.value)}
                    placeholder="(16) 99999-9999"
                  />
                </div>
              </div>

              <div style={styles.twoCols}>
                <div style={styles.field}>
                  <label style={styles.label}>Valor por número</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={styles.input}
                    value={sorteioForm.valorNumero}
                    onChange={(e) => handleSorteioChange("valorNumero", e.target.value)}
                    placeholder="2.00"
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Quantidade de números</label>
                  <input
                    type="number"
                    min="1"
                    style={styles.input}
                    value={sorteioForm.totalNumeros}
                    onChange={(e) => handleSorteioChange("totalNumeros", e.target.value)}
                    placeholder="500"
                    required
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <select
                  style={styles.input}
                  value={sorteioForm.status}
                  onChange={(e) => handleSorteioChange("status", e.target.value)}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div style={styles.twoCols}>
                <div style={styles.uploadArea}>
                  <label style={styles.label}>Foto do prêmio</label>
                  <input type="file" accept="image/*" onChange={handleImageFileChange} />
                  {sorteioForm.imagemPreview ? (
                    <img
                      src={sorteioForm.imagemPreview}
                      alt="Prêmio"
                      style={styles.previewLarge}
                    />
                  ) : null}
                </div>

                <div style={styles.uploadArea}>
                  <label style={styles.label}>Logo pública</label>
                  <input type="file" accept="image/*" onChange={handleLogoFileChange} />
                  {sorteioForm.logoPreview ? (
                    <img
                      src={sorteioForm.logoPreview}
                      alt="Logo"
                      style={styles.previewLarge}
                    />
                  ) : null}
                </div>
              </div>

              <div style={styles.actions}>
                <button type="submit" style={styles.greenButton} disabled={savingSorteio}>
                  {savingSorteio
                    ? "Salvando..."
                    : sorteioForm.id
                    ? "Atualizar sorteio"
                    : "Criar sorteio"}
                </button>

                {sorteioForm.id ? (
                  <button type="button" style={styles.grayButton} onClick={resetSorteioForm}>
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Sorteios cadastrados</h2>

            {loadingSorteios ? (
              <p>Carregando sorteios...</p>
            ) : sorteios.length === 0 ? (
              <p>Nenhum sorteio cadastrado.</p>
            ) : (
              <div style={styles.list}>
                {sorteios.map((sorteio) => {
                  const active = selectedSorteioId === sorteio.id;

                  return (
                    <div
                      key={sorteio.id}
                      style={{
                        ...styles.listItem,
                        border: active ? "2px solid #16a34a" : "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={styles.listItemMain}
                        onClick={() => setSelectedSorteioId(sorteio.id)}
                      >
                        <div style={styles.listItemTitleRow}>
                          <strong>{sorteio.title}</strong>
                          <span style={styles.badge}>{sorteio.status}</span>
                        </div>

                        <div style={styles.metaText}>
                          Valor: {currencyBRL(sorteio.price)}
                        </div>
                        <div style={styles.metaText}>
                          Números: {sorteio.totalNumbers || 0}
                        </div>
                        <div style={styles.metaText}>
                          Sorteio: {formatDate(sorteio.drawDate)}
                        </div>
                      </div>

                      <div style={styles.inlineButtons}>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => handleEditSorteio(sorteio)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={async () => {
                            setSelectedSorteioId(sorteio.id);
                            await copyToClipboard(
                              `${window.location.origin}/#/sorteio/${
                                sorteio.slug || sorteio.id
                              }`
                            );
                            setMessage("Link copiado.");
                            setError("");
                          }}
                        >
                          Link
                        </button>

                        <button
                          type="button"
                          style={styles.smallDangerButton}
                          onClick={() => handleDeleteSorteio(sorteio.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {selectedSorteio ? (
          <>
            <section style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Arrecadado</span>
                <strong style={styles.metricValue}>
                  {loadingResumo ? "..." : currencyBRL(sorteioMetrics.arrecadado)}
                </strong>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Vendidos</span>
                <strong style={styles.metricValue}>
                  {loadingResumo ? "..." : sorteioMetrics.vendidos}
                </strong>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Reservados</span>
                <strong style={styles.metricValue}>
                  {loadingResumo ? "..." : sorteioMetrics.reservados}
                </strong>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Disponíveis</span>
                <strong style={styles.metricValue}>
                  {loadingResumo ? "..." : sorteioMetrics.disponiveis}
                </strong>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Link do sorteio</h2>
                  <p style={styles.subtitle2}>Copie ou compartilhe o link público</p>
                </div>

                <div style={styles.inlineButtons}>
                  <button style={styles.greenButton} onClick={handleCopyLink}>
                    Copiar link
                  </button>
                  <button style={styles.grayButton} onClick={handleShare}>
                    Compartilhar
                  </button>
                </div>
              </div>

              <input
                readOnly
                style={styles.input}
                value={`${window.location.origin}/#/sorteio/${
                  selectedSorteio.slug || selectedSorteio.id
                }`}
              />
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Blocos rápidos</h2>
                  <p style={styles.subtitle2}>
                    Crie automaticamente os blocos de mãe, pai e vó
                  </p>
                </div>

                <button style={styles.greenButton} onClick={handleQuickCreateBlocks}>
                  Criar blocos padrão
                </button>
              </div>

              <div style={styles.blocksGrid}>
                <div style={styles.blockInfo}>
                  <div style={styles.blockTitle}>Mãe</div>
                  <div style={styles.blockText}>1 até 150</div>
                </div>
                <div style={styles.blockInfo}>
                  <div style={styles.blockTitle}>Pai</div>
                  <div style={styles.blockText}>151 até 300</div>
                </div>
                <div style={styles.blockInfo}>
                  <div style={styles.blockTitle}>Vó</div>
                  <div style={styles.blockText}>301 até 400</div>
                </div>
              </div>
            </section>

            <section style={styles.twoSectionGrid}>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Adicionar participante</h2>

                <form onSubmit={handleSaveParticipant} style={styles.form}>
                  <div style={styles.field}>
                    <label style={styles.label}>Nome</label>
                    <input
                      style={styles.input}
                      value={participantForm.nome}
                      onChange={(e) => handleParticipantChange("nome", e.target.value)}
                      placeholder="Nome completo"
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Telefone</label>
                    <input
                      style={styles.input}
                      value={participantForm.telefone}
                      onChange={(e) => handleParticipantChange("telefone", e.target.value)}
                      placeholder="(16) 99999-9999"
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Números</label>
                    <input
                      style={styles.input}
                      value={participantForm.numeros}
                      onChange={(e) => handleParticipantChange("numeros", e.target.value)}
                      placeholder="Ex: 305,308 ou 301-400"
                      required
                    />
                    <small style={styles.helpSmall}>
                      Aceita números separados por vírgula e também intervalo.
                    </small>
                  </div>

                  <div style={styles.twoCols}>
                    <div style={styles.field}>
                      <label style={styles.label}>Status</label>
                      <select
                        style={styles.input}
                        value={participantForm.status}
                        onChange={(e) => handleParticipantChange("status", e.target.value)}
                      >
                        <option value="reservado">Reservado</option>
                        <option value="pago">Pago</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Origem</label>
                      <select
                        style={styles.input}
                        value={participantForm.origem}
                        onChange={(e) => handleParticipantChange("origem", e.target.value)}
                      >
                        <option value="site">Site</option>
                        <option value="mae">Mãe</option>
                        <option value="pai">Pai</option>
                        <option value="vo">Vó</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </div>

                  <div style={styles.checkRow}>
                    <label style={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={participantForm.bloco}
                        onChange={(e) => handleParticipantChange("bloco", e.target.checked)}
                      />
                      <span>Cadastrar como bloco externo</span>
                    </label>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Observação</label>
                    <input
                      style={styles.input}
                      value={participantForm.observacao}
                      onChange={(e) =>
                        handleParticipantChange("observacao", e.target.value)
                      }
                      placeholder="Ex: venda da mãe, cliente presencial, etc."
                    />
                  </div>

                  <button
                    type="submit"
                    style={styles.greenButton}
                    disabled={savingParticipant}
                  >
                    {savingParticipant
                      ? "Salvando..."
                      : participantForm.bloco
                      ? "Cadastrar bloco"
                      : "Cadastrar participante"}
                  </button>
                </form>
              </div>

              <div style={styles.card}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>Participantes</h2>
                    <p style={styles.subtitle2}>Lista completa de compradores e blocos</p>
                  </div>

                  <button style={styles.greenButton} onClick={handleExportParticipants}>
                    Baixar CSV
                  </button>
                </div>

                <div style={styles.originSummary}>
                  <div style={styles.originBadge}>Mãe: {groupedParticipants.mae.length}</div>
                  <div style={styles.originBadge}>Pai: {groupedParticipants.pai.length}</div>
                  <div style={styles.originBadge}>Vó: {groupedParticipants.vo.length}</div>
                  <div style={styles.originBadge}>Site: {groupedParticipants.site.length}</div>
                  <div style={styles.originBadge}>
                    Manual: {groupedParticipants.manual.length}
                  </div>
                </div>

                {loadingParticipants ? (
                  <p>Carregando...</p>
                ) : participants.length === 0 ? (
                  <p>Nenhum participante.</p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Nome</th>
                          <th style={styles.th}>Telefone</th>
                          <th style={styles.th}>Números</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Origem</th>
                          <th style={styles.th}>Bloco</th>
                          <th style={styles.th}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p) => (
                          <tr key={p.id}>
                            <td style={styles.td}>
                              <div>{p.nome}</div>
                              {p.observacao ? (
                                <small style={styles.helpSmall}>{p.observacao}</small>
                              ) : null}
                            </td>
                            <td style={styles.td}>{p.telefone}</td>
                            <td style={styles.td}>{p.numerosTexto || p.numeros?.join(", ")}</td>
                            <td style={styles.td}>{p.status}</td>
                            <td style={styles.td}>{p.origem}</td>
                            <td style={styles.td}>{p.bloco ? "Sim" : "Não"}</td>
                            <td style={styles.td}>
                              <button
                                type="button"
                                style={styles.smallDangerButton}
                                onClick={() => handleDeleteParticipant(p.id)}
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "24px 14px",
    fontFamily: "Arial, sans-serif",
    color: "#111827",
  },
  container: {
    maxWidth: "1350px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 800,
  },
  subtitle: {
    margin: "4px 0 0 0",
    color: "#6b7280",
    fontSize: "15px",
  },
  subtitle2: {
    margin: "4px 0 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },
  successBox: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    padding: "12px 14px",
    borderRadius: "14px",
    marginBottom: "16px",
  },
  errorBox: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "12px 14px",
    borderRadius: "14px",
    marginBottom: "16px",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "18px",
    marginBottom: "20px",
  },
  twoSectionGrid: {
    display: "grid",
    gridTemplateColumns: "0.9fr 1.1fr",
    gap: "18px",
    marginBottom: "20px",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },
  metricCard: {
    background: "#fff",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
  },
  metricLabel: {
    display: "block",
    color: "#6b7280",
    fontSize: "14px",
    marginBottom: "8px",
  },
  metricValue: {
    fontSize: "26px",
    fontWeight: 800,
  },
  card: {
    background: "#fff",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
  },
  cardTitle: {
    margin: "0 0 16px 0",
    fontSize: "21px",
    fontWeight: 800,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 700,
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    resize: "vertical",
    width: "100%",
    boxSizing: "border-box",
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  uploadArea: {
    border: "1px dashed #cbd5e1",
    borderRadius: "16px",
    background: "#f8fafc",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  previewLarge: {
    width: "100%",
    maxWidth: "280px",
    height: "180px",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "6px",
  },
  greenButton: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
  grayButton: {
    background: "#fff",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
  darkButton: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  listItem: {
    borderRadius: "16px",
    padding: "14px",
    background: "#fff",
  },
  listItemMain: {
    cursor: "pointer",
    marginBottom: "12px",
  },
  listItemTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  badge: {
    fontSize: "12px",
    background: "#eef2ff",
    color: "#4338ca",
    padding: "6px 10px",
    borderRadius: "999px",
    fontWeight: 700,
    textTransform: "capitalize",
  },
  metaText: {
    fontSize: "13px",
    color: "#6b7280",
    marginTop: "4px",
  },
  inlineButtons: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallButton: {
    background: "#f3f4f6",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },
  smallDangerButton: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "12px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  blocksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  blockInfo: {
    border: "1px solid #dbe4f0",
    borderRadius: "16px",
    padding: "14px",
    background: "#f8fafc",
  },
  blockTitle: {
    fontWeight: 800,
    fontSize: "16px",
    marginBottom: "6px",
  },
  blockText: {
    color: "#475467",
    fontSize: "14px",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  helpSmall: {
    color: "#6b7280",
    fontSize: "12px",
  },
  originSummary: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  originBadge: {
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "920px",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "13px",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "14px",
    verticalAlign: "top",
  },
};

