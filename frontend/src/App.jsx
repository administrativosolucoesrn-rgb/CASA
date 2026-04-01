import React, { useEffect, useMemo, useState } from "react";

const API = "https://casapremiada.onrender.com/api";

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function pad(value) {
  return String(value).padStart(2, "0");
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
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
  });

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
    const pool = [];
    for (let i = Number(campaign.rangeStart); i <= Number(campaign.rangeEnd); i++) {
      if (getStatus(i) === "available" && !selected.includes(i)) pool.push(i);
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, qty);

    setSelected((prev) => [...new Set([...prev, ...chosen])].sort((a, b) => a - b));
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
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const organizerPhone = normalizePhone(
    campaign.organizerPhone || campaign.whatsapp || "16999999999"
  );

  const whatsappUrl = `https://wa.me/55${organizerPhone}?text=${encodeURIComponent(
    `Olá! Quero informações sobre ${campaign.title || "a campanha"}.`
  )}`;

  const totalNumbers =
    Number(campaign.rangeEnd || 0) - Number(campaign.rangeStart || 0) + 1;

  const paidCount = campaign.paidNumbers?.length || 0;
  const reservedCount = campaign.reservedNumbers?.length || 0;
  const availableCount = Math.max(totalNumbers - paidCount - reservedCount, 0);

  return (
    <div className="page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        html, body, #root {
          margin: 0;
          padding: 0;
          min-height: 100%;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at top, rgba(212, 175, 55, 0.10), transparent 32%),
            linear-gradient(180deg, #63000d 0%, #850012 35%, #9d0016 100%);
          color: #ffffff;
        }

        body {
          overflow-x: hidden;
        }

        .page {
          min-height: 100vh;
          padding: 20px 12px 110px;
        }

        .wrapper {
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
        }

        .hero {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)),
            linear-gradient(180deg, #b40019 0%, #860014 100%);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.08);
          margin-bottom: 16px;
        }

        .heroTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 16px 0;
        }

        .logoBox {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.18);
          color: #fff;
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.2px;
          padding: 12px 16px;
          border-radius: 18px;
          backdrop-filter: blur(8px);
        }

        .logoSmall {
          font-size: 12px;
          opacity: 0.86;
          display: block;
          font-weight: 600;
        }

        .heroBadge {
          background: linear-gradient(135deg, #f6e7a1, #d4af37);
          color: #5f0012;
          padding: 10px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          box-shadow: 0 8px 20px rgba(0,0,0,0.18);
        }

        .heroImageWrap {
          padding: 14px 14px 0;
        }

        .heroImg {
          width: 100%;
          height: 260px;
          object-fit: cover;
          display: block;
          border-radius: 24px;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 10px 28px rgba(0,0,0,0.20);
        }

        .heroInfo {
          padding: 16px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.14);
          color: #fff;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }

        .heroInfo h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.08;
          letter-spacing: -0.4px;
          font-weight: 900;
        }

        .heroInfo p {
          margin: 10px 0 0;
          color: rgba(255,255,255,0.88);
          font-size: 14px;
          line-height: 1.5;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 16px;
        }

        .infoBox {
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 18px;
          padding: 12px 10px;
          min-height: 82px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          backdrop-filter: blur(6px);
        }

        .infoBox span {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.78);
          margin-bottom: 6px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .infoBox strong {
          font-size: 14px;
          line-height: 1.25;
          color: #fff;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 12px;
        }

        .statBox {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 12px 10px;
          text-align: center;
        }

        .statBox b {
          display: block;
          font-size: 18px;
          margin-bottom: 4px;
        }

        .statBox small {
          color: rgba(255,255,255,0.78);
          font-size: 12px;
        }

        .card {
          background: rgba(255,255,255,0.98);
          color: #111;
          border-radius: 26px;
          padding: 18px;
          box-shadow: 0 16px 44px rgba(0,0,0,0.20);
          margin-bottom: 16px;
        }

        .card h2 {
          margin: 0 0 8px;
          font-size: 22px;
          line-height: 1.1;
          color: #111;
        }

        .card h3 {
          margin: 0 0 10px;
          font-size: 18px;
          color: #111;
        }

        .muted {
          color: #6d6d6d;
          font-size: 14px;
          line-height: 1.45;
        }

        .descriptionText {
          margin-top: 8px;
          color: #2a2a2a;
          line-height: 1.6;
          white-space: pre-line;
        }

        .moreInfoButton {
          width: 100%;
          border: none;
          cursor: pointer;
          border-radius: 18px;
          padding: 16px;
          font-size: 15px;
          font-weight: 800;
          background: linear-gradient(180deg, #fff1f3 0%, #ffe1e6 100%);
          color: #980018;
          box-shadow: inset 0 0 0 1px rgba(152,0,24,0.10);
        }

        .moreInfoContent {
          margin-top: 14px;
          border-top: 1px solid #f0d7dc;
          padding-top: 14px;
        }

        .contactLine {
          margin: 6px 0;
          color: #333;
          font-size: 15px;
        }

        .quickPickHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }

        .quickButtons {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .quickBtn {
          border: none;
          cursor: pointer;
          border-radius: 18px;
          padding: 16px 8px;
          font-weight: 900;
          font-size: 18px;
          color: white;
          background: linear-gradient(180deg, #d80021 0%, #aa0019 100%);
          box-shadow: 0 10px 20px rgba(184,0,27,0.20);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .quickBtn:active {
          transform: scale(0.98);
        }

        .chooseBanner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          margin: 14px 0 16px;
          padding: 16px;
          border-radius: 20px;
          background: linear-gradient(180deg, #fff8f9 0%, #ffecef 100%);
          border: 2px dashed #d10020;
          color: #a10018;
          box-shadow: 0 12px 28px rgba(209,0,32,0.10);
        }

        .chooseArrow {
          font-size: 28px;
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
          gap: 10px 16px;
          margin-top: 12px;
        }

        .legend span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #4a4a4a;
          font-weight: 700;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .dot.available { background: #ececec; }
        .dot.reserved { background: #f5b63d; }
        .dot.paid { background: #3fbf64; }
        .dot.selected { background: #d10020; }

        .gridNumbers {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          margin-top: 6px;
        }

        .numberCard {
          position: relative;
          overflow: hidden;
          border: none;
          cursor: pointer;
          border-radius: 16px;
          padding: 10px 4px;
          min-height: 62px;
          background: #f7f7f7;
          color: #111;
          box-shadow: inset 0 0 0 1px #ececec;
          transition:
            transform 0.16s ease,
            box-shadow 0.16s ease,
            background 0.16s ease;
        }

        .numberCard strong {
          display: block;
          font-size: 16px;
          line-height: 1.1;
          margin-bottom: 4px;
        }

        .numberCard small {
          font-size: 10px;
          color: #666;
          font-weight: 700;
        }

        .numberCard.available:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 16px rgba(0,0,0,0.08);
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
          background: linear-gradient(180deg, #d90022 0%, #a30018 100%);
          color: #fff;
          box-shadow: 0 12px 24px rgba(180,0,25,0.24);
          transform: scale(1.03);
          animation: pulseSelect 0.22s ease;
        }

        .numberCard.selected small {
          color: rgba(255,255,255,0.88);
        }

        @keyframes pulseSelect {
          0% { transform: scale(0.95); }
          100% { transform: scale(1.03); }
        }

        .selectedSheet {
          position: sticky;
          bottom: 14px;
          z-index: 30;
          background: rgba(255,255,255,0.98);
          color: #111;
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 20px 44px rgba(0,0,0,0.22);
          margin-top: 16px;
          border: 1px solid rgba(0,0,0,0.05);
        }

        .selectedHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 10px 0 14px;
        }

        .chip {
          background: #fff1f4;
          color: #9e0018;
          border: 1px solid #ffd6de;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 800;
        }

        .chip.white {
          background: #fff;
          color: #9e0018;
        }

        .totalRow,
        .summaryRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid #f0f0f0;
          color: #333;
        }

        .totalRow strong,
        .summaryRow strong {
          color: #111;
          font-size: 18px;
        }

        .green {
          color: #0c8b3f !important;
        }

        label {
          display: block;
          margin: 14px 0 6px;
          color: #333;
          font-size: 14px;
          font-weight: 700;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #e7e7e7;
          border-radius: 16px;
          padding: 14px 14px;
          font-size: 15px;
          outline: none;
          background: #fff;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        input:focus,
        textarea:focus {
          border-color: #d10020;
          box-shadow: 0 0 0 4px rgba(209,0,32,0.08);
        }

        .summary {
          background: #fff6f8;
          border: 1px solid #ffdce3;
          border-radius: 20px;
          padding: 14px;
          margin-bottom: 16px;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 18px;
        }

        .primaryBtn,
        .outlineBtn,
        .successBtn,
        .whatsBtn,
        .miniLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 52px;
          border-radius: 18px;
          font-size: 15px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .primaryBtn {
          border: none;
          color: #fff;
          background: linear-gradient(180deg, #d90022 0%, #a30018 100%);
          box-shadow: 0 12px 24px rgba(184,0,27,0.22);
        }

        .primaryBtn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        .outlineBtn {
          border: 1px solid #e4c7ce;
          color: #a00018;
          background: #fff4f6;
        }

        .successBtn,
        .greenBtn {
          border: none;
          color: #fff;
          background: linear-gradient(180deg, #11a84d 0%, #087c37 100%);
          box-shadow: 0 12px 24px rgba(17,168,77,0.22);
        }

        .whatsBtn {
          border: none;
          color: #fff;
          background: linear-gradient(180deg, #25d366 0%, #17a74d 100%);
          box-shadow: 0 12px 24px rgba(37,211,102,0.22);
          margin-top: 12px;
        }

        .primaryBtn:hover,
        .outlineBtn:hover,
        .successBtn:hover,
        .whatsBtn:hover,
        .miniLink:hover {
          transform: translateY(-1px);
        }

        .qrImage {
          width: 100%;
          max-width: 280px;
          display: block;
          margin: 18px auto;
          border-radius: 20px;
          background: #fff;
          padding: 12px;
          box-shadow: 0 14px 26px rgba(0,0,0,0.12);
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

        .adminCard h1,
        .topAdmin h1 {
          margin: 0;
          color: #111;
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
          background: #fff1f4;
          color: #9e0018;
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
        }

        .miniLink {
          width: auto;
          padding: 0 16px;
          background: #fff4f6;
          color: #9e0018;
          border: 1px solid #ffd2da;
          min-height: 44px;
        }

        .smallBtn {
          width: auto;
          padding: 0 16px;
          min-height: 44px;
        }

        .floatingWhats {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 50;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          border: none;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          color: white;
          background: linear-gradient(180deg, #25d366 0%, #139648 100%);
          box-shadow: 0 18px 36px rgba(37,211,102,0.28);
        }

        @media (max-width: 640px) {
          .page {
            padding: 14px 10px 110px;
          }

          .heroInfo h1 {
            font-size: 24px;
          }

          .heroImg {
            height: 230px;
          }

          .infoGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .statsGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 390px) {
          .gridNumbers {
            grid-template-columns: repeat(4, 1fr);
          }

          .quickButtons {
            grid-template-columns: repeat(2, 1fr);
          }

          .infoGrid {
            grid-template-columns: 1fr;
          }

          .statsGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="wrapper">
        <header className="hero">
          <div className="heroTop">
            <div className="logoBox">
              <div>
                <span className="logoSmall">Organização</span>
                Casa Premiada Ribeirão
              </div>
            </div>

            <div className="heroBadge">🎁 Prêmio especial</div>
          </div>

          <div className="heroImageWrap">
            <img
              src={campaign.coverImage}
              alt={campaign.title}
              className="heroImg"
              onError={(e) => {
                e.currentTarget.src =
                  "https://via.placeholder.com/900x600?text=Premio";
              }}
            />
          </div>

          <div className="heroInfo">
            <div className="eyebrow">✨ Escolha seus números da sorte</div>
            <h1>{campaign.title}</h1>
            <p>{campaign.shortDescription || campaign.description || "Participe agora e garanta seus números."}</p>

            <div className="infoGrid">
              <div className="infoBox">
                <span>Valor por número</span>
                <strong>{formatMoney(campaign.pricePerNumber)}</strong>
              </div>

              <div className="infoBox">
                <span>Sorteio</span>
                <strong>{campaign.drawDate || "A definir"}</strong>
              </div>

              <div className="infoBox">
                <span>Organizador</span>
                <strong>{campaign.organizer || "Casa Premiada Ribeirão"}</strong>
              </div>
            </div>

            <div className="statsGrid">
              <div className="statBox">
                <b>{availableCount}</b>
                <small>Disponíveis</small>
              </div>
              <div className="statBox">
                <b>{reservedCount}</b>
                <small>Reservados</small>
              </div>
              <div className="statBox">
                <b>{paidCount}</b>
                <small>Pagos</small>
              </div>
            </div>
          </div>
        </header>

        {step === "grid" && (
          <>
            <section className="card">
              <h2>Descrição da Rifa</h2>
              <div className="descriptionText">
                {campaign.description || "Depois eu preencho."}
              </div>
            </section>

            <section className="card">
              <button
                className="moreInfoButton"
                onClick={() => setShowMoreInfo((prev) => !prev)}
              >
                {showMoreInfo ? "Ocultar informações" : "Ver mais informações"}
              </button>

              {showMoreInfo && (
                <div className="moreInfoContent">
                  <div className="contactLine">
                    <strong>Contato do organizador:</strong>
                  </div>
                  <div className="contactLine">
                    {campaign.organizer || "Casa Premiada Ribeirão"}
                  </div>
                  <div className="contactLine">
                    {campaign.organizerPhone || "(16) 99999-9999"}
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="whatsBtn"
                  >
                    Chamar no WhatsApp
                  </a>
                </div>
              )}
            </section>

            <section className="card">
              <div className="quickPickHeader">
                <div>
                  <h3>Compras rápidas</h3>
                  <div className="muted">
                    Escolha quantidades aleatórias e ganhe agilidade na compra.
                  </div>
                </div>
              </div>

              <div className="quickButtons">
                {[2, 5, 10, 20].map((n) => (
                  <button
                    key={n}
                    className="quickBtn"
                    onClick={() => randomAdd(n)}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="chooseBanner">
                <div className="chooseArrow">↓</div>
                <div>
                  <strong>Escolher números</strong>
                  <div className="muted">
                    Toque nos números disponíveis para adicionar ao carrinho
                  </div>
                </div>
              </div>

              <div className="legend">
                <span><i className="dot available"></i>Disponível</span>
                <span><i className="dot reserved"></i>Reservado</span>
                <span><i className="dot paid"></i>Pago</span>
                <span><i className="dot selected"></i>Selecionado</span>
              </div>

              <div className="gridNumbers">
                {Array.from(
                  { length: Number(campaign.rangeEnd) - Number(campaign.rangeStart) + 1 },
                  (_, idx) => Number(campaign.rangeStart) + idx
                ).map((n) => {
                  const status = getStatus(n);
                  const isSelected = selected.includes(n);

                  return (
                    <button
                      key={n}
                      className={`numberCard ${status} ${isSelected ? "selected" : ""}`}
                      onClick={() => toggle(n)}
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
                  <div className="chip">{selected.length} selecionado(s)</div>
                </div>

                <div className="chips">
                  {selected.map((n) => (
                    <span key={n} className="chip">
                      Nº {pad(n)}
                    </span>
                  ))}
                </div>

                <div className="totalRow">
                  <span>Total</span>
                  <strong>{formatMoney(total)}</strong>
                </div>

                <button
                  className="primaryBtn"
                  disabled={!selected.length}
                  onClick={() => setStep("data")}
                >
                  Continuar para pagamento
                </button>
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
                  <span className="chip white" key={n}>
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
              <button className="outlineBtn" onClick={() => setStep("grid")}>
                Voltar
              </button>

              <button
                className="successBtn"
                disabled={!customer.name || !customer.phone || loading}
                onClick={createPix}
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
            >
              Copiar código Pix
            </button>
          </section>
        )}
      </div>

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
    organizer: "Casa Premiada Ribeirão",
    organizerPhone: "",
    whatsapp: "",
    pricePerNumber: 2,
    rangeStart: 1,
    rangeEnd: 500,
    drawDate: "",
    coverImage: "",
    theme: { primary: "#b40019", secondary: "#ffffff", accent: "#d4af37" },
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
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Erro ao criar campanha.");

    alert("Campanha criada.");
    setForm({
      siteName: "Casa Premiada Ribeirão",
      title: "",
      slug: "",
      description: "",
      shortDescription: "",
      organizer: "Casa Premiada Ribeirão",
      organizerPhone: "",
      whatsapp: "",
      pricePerNumber: 2,
      rangeStart: 1,
      rangeEnd: 500,
      drawDate: "",
      coverImage: "",
      theme: { primary: "#b40019", secondary: "#ffffff", accent: "#d4af37" },
    });
    load();
  };

  if (!token) {
    return (
      <div className="page">
        <div className="wrapper">
          <section className="card adminCard">
            <h1>Painel Admin</h1>
            <p className="muted">Acesso privado do administrador.</p>

            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="primaryBtn" onClick={login}>
              Entrar
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="wrapper adminWrap">
        <section className="card">
          <div className="topAdmin">
            <div>
              <h1>Painel Admin</h1>
              <p className="muted">Criar e gerenciar campanhas</p>
            </div>

            <button
              className="outlineBtn smallBtn"
              onClick={() => {
                localStorage.removeItem("admin_token");
                setToken("");
              }}
            >
              Sair
            </button>
          </div>

          <div className="adminGrid">
            <div>
              <label>Nome do site</label>
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
                onChange={(e) =>
                  setForm({ ...form, pricePerNumber: e.target.value })
                }
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
              <label>Data do sorteio</label>
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
              <label>Organizador</label>
              <input
                value={form.organizer}
                onChange={(e) => setForm({ ...form, organizer: e.target.value })}
              />
            </div>

            <div>
              <label>Telefone do organizador</label>
              <input
                value={form.organizerPhone}
                onChange={(e) =>
                  setForm({ ...form, organizerPhone: e.target.value })
                }
              />
            </div>

            <div className="full">
              <label>Descrição curta</label>
              <input
                value={form.shortDescription}
                onChange={(e) =>
                  setForm({ ...form, shortDescription: e.target.value })
                }
                placeholder="Ex: Garanta agora seus números da sorte."
              />
            </div>

            <div className="full">
              <label>Descrição completa</label>
              <textarea
                rows="4"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div>
              <label>Cor principal</label>
              <input
                value={form.theme.primary}
                onChange={(e) =>
                  setForm({
                    ...form,
                    theme: { ...form.theme, primary: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <label>Cor secundária</label>
              <input
                value={form.theme.secondary}
                onChange={(e) =>
                  setForm({
                    ...form,
                    theme: { ...form.theme, secondary: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <label>Cor destaque</label>
              <input
                value={form.theme.accent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    theme: { ...form.theme, accent: e.target.value },
                  })
                }
              />
            </div>
          </div>

          <button className="primaryBtn" onClick={createCampaign}>
            Criar campanha
          </button>
        </section>

        <section className="card">
          <h2>Campanhas</h2>
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
          <h2>Compradores / reservas</h2>
          <div className="list">
            {orders.length ? (
              orders.map((item) => (
                <div className="listItem" key={item.id}>
                  <div>
                    <strong>{item.customer?.name || "Sem nome"}</strong>
                    <div className="muted">
                      {item.customer?.phone || "-"} • {item.campaignSlug} •{" "}
                      {item.selectedNumbers?.join(", ")}
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

  useEffect(() => {
    const onHash = () => setHash(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetch(`${API}/campaigns`)
      .then((r) => r.json())
      .then((data) => setCampaigns(data))
      .catch(() => setCampaigns([]));
  }, []);

  if (hash === "#/admin") return <AdminPanel />;

  const slug = hash.replace("#/", "") || "air-fryer";
  const campaign = campaigns.find((c) => c.slug === slug) || campaigns[0];

  if (!campaign) {
    return (
      <div className="page">
        <div className="wrapper">
          <section className="card">
            <h2>Carregando campanha...</h2>
          </section>
        </div>
      </div>
    );
  }

  return <PublicCampaign campaign={campaign} />;
}
