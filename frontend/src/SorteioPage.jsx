import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const STORAGE_KEY = "casa_premiada_cliente";

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "Em breve";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Em breve";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function SorteioPage() {
  const { slug } = useParams();

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sorteio, setSorteio] = useState(null);

  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [hideFloatingCtas, setHideFloatingCtas] = useState(false);

  const [customer, setCustomer] = useState({
    nome: "",
    whatsapp: "",
  });

  const [pixData, setPixData] = useState(null);
  const [submittingPix, setSubmittingPix] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  const [myNumbersOpen, setMyNumbersOpen] = useState(false);
  const [myNumbersPhone, setMyNumbersPhone] = useState("");
  const [myNumbersLoading, setMyNumbersLoading] = useState(false);
  const [myNumbersResult, setMyNumbersResult] = useState(null);

  const numbersRef = useRef(null);
  const quickCardRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setCustomer({
        nome: parsed?.nome || "",
        whatsapp: parsed?.whatsapp || "",
      });
      setMyNumbersPhone(parsed?.whatsapp || "");
    } catch {
      //
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    loadSorteio();
  }, [slug]);


  useEffect(() => {
    const target = quickCardRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHideFloatingCtas(entry.isIntersecting);
      },
      {
        threshold: 0.2,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [sorteio]);

  async function safeJson(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function loadSorteio() {
    try {
      setLoading(true);
      setErro("");

      const res = await fetch(`${API_URL}/api/sorteios/${slug}`);
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível carregar o sorteio.");
      }

      setSorteio(data);
    } catch (err) {
      setErro(err.message || "Erro ao carregar sorteio.");
    } finally {
      setLoading(false);
    }
  }

  function persistCustomer(next) {
    setCustomer(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const totalNumbers = Number(sorteio?.totalNumbers || 0);
  const price = Number(sorteio?.price || 0);
  const heroImage =
    sorteio?.image ||
    "https://via.placeholder.com/1200x900?text=Premio";
  const title = sorteio?.title || "Casa Premiada Ribeirão";
  const description = sorteio?.descricao || sorteio?.subtitle || "";

  const reservedNumbers = safeArray(sorteio?.reservedNumbers).map(Number);
  const paidNumbers = safeArray(sorteio?.paidNumbers).map(Number);

  const unavailableNumbers = useMemo(() => {
    return new Set([...reservedNumbers, ...paidNumbers]);
  }, [sorteio, reservedNumbers, paidNumbers]);

  const reservedSet = useMemo(() => new Set(reservedNumbers), [reservedNumbers]);
  const paidSet = useMemo(() => new Set(paidNumbers), [paidNumbers]);

  const totalValue = selectedNumbers.length * price;

  const whatsappDigits = "5516993537516";
  const whatsappLink = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";

  function formatNumberLabel(num) {
    return String(num).padStart(3, "0");
  }

  function handleCustomerChange(field, value) {
    const next = {
      ...customer,
      [field]: field === "whatsapp" ? onlyDigits(value) : value,
    };
    persistCustomer(next);
  }

  function scrollToNumbers() {
    numbersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getAvailableNumbers() {
    const list = [];
    for (let i = 1; i <= totalNumbers; i += 1) {
      if (!unavailableNumbers.has(i) && !selectedNumbers.includes(i)) {
        list.push(i);
      }
    }
    return list;
  }

  function toggleNumber(num) {
    if (unavailableNumbers.has(num)) return;
    setPixData(null);

    setSelectedNumbers((prev) => {
      const exists = prev.includes(num);
      const updated = exists
        ? prev.filter((n) => n !== num)
        : [...prev, num].sort((a, b) => a - b);

      if (updated.length === 0) {
        setPaymentOpen(false);
      }
      return updated;
    });
  }

  function clearSelection() {
    setSelectedNumbers([]);
    setPixData(null);
    setPaymentOpen(false);
  }

  function openPayment() {
    if (!selectedNumbers.length) return;
    setErro("");
    setPaymentOpen(true);
  }

  function pickRandom(quantity) {
    const available = getAvailableNumbers();
    if (!available.length) return;

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, quantity);

    setSelectedNumbers((prev) =>
      [...new Set([...prev, ...chosen])].sort((a, b) => a - b)
    );
    setPixData(null);
  }

  async function handlePix() {
    try {
      setErro("");
      setSubmittingPix(true);
      setPixData(null);

      if (!customer.nome.trim()) {
        throw new Error("Digite seu nome.");
      }

      if (onlyDigits(customer.whatsapp).length < 10) {
        throw new Error("Digite um celular válido.");
      }

      if (!selectedNumbers.length) {
        throw new Error("Escolha pelo menos um número.");
      }

      const payload = {
        slug,
        nome: customer.nome.trim(),
        whatsapp: onlyDigits(customer.whatsapp),
        numeros: selectedNumbers,
      };

      const res = await fetch(`${API_URL}/api/pix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível gerar o PIX.");
      }

      setPixData(data);
      await loadSorteio();
    } catch (err) {
      setErro(err.message || "Erro ao gerar PIX.");
    } finally {
      setSubmittingPix(false);
    }
  }

  async function copyPixCode() {
    try {
      const code =
        pixData?.pixCopiaECola ||
        pixData?.pixCode ||
        pixData?.copiaecola ||
        "";

      if (!code) return;
      await navigator.clipboard.writeText(code);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 1800);
    } catch {
      setCopiedPix(false);
    }
  }

  async function searchMyNumbers() {
    try {
      setErro("");
      setMyNumbersLoading(true);
      setMyNumbersResult(null);

      const phone = onlyDigits(myNumbersPhone);
      if (phone.length < 10) {
        throw new Error("Digite seu telefone.");
      }

      const res = await fetch(
        `${API_URL}/api/meus-numeros/${slug}?whatsapp=${encodeURIComponent(phone)}`
      );
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(
          data?.error || "Não foi possível consultar seus números."
        );
      }

      setMyNumbersResult(data);
    } catch (err) {
      setErro(err.message || "Erro ao consultar.");
    } finally {
      setMyNumbersLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #eef2ef; }

        @keyframes floatArrows {
          0% { transform: translateY(0px); opacity: 0.9; }
          50% { transform: translateY(6px); opacity: 1; }
          100% { transform: translateY(0px); opacity: 0.9; }
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 10px 24px rgba(16,185,129,0.18); transform: translateY(0); }
          50% { box-shadow: 0 16px 28px rgba(16,185,129,0.28); transform: translateY(-1px); }
          100% { box-shadow: 0 10px 24px rgba(16,185,129,0.18); transform: translateY(0); }
        }

        @keyframes quickPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.01); }
          100% { transform: scale(1); }
        }

        @keyframes floatWhatsapp {
          0% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
          100% { transform: translateY(0); }
        }
      `}</style>

      {myNumbersOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => setMyNumbersOpen(false)}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Meus números</div>
              <button
                style={styles.closeBtn}
                onClick={() => setMyNumbersOpen(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Telefone cadastrado</label>
              <input
                style={styles.input}
                value={formatPhone(myNumbersPhone)}
                onChange={(e) => setMyNumbersPhone(onlyDigits(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>

            <button style={styles.greenWideButton} onClick={searchMyNumbers}>
              {myNumbersLoading ? "Pesquisando..." : "Buscar números"}
            </button>

            {myNumbersResult ? (
              <div style={{ marginTop: 14 }}>
                <div style={styles.resultBox}>
                  <div style={styles.resultName}>
                    {myNumbersResult?.nome || "Cliente"}
                  </div>
                  <div style={{ marginTop: 8, lineHeight: 1.5, color: "#344054" }}>
                    {(myNumbersResult?.numeros || []).length
                      ? myNumbersResult.numeros
                          .map((n) => `N° ${formatNumberLabel(n)}`)
                          .join(", ")
                      : "Nenhum número encontrado."}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {paymentOpen && (
        <div
          style={styles.paymentOverlay}
          onClick={() => setPaymentOpen(false)}
        >
          <div
            style={styles.paymentSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.paymentHeader}>
              <div>
                <div style={styles.paymentTitle}>Finalizar pagamento</div>
                <div style={styles.paymentSub}>
                  {selectedNumbers.length} número(s) • {formatCurrency(totalValue)}
                </div>
              </div>

              <button
                style={styles.closeBtn}
                onClick={() => setPaymentOpen(false)}
              >
                ×
              </button>
            </div>

            {!pixData ? (
              <>
                <div style={styles.cartNumbersBoxModal}>
                  <div style={styles.cartNumbersLabel}>Seus números</div>
                  <div style={styles.cartNumbersInline}>
                    {selectedNumbers.map((n) => (
                      <span key={n} style={styles.cartNumberPillModal}>
                        {formatNumberLabel(n)}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Nome</label>
                  <input
                    style={styles.input}
                    value={customer.nome}
                    onChange={(e) => handleCustomerChange("nome", e.target.value)}
                    placeholder="Digite seu nome"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Celular</label>
                  <input
                    style={styles.input}
                    value={formatPhone(customer.whatsapp)}
                    onChange={(e) =>
                      handleCustomerChange("whatsapp", e.target.value)
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>

                {erro ? <div style={styles.errorBox}>{erro}</div> : null}

                <div style={styles.modalActions}>
                  <button style={styles.modalGhostBtn} onClick={clearSelection}>
                    Limpar seleção
                  </button>

                  <button
                    style={styles.payBtn}
                    onClick={handlePix}
                    disabled={submittingPix}
                  >
                    {submittingPix ? "Gerando pagamento..." : "Gerar PIX"}
                  </button>
                </div>
              </>
            ) : (
              <div style={styles.pixModalContent}>
                <div style={styles.orangeTitle}>Aguardando o pagamento</div>
                <div style={styles.helpText}>
                  Finalize agora pelo PIX para garantir seus números.
                </div>

                {pixData?.qrCodeBase64 ? (
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <img
                      src={
                        pixData.qrCodeBase64.startsWith("data:image")
                          ? pixData.qrCodeBase64
                          : `data:image/png;base64,${pixData.qrCodeBase64}`
                      }
                      alt="QR Code PIX"
                      style={styles.qrImage}
                    />
                  </div>
                ) : null}

                <div style={styles.pixRow}>
                  <span>Nome</span>
                  <span>CASA PREMIADA</span>
                </div>

                <div style={styles.pixRow}>
                  <span>Valor total</span>
                  <span>{formatCurrency(totalValue)}</span>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Chave PIX</label>
                  <div style={styles.copyRow}>
                    <input
                      readOnly
                      style={{ ...styles.input, marginBottom: 0 }}
                      value={
                        pixData?.pixCopiaECola ||
                        pixData?.pixCode ||
                        pixData?.copiaecola ||
                        ""
                      }
                    />
                    <button style={styles.copyMiniBtn} onClick={copyPixCode}>
                      {copiedPix ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.sendBtn}
                  >
                    Enviar comprovante
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {contactOpen && !hideFloatingCtas && (
        <div style={styles.contactWrap}>
          <div style={styles.contactBox}>
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                style={styles.contactPrimary}
              >
                💬 Falar com o organizador
              </a>
            ) : null}

            {whatsappDigits ? (
              <div style={styles.contactPhone}>📞 {formatPhone(whatsappDigits)}</div>
            ) : (
              <div style={styles.contactPhone}>WhatsApp não configurado</div>
            )}
          </div>
        </div>
      )}

      <div style={styles.topBar}>
        <div style={styles.logoArea}>
          {sorteio?.logoUrl ? (
            <img src={sorteio.logoUrl} alt="Logo" style={styles.logoImg} />
          ) : (
            <div style={styles.logoFallback}>CASA PREMIADA</div>
          )}
        </div>

        <button style={styles.topAction} onClick={() => setMyNumbersOpen(true)}>
          <span style={styles.topActionIcon}>👁️🔎</span>
          <span>Meus números</span>
        </button>
      </div>

      <div style={styles.container}>
        {erro && !sorteio ? (
          <div style={styles.card}>
            <div style={styles.description}>{erro}</div>
          </div>
        ) : null}

        <div style={styles.heroCard}>
          <div style={styles.heroLogoWrap}>
            {sorteio?.logoUrl ? (
              <img src={sorteio.logoUrl} alt="Logo" style={styles.heroLogoImg} />
            ) : (
              <div style={styles.heroLogoFallback}>CASA PREMIADA</div>
            )}
          </div>

          <img src={heroImage} alt={title} style={styles.heroImage} />

          <div style={styles.blackInfoBar}>
            <div style={styles.infoMiniBox}>
              <div style={styles.infoLabel}>Valor por número</div>
              <div style={styles.infoValue}>{formatCurrency(price)}</div>
            </div>

            <div style={styles.infoTitleBox}>
              <div style={styles.infoLabel}>Prêmio</div>
              <div style={styles.infoValueMain}>{title}</div>
            </div>

            <div style={styles.infoMiniBox}>
              <div style={styles.infoLabel}>Data sorteio</div>
              <div style={styles.infoValueSmall}>{formatDateTime(sorteio?.drawDate)}</div>
            </div>
          </div>
        </div>

        {description ? (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Descrição do prêmio</div>
            <div style={styles.description}>{description}</div>
          </div>
        ) : null}

        <div
          ref={numbersRef}
          style={styles.sectionHeadlineAnimated}
          onClick={scrollToNumbers}
        >
          <div style={styles.chooseHeadlineTop}>
            <span style={styles.headlineBadge}>✨</span>
            <span>Escolher números</span>
          </div>

          <div style={styles.chooseArrowWrap}>
            <span style={styles.chooseArrow}>↓</span>
            <span style={{ ...styles.chooseArrow, animationDelay: "0.15s" }}>↓</span>
            <span style={{ ...styles.chooseArrow, animationDelay: "0.3s" }}>↓</span>
          </div>
        </div>

        <div style={styles.legendHint}>Toque no número que deseja comprar 👇</div>

        <div style={styles.legendCard}>
          <div style={styles.legendRow}>
            <div style={{ ...styles.legendItem, background: "#e2e8f0", color: "#1f2937" }}>
              Disponíveis
            </div>
            <div style={{ ...styles.legendItem, background: "#111827", color: "#fff" }}>
              Reservados
            </div>
            <div style={{ ...styles.legendItem, background: "#166534", color: "#fff" }}>
              Comprados
            </div>
          </div>
        </div>

        <div ref={quickCardRef} style={styles.quickCard}>
          <div style={styles.quickTopLine}>
            <span style={styles.quickIcon}>⚡</span>
            <div>
              <div style={styles.quickTitle}>Compra rápida</div>
              <div style={styles.quickText}>Escolha aleatória dos números</div>
            </div>
          </div>

          <div style={styles.quickGrid}>
            <button style={styles.quickBtn} onClick={() => pickRandom(2)}>
              +2
            </button>
            <button style={styles.quickBtn} onClick={() => pickRandom(5)}>
              +5
            </button>
            <button style={styles.quickBtn} onClick={() => pickRandom(10)}>
              +10
            </button>
            <button style={styles.quickBtn} onClick={() => pickRandom(15)}>
              +15
            </button>
            <button style={styles.quickBtn} onClick={() => pickRandom(20)}>
              +20
            </button>
          </div>
        </div>

        <div style={styles.numberGrid}>
          {Array.from({ length: totalNumbers }, (_, index) => {
            const num = index + 1;
            const isReserved = reservedSet.has(num);
            const isPaid = paidSet.has(num);
            const isUnavailable = unavailableNumbers.has(num);
            const isSelected = selectedNumbers.includes(num);

            let stateStyle = {};
            if (isPaid) stateStyle = styles.numberPaid;
            else if (isReserved) stateStyle = styles.numberUnavailable;
            else if (isSelected) stateStyle = styles.numberActive;

            return (
              <button
                key={num}
                onClick={() => toggleNumber(num)}
                disabled={isUnavailable}
                style={{
                  ...styles.numberBtn,
                  ...stateStyle,
                }}
              >
                {String(num).padStart(3, "0")}
              </button>
            );
          })}
        </div>
      </div>

      {selectedNumbers.length > 0 ? (
        <div style={styles.cartBar}>
          <div style={styles.cartTopRow}>
            <span style={styles.cartCount}>
              {selectedNumbers.length} número(s)
            </span>
            <span style={styles.cartTotal}>{formatCurrency(totalValue)}</span>
          </div>

          <div style={styles.cartNumbersInline}>
            {selectedNumbers.map((n) => (
              <span key={n} style={styles.cartNumberPill}>
                {formatNumberLabel(n)}
              </span>
            ))}
          </div>

          <div style={styles.cartActionRow}>
            <button style={styles.cartClearBtn} onClick={clearSelection}>
              Limpar seleção
            </button>

            <button style={styles.cartPayBtn} onClick={openPayment}>
              Continuar para pagamento
            </button>
          </div>
        </div>
      ) : !hideFloatingCtas ? (
        <div style={styles.floatingWrap}>
          <button style={styles.floatingBtn} onClick={scrollToNumbers}>
            <span>✨ Escolher números</span>
            <span style={styles.floatingArrows}>↓ ↓ ↓</span>
          </button>
        </div>
      ) : null}

      {!hideFloatingCtas ? (
        <button
          style={styles.whatsappFloat}
          onClick={() => setContactOpen((prev) => !prev)}
        >
          💬
        </button>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef2ef",
    paddingBottom: 150,
    fontFamily: "Arial, sans-serif",
    position: "relative",
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "#ffffffeb",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #e5e7eb",
  },
  logoArea: {
    minHeight: 52,
    display: "flex",
    alignItems: "center",
  },
  logoImg: {
    height: 48,
    objectFit: "contain",
  },
  logoFallback: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111827",
    lineHeight: 1.1,
  },
  topAction: {
    border: "none",
    background: "#15803d",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  topActionIcon: {
    fontSize: 14,
    lineHeight: 1,
  },
  container: {
    maxWidth: 620,
    margin: "0 auto",
    padding: 14,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 26,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    marginBottom: 16,
    position: "relative",
  },
  heroLogoWrap: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 3,
    background: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    padding: "8px 10px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.10)",
    backdropFilter: "blur(8px)",
  },
  heroLogoImg: {
    height: 42,
    objectFit: "contain",
    display: "block",
  },
  heroLogoFallback: {
    color: "#111827",
    fontSize: 14,
    fontWeight: 600,
  },
  heroImage: {
    width: "100%",
    minHeight: 320,
    maxHeight: 620,
    display: "block",
    objectFit: "cover",
    background: "#ddd",
  },
  blackInfoBar: {
    background: "#111111",
    color: "#fff",
    padding: 16,
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
  },
  infoMiniBox: {},
  infoTitleBox: {},
  infoLabel: {
    fontSize: 11,
    color: "#bdbdbd",
    textTransform: "uppercase",
    marginBottom: 8,
    fontWeight: 500,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.25,
  },
  infoValueMain: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.15,
  },
  infoValueSmall: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.35,
  },
  card: {
    background: "#fff",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 10,
    color: "#111827",
  },
  description: {
    fontSize: 16,
    lineHeight: 1.55,
    color: "#344054",
    fontWeight: 400,
  },
  sectionHeadlineAnimated: {
    margin: "24px 0 12px",
    borderRadius: 22,
    padding: "16px 18px 14px",
    background: "linear-gradient(135deg, #1db874, #149954)",
    color: "#fff",
    cursor: "pointer",
    animation: "pulseGlow 1.8s infinite",
  },
  chooseHeadlineTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 22,
    fontWeight: 600,
    lineHeight: 1.15,
  },
  headlineBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.28)",
    fontSize: 18,
  },
  chooseArrowWrap: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  chooseArrow: {
    fontSize: 18,
    fontWeight: 700,
    animation: "floatArrows 1.1s infinite",
  },
  legendHint: {
    color: "#667085",
    fontSize: 14,
    marginBottom: 10,
    fontWeight: 400,
  },
  legendCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 12,
    border: "1px solid #e5e7eb",
    marginBottom: 14,
  },
  legendRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },
  legendItem: {
    borderRadius: 10,
    padding: "10px 8px",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 500,
  },
  quickCard: {
    background: "linear-gradient(180deg, #fffdf6 0%, #fff8dc 100%)",
    border: "1.5px solid #f4d36f",
    borderRadius: 22,
    padding: 14,
    marginBottom: 16,
    boxShadow: "0 8px 18px rgba(244,211,111,0.18)",
    animation: "quickPulse 2s infinite",
  },
  quickTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "#f6c948",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    boxShadow: "0 8px 18px rgba(246,201,72,0.35)",
  },
  quickTitle: {
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.1,
    color: "#111827",
  },
  quickText: {
    fontSize: 13,
    color: "#475467",
    marginTop: 2,
    fontWeight: 400,
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
  },
  quickBtn: {
    minHeight: 42,
    border: "none",
    borderRadius: 14,
    background: "#f6c948",
    color: "#111827",
    fontWeight: 600,
    fontSize: 17,
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 7,
  },
  numberBtn: {
    minHeight: 42,
    borderRadius: 12,
    border: "1.5px solid #d0d5dd",
    background: "#fff",
    color: "#111827",
    fontSize: 13,
    fontWeight: 500,
    boxShadow: "0 4px 10px rgba(15,23,42,0.04)",
  },
  numberUnavailable: {
    background: "#111827",
    color: "#fff",
    border: "1.5px solid #111827",
  },
  numberPaid: {
    background: "#166534",
    color: "#fff",
    border: "1.5px solid #166534",
  },
  numberActive: {
    background: "linear-gradient(135deg, #10b981, #0f8f4c)",
    color: "#fff",
    border: "1.5px solid #0f8f4c",
    boxShadow: "0 10px 18px rgba(16,185,129,0.20)",
  },
  helpText: {
    color: "#667085",
    fontSize: 15,
    lineHeight: 1.5,
    marginBottom: 14,
    fontWeight: 400,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: "#344054",
  },
  input: {
    width: "100%",
    minHeight: 52,
    border: "1px solid #d0d5dd",
    borderRadius: 14,
    padding: "0 14px",
    fontSize: 16,
    background: "#fff",
  },
  errorBox: {
    background: "#fef3f2",
    color: "#b42318",
    border: "1px solid #fecdca",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    fontWeight: 400,
  },
  payBtn: {
    flex: 1,
    minHeight: 56,
    border: "none",
    borderRadius: 16,
    background: "#15803d",
    color: "#fff",
    fontSize: 17,
    fontWeight: 600,
  },
  orangeTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: "#d97706",
    marginBottom: 6,
  },
  qrImage: {
    width: "100%",
    maxWidth: 240,
    borderRadius: 16,
  },
  pixRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    fontSize: 16,
    color: "#344054",
    fontWeight: 400,
  },
  copyRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "center",
  },
  copyMiniBtn: {
    minHeight: 52,
    border: "none",
    borderRadius: 14,
    background: "#f4d36f",
    padding: "0 16px",
    fontWeight: 600,
  },
  sendBtn: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    background: "#15803d",
    color: "#fff",
    borderRadius: 14,
    padding: "16px",
    fontSize: 17,
    fontWeight: 600,
    marginTop: 12,
  },
  floatingWrap: {
    position: "fixed",
    left: 14,
    right: 14,
    bottom: 16,
    zIndex: 30,
  },
  floatingBtn: {
    width: "100%",
    minHeight: 58,
    border: "none",
    borderRadius: 18,
    background: "linear-gradient(135deg, #10b981, #0f8f4c)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 600,
    boxShadow: "0 14px 24px rgba(16,185,129,0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
    animation: "pulseGlow 1.8s infinite",
  },
  floatingArrows: {
    animation: "floatArrows 1.1s infinite",
    letterSpacing: 2,
    fontSize: 16,
  },
  cartBar: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 40,
    background: "#ffffff",
    borderRadius: 24,
    padding: 14,
    boxShadow: "0 16px 30px rgba(15,23,42,0.14)",
    border: "1px solid #eef2f6",
  },
  cartTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  cartCount: {
    fontSize: 14,
    color: "#111827",
    fontWeight: 500,
  },
  cartTotal: {
    fontSize: 18,
    color: "#15803d",
    fontWeight: 600,
  },
  cartNumbersInline: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 12,
    maxHeight: 70,
    overflowY: "auto",
  },
  cartNumberPill: {
    background: "#eefaf3",
    color: "#0f8f4c",
    border: "1px solid #b7e4c7",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 500,
    fontSize: 12,
  },
  cartActionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.35fr",
    gap: 10,
  },
  cartClearBtn: {
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid #d0d5dd",
    background: "#fff",
    color: "#111827",
    fontWeight: 500,
    fontSize: 15,
  },
  cartPayBtn: {
    minHeight: 50,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #1db874, #149954)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 15,
    boxShadow: "0 12px 22px rgba(16,185,129,0.20)",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 100,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 22,
    padding: 18,
  },
  paymentOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.52)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 120,
  },
  paymentSheet: {
    width: "100%",
    maxWidth: 620,
    background: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 -18px 40px rgba(0,0,0,0.18)",
  },
  paymentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  paymentTitle: {
    fontSize: 21,
    fontWeight: 600,
    color: "#111827",
  },
  paymentSub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 14,
    fontWeight: 400,
  },
  cartNumbersBoxModal: {
    background: "#f8fafc",
    border: "1px solid #eaecf0",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  cartNumbersLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#344054",
    marginBottom: 8,
  },
  cartNumberPillModal: {
    background: "#ffffff",
    color: "#0f8f4c",
    border: "1px solid #ccebd8",
    borderRadius: 999,
    padding: "7px 11px",
    fontWeight: 500,
    fontSize: 12,
  },
  modalActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr",
    gap: 10,
    marginTop: 6,
  },
  modalGhostBtn: {
    minHeight: 56,
    borderRadius: 16,
    border: "1px solid #d0d5dd",
    background: "#fff",
    color: "#111827",
    fontSize: 15,
    fontWeight: 500,
  },
  pixModalContent: {
    paddingTop: 4,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    color: "#111827",
    fontWeight: 600,
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    fontSize: 34,
    lineHeight: 1,
    color: "#667085",
    fontWeight: 400,
  },
  greenWideButton: {
    width: "100%",
    minHeight: 56,
    border: "none",
    borderRadius: 16,
    background: "#15803d",
    color: "#fff",
    fontSize: 17,
    fontWeight: 600,
  },
  resultBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
  },
  resultName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: 600,
  },
  whatsappFloat: {
    position: "fixed",
    right: 14,
    bottom: 96,
    zIndex: 60,
    width: 50,
    height: 50,
    borderRadius: 999,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontSize: 24,
    boxShadow: "0 12px 24px rgba(22,163,74,0.35)",
    animation: "floatWhatsapp 1.8s infinite",
  },
  contactWrap: {
    position: "fixed",
    right: 14,
    bottom: 154,
    zIndex: 61,
    width: "min(300px, calc(100vw - 28px))",
  },
  contactBox: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 12,
    boxShadow: "0 16px 30px rgba(15,23,42,0.18)",
  },
  contactPrimary: {
    display: "block",
    textDecoration: "none",
    textAlign: "center",
    background: "#10b981",
    color: "#fff",
    borderRadius: 14,
    padding: "14px 12px",
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 10,
  },
  contactPhone: {
    border: "1px solid #d7dbe2",
    borderRadius: 14,
    padding: "12px 14px",
    textAlign: "center",
    color: "#344054",
    fontSize: 15,
    background: "#f8fafc",
  },
};
