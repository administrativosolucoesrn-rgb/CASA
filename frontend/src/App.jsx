import React, { useEffect, useMemo, useState } from "react";

const API = "https://casapremiada.onrender.com/api";

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function pad(value) {
  return String(value).padStart(3, "0");
}

function route() {
  return window.location.hash || "#/";
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function PublicCampaign({ campaign }) {
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState("grid");
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(true);

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
  });

  const rangeStart = Number(campaign.rangeStart || 1);
  const rangeEnd = Number(campaign.rangeEnd || 300);

  const allNumbers = useMemo(() => {
    return Array.from(
      { length: rangeEnd - rangeStart + 1 },
      (_, idx) => rangeStart + idx
    );
  }, [rangeStart, rangeEnd]);

  const total = useMemo(
    () => selected.length * Number(campaign.pricePerNumber || 0),
    [selected, campaign.pricePerNumber]
  );

  const getStatus = (n) => {
    if (campaign.paidNumbers?.includes(n)) return "paid";
    if (campaign.reservedNumbers?.includes(n)) return "reserved";
    return "available";
  };

  const toggle = (n) => {
    if (getStatus(n) !== "available") return;

    setSelected((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : [...prev, n].sort((a, b) => a - b)
    );
  };

  const randomAdd = (qty) => {
    const pool = allNumbers.filter(
      (n) => getStatus(n) === "available" && !selected.includes(n)
    );

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, qty);

    setSelected((prev) =>
      [...new Set([...prev, ...chosen])].sort((a, b) => a - b)
    );
  };

  const clearCart = () => {
    setSelected([]);
  };

  const createPix = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/create-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          selectedNumbers: selected,
          amount: total,
          customer,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar Pix.");

      setPix(data);
      setStep("pix");
    } catch (e) {
      alert(e.message || "Erro ao gerar Pix.");
    } finally {
      setLoading(false);
    }
  };

  const organizerPhone = normalizePhone(
    campaign.organizerPhone || campaign.whatsapp || "16999999999"
  );

  const whatsappUrl = `https://wa.me/55${organizerPhone}?text=${encodeURIComponent(
    `Olá! Quero informações sobre ${campaign.title || "o sorteio"}.`
  )}`;

  useEffect(() => {
    const onScroll = () => {
      const area = document.getElementById("area-numeros");
      if (!area) return;

      const rect = area.getBoundingClientRect();
      setShowScrollButton(rect.top > 120);
    };

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleChooseNumbers = () => {
    const el = document.getElementById("area-numeros");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: campaign.title || "Casa Premiada Ribeirão",
          text: "Escolha seus números",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copiado.");
      }
    } catch {}
  };

  return (
    <div className="page">
      <style>{`
        * { box-sizing: border-box; }

        html, body, #root {
          margin: 0;
          padding: 0;
          min-height: 100%;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at top, rgba(212,175,55,0.10), transparent 28%),
            linear-gradient(180deg, #66000d 0%, #8f0013 38%, #a80018 100%);
          color: #fff;
        }

        body { overflow-x: hidden; }

        .page {
          min-height: 100vh;
          padding: 12px 10px 120px;
        }

        .wrapper {
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
        }

        .heroCard {
          overflow: hidden;
          border-radius: 26px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04)),
            linear-gradient(180deg, #b10019 0%, #7d0012 100%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 20px 50px rgba(0,0,0,0.24);
          margin-bottom: 14px;
        }

        .heroHeader {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 14px 10px;
        }

        .logoBox {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          overflow: hidden;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.14);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .logoBox img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .siteTitle {
          min-width: 0;
          font-size: 22px;
          font-weight: 900;
          line-height: 1.1;
        }

        .heroImageWrap {
          padding: 0 14px;
        }

        .heroImg {
          width: 100%;
          height: 340px;
          object-fit: cover;
          display: block;
          border-radius: 24px;
          background: rgba(255,255,255,0.08);
        }

        .infoOverlay {
          margin-top: -74px;
          position: relative;
          z-index: 2;
          padding: 0 14px 0;
        }

        .infoOverlayInner {
          background: linear-gradient(180deg, rgba(18,18,18,0.90), rgba(34,34,34,0.92));
          border-radius: 0 0 22px 22px;
          padding: 14px 12px 12px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .overlayItem span {
          display: block;
          font-size: 10px;
          color: rgba(255,255,255,0.72);
          text-transform: uppercase;
          font-weight: 800;
          margin-bottom: 5px;
          letter-spacing: 0.4px;
        }

        .overlayItem strong {
          display: block;
          color: #fff;
          font-size: 14px;
          line-height: 1.2;
          word-break: break-word;
        }

        .heroBody {
          padding: 14px;
        }

        .heroBody h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.06;
          font-weight: 900;
        }

        .heroDesc {
          margin: 8px 0 0;
          color: rgba(255,255,255,0.87);
          font-size: 14px;
          line-height: 1.45;
        }

        .card {
          background: rgba(255,255,255,0.985);
          color: #111;
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 16px 34px rgba(0,0,0,0.16);
          margin-bottom: 14px;
        }

        .card h2, .card h3 {
          margin: 0 0 8px;
          color: #111;
        }

        .muted {
          color: #6d6d6d;
          font-size: 14px;
          line-height: 1.45;
        }

        .moreInfoButton {
          width: 100%;
          border: none;
          cursor: pointer;
          border-radius: 16px;
          padding: 15px;
          font-size: 15px;
          font-weight: 900;
          background: linear-gradient(180deg, #fff3f6 0%, #ffe6ec 100%);
          color: #980018;
        }

        .moreInfoContent {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #f0d9de;
        }

        .contactLine {
          margin: 7px 0;
          color: #333;
          font-size: 14px;
          line-height: 1.45;
        }

        .quickButtons {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 10px;
        }

        .quickBtn {
          border: none;
          cursor: pointer;
          border-radius: 16px;
          padding: 14px 8px;
          font-weight: 900;
          font-size: 17px;
          color: white;
          background: linear-gradient(180deg, #d8aa23 0%, #b68606 100%);
          box-shadow: 0 10px 18px rgba(182,134,6,0.22);
        }

        .chooseBanner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-align: center;
          margin-bottom: 12px;
          padding: 14px;
          border-radius: 18px;
          background: linear-gradient(180deg, #fff9eb 0%, #fff1cb 100%);
          border: 2px dashed #c79612;
          color: #7a5200;
        }

        .chooseArrow {
          font-size: 24px;
          font-weight: 900;
          animation: bounceArrow 1.2s infinite;
        }

        @keyframes bounceArrow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-bottom: 12px;
        }

        .legend span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #4a4a4a;
          font-weight: 700;
        }

        .dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          display: inline-block;
        }

        .dot.available { background: #ececec; }
        .dot.reserved { background: #f5b63d; }
        .dot.paid { background: #43be67; }
        .dot.selected { background: #b3001a; }

        .gridNumbers {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 7px;
        }

        .numberCard {
          border: none;
          cursor: pointer;
          border-radius: 14px;
          padding: 10px 4px;
          min-height: 60px;
          background: #f7f7f7;
          color: #111;
          box-shadow: inset 0 0 0 1px #ececec;
          transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
        }

        .numberCard strong {
          display: block;
          font-size: 15px;
          line-height: 1.1;
          margin-bottom: 3px;
        }

        .numberCard small {
          font-size: 9px;
          color: #666;
          font-weight: 700;
        }

        .numberCard.reserved {
          background: #fff6df;
          color: #8b5b00;
          box-shadow: inset 0 0 0 1px #f0d38f;
          cursor: not-allowed;
        }

        .numberCard.paid {
          background: #eaf9ef;
          color: #137337;
          box-shadow: inset 0 0 0 1px #99d5ad;
          cursor: not-allowed;
        }

        .numberCard.selected {
          background: linear-gradient(180deg, #b10019 0%, #850013 100%);
          color: #fff;
          box-shadow: 0 10px 18px rgba(177,0,25,0.22);
          transform: scale(1.03);
        }

        .numberCard.selected small {
          color: rgba(255,255,255,0.88);
        }

        .selectedSheet {
          position: sticky;
          bottom: 12px;
          z-index: 30;
          background: rgba(255,255,255,0.99);
          color: #111;
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 18px 34px rgba(0,0,0,0.22);
          margin-top: 14px;
        }

        .selectedHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin: 10px 0 12px;
        }

        .chip {
          background: #fff5df;
          color: #8a5c00;
          border: 1px solid #f3dfab;
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .totalRow, .summaryRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid #f0f0f0;
          color: #333;
        }

        .totalRow strong, .summaryRow strong {
          color: #111;
          font-size: 18px;
        }

        .green { color: #0c8b3f !important; }

        .cartActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
        }

        label {
          display: block;
          margin: 14px 0 6px;
          color: #333;
          font-size: 14px;
          font-weight: 700;
        }

        input, textarea {
          width: 100%;
          border: 1px solid #e7e7e7;
          border-radius: 14px;
          padding: 13px 14px;
          font-size: 15px;
          outline: none;
          background: #fff;
        }

        .summary {
          background: #fff9ef;
          border: 1px solid #f2e2b8;
          border-radius: 18px;
          padding: 14px;
          margin-bottom: 16px;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 16px;
        }

        .primaryBtn,
        .outlineBtn,
        .successBtn,
        .whatsBtn,
        .shareBtn,
        .floatingChooseBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 50px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          border: none;
        }

        .primaryBtn,
        .floatingChooseBtn {
          color: #fff;
          background: linear-gradient(180deg, #b10019 0%, #850013 100%);
          box-shadow: 0 10px 22px rgba(177,0,25,0.22);
        }

        .outlineBtn {
          border: 1px solid #eadbb4;
          color: #8a5c00;
          background: #fff8e7;
        }

        .successBtn {
          color: #fff;
          background: linear-gradient(180deg, #11a84d 0%, #087c37 100%);
          box-shadow: 0 10px 22px rgba(17,168,77,0.22);
        }

        .whatsBtn {
          color: #fff;
          background: linear-gradient(180deg, #25d366 0%, #17a74d 100%);
          box-shadow: 0 10px 22px rgba(37,211,102,0.22);
        }

        .shareBtn {
          color: #8a5c00;
          background: #fff8e7;
          border: 1px solid #f2e2b8;
        }

        .floatingChooseWrap {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: 18px;
          z-index: 55;
          width: calc(100% - 24px);
          max-width: 540px;
        }

        .floatingChooseBtn {
          min-height: 56px;
          border-radius: 18px;
        }

        .qrImage {
          width: 100%;
          max-width: 260px;
          display: block;
          margin: 18px auto;
          border-radius: 18px;
          background: #fff;
          padding: 12px;
        }

        .demoBox {
          background: #fff8e5;
          color: #7c5b00;
          border-radius: 16px;
          padding: 14px;
          font-weight: 700;
          margin: 14px 0;
          border: 1px solid #f0d284;
        }

        .floatingWhats {
          position: fixed;
          right: 14px;
          bottom: 86px;
          z-index: 56;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
          background: linear-gradient(180deg, #25d366 0%, #139648 100%);
          box-shadow: 0 16px 30px rgba(37,211,102,0.25);
        }

        .adminWrap {
          max-width: 980px;
        }

        .topAdmin {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .adminGrid .full {
          grid-column: 1 / -1;
        }

        .list {
          display: grid;
          gap: 10px;
        }

        .listItem {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px;
          border: 1px solid #ececec;
          border-radius: 18px;
          background: #fff;
        }

        .badge {
          padding: 8px 12px;
          border-radius: 999px;
          background: #fff8e7;
          color: #8a5c00;
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
        }

        .miniLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 16px;
          background: #fff8e7;
          color: #8a5c00;
          border: 1px solid #f2e2b8;
          border-radius: 14px;
          text-decoration: none;
          font-weight: 900;
        }

        @media (max-width: 640px) {
          .adminGrid { grid-template-columns: 1fr; }
        }

        @media (max-width: 430px) {
          .gridNumbers { grid-template-columns: repeat(5, 1fr); }
          .quickButtons { grid-template-columns: repeat(4, 1fr); }
          .infoOverlayInner { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 390px) {
          .heroImg { height: 300px; }
          .gridNumbers { grid-template-columns: repeat(4, 1fr); }
          .cartActions, .actions { grid-template-columns: 1fr; }
          .infoOverlayInner { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="wrapper">
        <header className="heroCard">
          <div className="heroHeader">
            <div className="logoBox">
              <img
                src={campaign.logoImage || "https://via.placeholder.com/80x80?text=CP"}
                alt="Logo"
                onError={(e) => {
                  e.currentTarget.src = "https://via.placeholder.com/80x80?text=CP";
                }}
              />
            </div>

            <div className="siteTitle">
              {campaign.siteName || "Casa Premiada Ribeirão"}
            </div>
          </div>

          <div className="heroImageWrap">
            <img
              src={campaign.coverImage}
              alt={campaign.title}
              className="heroImg"
              onError={(e) => {
                e.currentTarget.src =
                  "https://via.placeholder.com/900x700?text=Premio";
              }}
            />
          </div>

          <div className="infoOverlay">
            <div className="infoOverlayInner">
              <div className="overlayItem">
                <span>Valor por número</span>
                <strong>{formatMoney(campaign.pricePerNumber)}</strong>
              </div>

              <div className="overlayItem">
                <span>Data</span>
                <strong>{campaign.drawDate || "A definir"}</strong>
              </div>

              <div className="overlayItem">
                <span>Empresa</span>
                <strong>{campaign.siteName || "Casa Premiada Ribeirão"}</strong>
              </div>
            </div>
          </div>

          <div className="heroBody">
            <h1>{campaign.title || "Prêmio especial"}</h1>
            <p className="heroDesc">
              {campaign.shortDescription ||
                campaign.description ||
                "Escolha seus números e participe."}
            </p>
          </div>
        </header>

        {step === "grid" && (
          <>
            <section className="card">
              <button
                className="moreInfoButton"
                onClick={() => setShowMoreInfo((prev) => !prev)}
                type="button"
              >
                {showMoreInfo ? "Ocultar informações" : "Ver mais informações"}
              </button>

              {showMoreInfo && (
                <div className="moreInfoContent">
                  <div className="contactLine">
                    <strong>Descrição</strong>
                  </div>

                  <div className="contactLine">
                    {campaign.description || "Depois eu preencho."}
                  </div>

                  <div className="contactLine" style={{ marginTop: 12 }}>
                    <strong>Empresa</strong>
                  </div>

                  <div className="contactLine">
                    {campaign.siteName || "Casa Premiada Ribeirão"}
                  </div>

                  <div className="contactLine">
                    {campaign.organizerPhone || "(16) 99999-9999"}
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="whatsBtn"
                    style={{ marginTop: 12 }}
                  >
                    WhatsApp
                  </a>

                  <button
                    className="shareBtn"
                    style={{ marginTop: 10 }}
                    onClick={handleShare}
                    type="button"
                  >
                    Compartilhar link
                  </button>
                </div>
              )}
            </section>

            <section className="card">
              <h3>Compras rápidas</h3>
              <div className="muted">
                Adicione números aleatórios com um toque.
              </div>

              <div className="quickButtons">
                {[2, 5, 10, 20].map((n) => (
                  <button
                    key={n}
                    className="quickBtn"
                    onClick={() => randomAdd(n)}
                    type="button"
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </section>

            <section className="card" id="area-numeros">
              <div className="chooseBanner">
                <div className="chooseArrow">↓</div>
                <div>
                  <strong>Escolher números</strong>
                  <div className="muted">Toque nos números disponíveis</div>
                </div>
              </div>

              <div className="legend">
                <span><i className="dot available"></i>Disponível</span>
                <span><i className="dot reserved"></i>Reservado</span>
                <span><i className="dot paid"></i>Pago</span>
                <span><i className="dot selected"></i>Selecionado</span>
              </div>

              <div className="gridNumbers">
                {allNumbers.map((n) => {
                  const status = getStatus(n);
                  const isSelected = selected.includes(n);

                  return (
                    <button
                      key={n}
                      className={`numberCard ${status} ${isSelected ? "selected" : ""}`}
                      onClick={() => toggle(n)}
                      type="button"
                    >
                      <strong>{pad(n)}</strong>
                      <small>
                        {isSelected
                          ? "Selecionado"
                          : status === "available"
                          ? "Livre"
                          : status === "reserved"
                          ? "Reservado"
                          : "Pago"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>

            {selected.length > 0 && (
              <section className="selectedSheet">
                <div className="selectedHeader">
                  <h3>Números selecionados</h3>
                  <div className="chip" style={{ cursor: "default" }}>
                    {selected.length} item(ns)
                  </div>
                </div>

                <div className="chips">
                  {selected.map((n) => (
                    <button
                      key={n}
                      className="chip"
                      onClick={() => toggle(n)}
                      type="button"
                    >
                      Nº {pad(n)} ✕
                    </button>
                  ))}
                </div>

                <div className="totalRow">
                  <span>Total</span>
                  <strong>{formatMoney(total)}</strong>
                </div>

                <div className="cartActions">
                  <button className="outlineBtn" onClick={clearCart} type="button">
                    Limpar carrinho
                  </button>

                  <button
                    className="primaryBtn"
                    disabled={!selected.length}
                    onClick={() => setStep("data")}
                    type="button"
                  >
                    Continuar
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {step === "data" && (
          <section className="card">
            <h2>Seus dados</h2>

            <div className="summary">
              <div className="chips">
                {selected.map((n) => (
                  <span className="chip" key={n}>
                    Nº {pad(n)}
                  </span>
                ))}
              </div>

              <div className="summaryRow">
                <span>Quantidade</span>
                <strong>{selected.length}</strong>
              </div>

              <div className="summaryRow">
                <span>Total</span>
                <strong className="green">{formatMoney(total)}</strong>
              </div>
            </div>

            <label>Nome</label>
            <input
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />

            <label>WhatsApp</label>
            <input
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />

            <label>E-mail</label>
            <input
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />

            <label>CPF</label>
            <input
              value={customer.cpf}
              onChange={(e) => setCustomer({ ...customer, cpf: e.target.value })}
            />

            <div className="actions">
              <button
                className="outlineBtn"
                onClick={() => setStep("grid")}
                type="button"
              >
                Voltar
              </button>

              <button
                className="successBtn"
                disabled={!customer.name || !customer.phone || loading}
                onClick={createPix}
                type="button"
              >
                {loading ? "Gerando Pix..." : "Gerar Pix"}
              </button>
            </div>
          </section>
        )}

        {step === "pix" && (
          <section className="card">
            <h2>Pagamento via Pix</h2>
            <p className="muted">Finalize o pagamento para garantir seus números.</p>

            <div className="summary">
              <div className="summaryRow">
                <span>Status</span>
                <strong>{pix?.status || "-"}</strong>
              </div>

              <div className="summaryRow">
                <span>Total</span>
                <strong className="green">{formatMoney(total)}</strong>
              </div>
            </div>

            {pix?.qr_code_base64 ? (
              <img
                className="qrImage"
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code Pix"
              />
            ) : (
              <div className="demoBox">
                Modo demonstração: configure o token do Mercado Pago no backend.
              </div>
            )}

            <label>Pix copia e cola</label>
            <textarea rows="6" readOnly value={pix?.qr_code || ""} />

            <button
              className="successBtn"
              onClick={() => navigator.clipboard.writeText(pix?.qr_code || "")}
              type="button"
            >
              Copiar código Pix
            </button>
          </section>
        )}
      </div>

      {showScrollButton && step === "grid" && (
        <div className="floatingChooseWrap">
          <button
            className="floatingChooseBtn"
            onClick={handleChooseNumbers}
            type="button"
          >
            ↓ Escolher números
          </button>
        </div>
      )}

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="floatingWhats"
        aria-label="WhatsApp"
        title="Falar no WhatsApp"
      >
        ☎
      </a>
    </div>
  );
}

function AdminPanel() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("admin_token") || "");
  const [campaigns, setCampaigns] = useState([]);
  const [orders, setOrders] = useState([]);

  const [form, setForm] = useState({
    siteName: "Casa Premiada Ribeirão",
    title: "",
    slug: "",
    description: "",
    shortDescription: "",
    organizerPhone: "",
    whatsapp: "",
    logoImage: "",
    pricePerNumber: 2,
    rangeStart: 1,
    rangeEnd: 300,
    drawDate: "",
    coverImage: "",
  });

  const headers = token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };

  const load = async () => {
    if (!token) return;

    const [cRes, oRes] = await Promise.all([
      fetch(`${API}/admin/campaigns`, { headers }),
      fetch(`${API}/admin/orders`, { headers }),
    ]);

    if (cRes.ok) setCampaigns(await cRes.json());
    if (oRes.ok) setOrders(await oRes.json());
  };

  useEffect(() => {
    load();
  }, [token]);

  const login = async () => {
    const res = await fetch(`${API}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Erro ao entrar.");

    localStorage.setItem("admin_token", data.token);
    setToken(data.token);
  };

  const createCampaign = async () => {
    const res = await fetch(`${API}/admin/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...form,
        rangeStart: Number(form.rangeStart),
        rangeEnd: Number(form.rangeEnd),
        pricePerNumber: Number(form.pricePerNumber),
      }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Erro ao criar campanha.");

    alert("Sorteio criado.");
    setForm({
      siteName: "Casa Premiada Ribeirão",
      title: "",
      slug: "",
      description: "",
      shortDescription: "",
      organizerPhone: "",
      whatsapp: "",
      logoImage: "",
      pricePerNumber: 2,
      rangeStart: 1,
      rangeEnd: 300,
      drawDate: "",
      coverImage: "",
    });
    load();
  };

  if (!token) {
    return (
      <div className="page">
        <div className="wrapper">
          <section className="card">
            <h1 style={{ marginTop: 0, color: "#111" }}>Painel Admin</h1>
            <p className="muted">Acesso privado do administrador.</p>

            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              className="primaryBtn"
              onClick={login}
              type="button"
              style={{ marginTop: 14 }}
            >
              Entrar
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root {
          margin: 0;
          padding: 0;
          min-height: 100%;
          font-family: Inter, system-ui, sans-serif;
          background:
            radial-gradient(circle at top, rgba(212, 175, 55, 0.10), transparent 30%),
            linear-gradient(180deg, #65000d 0%, #8d0012 38%, #a30017 100%);
        }
        .page { min-height: 100vh; padding: 12px 10px 40px; }
        .wrapper { width: 100%; max-width: 980px; margin: 0 auto; }
        .card {
          background: rgba(255,255,255,0.985);
          color: #111;
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 16px 34px rgba(0,0,0,0.16);
          margin-bottom: 14px;
        }
        .muted { color: #6d6d6d; font-size: 14px; line-height: 1.45; }
        label {
          display: block;
          margin: 14px 0 6px;
          color: #333;
          font-size: 14px;
          font-weight: 700;
        }
        input, textarea {
          width: 100%;
          border: 1px solid #e7e7e7;
          border-radius: 14px;
          padding: 13px 14px;
          font-size: 15px;
          outline: none;
          background: #fff;
        }
        .primaryBtn, .outlineBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 50px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          border: none;
        }
        .primaryBtn {
          color: #fff;
          background: linear-gradient(180deg, #b10019 0%, #850013 100%);
          box-shadow: 0 10px 22px rgba(177,0,25,0.22);
          width: 100%;
        }
        .outlineBtn {
          border: 1px solid #eadbb4;
          color: #8a5c00;
          background: #fff8e7;
          width: auto;
          padding: 0 16px;
        }
        .topAdmin {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .adminGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        .adminGrid .full {
          grid-column: 1 / -1;
        }
        .list {
          display: grid;
          gap: 10px;
        }
        .listItem {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px;
          border: 1px solid #ececec;
          border-radius: 18px;
          background: #fff;
        }
        .badge {
          padding: 8px 12px;
          border-radius: 999px;
          background: #fff8e7;
          color: #8a5c00;
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
        }
        .miniLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 16px;
          background: #fff8e7;
          color: #8a5c00;
          border: 1px solid #f2e2b8;
          border-radius: 14px;
          text-decoration: none;
          font-weight: 900;
        }
        @media (max-width: 640px) {
          .adminGrid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="wrapper">
        <section className="card">
          <div className="topAdmin">
            <div>
              <h1 style={{ margin: 0, color: "#111" }}>Painel Admin</h1>
              <p className="muted">Criar e gerenciar sorteios</p>
            </div>

            <button
              className="outlineBtn"
              onClick={() => {
                localStorage.removeItem("admin_token");
                setToken("");
              }}
              type="button"
            >
              Sair
            </button>
          </div>

          <div className="adminGrid">
            <div>
              <label>Nome da empresa</label>
              <input
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              />
            </div>

            <div>
              <label>Prêmio</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <label>Slug do link</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="ex: air-fryer"
              />
            </div>

            <div>
              <label>Preço por número</label>
              <input
                type="number"
                value={form.pricePerNumber}
                onChange={(e) => setForm({ ...form, pricePerNumber: e.target.value })}
              />
            </div>

            <div>
              <label>Começa em</label>
              <input
                type="number"
                value={form.rangeStart}
                onChange={(e) => setForm({ ...form, rangeStart: e.target.value })}
              />
            </div>

            <div>
              <label>Termina em</label>
              <input
                type="number"
                value={form.rangeEnd}
                onChange={(e) => setForm({ ...form, rangeEnd: e.target.value })}
              />
            </div>

            <div>
              <label>Data</label>
              <input
                value={form.drawDate}
                onChange={(e) => setForm({ ...form, drawDate: e.target.value })}
                placeholder="12/04/2026"
              />
            </div>

            <div>
              <label>URL da foto</label>
              <input
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              />
            </div>

            <div>
              <label>URL da logo</label>
              <input
                value={form.logoImage}
                onChange={(e) => setForm({ ...form, logoImage: e.target.value })}
              />
            </div>

            <div>
              <label>Telefone</label>
              <input
                value={form.organizerPhone}
                onChange={(e) => setForm({ ...form, organizerPhone: e.target.value })}
              />
            </div>

            <div>
              <label>WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="5516999999999"
              />
            </div>

            <div className="full">
              <label>Descrição curta</label>
              <input
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              />
            </div>

            <div className="full">
              <label>Descrição completa</label>
              <textarea
                rows="4"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <button
            className="primaryBtn"
            onClick={createCampaign}
            type="button"
            style={{ marginTop: 16 }}
          >
            Criar sorteio
          </button>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Sorteios</h2>
          <div className="list">
            {campaigns.map((item) => (
              <div className="listItem" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <div className="muted">
                    {item.slug} • {formatMoney(item.pricePerNumber)} • {item.rangeStart} até {item.rangeEnd}
                  </div>
                </div>

                <a className="miniLink" href={`#/${item.slug}`}>
                  Abrir
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Compradores / reservas</h2>
          <div className="list">
            {orders.length ? (
              orders.map((item) => (
                <div className="listItem" key={item.id}>
                  <div>
                    <strong>{item.customer?.name || "Sem nome"}</strong>
                    <div className="muted">
                      {item.customer?.phone || "-"} • {item.campaignSlug} • {item.selectedNumbers?.join(", ")}
                    </div>
                  </div>
                  <span className="badge">{item.status}</span>
                </div>
              ))
            ) : (
              <p className="muted">Ainda não há reservas.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState(route());
  const [campaigns, setCampaigns] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onHash = () => setHash(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const res = await fetch(`${API}/campaigns`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : []);
      } catch {
        setCampaigns([]);
      } finally {
        setLoaded(true);
      }
    }

    loadCampaigns();
  }, []);

  if (hash === "#/admin") return <AdminPanel />;

  const slug = hash.replace("#/", "") || "air-fryer";
  const campaign = campaigns.find((c) => c.slug === slug) || campaigns[0];

  if (!loaded) return null;

  if (!campaign) {
    return (
      <div className="page">
        <div className="wrapper">
          <section
            style={{
              background: "#fff",
              color: "#111",
              borderRadius: 18,
              padding: 18,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Nenhum sorteio encontrado</h2>
            <p style={{ marginBottom: 0 }}>
              Crie um sorteio no painel admin para exibir no site.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return <PublicCampaign campaign={campaign} />;
}
