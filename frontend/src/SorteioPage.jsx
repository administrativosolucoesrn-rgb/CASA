import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

export default function SorteioPage() {
  const { slug } = useParams();

  const [loading, setLoading] = useState(true);
  const [sorteio, setSorteio] = useState(null);
  const [erro, setErro] = useState("");

  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [customer, setCustomer] = useState({
    nome: "",
    whatsapp: "",
  });

  const [submittingReserve, setSubmittingReserve] = useState(false);
  const [submittingPix, setSubmittingPix] = useState(false);

  const [showBuyerPanel, setShowBuyerPanel] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [reserveResponse, setReserveResponse] = useState(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);

  const numbersSectionRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    loadSorteio();
    loadCustomerFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function loadSorteio() {
    try {
      setLoading(true);
      setErro("");

      const res = await fetch(`${API_URL}/api/sorteios/${slug}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível carregar o sorteio.");
      }

      setSorteio(data);
    } catch (err) {
      setErro(err.message || "Erro ao carregar o sorteio.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerFromBackend() {
    try {
      const savedPhone =
        localStorage.getItem("casa_premiada_whatsapp") || "";

      if (!savedPhone) return;

      const res = await fetch(
        `${API_URL}/api/clientes/buscar?whatsapp=${encodeURIComponent(savedPhone)}`
      );

      if (!res.ok) return;

      const data = await res.json();

      if (data?.cliente) {
        setCustomer({
          nome: data.cliente.nome || "",
          whatsapp: data.cliente.whatsapp || savedPhone,
        });
      }
    } catch {
      // silencioso para não travar a página pública
    }
  }

  const totalNumbers = Number(sorteio?.totalNumbers || sorteio?.quantidadeNumeros || 0);
  const ticketPrice = Number(sorteio?.price || sorteio?.valor || 0);

  const unavailableNumbers = useMemo(() => {
    if (!sorteio) return new Set();

    const reserved = Array.isArray(sorteio?.reservedNumbers)
      ? sorteio.reservedNumbers
      : [];
    const paid = Array.isArray(sorteio?.paidNumbers) ? sorteio.paidNumbers : [];
    const sold = Array.isArray(sorteio?.soldNumbers) ? sorteio.soldNumbers : [];

    return new Set([...reserved, ...paid, ...sold].map(Number));
  }, [sorteio]);

  const totalValue = useMemo(() => {
    return selectedNumbers.length * ticketPrice;
  }, [selectedNumbers.length, ticketPrice]);

  const heroImage =
    sorteio?.image ||
    sorteio?.imagem ||
    sorteio?.premioImagem ||
    "https://via.placeholder.com/1200x900?text=Premio";

  const campaignTitle =
    sorteio?.title || sorteio?.titulo || "Casa Premiada Ribeirão";

  const prizeTitle =
    sorteio?.subtitle ||
    sorteio?.descricao ||
    sorteio?.premioNome ||
    "Escolha seus números e participe";

  const drawDate =
    sorteio?.drawDate || sorteio?.dataSorteio || sorteio?.date || "";

  const companyName =
    sorteio?.companyName ||
    sorteio?.empresa ||
    "Casa Premiada Ribeirão";

  const whatsappLink = useMemo(() => {
    const raw =
      sorteio?.whatsapp ||
      sorteio?.telefone ||
      sorteio?.numeroWhatsapp ||
      "";
    const digits = String(raw).replace(/\D/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits}`;
  }, [sorteio]);

  const shareLink =
    typeof window !== "undefined" ? window.location.href : "";

  function scrollToNumbers() {
    numbersSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatDate(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatNumberLabel(num) {
    const digits = String(totalNumbers).length >= 4 ? 4 : 3;
    return String(num).padStart(digits, "0");
  }

  function sanitizePhone(value) {
    return value.replace(/\D/g, "").slice(0, 11);
  }

  function formatWhatsapp(value) {
    const digits = sanitizePhone(value);

    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return value;
  }

  function handleCustomerChange(field, value) {
    if (field === "whatsapp") {
      const digits = sanitizePhone(value);
      setCustomer((prev) => ({ ...prev, whatsapp: digits }));
      localStorage.setItem("casa_premiada_whatsapp", digits);
      return;
    }

    setCustomer((prev) => ({ ...prev, [field]: value }));
  }

  function toggleNumber(num) {
    if (unavailableNumbers.has(num)) return;

    setPixData(null);
    setReserveResponse(null);
    setSuccessMessage("");

    setSelectedNumbers((prev) => {
      const exists = prev.includes(num);

      if (exists) {
        const updated = prev.filter((n) => n !== num);
        if (updated.length === 0) setShowBuyerPanel(false);
        return updated;
      }

      const updated = [...prev, num].sort((a, b) => a - b);
      setShowBuyerPanel(true);
      return updated;
    });
  }

  function getAvailableNumbersList() {
    const available = [];
    for (let i = 1; i <= totalNumbers; i += 1) {
      if (!unavailableNumbers.has(i) && !selectedNumbers.includes(i)) {
        available.push(i);
      }
    }
    return available;
  }

  function selectRandomNumbers(quantity) {
    setPixData(null);
    setReserveResponse(null);
    setSuccessMessage("");

    const available = getAvailableNumbersList();

    if (available.length === 0) return;

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, quantity);

    if (chosen.length === 0) return;

    setSelectedNumbers((prev) =>
      [...new Set([...prev, ...chosen])].sort((a, b) => a - b)
    );
    setShowBuyerPanel(true);

    setTimeout(() => {
      numbersSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  function clearSelection() {
    setSelectedNumbers([]);
    setPixData(null);
    setReserveResponse(null);
    setSuccessMessage("");
    setShowBuyerPanel(false);
  }

  async function handleReserve() {
    try {
      setErro("");
      setSuccessMessage("");

      if (!customer.nome.trim()) {
        throw new Error("Digite seu nome completo.");
      }

      if (sanitizePhone(customer.whatsapp).length < 10) {
        throw new Error("Digite um WhatsApp válido.");
      }

      if (!selectedNumbers.length) {
        throw new Error("Escolha pelo menos um número.");
      }

      setSubmittingReserve(true);

      const payload = {
        slug,
        nome: customer.nome.trim(),
        whatsapp: sanitizePhone(customer.whatsapp),
        numeros: selectedNumbers,
      };

      const res = await fetch(`${API_URL}/api/reservas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível reservar agora.");
      }

      setReserveResponse(data);
      setSuccessMessage("Números reservados com sucesso.");
      localStorage.setItem(
        "casa_premiada_whatsapp",
        sanitizePhone(customer.whatsapp)
      );

      await loadSorteio();
    } catch (err) {
      setErro(err.message || "Erro ao reservar números.");
    } finally {
      setSubmittingReserve(false);
    }
  }

  async function handlePixPayment() {
    try {
      setErro("");
      setSuccessMessage("");
      setCopiedPix(false);

      if (!customer.nome.trim()) {
        throw new Error("Digite seu nome completo.");
      }

      if (sanitizePhone(customer.whatsapp).length < 10) {
        throw new Error("Digite um WhatsApp válido.");
      }

      if (!selectedNumbers.length) {
        throw new Error("Escolha pelo menos um número.");
      }

      setSubmittingPix(true);

      const payload = {
        slug,
        nome: customer.nome.trim(),
        whatsapp: sanitizePhone(customer.whatsapp),
        numeros: selectedNumbers,
      };

      const res = await fetch(`${API_URL}/api/pix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível gerar o Pix.");
      }

      setPixData(data);
      setSuccessMessage("Pix gerado com sucesso.");

      if (!reserveResponse) {
        setReserveResponse({
          reservaId: data?.reservaId,
          status: "reservado",
        });
      }

      localStorage.setItem(
        "casa_premiada_whatsapp",
        sanitizePhone(customer.whatsapp)
      );

      await loadSorteio();

      setTimeout(() => {
        const pixBox = document.getElementById("pix-box");
        pixBox?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    } catch (err) {
      setErro(err.message || "Erro ao gerar Pix.");
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

      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      setCopiedPix(false);
    }
  }

  async function sharePage() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: campaignTitle,
          text: `Participe agora: ${campaignTitle}`,
          url: shareLink,
        });
        return;
      }

      await navigator.clipboard.writeText(shareLink);
      alert("Link copiado com sucesso.");
    } catch {
      // silencioso
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f7f8fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#fff",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 10px 35px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "4px solid #e8f5ee",
              borderTop: "4px solid #1f9d55",
              margin: "0 auto 18px",
              animation: "spin 1s linear infinite",
            }}
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#182028",
              marginBottom: 6,
            }}
          >
            Abrindo sorteio
          </div>
          <div style={{ color: "#667085", fontSize: 14 }}>
            Aguarde só um instante...
          </div>

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (erro && !sorteio) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f7f8fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          padding: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#fff",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 10px 35px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Não foi possível abrir este sorteio
          </div>
          <div style={{ color: "#667085", marginBottom: 18 }}>{erro}</div>
          <button
            onClick={loadSorteio}
            style={primaryButtonStyle}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        color: "#182028",
        paddingBottom: selectedNumbers.length ? 160 : 100,
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #f5f7fb; }
        button { font-family: inherit; }
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ position: "relative" }}>
            <img
              src={heroImage}
              alt={campaignTitle}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                objectFit: "cover",
                maxHeight: 520,
                background: "#edf1f5",
              }}
            />

            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.48), rgba(0,0,0,0.08), rgba(0,0,0,0))",
              }}
            />

            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  background: "rgba(255,255,255,0.16)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 999,
                  padding: "8px 14px",
                  fontWeight: 700,
                  fontSize: 12,
                  backdropFilter: "blur(6px)",
                }}
              >
                {companyName}
              </div>

              <div
                style={{
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  textShadow: "0 2px 18px rgba(0,0,0,0.28)",
                }}
              >
                {campaignTitle}
              </div>

              <div
                style={{
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 14,
                  lineHeight: 1.45,
                  maxWidth: 440,
                }}
              >
                {prizeTitle}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <InfoCard
              title="Valor por número"
              value={formatCurrency(ticketPrice)}
            />
            <InfoCard
              title="Data do sorteio"
              value={drawDate ? formatDate(drawDate) : "Em breve"}
            />
          </div>
        </section>

        <div style={{ padding: "16px 14px 0" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 24,
              boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
              padding: 16,
              marginTop: 14,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              Como funciona
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#667085",
                lineHeight: 1.6,
              }}
            >
              Escolha seus números, informe seu nome e WhatsApp, reserve e
              finalize com Pix. Simples, rápido e feito para celular.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginTop: 14,
              }}
            >
              <MiniStep number="1" text="Escolha seus números" />
              <MiniStep number="2" text="Preencha seus dados" />
              <MiniStep number="3" text="Pague via Pix" />
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 14px 0" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
            }}
          >
            <QuickSelectButton
              label="+5"
              onClick={() => selectRandomNumbers(5)}
            />
            <QuickSelectButton
              label="+10"
              onClick={() => selectRandomNumbers(10)}
            />
            <QuickSelectButton
              label="+25"
              onClick={() => selectRandomNumbers(25)}
            />
            <QuickSelectButton
              label="+50"
              onClick={() => selectRandomNumbers(50)}
            />
          </div>
        </div>

        <section ref={numbersSectionRef} style={{ padding: "16px 14px 0" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              padding: 16,
              boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#101828",
                  }}
                >
                  Escolha seus números
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#667085",
                    marginTop: 4,
                  }}
                >
                  Toque para selecionar manualmente
                </div>
              </div>

              {selectedNumbers.length > 0 && (
                <button
                  onClick={clearSelection}
                  style={{
                    border: "none",
                    background: "#fff4f4",
                    color: "#d92d20",
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Limpar
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 10,
              }}
            >
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
                      border: isSelected
                        ? "2px solid #16a34a"
                        : isUnavailable
                        ? "1px solid #e4e7ec"
                        : "1px solid #d0d5dd",
                      background: isSelected
                        ? "linear-gradient(135deg, #1db954, #148143)"
                        : isUnavailable
                        ? "#f2f4f7"
                        : "#ffffff",
                      color: isSelected
                        ? "#fff"
                        : isUnavailable
                        ? "#98a2b3"
                        : "#101828",
                      borderRadius: 16,
                      height: 52,
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: isUnavailable ? "not-allowed" : "pointer",
                      boxShadow: isSelected
                        ? "0 10px 20px rgba(22,163,74,0.18)"
                        : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {formatNumberLabel(num)}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                fontSize: 12,
                color: "#667085",
              }}
            >
              <Legend color="#ffffff" border="#d0d5dd" label="Disponível" />
              <Legend color="#16a34a" border="#16a34a" label="Selecionado" textColor="#fff" />
              <Legend color="#f2f4f7" border="#e4e7ec" label="Indisponível" />
            </div>
          </div>
        </section>

        {showBuyerPanel && (
          <section style={{ padding: "16px 14px 0" }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                padding: 18,
                boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#101828",
                  marginBottom: 14,
                }}
              >
                Seus dados
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#344054",
                      marginBottom: 8,
                    }}
                  >
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={customer.nome}
                    onChange={(e) =>
                      handleCustomerChange("nome", e.target.value)
                    }
                    placeholder="Digite seu nome completo"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#344054",
                      marginBottom: 8,
                    }}
                  >
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={formatWhatsapp(customer.whatsapp)}
                    onChange={(e) =>
                      handleCustomerChange("whatsapp", e.target.value)
                    }
                    placeholder="(00) 00000-0000"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 18,
                  background: "#f8fafc",
                  border: "1px solid #eaecf0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    gap: 12,
                  }}
                >
                  <span style={{ color: "#667085", fontSize: 14 }}>
                    Quantidade
                  </span>
                  <strong style={{ color: "#101828" }}>
                    {selectedNumbers.length} número(s)
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    gap: 12,
                  }}
                >
                  <span style={{ color: "#667085", fontSize: 14 }}>
                    Total
                  </span>
                  <strong
                    style={{
                      color: "#16a34a",
                      fontSize: 18,
                    }}
                  >
                    {formatCurrency(totalValue)}
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      color: "#667085",
                      fontSize: 13,
                      marginBottom: 8,
                    }}
                  >
                    Números escolhidos
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedNumbers.map((num) => (
                      <div
                        key={num}
                        style={{
                          background: "#e8f7ee",
                          color: "#148143",
                          fontWeight: 800,
                          padding: "8px 10px",
                          borderRadius: 12,
                          fontSize: 13,
                        }}
                      >
                        {formatNumberLabel(num)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {erro && (
                <div
                  style={{
                    marginTop: 14,
                    background: "#fff3f2",
                    color: "#b42318",
                    padding: 12,
                    borderRadius: 14,
                    fontSize: 14,
                    border: "1px solid #fecdca",
                  }}
                >
                  {erro}
                </div>
              )}

              {successMessage && (
                <div
                  style={{
                    marginTop: 14,
                    background: "#ecfdf3",
                    color: "#027a48",
                    padding: 12,
                    borderRadius: 14,
                    fontSize: 14,
                    border: "1px solid #abefc6",
                  }}
                >
                  {successMessage}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <button
                  onClick={handleReserve}
                  disabled={submittingReserve}
                  style={{
                    ...primaryButtonStyle,
                    width: "100%",
                    opacity: submittingReserve ? 0.75 : 1,
                  }}
                >
                  {submittingReserve ? "Reservando..." : "Reservar"}
                </button>

                <button
                  onClick={handlePixPayment}
                  disabled={submittingPix}
                  style={{
                    ...secondaryGreenButtonStyle,
                    width: "100%",
                    opacity: submittingPix ? 0.75 : 1,
                  }}
                >
                  {submittingPix ? "Gerando Pix..." : "Pagar"}
                </button>
              </div>
            </div>
          </section>
        )}

        {pixData && (
          <section id="pix-box" style={{ padding: "16px 14px 0" }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                padding: 18,
                boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 800,
                  color: "#101828",
                  marginBottom: 6,
                }}
              >
                Pagamento Pix
              </div>

              <div
                style={{
                  color: "#667085",
                  fontSize: 14,
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
                Faça o pagamento para confirmar seus números. Assim que o Pix
                for identificado, sua participação fica concluída.
              </div>

              {pixData?.qrCodeBase64 || pixData?.qrCode ? (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #eaecf0",
                    borderRadius: 20,
                    padding: 18,
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <img
                    src={
                      pixData?.qrCodeBase64?.startsWith("data:image")
                        ? pixData.qrCodeBase64
                        : pixData?.qrCodeBase64
                        ? `data:image/png;base64,${pixData.qrCodeBase64}`
                        : pixData?.qrCode || ""
                    }
                    alt="QR Code Pix"
                    style={{
                      width: "100%",
                      maxWidth: 260,
                      borderRadius: 18,
                      background: "#fff",
                    }}
                  />
                </div>
              ) : null}

              {(pixData?.pixCopiaECola ||
                pixData?.pixCode ||
                pixData?.copiaecola) && (
                <>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#344054",
                      marginBottom: 8,
                    }}
                  >
                    Pix copia e cola
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #eaecf0",
                      borderRadius: 16,
                      padding: 14,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "#475467",
                      wordBreak: "break-all",
                    }}
                  >
                    {pixData?.pixCopiaECola ||
                      pixData?.pixCode ||
                      pixData?.copiaecola}
                  </div>

                  <button
                    onClick={copyPixCode}
                    style={{
                      ...primaryButtonStyle,
                      width: "100%",
                      marginTop: 12,
                    }}
                  >
                    {copiedPix ? "Código copiado" : "Copiar código Pix"}
                  </button>
                </>
              )}

              {(pixData?.expirationDate ||
                pixData?.expiresAt ||
                pixData?.expiracao) && (
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 13,
                    color: "#667085",
                  }}
                >
                  Válido até:{" "}
                  <strong style={{ color: "#101828" }}>
                    {formatDate(
                      pixData?.expirationDate ||
                        pixData?.expiresAt ||
                        pixData?.expiracao
                    )}
                  </strong>
                </div>
              )}
            </div>
          </section>
        )}

        <section style={{ padding: "16px 14px 30px" }}>
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...whatsappButtonStyle,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Falar no WhatsApp
              </a>
            )}

            <button
              onClick={sharePage}
              style={{
                background: "#fff",
                color: "#101828",
                border: "1px solid #d0d5dd",
                borderRadius: 18,
                height: 54,
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
              }}
            >
              Compartilhar sorteio
            </button>
          </div>
        </section>
      </div>

      {selectedNumbers.length === 0 && (
        <div
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            bottom: 16,
            zIndex: 1000,
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              margin: "0 auto",
              maxWidth: 560,
            }}
          >
            <button
              onClick={scrollToNumbers}
              style={{
                width: "100%",
                height: 60,
                border: "none",
                borderRadius: 20,
                background: "linear-gradient(135deg, #1db954, #148143)",
                color: "#fff",
                fontSize: 17,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 18px 35px rgba(22,163,74,0.30)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              Escolher números
              <span style={{ fontSize: 22, lineHeight: 1 }}>↓</span>
            </button>
          </div>
        </div>
      )}

      {selectedNumbers.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            bottom: 16,
            zIndex: 1000,
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 22,
              boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
              border: "1px solid #eaecf0",
              padding: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#667085",
                  marginBottom: 4,
                }}
              >
                Selecionados
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#101828",
                }}
              >
                {selectedNumbers.length} número(s)
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#16a34a",
                  fontWeight: 800,
                }}
              >
                {formatCurrency(totalValue)}
              </div>
            </div>

            <button
              onClick={() => {
                setShowBuyerPanel(true);
                setTimeout(() => {
                  window.scrollBy({
                    top: 300,
                    behavior: "smooth",
                  });
                }, 80);
              }}
              style={{
                ...primaryButtonStyle,
                minWidth: 160,
                padding: "0 18px",
              }}
            >
              Ver informações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #eaecf0",
        borderRadius: 18,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#667085",
          marginBottom: 6,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: "#101828",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStep({ number, text }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #eaecf0",
        borderRadius: 18,
        padding: 12,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#16a34a",
          color: "#fff",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 8px",
          fontSize: 13,
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#475467",
          fontWeight: 700,
          lineHeight: 1.4,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function QuickSelectButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 50,
        borderRadius: 18,
        border: "1px solid #d0d5dd",
        background: "#fff",
        color: "#101828",
        fontWeight: 800,
        fontSize: 15,
        cursor: "pointer",
        boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
      }}
    >
      {label}
    </button>
  );
}

function Legend({ color, border, label, textColor }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 6,
          background: color,
          border: `1px solid ${border}`,
          display: "inline-block",
        }}
      />
      <span style={{ color: textColor || "#667085" }}>{label}</span>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 54,
  borderRadius: 16,
  border: "1px solid #d0d5dd",
  outline: "none",
  padding: "0 16px",
  fontSize: 15,
  background: "#fff",
  color: "#101828",
};

const primaryButtonStyle = {
  height: 54,
  border: "none",
  borderRadius: 18,
  background: "linear-gradient(135deg, #1db954, #148143)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(22,163,74,0.22)",
};

const secondaryGreenButtonStyle = {
  height: 54,
  border: "1px solid #bbf7d0",
  borderRadius: 18,
  background: "#ecfdf3",
  color: "#067647",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const whatsappButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 54,
  border: "none",
  borderRadius: 18,
  background: "#25D366",
  color: "#fff",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(37, 211, 102, 0.22)",
};
