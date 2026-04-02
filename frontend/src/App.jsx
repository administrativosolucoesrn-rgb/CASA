import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const emptyForm = {
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

function currencyBRL(value) {
  const number = Number(value || 0);
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizePhone(value = "") {
  return value.replace(/\D/g, "");
}

function formatPhone(value = "") {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function downloadCSV(filename, rows) {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell == null ? "" : String(cell);
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(";")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
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

export default function App() {
  const [raffles, setRaffles] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPrize, setUploadingPrize] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadRaffles();
  }, []);

  useEffect(() => {
    if (selectedRaffleId) {
      loadParticipants(selectedRaffleId);
    } else {
      setParticipants([]);
    }
  }, [selectedRaffleId]);

  async function loadRaffles() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`${API_BASE}/api/admin/raffles`);
      const data = await res.json();

      const list = Array.isArray(data) ? data : data?.raffles || [];
      setRaffles(list);

      if (list.length && !selectedRaffleId) {
        setSelectedRaffleId(list[0].id);
      }
    } catch (error) {
      console.error(error);
      setMessage("Erro ao carregar sorteios.");
    } finally {
      setLoading(false);
    }
  }

  async function loadParticipants(raffleId) {
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/raffles/${raffleId}/participants`
      );
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.participants || [];
      setParticipants(list);
    } catch (error) {
      console.error(error);
      setParticipants([]);
    }
  }

  function resetForm() {
    setForm(emptyForm);
  }

  function handleEditRaffle(raffle) {
    setForm({
      id: raffle.id || null,
      title: raffle.title || "",
      description: raffle.description || "",
      drawDate: raffle.drawDate
        ? String(raffle.drawDate).slice(0, 16)
        : "",
      pricePerNumber: raffle.pricePerNumber || "",
      totalNumbers: raffle.totalNumbers || "",
      whatsapp: raffle.whatsapp || "",
      status: raffle.status || "draft",
      logoUrl: raffle.logoUrl || "",
      prizeImageUrl: raffle.prizeImageUrl || "",
      coverImageUrl: raffle.coverImageUrl || "",
    });
  }

  function handleChange(field, value) {
    if (field === "whatsapp") {
      setForm((prev) => ({ ...prev, whatsapp: formatPhone(value) }));
      return;
    }

    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function uploadFile(file, type) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Falha no upload");
    }

    const data = await res.json();
    return data.url;
  }

  async function handleFileChange(event, field) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (field === "logoUrl") setUploadingLogo(true);
      if (field === "prizeImageUrl") setUploadingPrize(true);
      if (field === "coverImageUrl") setUploadingCover(true);

      const url = await uploadFile(file, field);
      setForm((prev) => ({ ...prev, [field]: url }));
      setMessage("Imagem enviada com sucesso.");
    } catch (error) {
      console.error(error);
      setMessage("Erro ao enviar imagem.");
    } finally {
      if (field === "logoUrl") setUploadingLogo(false);
      if (field === "prizeImageUrl") setUploadingPrize(false);
      if (field === "coverImageUrl") setUploadingCover(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        title: form.title,
        description: form.description,
        drawDate: form.drawDate,
        pricePerNumber: Number(form.pricePerNumber || 0),
        totalNumbers: Number(form.totalNumbers || 0),
        whatsapp: normalizePhone(form.whatsapp),
        status: form.status,
        logoUrl: form.logoUrl,
        prizeImageUrl: form.prizeImageUrl,
        coverImageUrl: form.coverImageUrl,
      };

      const isEdit = Boolean(form.id);
      const endpoint = isEdit
        ? `${API_BASE}/api/admin/raffles/${form.id}`
        : `${API_BASE}/api/admin/raffles`;

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Falha ao salvar");
      }

      setMessage(isEdit ? "Sorteio atualizado com sucesso." : "Sorteio criado com sucesso.");
      resetForm();
      await loadRaffles();
    } catch (error) {
      console.error(error);
      setMessage("Erro ao salvar sorteio.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRaffle(id) {
    const ok = window.confirm("Deseja realmente excluir este sorteio?");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/raffles/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Erro ao excluir");
      }

      setMessage("Sorteio excluído com sucesso.");
      if (selectedRaffleId === id) {
        setSelectedRaffleId(null);
      }
      await loadRaffles();
    } catch (error) {
      console.error(error);
      setMessage("Erro ao excluir sorteio.");
    }
  }

  const selectedRaffle = useMemo(() => {
    return raffles.find((item) => item.id === selectedRaffleId) || null;
  }, [raffles, selectedRaffleId]);

  const metrics = useMemo(() => {
    if (!selectedRaffle) {
      return {
        sold: 0,
        reserved: 0,
        paid: 0,
        revenue: 0,
      };
    }

    const sold = Number(selectedRaffle.soldNumbers || 0);
    const reserved = Number(selectedRaffle.reservedNumbers || 0);
    const paid = Number(selectedRaffle.paidNumbers || 0);
    const revenue =
      Number(selectedRaffle.amountRaised || 0) ||
      paid * Number(selectedRaffle.pricePerNumber || 0);

    return { sold, reserved, paid, revenue };
  }, [selectedRaffle]);

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
      } else {
        await navigator.clipboard.writeText(link);
        setMessage("Link copiado para a área de transferência.");
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCopyLink() {
    if (!selectedRaffle) return;

    const link =
      selectedRaffle.publicLink ||
      `${window.location.origin}/sorteio/${selectedRaffle.slug || selectedRaffle.id}`;

    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copiado com sucesso.");
    } catch (error) {
      console.error(error);
      setMessage("Não foi possível copiar o link.");
    }
  }

  function exportParticipants() {
    if (!selectedRaffle) return;

    const rows = [
      ["Nome", "Telefone", "Números Comprados", "Status", "Valor Pago"],
      ...participants.map((p) => [
        p.name || "",
        p.phone || "",
        Array.isArray(p.numbers) ? p.numbers.join(", ") : p.numbers || "",
        p.status || "",
        p.amountPaid != null ? String(p.amountPaid) : "",
      ]),
    ];

    const safeTitle = (selectedRaffle.title || "participantes")
      .toLowerCase()
      .replace(/\s+/g, "-");

    downloadCSV(`${safeTitle}-participantes.csv`, rows);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Painel Administrativo</h1>
          <p style={styles.subtitle}>Gerencie seus sorteios, imagens, participantes e resultados.</p>
        </div>

        <button style={styles.newButton} onClick={resetForm}>
          + Novo sorteio
        </button>
      </header>

      {message ? <div style={styles.alert}>{message}</div> : null}

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>
            {form.id ? "Editar sorteio" : "Criar sorteio"}
          </h2>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Título</label>
              <input
                style={styles.input}
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Ex: Casa Premiada Ribeirão"
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Descrição</label>
              <textarea
                style={styles.textarea}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Descreva o prêmio e as regras"
                rows={4}
              />
            </div>

            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Data do sorteio</label>
                <input
                  type="datetime-local"
                  style={styles.input}
                  value={form.drawDate}
                  onChange={(e) => handleChange("drawDate", e.target.value)}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>WhatsApp</label>
                <input
                  style={styles.input}
                  value={form.whatsapp}
                  onChange={(e) => handleChange("whatsapp", e.target.value)}
                  placeholder="(16) 99999-9999"
                />
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Valor por número</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={styles.input}
                  value={form.pricePerNumber}
                  onChange={(e) => handleChange("pricePerNumber", e.target.value)}
                  placeholder="2.00"
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Quantidade de números</label>
                <input
                  type="number"
                  min="1"
                  style={styles.input}
                  value={form.totalNumbers}
                  onChange={(e) => handleChange("totalNumbers", e.target.value)}
                  placeholder="300"
                  required
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.input}
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="finished">Finalizado</option>
              </select>
            </div>

            <div style={styles.uploadBox}>
              <label style={styles.label}>Logo (arquivo)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "logoUrl")}
              />
              {uploadingLogo && <small>Enviando logo...</small>}
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" style={styles.previewSmall} />
              ) : null}
            </div>

            <div style={styles.uploadBox}>
              <label style={styles.label}>Foto do prêmio (arquivo)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "prizeImageUrl")}
              />
              {uploadingPrize && <small>Enviando foto do prêmio...</small>}
              {form.prizeImageUrl ? (
                <img
                  src={form.prizeImageUrl}
                  alt="Prêmio"
                  style={styles.previewLarge}
                />
              ) : null}
            </div>

            <div style={styles.uploadBox}>
              <label style={styles.label}>Imagem de capa (arquivo)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "coverImageUrl")}
              />
              {uploadingCover && <small>Enviando capa...</small>}
              {form.coverImageUrl ? (
                <img
                  src={form.coverImageUrl}
                  alt="Capa"
                  style={styles.previewLarge}
                />
              ) : null}
            </div>

            <div style={styles.actions}>
              <button type="submit" style={styles.primaryButton} disabled={saving}>
                {saving ? "Salvando..." : form.id ? "Atualizar sorteio" : "Criar sorteio"}
              </button>

              {form.id ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={resetForm}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Sorteios cadastrados</h2>

          {loading ? (
            <p>Carregando...</p>
          ) : raffles.length === 0 ? (
            <p>Nenhum sorteio cadastrado.</p>
          ) : (
            <div style={styles.raffleList}>
              {raffles.map((raffle) => {
                const publicLink =
                  raffle.publicLink ||
                  `${window.location.origin}/sorteio/${raffle.slug || raffle.id}`;

                return (
                  <div
                    key={raffle.id}
                    style={{
                      ...styles.raffleItem,
                      border:
                        selectedRaffleId === raffle.id
                          ? "2px solid #16a34a"
                          : "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={styles.raffleMain}
                      onClick={() => setSelectedRaffleId(raffle.id)}
                    >
                      <div>
                        <strong>{raffle.title}</strong>
                        <div style={styles.raffleMeta}>
                          Status: {raffle.status || "draft"}
                        </div>
                        <div style={styles.raffleMeta}>
                          Valor: {currencyBRL(raffle.pricePerNumber)}
                        </div>
                      </div>
                    </div>

                    <div style={styles.raffleButtons}>
                      <button
                        style={styles.smallButton}
                        onClick={() => handleEditRaffle(raffle)}
                      >
                        Editar
                      </button>
                      <button
                        style={styles.smallButton}
                        onClick={() => {
                          navigator.clipboard.writeText(publicLink);
                          setMessage("Link do sorteio copiado.");
                        }}
                      >
                        Copiar link
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
        </section>
      </div>

      {selectedRaffle ? (
        <>
          <section style={styles.metricsSection}>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Arrecadado</span>
              <strong style={styles.metricValue}>{currencyBRL(metrics.revenue)}</strong>
            </div>

            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Bilhetes vendidos</span>
              <strong style={styles.metricValue}>{metrics.sold}</strong>
            </div>

            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Reservados</span>
              <strong style={styles.metricValue}>{metrics.reserved}</strong>
            </div>

            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Pagos</span>
              <strong style={styles.metricValue}>{metrics.paid}</strong>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.cardTitle}>Link e compartilhamento</h2>
                <p style={styles.subtitle}>
                  Compartilhe facilmente o sorteio com seus clientes.
                </p>
              </div>
              <div style={styles.inlineActions}>
                <button style={styles.primaryButton} onClick={handleCopyLink}>
                  Copiar link
                </button>
                <button style={styles.secondaryButton} onClick={handleShare}>
                  Compartilhar
                </button>
              </div>
            </div>

            <input
              style={styles.input}
              readOnly
              value={
                selectedRaffle.publicLink ||
                `${window.location.origin}/sorteio/${selectedRaffle.slug || selectedRaffle.id}`
              }
            />
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.cardTitle}>Participantes</h2>
                <p style={styles.subtitle}>
                  Nome, telefone, números comprados e status.
                </p>
              </div>

              <button style={styles.primaryButton} onClick={exportParticipants}>
                Baixar lista CSV
              </button>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nome</th>
                    <th style={styles.th}>Telefone</th>
                    <th style={styles.th}>Números comprados</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Valor pago</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={5}>
                        Nenhum participante encontrado.
                      </td>
                    </tr>
                  ) : (
                    participants.map((p, index) => (
                      <tr key={p.id || index}>
                        <td style={styles.td}>{p.name || "-"}</td>
                        <td style={styles.td}>{p.phone || "-"}</td>
                        <td style={styles.td}>
                          {Array.isArray(p.numbers)
                            ? p.numbers.join(", ")
                            : p.numbers || "-"}
                        </td>
                        <td style={styles.td}>{p.status || "-"}</td>
                        <td style={styles.td}>{currencyBRL(p.amountPaid || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },
  alert: {
    background: "#dcfce7",
    border: "1px solid #86efac",
    color: "#166534",
    padding: "12px 14px",
    borderRadius: "12px",
    marginBottom: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    marginBottom: "20px",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: "16px",
    fontSize: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
  },
  textarea: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    resize: "vertical",
  },
  uploadBox: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    background: "#f8fafc",
  },
  previewSmall: {
    width: "100px",
    height: "100px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },
  previewLarge: {
    width: "100%",
    maxWidth: "260px",
    height: "160px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "8px",
  },
  primaryButton: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#fff",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  newButton: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  raffleList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  raffleItem: {
    borderRadius: "14px",
    padding: "14px",
    background: "#fff",
  },
  raffleMain: {
    cursor: "pointer",
    marginBottom: "10px",
  },
  raffleMeta: {
    fontSize: "13px",
    color: "#6b7280",
    marginTop: "4px",
  },
  raffleButtons: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallButton: {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  smallDangerButton: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: "10px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  metricsSection: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  },
  metricCard: {
    background: "#fff",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
  },
  metricLabel: {
    display: "block",
    color: "#6b7280",
    fontSize: "14px",
    marginBottom: "8px",
  },
  metricValue: {
    fontSize: "24px",
    fontWeight: 700,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  inlineActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#f9fafb",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "14px",
  },
};
