import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

function formatDrawDate(dateString) {
  if (!dateString) return "Data a definir";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Data a definir";

  return date.toLocaleString("pt-BR");
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export default function SorteioPage() {
  const { slug } = useParams();

  const [raffle, setRaffle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [buyerName, setBuyerName] = useState(localStorage.getItem("buyer_name") || "");
  const [buyerPhone, setBuyerPhone] = useState(localStorage.getItem("buyer_phone") || "");
  const [showInfoBox, setShowInfoBox] = useState(false);

  useEffect(() => {
    loadRaffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    localStorage.setItem("buyer_name", buyerName);
  }, [buyerName]);

  useEffect(() => {
    localStorage.setItem("buyer_phone", buyerPhone);
  }, [buyerPhone]);

  async function safeJson(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function loadRaffle() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const raffleSlug = slug || "";
      const res = await fetch(`${API_BASE}/api/raffles/${raffleSlug}`);
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Sorteio não encontrado.");
      }

      setRaffle(data);
    } catch (err) {
      setError(err.message || "Erro ao carregar sorteio.");
      setRaffle(null);
    } finally {
      setLoading(false);
    }
  }

  const takenMap = useMemo(() => {
    const map = new Map();

    if (!raffle?.takenNumbers) return map;

    raffle.takenNumbers.forEach((item) => {
      map.set(Number(item.number), item.status || "reserved");
    });

    return map;
  }, [raffle]);

  const availableNumbers = useMemo(() => {
    if (!raffle?.totalNumbers) return [];

    const total = Number(raffle.totalNumbers || 0);
    const all = Array.from({ length: total }, (_, i) => i + 1);

    return all.filter((num) => !takenMap.has(num));
  }, [raffle, takenMap]);

  const totalAmount = useMemo(() => {
    return selectedNumbers.length * Number(raffle?.pricePerNumber || 0);
  }, [selectedNumbers, raffle]);

  const numberGrid = useMemo(() => {
    if (!raffle?.totalNumbers) return [];
    const total = Number(raffle.totalNumbers || 0);
    return chunkArray(Array.from({ length: total }, (_, i) => i + 1), 5);
  }, [raffle]);

  function toggleNumber(number) {
    if (!raffle) return;
    if (takenMap.has(number)) return;

    setMessage("");
    setError("");

    setSelectedNumbers((prev) => {
      if (prev.includes(number)) {
        return prev.filter((n) => n !== number);
      }
      return [...prev, number].sort((a, b) => a - b);
    });

    setShowInfoBox(true);
  }

  function pickRandomNumbers(quantity) {
    if (!raffle) return;

    setMessage("");
    setError("");

    const available = [...availableNumbers];

    if (available.length === 0) {
      setError("Não há números disponíveis.");
      return;
    }

    const qty = Math.min(quantity, available.length);

    for (let i = available.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const chosen = available.slice(0, qty).sort((a, b) => a - b);
    setSelectedNumbers(chosen);
    setShowInfoBox(true);
  }

  async function handleReserve() {
    if (!raffle) return;

    setMessage("");
    setError("");

    if (!buyerName.trim()) {
      setError("Informe seu nome completo.");
      return;
    }

    if (!onlyDigits(buyerPhone)) {
      setError("Informe seu telefone/WhatsApp.");
      return;
    }

    if (selectedNumbers.length === 0) {
      setError("Escolha ao menos um número.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE}/api/raffles/${raffle.slug || raffle.id}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: buyerName.trim(),
          phone: onlyDigits(buyerPhone),
          numbers: selectedNumbers,
          status: "reserved",
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao reservar números.");
      }

      setMessage("Números reservados com sucesso.");
      setSelectedNumbers([]);
      await loadRaffle();
    } catch (err) {
      setError(err.message || "Erro ao reservar números.");
    } finally {
      setSaving(false);
    }
  }

  function getNumberStyle(number) {
    const status = takenMap.get(number);
    const isSelected = selectedNumbers.includes(number);

    if (isSelected) {
      return {
        ...styles.numberButton,
        background: "#16a34a",
        color: "#fff",
        border: "1px solid #16a34a",
      };
    }

    if (status === "paid") {
      return {
        ...styles.numberButton,
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #86efac",
        cursor: "not-allowed",
      };
    }

    if (status === "reserved" || status === "sold") {
      return {
        ...styles.numberButton,
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
        cursor: "not-allowed",
      };
    }

    return styles.numberButton;
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Carregando sorteio...</div>
      </div>
    );
  }

  if (error && !raffle) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>{error || "Sorteio não encontrado."}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          {raffle?.coverImageUrl ? (
            <img
              src={raffle.coverImageUrl}
              alt="Capa"
              style={styles.coverImage}
            />
          ) : null}

          <div style={styles.heroContent}>
            <div style={styles.brandRow}>
              {raffle?.logoUrl ? (
                <img src={raffle.logoUrl} alt="Logo" style={styles.logo} />
              ) : null}

              <div>
                <div style={styles.brandName}>Casa Premiada Ribeirão</div>
                <div style={styles.brandSub}>Escolha seus números e participe</div>
              </div>
            </div>

            <div style={styles.heroGrid}>
              <div style={styles.prizeMediaBox}>
                {raffle?.prizeImageUrl ? (
                  <img
                    src={raffle.prizeImageUrl}
                    alt={raffle?.title || "Prêmio"}
                    style={styles.prizeImage}
                  />
                ) : (
                  <div style={styles.placeholderPrize}>Imagem do prêmio</div>
                )}
              </div>

              <div style={styles.heroInfo}>
                <h1 style={styles.title}>{raffle?.title || "Sorteio"}</h1>

                <div style={styles.infoTags}>
                  <span style={styles.tag}>
                    {currencyBRL(raffle?.pricePerNumber || 0)} por número
                  </span>
                  <span style={styles.tag}>
                    Sorteio: {formatDrawDate(raffle?.drawDate)}
                  </span>
                </div>

                <p style={styles.description}>
                  {raffle?.description || "Escolha seus números e participe."}
                </p>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryCard}>
                    <small style={styles.summaryLabel}>Disponíveis</small>
                    <strong style={styles.summaryValue}>{availableNumbers.length}</strong>
                  </div>
                  <div style={styles.summaryCard}>
                    <small style={styles.summaryLabel}>Reservados/Vendidos</small>
                    <strong style={styles.summaryValue}>
                      {Number(raffle?.totalNumbers || 0) - availableNumbers.length}
                    </strong>
                  </div>
                  <div style={styles.summaryCard}>
                    <small style={styles.summaryLabel}>Total de números</small>
                    <strong style={styles.summaryValue}>{raffle?.totalNumbers || 0}</strong>
                  </div>
                </div>

                <div style={styles.quickActions}>
                  <button
                    type="button"
                    style={styles.greenButton}
                    onClick={() => pickRandomNumbers(5)}
                  >
                    5 números aleatórios
                  </button>

                  <button
                    type="button"
                    style={styles.outlineGreenButton}
                    onClick={() => pickRandomNumbers(10)}
                  >
                    10 números aleatórios
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {message ? <div style={styles.successBox}>{message}</div> : null}

        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Escolha seus números</h2>
              <p style={styles.sectionSubtitle}>
                Verde = selecionado | Vermelho = indisponível | Branco = disponível
              </p>
            </div>

            <button
              type="button"
              style={styles.infoButton}
              onClick={() => setShowInfoBox((prev) => !prev)}
            >
              Ver informações
            </button>
          </div>

          <div style={styles.numberGridWrapper}>
            {numberGrid.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} style={styles.numberRow}>
                {row.map((number) => (
                  <button
                    key={number}
                    type="button"
                    style={getNumberStyle(number)}
                    onClick={() => toggleNumber(number)}
                    disabled={takenMap.has(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>

        {showInfoBox ? (
          <section style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>Seus dados</h2>

            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Nome completo</label>
                <input
                  style={styles.input}
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Digite seu nome completo"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Número / WhatsApp</label>
                <input
                  style={styles.input}
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(formatPhone(e.target.value))}
                  placeholder="(16) 99999-9999"
                />
              </div>
            </div>
          </section>
        ) : null}

        <div style={styles.bottomSpace} />
      </div>

      <div style={styles.bottomBar}>
        <div style={styles.bottomBarContent}>
          <div>
            <div style={styles.bottomLabel}>Números selecionados</div>
            <div style={styles.bottomSelected}>
              {selectedNumbers.length > 0 ? selectedNumbers.join(", ") : "Nenhum número"}
            </div>
          </div>

          <div style={styles.bottomPriceBox}>
            <div style={styles.bottomLabel}>Total</div>
            <div style={styles.bottomPrice}>{currencyBRL(totalAmount)}</div>
          </div>

          <div style={styles.bottomButtons}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setShowInfoBox(true)}
            >
              Ver informações
            </button>

            <button
              type="button"
              style={styles.primaryButton}
              onClick={handleReserve}
              disabled={saving || selectedNumbers.length === 0}
            >
              {saving ? "Reservando..." : "Reservar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fb",
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
  },
  container: {
    maxWidth: "980px",
    margin: "0 auto",
    padding: "14px 14px 0 14px",
  },
  centerBox: {
    maxWidth: "900px",
    margin: "40px auto",
    background: "#fff",
    padding: "24px",
    borderRadius: "20px",
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  },
  heroCard: {
    background: "#fff",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
    marginBottom: "16px",
  },
  coverImage: {
    width: "100%",
    height: "180px",
    objectFit: "cover",
    display: "block",
  },
  heroContent: {
    padding: "16px",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  logo: {
    width: "58px",
    height: "58px",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
  },
  brandName: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#0f172a",
  },
  brandSub: {
    fontSize: "14px",
    color: "#64748b",
    marginTop: "4px",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "16px",
  },
  prizeMediaBox: {
    width: "100%",
  },
  prizeImage: {
    width: "100%",
    borderRadius: "20px",
    objectFit: "cover",
    maxHeight: "360px",
    border: "1px solid #e5e7eb",
  },
  placeholderPrize: {
    width: "100%",
    minHeight: "240px",
    borderRadius: "20px",
    border: "1px dashed #cbd5e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    background: "#f8fafc",
  },
  heroInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    lineHeight: 1.1,
    fontWeight: 900,
  },
  infoTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  tag: {
    background: "#eef2ff",
    color: "#3730a3",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
  },
  description: {
    margin: 0,
    color: "#475569",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
  },
  summaryCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "14px",
  },
  summaryLabel: {
    display: "block",
    color: "#64748b",
    marginBottom: "8px",
    fontSize: "12px",
  },
  summaryValue: {
    fontSize: "24px",
    fontWeight: 900,
  },
  quickActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "4px",
  },
  greenButton: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  outlineGreenButton: {
    background: "#fff",
    color: "#16a34a",
    border: "1px solid #16a34a",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  sectionCard: {
    background: "#fff",
    borderRadius: "24px",
    padding: "16px",
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
    marginBottom: "16px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 900,
  },
  sectionSubtitle: {
    margin: "6px 0 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  infoButton: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  numberGridWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  numberRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "10px",
  },
  numberButton: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #dbe2ea",
    borderRadius: "14px",
    padding: "14px 8px",
    fontSize: "16px",
    fontWeight: 800,
    cursor: "pointer",
    minHeight: "52px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 800,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "16px",
    padding: "14px 16px",
    fontSize: "16px",
    outline: "none",
  },
  errorBox: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "12px 14px",
    borderRadius: "14px",
    marginBottom: "16px",
  },
  successBox: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    padding: "12px 14px",
    borderRadius: "14px",
    marginBottom: "16px",
  },
  bottomSpace: {
    height: "120px",
  },
  bottomBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(255,255,255,0.98)",
    borderTop: "1px solid #e5e7eb",
    boxShadow: "0 -10px 30px rgba(15,23,42,0.08)",
    zIndex: 1000,
  },
  bottomBarContent: {
    maxWidth: "980px",
    margin: "0 auto",
    padding: "12px 14px",
    display: "grid",
    gridTemplateColumns: "1.5fr 0.8fr 1fr",
    gap: "12px",
    alignItems: "center",
  },
  bottomLabel: {
    color: "#64748b",
    fontSize: "12px",
    marginBottom: "4px",
    fontWeight: 700,
  },
  bottomSelected: {
    fontWeight: 800,
    fontSize: "14px",
    color: "#0f172a",
    wordBreak: "break-word",
  },
  bottomPriceBox: {
    textAlign: "center",
  },
  bottomPrice: {
    fontSize: "28px",
    fontWeight: 900,
    color: "#16a34a",
  },
  bottomButtons: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  secondaryButton: {
    background: "#fff",
    color: "#16a34a",
    border: "1px solid #16a34a",
    borderRadius: "14px",
    padding: "12px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButton: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
