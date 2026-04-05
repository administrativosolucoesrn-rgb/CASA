import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function SorteioPage() {
  const { slug } = useParams();

  const [sorteio, setSorteio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [showNumeros, setShowNumeros] = useState(true);
  const [comprador, setComprador] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cp_cliente")) || { nome: "", telefone: "" };
    } catch {
      return { nome: "", telefone: "" };
    }
  });

  useEffect(() => {
    carregarSorteio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function carregarSorteio() {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/public/sorteios/${slug}`);
      const data = await res.json();
      setSorteio(data);
    } catch (err) {
      console.error(err);
      setSorteio(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("cp_cliente", JSON.stringify(comprador));
  }, [comprador]);

  const total = useMemo(() => {
    const valor = Number(sorteio?.valorNumero || 0);
    return selectedNumbers.length * valor;
  }, [selectedNumbers, sorteio]);

  const numerosDisponiveis = useMemo(() => {
    if (!sorteio?.numeros) return [];
    return sorteio.numeros;
  }, [sorteio]);

  function toggleNumero(numeroObj) {
    if (numeroObj.status !== "disponivel") return;

    setSelectedNumbers((prev) => {
      const jaExiste = prev.includes(numeroObj.numero);
      if (jaExiste) {
        return prev.filter((n) => n !== numeroObj.numero);
      }
      return [...prev, numeroObj.numero];
    });
  }

  function escolherAleatorios(qtd) {
    const livres = numerosDisponiveis
      .filter((n) => n.status === "disponivel" && !selectedNumbers.includes(n.numero))
      .map((n) => n.numero);

    if (!livres.length) return;

    const embaralhados = [...livres].sort(() => Math.random() - 0.5);
    const novos = embaralhados.slice(0, qtd);

    setSelectedNumbers((prev) => [...prev, ...novos]);
    setShowNumeros(false);
  }

  function limparSelecao() {
    setSelectedNumbers([]);
  }

  async function reservarNumeros() {
    if (!comprador.nome || !comprador.telefone) {
      alert("Preencha nome e telefone.");
      return;
    }

    if (!selectedNumbers.length) {
      alert("Selecione pelo menos um número.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/public/sorteios/${slug}/reservar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: comprador.nome,
          telefone: comprador.telefone,
          numeros: selectedNumbers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao reservar números.");
        return;
      }

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data?.pixQrCodeBase64 || data?.pixCopiaECola) {
        localStorage.setItem("cp_pix", JSON.stringify(data));
        window.location.href = `/pagamento/${slug}`;
        return;
      }

      alert("Reserva realizada com sucesso.");
      setSelectedNumbers([]);
      carregarSorteio();
    } catch (err) {
      console.error(err);
      alert("Erro ao reservar números.");
    }
  }

  function copiarLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copiado.");
  }

  function compartilhar() {
    if (navigator.share) {
      navigator.share({
        title: sorteio?.titulo || "Sorteio",
        text: "Participe deste sorteio",
        url: window.location.href,
      });
    } else {
      copiarLink();
    }
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarNumero(numero) {
    const digitos = String(sorteio?.totalNumeros || 100).length;
    return String(numero).padStart(digitos, "0");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Carregando sorteio...</div>
      </div>
    );
  }

  if (!sorteio) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>Sorteio não encontrado.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.heroCard}>
          <div style={styles.logoWrap}>
            {sorteio.logoUrl ? (
              <img src={sorteio.logoUrl} alt="Logo" style={styles.logo} />
            ) : (
              <div style={styles.logoPlaceholder}>CASA PREMIADA RIBEIRÃO</div>
            )}
          </div>

          <div style={styles.imageWrap}>
            {sorteio.fotoPremio ? (
              <img src={sorteio.fotoPremio} alt={sorteio.titulo} style={styles.heroImage} />
            ) : (
              <div style={styles.imagePlaceholder}>Imagem do prêmio</div>
            )}
          </div>

          <div style={styles.heroContent}>
            <div style={styles.badge}>Sorteio disponível</div>
            <h1 style={styles.title}>{sorteio.titulo}</h1>
            {sorteio.descricao && <p style={styles.description}>{sorteio.descricao}</p>}

            <div style={styles.priceRow}>
              <div style={styles.priceBox}>
                <span style={styles.priceLabel}>Valor por número</span>
                <strong style={styles.priceValue}>{formatarMoeda(sorteio.valorNumero)}</strong>
              </div>

              <div style={styles.priceBox}>
                <span style={styles.priceLabel}>Total de números</span>
                <strong style={styles.priceValue}>{sorteio.totalNumeros}</strong>
              </div>
            </div>

            <div style={styles.actionRow}>
              <button style={styles.secondaryButton} onClick={copiarLink}>
                Copiar link
              </button>
              <button style={styles.primaryOutlineButton} onClick={compartilhar}>
                Compartilhar
              </button>
            </div>
          </div>
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoCard}>
            <div style={styles.infoTitle}>Como funciona</div>
            <div style={styles.infoText}>
              Escolha seus números, preencha nome e WhatsApp e finalize o pagamento.
            </div>
          </div>

          <div style={styles.infoCard}>
            <div style={styles.infoTitle}>Pagamento</div>
            <div style={styles.infoText}>
              Após reservar, você será direcionado para a etapa de pagamento.
            </div>
          </div>

          <div style={styles.infoCard}>
            <div style={styles.infoTitle}>Resultado</div>
            <div style={styles.infoText}>
              O sorteio será realizado conforme as regras informadas pelo organizador.
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Seus dados</h2>
              <p style={styles.cardSubtitle}>Esses dados ficam salvos para futuras compras.</p>
            </div>
          </div>

          <div style={styles.formGrid}>
            <input
              style={styles.input}
              placeholder="Nome completo"
              value={comprador.nome}
              onChange={(e) => setComprador((prev) => ({ ...prev, nome: e.target.value }))}
            />
            <input
              style={styles.input}
              placeholder="Número / WhatsApp"
              value={comprador.telefone}
              onChange={(e) => setComprador((prev) => ({ ...prev, telefone: e.target.value }))}
            />
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <div>
              <h2 style={styles.cardTitle}>Escolha seus números</h2>
              <p style={styles.cardSubtitle}>Selecione manualmente ou escolha números aleatórios.</p>
            </div>

            <button
              style={styles.greenButton}
              onClick={() => setShowNumeros((prev) => !prev)}
            >
              {showNumeros ? "Ocultar números" : "Escolher números"}
            </button>
          </div>

          <div style={styles.quickButtons}>
            <button style={styles.quickButton} onClick={() => escolherAleatorios(5)}>
              +5 aleatórios
            </button>
            <button style={styles.quickButton} onClick={() => escolherAleatorios(10)}>
              +10 aleatórios
            </button>
            <button style={styles.quickButton} onClick={() => escolherAleatorios(20)}>
              +20 aleatórios
            </button>
            <button style={styles.quickButtonDanger} onClick={limparSelecao}>
              Limpar
            </button>
          </div>

          {showNumeros && (
            <div style={styles.gridNumeros}>
              {numerosDisponiveis.map((item) => {
                const ativo = selectedNumbers.includes(item.numero);
                const reservado = item.status === "reservado";
                const pago = item.status === "pago";

                return (
                  <button
                    key={item.numero}
                    onClick={() => toggleNumero(item)}
                    style={{
                      ...styles.numeroButton,
                      ...(ativo ? styles.numeroAtivo : {}),
                      ...(reservado ? styles.numeroReservado : {}),
                      ...(pago ? styles.numeroPago : {}),
                    }}
                    disabled={reservado || pago}
                  >
                    {formatarNumero(item.numero)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.legendRow}>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendColor, background: "#ffffff", border: "1px solid #d1d5db" }} />
            Disponível
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendColor, background: "#16a34a" }} />
            Selecionado
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendColor, background: "#facc15" }} />
            Reservado
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendColor, background: "#111827" }} />
            Pago
          </div>
        </div>
      </div>

      <div style={styles.bottomBar}>
        <div style={styles.bottomSummary}>
          <div style={styles.bottomCount}>{selectedNumbers.length} número(s)</div>
          <div style={styles.bottomValue}>{formatarMoeda(total)}</div>
        </div>

        <button style={styles.bottomButton} onClick={reservarNumeros}>
          Reservar / Pagar
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    paddingBottom: "110px",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto",
    padding: "14px",
  },

  centerBox: {
    maxWidth: "720px",
    margin: "40px auto",
    background: "#fff",
    borderRadius: "18px",
    padding: "30px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },

  heroCard: {
    background: "#fff",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    marginBottom: "16px",
    border: "1px solid #e5e7eb",
  },

  logoWrap: {
    padding: "14px 14px 0",
  },

  logo: {
    width: "100%",
    maxHeight: "70px",
    objectFit: "contain",
    borderRadius: "12px",
    background: "#fff",
  },

  logoPlaceholder: {
    width: "100%",
    background: "#166534",
    color: "#fff",
    borderRadius: "14px",
    padding: "16px",
    textAlign: "center",
    fontWeight: "800",
    fontSize: "18px",
    letterSpacing: "0.5px",
  },

  imageWrap: {
    padding: "14px",
    paddingBottom: "0",
  },

  heroImage: {
    width: "100%",
    display: "block",
    borderRadius: "20px",
    objectFit: "cover",
    maxHeight: "420px",
    background: "#f3f4f6",
  },

  imagePlaceholder: {
    width: "100%",
    minHeight: "260px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eef2f7",
    color: "#6b7280",
    fontWeight: "700",
  },

  heroContent: {
    padding: "18px",
  },

  badge: {
    display: "inline-block",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: "700",
    fontSize: "12px",
    padding: "8px 12px",
    borderRadius: "999px",
    marginBottom: "12px",
  },

  title: {
    fontSize: "28px",
    lineHeight: 1.15,
    margin: "0 0 10px",
    color: "#111827",
  },

  description: {
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#4b5563",
    margin: "0 0 16px",
  },

  priceRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "14px",
  },

  priceBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "14px",
  },

  priceLabel: {
    display: "block",
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "6px",
  },

  priceValue: {
    fontSize: "20px",
    color: "#111827",
  },

  actionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },

  secondaryButton: {
    height: "48px",
    borderRadius: "14px",
    border: "1px solid #d1d5db",
    background: "#fff",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
  },

  primaryOutlineButton: {
    height: "48px",
    borderRadius: "14px",
    border: "1px solid #16a34a",
    background: "#f0fdf4",
    color: "#166534",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
    marginBottom: "16px",
  },

  infoCard: {
    background: "#fff",
    borderRadius: "20px",
    padding: "16px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
  },

  infoTitle: {
    fontSize: "16px",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "6px",
  },

  infoText: {
    fontSize: "14px",
    color: "#4b5563",
    lineHeight: 1.5,
  },

  card: {
    background: "#fff",
    borderRadius: "22px",
    padding: "16px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
    marginBottom: "16px",
  },

  cardHeader: {
    marginBottom: "12px",
  },

  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#111827",
  },

  cardSubtitle: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },

  input: {
    width: "100%",
    height: "50px",
    borderRadius: "14px",
    border: "1px solid #d1d5db",
    padding: "0 14px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  },

  greenButton: {
    minWidth: "150px",
    height: "46px",
    border: "none",
    borderRadius: "14px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    padding: "0 14px",
  },

  quickButtons: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },

  quickButton: {
    height: "40px",
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: "999px",
    padding: "0 14px",
    fontWeight: "700",
    cursor: "pointer",
  },

  quickButtonDanger: {
    height: "40px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "999px",
    padding: "0 14px",
    fontWeight: "700",
    cursor: "pointer",
  },

  gridNumeros: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "8px",
  },

  numeroButton: {
    height: "48px",
    borderRadius: "14px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
  },

  numeroAtivo: {
    background: "#16a34a",
    color: "#fff",
    border: "1px solid #16a34a",
  },

  numeroReservado: {
    background: "#facc15",
    color: "#111827",
    border: "1px solid #facc15",
    cursor: "not-allowed",
  },

  numeroPago: {
    background: "#111827",
    color: "#fff",
    border: "1px solid #111827",
    cursor: "not-allowed",
  },

  legendRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "14px",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
    color: "#4b5563",
    fontSize: "14px",
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  legendColor: {
    width: "16px",
    height: "16px",
    borderRadius: "6px",
    display: "inline-block",
  },

  bottomBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(255,255,255,0.97)",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid #e5e7eb",
    padding: "12px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },

  bottomSummary: {
    minWidth: "120px",
  },

  bottomCount: {
    fontSize: "14px",
    color: "#6b7280",
  },

  bottomValue: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#111827",
  },

  bottomButton: {
    height: "54px",
    minWidth: "190px",
    border: "none",
    borderRadius: "16px",
    background: "#16a34a",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "800",
    cursor: "pointer",
    padding: "0 18px",
    boxShadow: "0 10px 24px rgba(22,163,74,0.28)",
  },
};
