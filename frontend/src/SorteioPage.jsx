import { useEffect, useMemo, useRef, useState } from "react";

export default function SorteioPage() {
  const numerosRef = useRef(null);

  const [showFloatButton, setShowFloatButton] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const [nome, setNome] = useState(localStorage.getItem("cp_nome") || "");
  const [telefone, setTelefone] = useState(localStorage.getItem("cp_telefone") || "");

  const [selecionados, setSelecionados] = useState([]);
  const [numeros, setNumeros] = useState([]);

  // ===== CONFIG DEMO =====
  // depois podemos puxar isso do backend/admin
  const sorteio = {
    titulo: "Air Fryer Premium",
    empresa: "Casa Premiada Ribeirão",
    preco: 2,
    imagem:
      "https://images.unsplash.com/photo-1585515656973-6e7f9b2b5f8e?auto=format&fit=crop&w=1200&q=80",
    logo:
      "", // se quiser testar agora, cole a URL da logo aqui
    descricao:
      "Escolha seus números, reserve rapidamente e finalize seu pagamento.",
    whatsapp: "5516999999999",
    slug: "casa",
    totalNumeros: 200,
  };

  useEffect(() => {
    const lista = Array.from({ length: sorteio.totalNumeros }, (_, i) => ({
      numero: i + 1,
      status: "livre", // livre | reservado | pago
    }));
    setNumeros(lista);
  }, []);

  useEffect(() => {
    localStorage.setItem("cp_nome", nome);
  }, [nome]);

  useEffect(() => {
    localStorage.setItem("cp_telefone", telefone);
  }, [telefone]);

  useEffect(() => {
    const onScroll = () => {
      if (!numerosRef.current) return;
      const rect = numerosRef.current.getBoundingClientRect();
      setShowFloatButton(rect.top > 120);
    };

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function irParaNumeros() {
    numerosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleNumero(numero) {
    setSelecionados((prev) =>
      prev.includes(numero)
        ? prev.filter((n) => n !== numero)
        : [...prev, numero].sort((a, b) => a - b)
    );
  }

  function gerarAleatorios(qtd = 5) {
    const livres = numeros
      .filter((n) => n.status === "livre" && !selecionados.includes(n.numero))
      .map((n) => n.numero);

    if (!livres.length) return;

    const escolhidos = [];
    const copia = [...livres];

    while (escolhidos.length < qtd && copia.length > 0) {
      const idx = Math.floor(Math.random() * copia.length);
      escolhidos.push(copia[idx]);
      copia.splice(idx, 1);
    }

    setSelecionados((prev) => [...new Set([...prev, ...escolhidos])].sort((a, b) => a - b));

    setTimeout(() => {
      numerosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  const total = useMemo(() => selecionados.length * sorteio.preco, [selecionados.length, sorteio.preco]);
  const dadosPreenchidos = nome.trim().length >= 3 && telefone.trim().length >= 8;

  function reservar() {
    if (!selecionados.length) {
      alert("Escolha ao menos um número.");
      return;
    }

    if (!dadosPreenchidos) {
      alert("Preencha seu nome e WhatsApp.");
      return;
    }

    alert("Números reservados com sucesso.");
  }

  function pagar() {
    if (!selecionados.length) {
      alert("Escolha ao menos um número.");
      return;
    }

    if (!dadosPreenchidos) {
      alert("Preencha seu nome e WhatsApp.");
      return;
    }

    alert("Aqui entra o checkout PIX / cartão.");
  }

  function compartilhar() {
    const link = `${window.location.origin}/#/sorteio/${sorteio.slug}`;

    if (navigator.share) {
      navigator
        .share({
          title: sorteio.titulo,
          text: `Participe agora: ${sorteio.titulo}`,
          url: link,
        })
        .catch(() => {});
      return;
    }

    navigator.clipboard.writeText(link);
    alert("Link copiado com sucesso.");
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#ffffff",
      color: "#111827",
      fontFamily: "Arial, sans-serif",
      paddingBottom: selecionados.length > 0 ? 210 : 40,
    },

    container: {
      width: "100%",
      maxWidth: 520,
      margin: "0 auto",
      background: "#fff",
    },

    top: {
      padding: "14px 14px 8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      background: "#fff",
      position: "sticky",
      top: 0,
      zIndex: 25,
      borderBottom: "1px solid #f1f5f9",
    },

    logoWrap: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
    },

    logo: {
      width: 42,
      height: 42,
      borderRadius: 12,
      objectFit: "cover",
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
    },

    empresaNome: {
      fontSize: 16,
      fontWeight: 800,
      lineHeight: 1.1,
      margin: 0,
    },

    headerButton: {
      border: "none",
      background: "#f3f4f6",
      color: "#111827",
      padding: "10px 14px",
      borderRadius: 999,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },

    heroWrap: {
      padding: "12px 14px 0",
    },

    heroImage: {
      width: "100%",
      height: 340,
      objectFit: "cover",
      borderRadius: 22,
      display: "block",
      background: "#f3f4f6",
    },

    infoBox: {
      margin: "14px 14px 0",
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 20,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
    },

    badgeEmpresa: {
      display: "inline-block",
      background: "#111827",
      color: "#fff",
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: 0.5,
      borderRadius: 999,
      padding: "7px 10px",
      marginBottom: 10,
    },

    titulo: {
      fontSize: 24,
      lineHeight: 1.15,
      fontWeight: 900,
      margin: "0 0 8px",
      color: "#111827",
    },

    empresa: {
      fontSize: 15,
      fontWeight: 700,
      color: "#374151",
      margin: "0 0 10px",
    },

    descricao: {
      fontSize: 14,
      lineHeight: 1.5,
      color: "#6b7280",
      margin: 0,
    },

    actionRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginTop: 14,
    },

    actionButtonDark: {
      border: "none",
      background: "#111827",
      color: "#fff",
      padding: "14px 12px",
      borderRadius: 14,
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
    },

    actionButtonLight: {
      border: "1px solid #d1d5db",
      background: "#fff",
      color: "#111827",
      padding: "14px 12px",
      borderRadius: 14,
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
    },

    floatChoose: {
      position: "fixed",
      right: 16,
      bottom: selecionados.length > 0 ? 230 : 22,
      zIndex: 40,
      background: "#16a34a",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "14px 18px",
      fontWeight: 900,
      fontSize: 15,
      boxShadow: "0 14px 35px rgba(22,163,74,0.35)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer",
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: 900,
      color: "#111827",
      margin: "22px 14px 12px",
    },

    quickButtons: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 8,
      padding: "0 14px 14px",
    },

    quickButton: {
      border: "1px solid #d1d5db",
      background: "#fff",
      color: "#111827",
      padding: "12px 10px",
      borderRadius: 14,
      fontWeight: 800,
      cursor: "pointer",
    },

    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 8,
      padding: "0 14px 20px",
    },

    numero: {
      borderRadius: 14,
      minHeight: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 900,
      fontSize: 14,
      cursor: "pointer",
      userSelect: "none",
      border: "1px solid #e5e7eb",
      background: "#fff",
      color: "#111827",
    },

    numeroSelecionado: {
      background: "#16a34a",
      color: "#fff",
      border: "1px solid #16a34a",
      boxShadow: "0 10px 20px rgba(22,163,74,0.18)",
    },

    bottomSheet: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      background: "#ffffff",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      boxShadow: "0 -12px 35px rgba(0,0,0,0.12)",
      borderTop: "1px solid #e5e7eb",
    },

    bottomInner: {
      width: "100%",
      maxWidth: 520,
      margin: "0 auto",
      padding: "12px 14px 16px",
    },

    dragLine: {
      width: 52,
      height: 5,
      borderRadius: 999,
      background: "#e5e7eb",
      margin: "0 auto 12px",
    },

    resumoBox: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      background: "#f8fafc",
      border: "1px solid #e5e7eb",
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
    },

    resumoLeft: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
    },

    resumoLogo: {
      width: 42,
      height: 42,
      borderRadius: 12,
      objectFit: "cover",
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      flexShrink: 0,
    },

    resumoSmall: {
      fontSize: 12,
      color: "#6b7280",
      margin: 0,
      fontWeight: 700,
    },

    resumoStrong: {
      fontSize: 20,
      color: "#111827",
      margin: 0,
      fontWeight: 900,
      lineHeight: 1,
    },

    resumoValue: {
      textAlign: "right",
      flexShrink: 0,
    },

    valueLabel: {
      fontSize: 12,
      color: "#6b7280",
      margin: 0,
      fontWeight: 700,
    },

    valueStrong: {
      fontSize: 24,
      fontWeight: 900,
      color: "#16a34a",
      margin: 0,
      lineHeight: 1,
    },

    inputs: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 8,
      marginBottom: 10,
    },

    input: {
      width: "100%",
      height: 48,
      borderRadius: 14,
      border: "1px solid #d1d5db",
      background: "#fff",
      padding: "0 14px",
      fontSize: 15,
      outline: "none",
      boxSizing: "border-box",
    },

    buttonsRow: {
      display: "grid",
      gridTemplateColumns: dadosPreenchidos ? "1fr 1fr" : "1fr",
      gap: 10,
    },

    reserveBtn: {
      height: 50,
      border: "none",
      borderRadius: 16,
      background: "#111827",
      color: "#fff",
      fontWeight: 900,
      fontSize: 15,
      cursor: "pointer",
    },

    payBtn: {
      height: 50,
      border: "none",
      borderRadius: 16,
      background: "#16a34a",
      color: "#fff",
      fontWeight: 900,
      fontSize: 15,
      cursor: "pointer",
    },

    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 80,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    },

    modalCard: {
      width: "100%",
      maxWidth: 520,
      background: "#fff",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 16,
      boxSizing: "border-box",
    },

    modalTitle: {
      margin: "0 0 8px",
      fontSize: 20,
      fontWeight: 900,
      color: "#111827",
    },

    modalText: {
      fontSize: 14,
      color: "#4b5563",
      lineHeight: 1.55,
      marginBottom: 14,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.top}>
          <div style={styles.logoWrap}>
            {sorteio.logo ? (
              <img src={sorteio.logo} alt="Logo" style={styles.logo} />
            ) : (
              <div style={styles.logo} />
            )}

            <div>
              <p style={styles.empresaNome}>{sorteio.empresa}</p>
            </div>
          </div>

          <button style={styles.headerButton} onClick={() => setShowInfo(true)}>
            Ver informações
          </button>
        </div>

        <div style={styles.heroWrap}>
          <img src={sorteio.imagem} alt={sorteio.titulo} style={styles.heroImage} />
        </div>

        <div style={styles.infoBox}>
          <div style={styles.badgeEmpresa}>EMPRESA</div>
          <h1 style={styles.titulo}>{sorteio.titulo}</h1>
          <p style={styles.empresa}>{sorteio.empresa}</p>
          <p style={styles.descricao}>{sorteio.descricao}</p>

          <div style={styles.actionRow}>
            <button style={styles.actionButtonDark} onClick={irParaNumeros}>
              Escolher números
            </button>
            <button style={styles.actionButtonLight} onClick={compartilhar}>
              Compartilhar
            </button>
          </div>
        </div>

        <h2 ref={numerosRef} style={styles.sectionTitle}>
          Escolha seus números
        </h2>

        <div style={styles.quickButtons}>
          <button style={styles.quickButton} onClick={() => gerarAleatorios(5)}>
            +5 aleatórios
          </button>
          <button style={styles.quickButton} onClick={() => gerarAleatorios(10)}>
            +10 aleatórios
          </button>
          <button style={styles.quickButton} onClick={() => setSelecionados([])}>
            Limpar
          </button>
        </div>

        <div style={styles.grid}>
          {numeros.map((item) => {
            const ativo = selecionados.includes(item.numero);

            return (
              <div
                key={item.numero}
                onClick={() => item.status === "livre" && toggleNumero(item.numero)}
                style={{
                  ...styles.numero,
                  ...(ativo ? styles.numeroSelecionado : {}),
                  opacity: item.status === "livre" ? 1 : 0.55,
                }}
              >
                {String(item.numero).padStart(2, "0")}
              </div>
            );
          })}
        </div>
      </div>

      {showFloatButton && (
        <button style={styles.floatChoose} onClick={irParaNumeros}>
          <span>↓</span>
          <span>Escolher números</span>
        </button>
      )}

      {selecionados.length > 0 && (
        <div style={styles.bottomSheet}>
          <div style={styles.bottomInner}>
            <div style={styles.dragLine} />

            <div style={styles.resumoBox}>
              <div style={styles.resumoLeft}>
                {sorteio.logo ? (
                  <img src={sorteio.logo} alt="Logo" style={styles.resumoLogo} />
                ) : (
                  <div style={styles.resumoLogo} />
                )}

                <div>
                  <p style={styles.resumoSmall}>Seus números</p>
                  <p style={styles.resumoStrong}>{selecionados.length} selecionado(s)</p>
                </div>
              </div>

              <div style={styles.resumoValue}>
                <p style={styles.valueLabel}>Valor total</p>
                <p style={styles.valueStrong}>R$ {total.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>

            {!dadosPreenchidos && (
              <div style={styles.inputs}>
                <input
                  style={styles.input}
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Número / WhatsApp"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>
            )}

            <div style={styles.buttonsRow}>
              <button style={styles.reserveBtn} onClick={reservar}>
                Reservar
              </button>

              {dadosPreenchidos && (
                <button style={styles.payBtn} onClick={pagar}>
                  Pagar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showInfo && (
        <div style={styles.modalBackdrop} onClick={() => setShowInfo(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dragLine} />
            <h3 style={styles.modalTitle}>Informações</h3>
            <div style={styles.modalText}>
              Tire dúvidas, fale no WhatsApp ou compartilhe seu link de venda.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <a
                href={`https://wa.me/${sorteio.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...styles.actionButtonDark,
                  textDecoration: "none",
                  textAlign: "center",
                  display: "block",
                }}
              >
                Falar no WhatsApp
              </a>

              <button
                style={styles.actionButtonLight}
                onClick={compartilhar}
              >
                Compartilhar link
              </button>

              <button
                style={styles.actionButtonLight}
                onClick={() => setShowInfo(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
