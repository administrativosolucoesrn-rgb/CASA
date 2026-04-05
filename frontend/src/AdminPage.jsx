import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const emptyRaffleForm = {
  id: null,
  title: "",
  description: "",
  drawDate: "",
  pricePerNumber: "",
  totalNumbers: "",
  whatsapp: "",
  status: "draft",
  logoUrl: "",
  prizeImageUrl: "",
  coverImageUrl: "",
};

const emptyParticipantForm = {
  name: "",
  phone: "",
  numbers: "",
  status: "reserved",
  amountPaid: "",
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

function parseNumbersInput(input = "") {
  return [
    ...new Set(
      String(input)
        .split(/[\s,;]+/)
        .map((item) => Number(item.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ].sort((a, b) => a - b);
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
}

export default function AdminPage() {
  const [raffles, setRaffles] = useState([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState(null);

  const [raffleForm, setRaffleForm] = useState(emptyRaffleForm);
  const [participantForm, setParticipantForm] = useState(emptyParticipantForm);

  const [participants, setParticipants] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  const [loadingRaffles, setLoadingRaffles] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [savingRaffle, setSavingRaffle] = useState(false);
  const [savingParticipant, setSavingParticipant] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPrize, setUploadingPrize] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadRaffles();
    loadDashboard();
  }, []);

  useEffect(() => {
    if (selectedRaffleId) {
      loadParticipants(selectedRaffleId);
    } else {
      setParticipants([]);
    }
  }, [selectedRaffleId]);

  async function safeJson(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function loadRaffles() {
    try {
      setLoadingRaffles(true);
      setError("");

      const res = await fetch(`${API_BASE}/api/admin/raffles`);
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar sorteios.");
      }

      const list = Array.isArray(data) ? data : [];
      setRaffles(list);

      if (list.length && !selectedRaffleId) {
        setSelectedRaffleId(list[0].id);
      }

      if (!list.length) {
        setSelectedRaffleId(null);
      }
    } catch (err) {
      setError(err.message || "Erro ao carregar sorteios.");
    } finally {
      setLoadingRaffles(false);
    }
  }

  async function loadParticipants(raffleId) {
    try {
      setLoadingParticipants(true);
      setError("");

      const res = await fetch(`${API_BASE}/api/admin/raffles/${raffleId}/participants`);
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar participantes.");
      }

      setParticipants(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Erro ao carregar participantes.");
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  }

  async function loadDashboard() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`);
      const data = await safeJson(res);

      if (!res.ok) return;
      setDashboard(data);
    } catch {
      // silencioso
    }
  }

  function resetRaffleForm() {
    setRaffleForm(emptyRaffleForm);
  }

  function resetParticipantForm() {
    setParticipantForm(emptyParticipantForm);
  }

  const selectedRaffle = useMemo(() => {
    return raffles.find((item) => item.id === selectedRaffleId) || null;
  }, [raffles, selectedRaffleId]);

  const raffleMetrics = useMemo(() => {
    if (!selectedRaffle) {
      return {
        soldNumbers: 0,
        reservedNumbers: 0,
        paidNumbers: 0,
        amountRaised: 0,
      };
    }

    return {
      soldNumbers: Number(selectedRaffle.soldNumbers || 0),
      reservedNumbers: Number(selectedRaffle.reservedNumbers || 0),
      paidNumbers: Number(selectedRaffle.paidNumbers || 0),
      amountRaised: Number(selectedRaffle.amountRaised || 0),
    };
  }, [selectedRaffle]);

  async function uploadFile(file, field) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", field);

    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await safeJson(res);

    if (!res.ok) {
      throw new Error(data?.error || "Erro ao enviar arquivo.");
    }

    return data.url;
  }

  async function handleImageUpload(event, field) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setError("");

    try {
      if (field === "logoUrl") setUploadingLogo(true);
      if (field === "prizeImageUrl") setUploadingPrize(true);
      if (field === "coverImageUrl") setUploadingCover(true);

      const url = await uploadFile(file, field);

      setRaffleForm((prev) => ({
        ...prev,
        [field]: url,
      }));

      setMessage("Imagem enviada com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao enviar imagem.");
    } finally {
      if (field === "logoUrl") setUploadingLogo(false);
      if (field === "prizeImageUrl") setUploadingPrize(false);
      if (field === "coverImageUrl") setUploadingCover(false);

      event.target.value = "";
    }
  }

  function handleRaffleChange(field, value) {
    if (field === "whatsapp") {
      setRaffleForm((prev) => ({
        ...prev,
        whatsapp: formatPhone(value),
      }));
      return;
    }

    setRaffleForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleParticipantChange(field, value) {
    if (field === "phone") {
      setParticipantForm((prev) => ({
        ...prev,
        phone: formatPhone(value),
      }));
      return;
    }

    setParticipantForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSaveRaffle(e) {
    e.preventDefault();

    try {
      setSavingRaffle(true);
      setMessage("");
      setError("");

      const payload = {
        title: raffleForm.title,
        description: raffleForm.description,
        drawDate: raffleForm.drawDate,
        pricePerNumber: Number(raffleForm.pricePerNumber || 0),
        totalNumbers: Number(raffleForm.totalNumbers || 0),
        whatsapp: onlyDigits(raffleForm.whatsapp),
        status: raffleForm.status,
        logoUrl: raffleForm.logoUrl,
        prizeImageUrl: raffleForm.prizeImageUrl,
        coverImageUrl: raffleForm.coverImageUrl,
        baseUrl: window.location.origin,
      };

      const isEdit = Boolean(raffleForm.id);

      const res = await fetch(
        isEdit
          ? `${API_BASE}/api/admin/raffles/${raffleForm.id}`
          : `${API_BASE}/api/admin/raffles`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao salvar sorteio.");
      }

      setMessage(isEdit ? "Sorteio atualizado com sucesso." : "Sorteio criado com sucesso.");
      resetRaffleForm();
      await loadRaffles();
      await loadDashboard();

      if (data?.id) {
        setSelectedRaffleId(data.id);
      }
    } catch (err) {
      setError(err.message || "Erro ao salvar sorteio.");
    } finally {
      setSavingRaffle(false);
    }
  }

  function handleEditRaffle(raffle) {
    setRaffleForm({
      id: raffle.id || null,
      title: raffle.title || "",
      description: raffle.description || "",
      drawDate: raffle.drawDate ? String(raffle.drawDate).slice(0, 16) : "",
      pricePerNumber: raffle.pricePerNumber || "",
      totalNumbers: raffle.totalNumbers || "",
      whatsapp: formatPhone(raffle.whatsapp || ""),
      status: raffle.status || "draft",
      logoUrl: raffle.logoUrl || "",
      prizeImageUrl: raffle.prizeImageUrl || "",
      coverImageUrl: raffle.coverImageUrl || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteRaffle(id) {
    const confirmed = window.confirm("Deseja realmente excluir este sorteio?");
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/api/admin/raffles/${id}`, {
        method: "DELETE",
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao excluir sorteio.");
      }

      setMessage("Sorteio excluído com sucesso.");

      if (selectedRaffleId === id) {
        setSelectedRaffleId(null);
      }

      await loadRaffles();
      await loadDashboard();
      resetRaffleForm();
      setParticipants([]);
    } catch (err) {
      setError(err.message || "Erro ao excluir sorteio.");
    }
  }

  async function handleSaveParticipant(e) {
    e.preventDefault();

    if (!selectedRaffle) {
      setError("Selecione um sorteio antes de cadastrar participante.");
      return;
    }

    try {
      setSavingParticipant(true);
      setError("");
      setMessage("");

      const parsedNumbers = parseNumbersInput(participantForm.numbers);

      const payload = {
        name: participantForm.name.trim(),
        phone: onlyDigits(participantForm.phone),
        numbers: parsedNumbers,
        status: participantForm.status,
        amountPaid:
          participantForm.amountPaid !== ""
            ? Number(participantForm.amountPaid)
            : parsedNumbers.length * Number(selectedRaffle.pricePerNumber || 0),
      };

      const res = await fetch(
        `${API_BASE}/api/admin/raffles/${selectedRaffle.id}/participants`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao cadastrar participante.");
      }

      setMessage("Participante cadastrado com sucesso.");
      resetParticipantForm();
      await loadParticipants(selectedRaffle.id);
      await loadRaffles();
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Erro ao cadastrar participante.");
    } finally {
      setSavingParticipant(false);
    }
  }

  async function handleMarkAsPaid(participant) {
    if (!selectedRaffle) return;

    try {
      setError("");
      setMessage("");

      const res = await fetch(
        `${API_BASE}/api/admin/raffles/${selectedRaffle.id}/participants/${participant.id}/pay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amountPaid:
              participant.amountPaid != null && participant.amountPaid !== ""
                ? Number(participant.amountPaid)
                : Array.isArray(participant.numbers)
                ? participant.numbers.length * Number(selectedRaffle.pricePerNumber || 0)
                : 0,
          }),
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao marcar pagamento.");
      }

      setMessage("Participante marcado como pago.");
      await loadParticipants(selectedRaffle.id);
      await loadRaffles();
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Erro ao marcar pagamento.");
    }
  }

  async function handleDeleteParticipant(participantId) {
    if (!selectedRaffle) return;

    const confirmed = window.confirm("Deseja excluir este participante?");
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const res = await fetch(
        `${API_BASE}/api/admin/raffles/${selectedRaffle.id}/participants/${participantId}`,
        {
          method: "DELETE",
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao excluir participante.");
      }

      setMessage("Participante excluído com sucesso.");
      await loadParticipants(selectedRaffle.id);
      await loadRaffles();
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Erro ao excluir participante.");
    }
  }

  async function handleCopyLink() {
    if (!selectedRaffle) return;

    const link =
      selectedRaffle.publicLink ||
      `${window.location.origin}/#/sorteio/${selectedRaffle.slug || selectedRaffle.id}`
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copiado com sucesso.");
    } catch {
      setError("Não foi possível copiar o link.");
    }
  }

  async function handleShare() {
    if (!selectedRaffle) return;

    const link =
      selectedRaffle.publicLink ||
      `${window.location.origin}/sorteio/${selectedRaffle.slug || selectedRaffle.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedRaffle.title,
          text: `Participe do sorteio ${selectedRaffle.title}`,
          url: link,
        });
        setMessage("Link compartilhado com sucesso.");
      } else {
        await navigator.clipboard.writeText(link);
        setMessage("Compartilhamento não disponível. Link copiado.");
      }
    } catch {
      //
    }
  }

  function handleExportParticipants() {
    if (!selectedRaffle) return;

    const rows = [
      ["Nome", "Telefone", "Números Comprados", "Status", "Valor Pago", "Criado em"],
      ...participants.map((p) => [
        p.name || "",
        p.phone || "",
        Array.isArray(p.numbers) ? p.numbers.join(", ") : "",
        p.status || "",
        p.amountPaid || 0,
        formatDate(p.createdAt),
      ]),
    ];

    const safeName = (selectedRaffle.title || "participantes")
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

          <button style={styles.darkButton} onClick={resetRaffleForm}>
            + Novo sorteio
          </button>
        </header>

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {message ? <div style={styles.successBox}>{message}</div> : null}

        {dashboard ? (
          <section style={styles.dashboardGrid}>
            <div style={styles.dashboardCard}>
              <span style={styles.metricLabel}>Total arrecadado</span>
              <strong style={styles.metricValue}>{currencyBRL(dashboard.totalRaised)}</strong>
            </div>
            <div style={styles.dashboardCard}>
              <span style={styles.metricLabel}>Bilhetes vendidos</span>
              <strong style={styles.metricValue}>{dashboard.totalSold || 0}</strong>
            </div>
            <div style={styles.dashboardCard}>
              <span style={styles.metricLabel}>Reservados</span>
              <strong style={styles.metricValue}>{dashboard.totalReserved || 0}</strong>
            </div>
            <div style={styles.dashboardCard}>
              <span style={styles.metricLabel}>Pagos</span>
              <strong style={styles.metricValue}>{dashboard.totalPaid || 0}</strong>
            </div>
          </section>
        ) : null}

        <section style={styles.mainGrid}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              {raffleForm.id ? "Editar sorteio" : "Criar sorteio"}
            </h2>

            <form onSubmit={handleSaveRaffle} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Título</label>
                <input
                  style={styles.input}
                  value={raffleForm.title}
                  onChange={(e) => handleRaffleChange("title", e.target.value)}
                  placeholder="Ex: Casa Premiada Ribeirão"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Descrição</label>
                <textarea
                  style={styles.textarea}
                  value={raffleForm.description}
                  onChange={(e) => handleRaffleChange("description", e.target.value)}
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
                    value={raffleForm.drawDate}
                    onChange={(e) => handleRaffleChange("drawDate", e.target.value)}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>WhatsApp</label>
                  <input
                    style={styles.input}
                    value={raffleForm.whatsapp}
                    onChange={(e) => handleRaffleChange("whatsapp", e.target.value)}
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
                    value={raffleForm.pricePerNumber}
                    onChange={(e) => handleRaffleChange("pricePerNumber", e.target.value)}
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
                    value={raffleForm.totalNumbers}
                    onChange={(e) => handleRaffleChange("totalNumbers", e.target.value)}
                    placeholder="300"
                    required
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <select
                  style={styles.input}
                  value={raffleForm.status}
                  onChange={(e) => handleRaffleChange("status", e.target.value)}
                >
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="finished">Finalizado</option>
                </select>
              </div>

              <div style={styles.uploadArea}>
                <label style={styles.label}>Logo</label>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "logoUrl")} />
                {uploadingLogo ? <small>Enviando logo...</small> : null}
                {raffleForm.logoUrl ? (
                  <img src={raffleForm.logoUrl} alt="Logo" style={styles.previewSmall} />
                ) : null}
              </div>

              <div style={styles.uploadArea}>
                <label style={styles.label}>Foto do prêmio</label>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "prizeImageUrl")} />
                {uploadingPrize ? <small>Enviando foto do prêmio...</small> : null}
                {raffleForm.prizeImageUrl ? (
                  <img src={raffleForm.prizeImageUrl} alt="Prêmio" style={styles.previewLarge} />
                ) : null}
              </div>

              <div style={styles.uploadArea}>
                <label style={styles.label}>Imagem de capa</label>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "coverImageUrl")} />
                {uploadingCover ? <small>Enviando capa...</small> : null}
                {raffleForm.coverImageUrl ? (
                  <img src={raffleForm.coverImageUrl} alt="Capa" style={styles.previewLarge} />
                ) : null}
              </div>

              <div style={styles.actions}>
                <button type="submit" style={styles.greenButton} disabled={savingRaffle}>
                  {savingRaffle
                    ? "Salvando..."
                    : raffleForm.id
                    ? "Atualizar sorteio"
                    : "Criar sorteio"}
                </button>

                {raffleForm.id ? (
                  <button type="button" style={styles.grayButton} onClick={resetRaffleForm}>
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Sorteios cadastrados</h2>

            {loadingRaffles ? (
              <p>Carregando sorteios...</p>
            ) : raffles.length === 0 ? (
              <p>Nenhum sorteio cadastrado.</p>
            ) : (
              <div style={styles.list}>
                {raffles.map((raffle) => {
                  const active = selectedRaffleId === raffle.id;

                  return (
                    <div
                      key={raffle.id}
                      style={{
                        ...styles.listItem,
                        border: active ? "2px solid #16a34a" : "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={styles.listItemMain}
                        onClick={() => setSelectedRaffleId(raffle.id)}
                      >
                        <div style={styles.listItemTitleRow}>
                          <strong>{raffle.title}</strong>
                          <span style={styles.badge}>{raffle.status}</span>
                        </div>

                        <div style={styles.metaText}>
                          Valor: {currencyBRL(raffle.pricePerNumber)}
                        </div>
                        <div style={styles.metaText}>
                          Números: {raffle.totalNumbers || 0}
                        </div>
                        <div style={styles.metaText}>
                          Sorteio: {formatDate(raffle.drawDate)}
                        </div>
                      </div>

                      <div style={styles.inlineButtons}>
                        <button
                          style={styles.smallButton}
                          onClick={() => handleEditRaffle(raffle)}
                        >
                          Editar
                        </button>
                        <button
                          style={styles.smallButton}
                          onClick={() => {
                            setSelectedRaffleId(raffle.id);
                            navigator.clipboard.writeText(
                              `${window.location.origin}/sorteio/${raffle.slug || raffle.id}`
                            );
                            setMessage("Link copiado.");
                          }}
                        >
                          Link
                        </button>
                        <button
                          style={styles.smallDangerButton}
                          onClick={() => handleDeleteRaffle(raffle.id)}
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

        {selectedRaffle ? (
          <>
            <section style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Arrecadado</span>
                <strong style={styles.metricValue}>{currencyBRL(raffleMetrics.amountRaised)}</strong>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Vendidos</span>
                <strong style={styles.metricValue}>{raffleMetrics.soldNumbers}</strong>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Reservados</span>
                <strong style={styles.metricValue}>{raffleMetrics.reservedNumbers}</strong>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Pagos</span>
                <strong style={styles.metricValue}>{raffleMetrics.paidNumbers}</strong>
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
                value={`${window.location.origin}/sorteio/${selectedRaffle.slug || selectedRaffle.id}`}
              />
            </section>

            <section style={styles.twoSectionGrid}>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Adicionar participante</h2>

                <form onSubmit={handleSaveParticipant} style={styles.form}>
                  <div style={styles.field}>
                    <label style={styles.label}>Nome</label>
                    <input
                      style={styles.input}
                      value={participantForm.name}
                      onChange={(e) => handleParticipantChange("name", e.target.value)}
                      placeholder="Nome completo"
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Telefone</label>
                    <input
                      style={styles.input}
                      value={participantForm.phone}
                      onChange={(e) => handleParticipantChange("phone", e.target.value)}
                      placeholder="(16) 99999-9999"
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Números comprados</label>
                    <input
                      style={styles.input}
                      value={participantForm.numbers}
                      onChange={(e) => handleParticipantChange("numbers", e.target.value)}
                      placeholder="Ex: 1, 8, 15, 44"
                      required
                    />
                    <small style={styles.helpText}>
                      Separe por vírgula, espaço ou ponto e vírgula.
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
                        <option value="reserved">Reservado</option>
                        <option value="paid">Pago</option>
                        <option value="sold">Vendido</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Valor pago</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={styles.input}
                        value={participantForm.amountPaid}
                        onChange={(e) => handleParticipantChange("amountPaid", e.target.value)}
                        placeholder="Automático se vazio"
                      />
                    </div>
                  </div>

                  <button type="submit" style={styles.greenButton} disabled={savingParticipant}>
                    {savingParticipant ? "Salvando..." : "Cadastrar participante"}
                  </button>
                </form>
              </div>

              <div style={styles.card}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>Participantes</h2>
                    <p style={styles.subtitle2}>Nome, telefone, números e status</p>
                  </div>

                  <button style={styles.greenButton} onClick={handleExportParticipants}>
                    Baixar CSV
                  </button>
                </div>

                {loadingParticipants ? (
                  <p>Carregando participantes...</p>
                ) : participants.length === 0 ? (
                  <p>Nenhum participante neste sorteio.</p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Nome</th>
                          <th style={styles.th}>Telefone</th>
                          <th style={styles.th}>Números</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Valor</th>
                          <th style={styles.th}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((participant) => (
                          <tr key={participant.id}>
                            <td style={styles.td}>{participant.name || "-"}</td>
                            <td style={styles.td}>{participant.phone || "-"}</td>
                            <td style={styles.td}>
                              {Array.isArray(participant.numbers)
                                ? participant.numbers.join(", ")
                                : "-"}
                            </td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.statusPill,
                                  background:
                                    participant.status === "paid"
                                      ? "#dcfce7"
                                      : participant.status === "reserved"
                                      ? "#fef3c7"
                                      : "#e0f2fe",
                                  color:
                                    participant.status === "paid"
                                      ? "#166534"
                                      : participant.status === "reserved"
                                      ? "#92400e"
                                      : "#075985",
                                }}
                              >
                                {participant.status}
                              </span>
                            </td>
                            <td style={styles.td}>{currencyBRL(participant.amountPaid || 0)}</td>
                            <td style={styles.td}>
                              <div style={styles.inlineButtons}>
                                {participant.status !== "paid" ? (
                                  <button
                                    style={styles.smallButton}
                                    onClick={() => handleMarkAsPaid(participant)}
                                  >
                                    Marcar pago
                                  </button>
                                ) : null}

                                <button
                                  style={styles.smallDangerButton}
                                  onClick={() => handleDeleteParticipant(participant.id)}
                                >
                                  Excluir
                                </button>
                              </div>
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
  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },
  dashboardCard: {
    background: "#fff",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
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
  previewSmall: {
    width: "110px",
    height: "110px",
    objectFit: "cover",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
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
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
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
  statusPill: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "capitalize",
  },
  helpText: {
    color: "#6b7280",
    fontSize: "12px",
  },
};
