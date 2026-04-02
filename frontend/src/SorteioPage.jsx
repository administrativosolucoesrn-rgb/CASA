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

export default function SorteioPage() {
  const { slug } = useParams();

  const [raffle, setRaffle] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadRaffle();
  }, [slug]);

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

      const res = await fetch(`${API_BASE}/api/raffles/${slug}`);
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar sorteio.");
      }

      setRaffle(data);
    } catch (err) {
      setError(err.message || "Erro ao carregar sorteio.");
    } finally {
      setLoading(false);
    }
  }

  const takenMap = useMemo(() => {
    const map = new Map();

    if (raffle?.takenNumbers) {
      raffle.takenNumbers.forEach((item) => {
        map.set(Number(item.number), item.status);
      });
    }

    return map;
  }, [raffle]);

  function toggleNumber(number) {
    if (takenMap.has(number)) return;

    setSelectedNumbers((prev) =>
      prev.includes(number)
        ? prev.filter((n) => n !== number)
        : [...prev, number].sort((a, b) => a - b)
    );
  }

  async function handleReserve(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/api/raffles/${slug}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: onlyDigits(phone),
          numbers: selectedNumbers,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao reservar números.");
      }

      setMessage("Reserva realizada com sucesso.");
      setName("");
      setPhone("");
      setSelectedNumbers([]);
      await loadRaffle();
    } catch (err) {
      setError(err.message || "Erro ao reservar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={styles.page}>Carregando sorteio...</div>;
  }

  if (error && !raffle) {
    return <div style={styles.page}>{error}</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {raffle?.coverImageUrl ? (
          <img src={raffle.coverImageUrl} alt="Capa" style={styles.cover} />
        ) : null}

        <div style={styles.header}>
          {raffle?.logoUrl ? (
            <img src={raffle.logoUrl} alt="Logo" style={styles.logo} />
          ) : null}

          <div>
            <h1 style={styles.title}>{raffle?.title}</h1>
            <p style={styles.description}>{raffle?.description}</p>
            <p style={styles.price}>
              {currencyBRL(raffle?.pricePerNumber)} por número
            </p>
          </div>
        </div>

        {raffle?.prizeImageUrl ? (
          <img src={raffle.prizeImageUrl} alt="Prêmio" style={styles.prizeImage} />
        ) : null}

        {message ? <div style={styles.success}>{message}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Escolha seus números</h2>

          <div style={styles.legend}>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendColor, background: "#16a34a" }} />
              Selecionado
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendColor, background: "#fef3c7" }} />
              Reservado
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendColor, background: "#dbeafe" }} />
              Pago
            </div>
          </div>

          <div style={styles.grid}>
            {Array.from({ length: Number(raffle?.totalNumbers || 0) }, (_, i) => i + 1).map(
              (number) => {
                const takenStatus = takenMap.get(number);
                const selected = selectedNumbers.includes(number);

                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => toggleNumber(number)}
                    disabled={Boolean(takenStatus)}
                    style={{
                      ...styles.numberButton,
                      ...(takenStatus
                        ? takenStatus === "paid"
                          ? styles.numberPaid
                          : styles.numberReserved
                        : selected
                        ? styles.numberSelected
                        : {}),
                    }}
                  >
                    {number}
                  </button>
                );
              }
            )}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Seus dados</h2>

          <form onSubmit={handleReserve} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              style={styles.input}
              placeholder="WhatsApp"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              required
            />

            <div style={styles.summary}>
              <div>
                <strong>Números escolhidos:</strong>{" "}
                {selectedNumbers.length ? selectedNumbers.join(", ") : "-"}
              </div>
              <div>
                <strong>Quantidade:</strong> {selectedNumbers.length}
              </div>
              <div>
                <strong>Total:</strong>{" "}
                {currencyBRL(selectedNumbers.length * Number(raffle?.pricePerNumber || 0))}
              </div>
            </div>

            <button
              type="submit"
              style={styles.reserveButton}
              disabled={saving || selectedNumbers.length === 0}
            >
              {saving ? "Reservando..." : "Reservar números"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "20px 12px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
  },
  cover: {
    width: "100%",
    height: "220px",
    objectFit: "cover",
    borderRadius: "20px",
    marginBottom: "18px",
  },
  header: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    background: "#fff",
    padding: "18px",
    borderRadius: "20px",
    marginBottom: "18px",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
  },
  logo: {
    width: "90px",
    height: "90px",
    objectFit: "cover",
    borderRadius: "16px",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 800,
    color: "#111827",
  },
  description: {
    color: "#4b5563",
    marginTop: "8px",
  },
  price: {
    fontWeight: 700,
    fontSize: "18px",
    color: "#16a34a",
    marginTop: "10px",
  },
  prizeImage: {
    width: "100%",
    maxHeight: "420px",
    objectFit: "cover",
    borderRadius: "20px",
    marginBottom: "18px",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
  },
  card: {
    background: "#fff",
    borderRadius: "20px",
    padding: "18px",
    marginBottom: "18px",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "16px",
    color: "#111827",
  },
  legend: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    marginBottom: "16px",
    fontSize: "14px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#4b5563",
  },
  legendColor: {
    width: "16px",
    height: "16px",
    borderRadius: "4px",
    display: "inline-block",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))",
    gap: "10px",
  },
  numberButton: {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: "12px",
    padding: "14px 8px",
    cursor: "pointer",
    fontWeight: 700,
    color: "#111827",
  },
  numberSelected: {
    background: "#16a34a",
    color: "#fff",
    border: "1px solid #16a34a",
  },
  numberReserved: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fcd34d",
    cursor: "not-allowed",
  },
  numberPaid: {
    background: "#dbeafe",
    color: "#1d4ed8",
    border: "1px solid #93c5fd",
    cursor: "not-allowed",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "14px",
    fontSize: "15px",
  },
  summary: {
    background: "#f9fafb",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#111827",
  },
  reserveButton: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    padding: "12px 14px",
    borderRadius: "14px",
    marginBottom: "16px",
  },
  error: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "12px 14px",
    borderRadius: "14px",
    marginBottom: "16px",
  },
};              
