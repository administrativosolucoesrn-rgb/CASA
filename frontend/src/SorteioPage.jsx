import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatTimer(seconds = 0) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function SorteioPage() {
  const slug = window.location.pathname.split("/").pop();

  const [sorteio, setSorteio] = useState(null);
  const [erro, setErro] = useState("");
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [customer, setCustomer] = useState({ nome: "", whatsapp: "" });

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("idle");

  useEffect(() => {
    loadSorteio();
  }, []);

  useEffect(() => {
    if (!paymentOpen || !pixData || paymentStatus === "paid" || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPaymentStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentOpen, pixData, paymentStatus, timeLeft]);

  useEffect(() => {
    if (!paymentOpen || !pixData || paymentStatus === "paid" || paymentStatus === "expired") return;
    const paymentId = pixData?.paymentId || pixData?.pagamentoId || pixData?.pixId;
    if (!paymentId) return;

    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/pix/status/${paymentId}`);
        const status = String(
          res?.data?.status || res?.data?.paymentStatus || res?.data?.pixStatus || ""
        ).toLowerCase();

        if (["paid", "approved", "confirmado", "confirmed"].includes(status)) {
          setPaymentStatus("paid");
          clearInterval(poll);
          await loadSorteio();
        }

        if (["expired", "cancelled", "canceled"].includes(status)) {
          setPaymentStatus("expired");
          clearInterval(poll);
        }
      } catch {
        //
      }
    }, 4000);

    return () => clearInterval(poll);
  }, [paymentOpen, pixData, paymentStatus]);

  async function loadSorteio() {
    try {
      setErro("");
      const res = await axios.get(`${API_URL}/api/sorteios/${slug}`);
      setSorteio(res.data);
    } catch (e) {
      setErro(e?.response?.data?.error || "Erro ao carregar sorteio.");
    }
  }

  const reservedNumbers = useMemo(
    () => (Array.isArray(sorteio?.reservedNumbers) ? sorteio.reservedNumbers.map(Number) : []),
    [sorteio]
  );
  const paidNumbers = useMemo(
    () => (Array.isArray(sorteio?.paidNumbers) ? sorteio.paidNumbers.map(Number) : []),
    [sorteio]
  );

  const unavailable = useMemo(
    () => new Set([...reservedNumbers, ...paidNumbers]),
    [reservedNumbers, paidNumbers]
  );

  const totalNumbers = Number(sorteio?.totalNumbers || 0);
  const price = Number(sorteio?.price || 0);
  const total = selectedNumbers.length * price;

  function toggleNumber(num) {
    if (unavailable.has(num)) return;

    setSelectedNumbers((prev) =>
      prev.includes(num)
        ? prev.filter((n) => n !== num)
        : [...prev, num].sort((a, b) => a - b)
    );
  }

  function pickRandom(quantity) {
    const avail = [];
    for (let i = 1; i <= totalNumbers; i += 1) {
      if (!unavailable.has(i) && !selectedNumbers.includes(i)) {
        avail.push(i);
      }
    }

    const shuffled = [...avail].sort(() => Math.random() - 0.5).slice(0, quantity);
    setSelectedNumbers((prev) =>
      [...new Set([...prev, ...shuffled])].sort((a, b) => a - b)
    );
  }

  function clearSelection() {
    setSelectedNumbers([]);
    setPixData(null);
    setPaymentOpen(false);
    setPaymentStatus("idle");
    setTimeLeft(0);
  }

  async function generatePix() {
    try {
      setErro("");

      if (!customer.nome.trim()) {
        throw new Error("Digite seu nome.");
      }

      if (onlyDigits(customer.whatsapp).length < 10) {
        throw new Error("Digite seu WhatsApp.");
      }

      if (!selectedNumbers.length) {
        throw new Error("Escolha pelo menos um número.");
      }

      setLoadingPix(true);
      setPixData(null);
      setPaymentStatus("pending");

      const res = await axios.post(`${API_URL}/api/pix`, {
        slug,
        nome: customer.nome.trim(),
        whatsapp: onlyDigits(customer.whatsapp),
        numeros: selectedNumbers,
      });

      setPixData(res.data);
      setPaymentOpen(true);

      if (res.data?.expiresInSeconds) {
        setTimeLeft(Number(res.data.expiresInSeconds));
      } else {
        setTimeLeft(15 * 60);
      }

      await loadSorteio();
    } catch (e) {
      setErro(e?.response?.data?.error || e.message || "Erro ao gerar PIX.");
    } finally {
      setLoadingPix(false);
    }
  }

  async function copyPix() {
    try {
      const code = pixData?.pixCopiaECola || pixData?.pixCode || "";
      if (!code) return;
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (!sorteio) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>
          {erro || "Carregando sorteio..."}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #eef2ef; font-family: Arial, sans-serif; }

        @keyframes pulseGlow {
          0% { transform: translateY(0); box-shadow: 0 12px 24px rgba(16,185,129,.16); }
          50% { transform: translateY(-1px); box-shadow: 0 18px 28px rgba(16,185,129,.24); }
          100% { transform: translateY(0); box-shadow: 0 12px 24px rgba(16,185,129,.16); }
        }

        @media (min-width: 768px) {
          .pixGridResponsive {
            grid-template-columns: 1.05fr 0.95fr !important;
          }
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.logoArea}>
            {sorteio.logoUrl ? (
              <img src={sorteio.logoUrl} alt="Logo" style={styles.logo} />
            ) : (
              <div style={styles.logoFallback}>CASA PREMIADA</div>
            )}
          </div>

          <button style={styles.myNumbersBtn}>
            👁️🔎 Meus números
          </button>
        </div>

        <div style={styles.heroCard}>
          {sorteio.image ? (
            <img src={sorteio.image} alt={sorteio.title} style={styles.heroImage} />
          ) : null}

          <div style={styles.heroInfo}>
            <div style={styles.infoChip}>
              <div style={styles.infoLabel}>Valor</div>
              <div style={styles.infoValue}>{formatMoney(price)}</div>
            </div>
            <div style={styles.infoMain}>
              <div style={styles.infoLabel}>Prêmio</div>
              <div style={styles.infoMainText}>{sorteio.title}</div>
            </div>
          </div>
        </div>

        {!!sorteio.descricao && (
          <div style={styles.descriptionCard}>
            <div style={styles.sectionTitle}>Descrição do prêmio</div>
            <div style={styles.descriptionText}>{sorteio.descricao}</div>
          </div>
        )}

        {!selectedNumbers.length && (
          <div style={styles.quickCard}>
            <div style={styles.sectionTitle}>Compra rápida</div>
            <div style={styles.quickGrid}>
              <button style={styles.quickBtn} onClick={() => pickRandom(2)}>+2</button>
              <button style={styles.quickBtn} onClick={() => pickRandom(5)}>+5</button>
              <button style={styles.quickBtn} onClick={() => pickRandom(10)}>+10</button>
              <button style={styles.quickBtn} onClick={() => pickRandom(15)}>+15</button>
            </div>
          </div>
        )}

        <div style={styles.legendWrap}>
          <div style={{ ...styles.legendPill, background: "#edf2f7", color: "#1f2937" }}>Disponíveis</div>
          <div style={{ ...styles.legendPill, background: "#111827", color: "#fff" }}>Reservados</div>
          <div style={{ ...styles.legendPill, background: "#166534", color: "#fff" }}>Comprados</div>
        </div>

        <div style={styles.numberGrid}>
          {Array.from({ length: totalNumbers }, (_, i) => i + 1).map((num) => {
            const isPaid = paidNumbers.includes(num);
            const isReserved = reservedNumbers.includes(num);
            const isSelected = selectedNumbers.includes(num);

            const extraStyle = isPaid
              ? styles.numberPaid
              : isReserved
              ? styles.numberReserved
              : isSelected
              ? styles.numberSelected
              : null;

            return (
              <button
                key={num}
                onClick={() => toggleNumber(num)}
                disabled={isPaid || isReserved}
                style={{ ...styles.numberBtn, ...(extraStyle || {}) }}
              >
                {String(num).padStart(3, "0")}
              </button>
            );
          })}
        </div>
      </div>

      {selectedNumbers.length > 0 && (
        <div style={styles.cartBar}>
          <div style={styles.cartRow}>
            <span style={styles.cartText}>{selectedNumbers.length} número(s)</span>
            <strong style={styles.cartTotal}>{formatMoney(total)}</strong>
          </div>

          <div style={styles.selectedWrap}>
            {selectedNumbers.map((n) => (
              <span key={n} style={styles.selectedPill}>
                {String(n).padStart(3, "0")}
              </span>
            ))}
          </div>

          <div style={styles.formFields}>
            <input
              style={styles.input}
              placeholder="Seu nome"
              value={customer.nome}
              onChange={(e) => setCustomer((prev) => ({ ...prev, nome: e.target.value }))}
            />
            <input
              style={styles.input}
              placeholder="Seu WhatsApp"
              value={formatPhone(customer.whatsapp)}
              onChange={(e) =>
                setCustomer((prev) => ({ ...prev, whatsapp: onlyDigits(e.target.value) }))
              }
            />
          </div>

          {!!erro && <div style={styles.errorBox}>{erro}</div>}

          <div style={styles.cartActions}>
            <button style={styles.clearBtn} onClick={clearSelection}>
              Limpar seleção
            </button>
            <button style={styles.payBtn} onClick={generatePix} disabled={loadingPix}>
              {loadingPix ? "Gerando PIX..." : "Continuar para pagamento"}
            </button>
          </div>
        </div>
      )}

      {paymentOpen && (
        <div style={styles.modalOverlay} onClick={() => setPaymentOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>Finalizar pagamento</div>
                <div style={styles.modalSub}>
                  {selectedNumbers.length} número(s) • {formatMoney(total)}
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setPaymentOpen(false)}>×</button>
            </div>

            <div
              style={{
                ...styles.statusBox,
                ...(paymentStatus === "paid"
                  ? styles.statusPaid
                  : paymentStatus === "expired"
                  ? styles.statusExpired
                  : styles.statusPending),
              }}
            >
              <div style={styles.statusTitle}>
                {paymentStatus === "paid"
                  ? "Pagamento aprovado"
                  : paymentStatus === "expired"
                  ? "Tempo expirado"
                  : "Aguardando o pagamento"}
              </div>
              <div style={styles.statusText}>
                {paymentStatus === "paid"
                  ? "Seu pagamento foi confirmado com sucesso."
                  : paymentStatus === "expired"
                  ? "O tempo terminou. Gere um novo PIX para continuar."
                  : "Finalize agora pelo PIX automático para garantir seus números antes que o tempo acabe."}
              </div>
            </div>

            {paymentStatus === "paid" ? (
              <div style={styles.successWrap}>
                <div style={styles.successEmoji}>✅</div>
                <div style={styles.successTitle}>Pagamento confirmado</div>
                <div style={styles.successText}>Seus números foram aprovados automaticamente.</div>
              </div>
            ) : (
              <div className="pixGridResponsive" style={styles.pixGrid}>
                <div style={styles.qrCard}>
                  <div style={styles.qrTitle}>QR Code PIX</div>
                  <div style={styles.qrSub}>Escaneie pelo aplicativo do seu banco</div>

                  <div style={styles.qrWrap}>
                    {pixData?.qrCodeBase64 ? (
                      <img
                        src={pixData.qrCodeBase64}
                        alt="QR Code PIX"
                        style={styles.qrImage}
                      />
                    ) : null}
                  </div>

                  <div style={styles.timerBox}>
                    <span style={styles.timerLabel}>Reserve seus números por</span>
                    <span style={styles.timerValue}>{formatTimer(timeLeft)}</span>
                  </div>
                </div>

                <div style={styles.detailCard}>
                  <div style={styles.rowInfo}>
                    <span>Recebedor</span>
                    <strong>46.573.111 RAILANNY SILVA</strong>
                  </div>
                  <div style={styles.rowInfo}>
                    <span>Tipo de pagamento</span>
                    <strong>PIX automático</strong>
                  </div>
                  <div style={styles.rowInfo}>
                    <span>Valor total</span>
                    <strong>{formatMoney(total)}</strong>
                  </div>
                  <div style={styles.rowInfo}>
                    <span>Números</span>
                    <strong>{selectedNumbers.length}</strong>
                  </div>

                  <div style={styles.fieldWrap}>
                    <label style={styles.label}>Código PIX copia e cola</label>
                    <div style={styles.copyGrid}>
                      <textarea
                        readOnly
                        style={styles.copyArea}
                        value={pixData?.pixCopiaECola || pixData?.pixCode || ""}
                      />
                      <button style={styles.copyBtn} onClick={copyPix}>
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>

                  <div style={styles.noticeBox}>
                    Este é um PIX automático. Após o pagamento, a confirmação acontece automaticamente em poucos segundos.
                  </div>

                  {paymentStatus === "expired" && (
                    <button style={styles.regenerateBtn} onClick={generatePix}>
                      Gerar novo PIX
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef2ef",
    paddingBottom: 180,
  },
  loadingWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eef2ef",
  },
  loadingCard: {
    background: "#fff",
    padding: 18,
    borderRadius: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
    fontSize: 16,
    color: "#111827",
  },
  container: {
    maxWidth: 620,
    margin: "0 auto",
    padding: 14,
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0 14px",
    background: "#eef2ef",
  },
  logoArea: {
    minHeight: 46,
    display: "flex",
    alignItems: "center",
  },
  logo: {
    height: 48,
    objectFit: "contain",
  },
  logoFallback: {
    fontWeight: 700,
    color: "#111827",
    fontSize: 16,
  },
  myNumbersBtn: {
    border: "none",
    background: "#15803d",
    color: "#fff",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 14,
  },
  heroCard: {
    background: "#fff",
    borderRadius: 28,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    marginBottom: 14,
  },
  heroImage: {
    width: "100%",
    display: "block",
    minHeight: 260,
    objectFit: "cover",
  },
  heroInfo: {
    background: "#111111",
    color: "#fff",
    padding: 16,
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr",
    gap: 12,
  },
  infoChip: {},
  infoMain: {},
  infoLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  infoMainText: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  descriptionCard: {
    background: "#fff",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 8,
  },
  descriptionText: {
    color: "#475467",
    lineHeight: 1.55,
    fontSize: 16,
  },
  quickCard: {
    background: "linear-gradient(180deg,#fffdf6 0%,#fff8dc 100%)",
    border: "1.5px solid #f4d36f",
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    boxShadow: "0 8px 18px rgba(244,211,111,0.16)",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 8,
  },
  quickBtn: {
    minHeight: 44,
    border: "none",
    borderRadius: 14,
    background: "#f6c948",
    color: "#111827",
    fontWeight: 800,
    fontSize: 16,
  },
  legendWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    background: "#fff",
    borderRadius: 18,
    padding: 10,
    marginBottom: 14,
    border: "1px solid #e5e7eb",
  },
  legendPill: {
    borderRadius: 12,
    padding: "10px 8px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 12,
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6,1fr)",
    gap: 7,
  },
  numberBtn: {
    minHeight: 42,
    borderRadius: 12,
    border: "1.5px solid #d0d5dd",
    background: "#fff",
    color: "#111827",
    fontSize: 13,
    fontWeight: 700,
    boxShadow: "0 4px 10px rgba(15,23,42,0.04)",
  },
  numberReserved: {
    background: "#111827",
    color: "#fff",
    border: "1.5px solid #111827",
  },
  numberPaid: {
    background: "#166534",
    color: "#fff",
    border: "1.5px solid #166534",
  },
  numberSelected: {
    background: "linear-gradient(135deg,#10b981,#0f8f4c)",
    color: "#fff",
    border: "1.5px solid #0f8f4c",
    boxShadow: "0 10px 18px rgba(16,185,129,.20)",
  },
  cartBar: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 20,
    background: "#fff",
    borderRadius: 24,
    padding: 14,
    border: "1px solid #eef2f6",
    boxShadow: "0 16px 30px rgba(15,23,42,.14)",
  },
  cartRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cartText: {
    color: "#111827",
    fontWeight: 700,
    fontSize: 14,
  },
  cartTotal: {
    color: "#15803d",
    fontSize: 20,
  },
  selectedWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
    maxHeight: 70,
    overflowY: "auto",
  },
  selectedPill: {
    background: "#eefaf3",
    color: "#0f8f4c",
    border: "1px solid #b7e4c7",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 700,
    fontSize: 12,
  },
  formFields: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
    marginBottom: 10,
  },
  input: {
    width: "100%",
    minHeight: 50,
    borderRadius: 14,
    border: "1px solid #d0d5dd",
    padding: "0 14px",
    fontSize: 16,
    background: "#fff",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    fontWeight: 600,
  },
  cartActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr",
    gap: 10,
  },
  clearBtn: {
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid #d0d5dd",
    background: "#fff",
    color: "#111827",
    fontWeight: 700,
    fontSize: 15,
  },
  payBtn: {
    minHeight: 50,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg,#1db874,#149954)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    animation: "pulseGlow 1.8s infinite",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.58)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    zIndex: 100,
  },
  modalCard: {
    width: "100%",
    maxWidth: 960,
    background: "#fff",
    borderRadius: 30,
    padding: 20,
    maxHeight: "94vh",
    overflowY: "auto",
    boxShadow: "0 24px 60px rgba(0,0,0,.28)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 30,
    fontWeight: 800,
    color: "#111827",
  },
  modalSub: {
    color: "#667085",
    marginTop: 4,
    fontSize: 15,
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    color: "#667085",
    fontSize: 34,
    lineHeight: 1,
  },
  statusBox: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
  },
  statusPending: {
    background: "#fff7ed",
    border: "1px solid #fdba74",
  },
  statusPaid: {
    background: "#ecfdf3",
    border: "1px solid #86efac",
  },
  statusExpired: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
  },
  statusTitle: {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 6,
    color: "#111827",
  },
  statusText: {
    color: "#475467",
    fontSize: 16,
    lineHeight: 1.5,
  },
  pixGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 18,
  },
  qrCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 18,
  },
  qrTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 4,
  },
  qrSub: {
    color: "#667085",
    fontSize: 14,
    marginBottom: 14,
  },
  qrWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  qrImage: {
    width: "100%",
    maxWidth: 320,
    display: "block",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 14,
  },
  timerBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 18,
    background: "#fff",
    border: "1px solid #e5e7eb",
  },
  timerLabel: {
    color: "#667085",
    fontWeight: 700,
    fontSize: 14,
  },
  timerValue: {
    color: "#111827",
    fontWeight: 800,
    fontSize: 26,
    letterSpacing: 1,
  },
  detailCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 18,
  },
  rowInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    color: "#344054",
    fontSize: 16,
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
  },
  label: {
    color: "#344054",
    fontWeight: 700,
    fontSize: 14,
  },
  copyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "stretch",
  },
  copyArea: {
    width: "100%",
    minHeight: 118,
    border: "1px solid #d0d5dd",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    background: "#f8fafc",
    resize: "none",
    lineHeight: 1.5,
    color: "#111827",
    fontFamily: "Arial, sans-serif",
  },
  copyBtn: {
    minWidth: 120,
    border: "none",
    borderRadius: 18,
    background: "#f4d36f",
    color: "#111827",
    fontWeight: 800,
    fontSize: 18,
    padding: "0 18px",
  },
  noticeBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    color: "#475467",
    fontSize: 14,
    lineHeight: 1.5,
  },
  regenerateBtn: {
    marginTop: 12,
    width: "100%",
    minHeight: 54,
    border: "none",
    borderRadius: 16,
    background: "#15803d",
    color: "#fff",
    fontWeight: 800,
    fontSize: 16,
  },
  successWrap: {
    background: "#ecfdf3",
    border: "1px solid #86efac",
    borderRadius: 24,
    padding: 24,
    textAlign: "center",
  },
  successEmoji: {
    fontSize: 42,
    marginBottom: 10,
  },
  successTitle: {
    color: "#166534",
    fontSize: 26,
    fontWeight: 800,
    marginBottom: 6,
  },
  successText: {
    color: "#14532d",
    fontSize: 16,
    lineHeight: 1.5,
  },
};
