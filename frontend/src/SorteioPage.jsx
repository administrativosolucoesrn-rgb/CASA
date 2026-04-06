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

function formatDate(dateString) {
  if (!dateString) return "Em breve";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Em breve";
  return date.toLocaleDateString("pt-BR");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function SorteioPage() {
  const { slug } = useParams();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sorteio, setSorteio] = useState(null);

  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);

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
  const checkoutRef = useRef(null);

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
  const companyName = sorteio?.companyName || "Casa Premiada Ribeirão";

  const unavailableNumbers = useMemo(() => {
    const reserved = safeArray(sorteio?.reservedNumbers);
    const paid = safeArray(sorteio?.paidNumbers);
    return new Set([...reserved, ...paid].map(Number));
  }, [sorteio]);

  const totalValue = selectedNumbers.length * price;

  const whatsappLink = useMemo(() => {
    const digits = onlyDigits(sorteio?.whatsapp || "");
    return digits ? `https://wa.me/${digits}` : "";
  }, [sorteio]);

  function formatNumberLabel(num) {
    return `N° ${String(num).padStart(3, "0")}`;
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

      setShowCheckout(updated.length > 0);
      return updated;
    });

    setTimeout(() => {
      checkoutRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }

  function pickRandom(quantity) {
    const available = getAvailableNumbers();
    if (!available.length) return;

    const chosen = [...available]
      .sort(() => Math.random() - 0.5)
      .slice(0, quantity);

    setSelectedNumbers((prev) =>
      [...new Set([...prev, ...chosen])].sort((a, b) => a - b)
    );
    setShowCheckout(true);
    setPixData(null);

    setTimeout(() => {
      checkoutRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
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

      setTimeout(() => {
        document.getElementById("pix-box")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 150);
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

  if (loading) {
    return (
      <div style={styles.centerWrap}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingDot} />
          <strong style={{ fontSize: 20 }}>Abrindo sorteio</strong>
        </div>
      </div>
    );
  }

  if (!sorteio) {
    return (
      <div style={styles.centerWrap}>
        <div style={styles.loadingCard}>
          <strong>Não foi possível abrir este sorteio.</strong>
          <div style={{ marginTop: 8 }}>{erro}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #eef2ef; }
      `}</style>

      {myNumbersOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => setMyNumbersOpen(false)}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <strong style={{ fontSize: 18 }}>Pesquisar suas reservas</strong>
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
              {myNumbersLoading ? "Pesquisando..." : "Pesquisar"}
            </button>

            {myNumbersResult ? (
              <div style={{ marginTop: 14 }}>
                <div style={styles.resultBox}>
                  <strong>{myNumbersResult?.nome || "Cliente"}</strong>
                  <div style={{ marginTop: 8, lineHeight: 1.5 }}>
                    {(myNumbersResult?.numeros || []).length
                      ? myNumbersResult.numeros
                          .map((n) => formatNumberLabel(n))
                          .join(", ")
                      : "Nenhum número encontrado."}
                  </div>
                </div>
              </div>
            ) : null}
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
          Ver meus números
        </button>
      </div>

      <div style={styles.container}>
        <div style={styles.heroCard}>
          <img src={heroImage} alt={title} style={styles.heroImage} />

          <div style={styles.blackInfoBar}>
            <div style={styles.infoMiniBox}>
              <div style={styles.infoLabel}>Valor por número</div>
              <div style={styles.infoValue}>{formatCurrency(price)}</div>
            </div>

            <div style={styles.infoTitleBox}>
              <div style={styles.infoLabel}>Prêmio</div>
              <div style={styles.infoTitle}>{title}</div>
            </div>

            <div style={styles.infoMiniBox}>
              <div style={styles.infoLabel}>Empresa</div>
              <div style={styles.infoValue}>{companyName}</div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.mainTitle}>{title}</div>
          <div style={styles.mainSubtitle}>Organizado por {companyName}</div>

          <div style={styles.metaRow}>
            <div style={styles.metaPill}>
              Sorteio: {formatDate(sorteio?.drawDate)}
            </div>
            <div style={styles.metaPill}>
              Bilhetes por apenas {formatCurrency(price)}
            </div>
          </div>

          <div style={styles.shareTitle}>Compartilhar sorteio</div>
          <div style={styles.shareRow}>
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                style={styles.whatsappBtn}
              >
                WhatsApp
              </a>
            ) : null}

            <button
              style={styles.copyBtn}
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
              }}
            >
              Copiar Link
            </button>
          </div>
        </div>

        {description ? (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Descrição do prêmio</div>
            <div style={styles.description}>{description}</div>
          </div>
        ) : null}

        <div ref={numbersRef} style={styles.sectionHeadline}>
          Clique e escolha seu número da sorte
        </div>

        <div style={styles.quickCard}>
          <div style={styles.quickHeadline}>
            COMPRA RÁPIDA - escolha aleatória dos números
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

        {selectedNumbers.length > 0 ? (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Números selecionados</div>
            <div style={styles.selectedWrap}>
              {selectedNumbers.map((n) => (
                <span key={n} style={styles.selectedChip}>
                  {formatNumberLabel(n)}
                </span>
              ))}
            </div>
            <div style={styles.selectedSummary}>
              {selectedNumbers.length} número(s) • {formatCurrency(totalValue)}
            </div>
          </div>
        ) : null}

        <div style={styles.numberGrid}>
          {Array.from({ length: totalNumbers }, (_, index) => {
            const num = index + 1;
            const isUnavailable = unavailableNumbers.has(num);
            const isSelected = selectedNumbers.includes(num);

            return (
              <button
                key={num}
                onClick={() => toggleNumber(num)}
                disabled={isUnavailable}
                style={{
                  ...styles.numberBtn,
                  ...(isUnavailable ? styles.numberUnavailable : {}),
                  ...(isSelected ? styles.numberActive : {}),
                }}
              >
                {String(num).padStart(3, "0")}
              </button>
            );
          })}
        </div>

        {showCheckout ? (
          <div ref={checkoutRef} style={styles.card}>
            <div style={styles.sectionTitle}>Pagar agora</div>
            <div style={styles.helpText}>
              Sua reserva será mantida por 10 minutos para pagamento.
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

            <div style={styles.resumeBox}>
              <div>
                <strong>Números:</strong>{" "}
                {selectedNumbers.map((n) => formatNumberLabel(n)).join(", ")}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Total:</strong> {formatCurrency(totalValue)}
              </div>
            </div>

            {erro ? <div style={styles.errorBox}>{erro}</div> : null}

            <button
              style={styles.payBtn}
              onClick={handlePix}
              disabled={submittingPix}
            >
              {submittingPix ? "Gerando pagamento..." : "Pagar"}
            </button>
          </div>
        ) : null}

        {pixData ? (
          <div id="pix-box" style={styles.card}>
            <div style={styles.orangeTitle}>Aguardando o pagamento!</div>
            <div style={styles.helpText}>Finalize o pagamento</div>

            <div style={styles.infoCard}>
              <div style={styles.sectionTitle}>Veja o passo a passo</div>
              <ol style={styles.stepList}>
                <li>Copie a chave PIX.</li>
                <li>Abra o aplicativo do seu banco e escolha PIX.</li>
                <li>Faça o pagamento e envie o comprovante no WhatsApp.</li>
              </ol>

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

              <div style={styles.pixHeading}>Dados do PIX</div>

              <div style={styles.pixRow}>
                <span>Nome</span>
                <strong>CASA PREMIADA</strong>
              </div>

              <div style={styles.pixRow}>
                <span>Valor total</span>
                <strong>{formatCurrency(totalValue)}</strong>
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
          </div>
        ) : null}
      </div>

      {selectedNumbers.length === 0 ? (
        <div style={styles.floatingWrap}>
          <button style={styles.floatingBtn} onClick={scrollToNumbers}>
            Escolher números
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef2ef",
    paddingBottom: 100,
    fontFamily: "Arial, sans-serif",
  },
  centerWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#eef2ef",
  },
  loadingCard: {
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    textAlign: "center",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  },
  loadingDot: {
    width: 42,
    height: 42,
    borderRadius: 99,
    background: "#10b981",
    margin: "0 auto 12px",
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
    fontSize: 22,
    fontWeight: 900,
    color: "#111827",
  },
  topAction: {
    border: "none",
    background: "#15803d",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 900,
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
  },
  heroImage: {
    width: "100%",
    minHeight: 360,
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
    gridTemplateColumns: "1fr 1.2fr 1fr",
    gap: 10,
  },
  infoMiniBox: {},
  infoTitleBox: {},
  infoLabel: {
    fontSize: 12,
    color: "#bdbdbd",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.15,
  },
  card: {
    background: "#fff",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1.05,
    color: "#111827",
  },
  mainSubtitle: {
    marginTop: 6,
    fontSize: 17,
    color: "#475467",
  },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 14,
    marginBottom: 18,
  },
  metaPill: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "12px 14px",
    textAlign: "center",
    fontWeight: 800,
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 12,
  },
  shareRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  whatsappBtn: {
    textDecoration: "none",
    background: "#22c55e",
    color: "#fff",
    padding: "16px 18px",
    textAlign: "center",
    borderRadius: 18,
    fontSize: 18,
    fontWeight: 900,
  },
  copyBtn: {
    background: "#fff",
    color: "#111827",
    border: "1px solid #d0d5dd",
    borderRadius: 18,
    padding: "16px 18px",
    fontSize: 18,
    fontWeight: 900,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 900,
    marginBottom: 10,
  },
  description: {
    fontSize: 18,
    lineHeight: 1.55,
    color: "#344054",
  },
  sectionHeadline: {
    margin: "24px 0 14px",
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.15,
    color: "#111827",
  },
  quickCard: {
    background: "#fffef6",
    border: "2px solid #f4d36f",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  quickHeadline: {
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.2,
    marginBottom: 14,
    color: "#111827",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 10,
  },
  quickBtn: {
    minHeight: 54,
    border: "none",
    borderRadius: 14,
    background: "#f6c948",
    color: "#111827",
    fontWeight: 900,
    fontSize: 20,
  },
  selectedWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  selectedChip: {
    background: "#e8f7ee",
    color: "#087443",
    borderRadius: 999,
    padding: "10px 12px",
    fontWeight: 900,
  },
  selectedSummary: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 900,
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  numberBtn: {
    minHeight: 76,
    borderRadius: 18,
    border: "2px solid #d0d5dd",
    background: "#fff",
    color: "#111827",
    fontSize: 24,
    fontWeight: 900,
    boxShadow: "0 8px 18px rgba(15,23,42,0.05)",
  },
  numberUnavailable: {
    background: "#edf1f5",
    color: "#98a2b3",
    border: "2px solid #e4e7ec",
  },
  numberActive: {
    background: "linear-gradient(135deg, #10b981, #0f8f4c)",
    color: "#fff",
    border: "2px solid #0f8f4c",
    boxShadow: "0 12px 22px rgba(16,185,129,0.24)",
  },
  helpText: {
    color: "#667085",
    fontSize: 15,
    lineHeight: 1.5,
    marginBottom: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 800,
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
  resumeBox: {
    background: "#f8fafc",
    border: "1px solid #eaecf0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    lineHeight: 1.6,
  },
  errorBox: {
    background: "#fef3f2",
    color: "#b42318",
    border: "1px solid #fecdca",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  payBtn: {
    width: "100%",
    minHeight: 56,
    border: "none",
    borderRadius: 16,
    background: "#15803d",
    color: "#fff",
    fontSize: 20,
    fontWeight: 900,
  },
  orangeTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#d97706",
    marginBottom: 6,
  },
  infoCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
  },
  stepList: {
    paddingLeft: 18,
    lineHeight: 1.7,
    color: "#344054",
    fontSize: 18,
    marginTop: 0,
  },
  qrImage: {
    width: "100%",
    maxWidth: 240,
    borderRadius: 16,
  },
  pixHeading: {
    fontSize: 22,
    fontWeight: 900,
    margin: "6px 0 14px",
  },
  pixRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    fontSize: 18,
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
    fontWeight: 900,
  },
  sendBtn: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    background: "#15803d",
    color: "#fff",
    borderRadius: 14,
    padding: "16px",
    fontSize: 18,
    fontWeight: 900,
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
    fontSize: 20,
    fontWeight: 900,
    boxShadow: "0 14px 24px rgba(16,185,129,0.28)",
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
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    fontSize: 36,
    lineHeight: 1,
    color: "#667085",
  },
  greenWideButton: {
    width: "100%",
    minHeight: 56,
    border: "none",
    borderRadius: 16,
    background: "#15803d",
    color: "#fff",
    fontSize: 18,
    fontWeight: 900,
  },
  resultBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
  },
};
