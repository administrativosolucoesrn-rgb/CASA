import React, { useEffect, useMemo, useRef, useState } from "react";

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

const FALLBACK_CAMPAIGN = {
  id: "fallback-air-fryer",
  slug: "air-fryer",
  siteName: "Casa Premiada Ribeirão",
  logoImage: "",
  title: "Air Fryer",
  shortDescription: "Concorra a uma Air Fryer comprando seus números.",
  description: "Depois eu preencho.",
  company: "Casa Premiada Ribeirão",
  organizerPhone: "16999999999",
  whatsapp: "5516999999999",
  pricePerNumber: 2,
  rangeStart: 1,
  rangeEnd: 300,
  drawDate: "2026-05-10",
  coverImage: "",
  paidNumbers: [],
  reservedNumbers: [],
};

function PublicCampaign({ campaign }) {
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState("grid");
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(true);

  const numbersRef = useRef(null);

  const [customer, setCustomer] = useState(() => {
    try {
      const saved = localStorage.getItem("cp_customer");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || "",
          phone: parsed.phone || "",
        };
      }
    } catch {}
    return {
      name: "",
      phone: "",
    };
  });

  useEffect(() => {
    localStorage.setItem(
      "cp_customer",
      JSON.stringify({
        name: customer.name,
        phone: customer.phone,
      })
    );
  }, [customer]);

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
          customer: {
            name: customer.name,
            phone: customer.phone,
          },
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copiado com sucesso.");
    } catch {
      alert("Não foi possível copiar o link.");
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: campaign.title || "Sorteio",
          text: `Veja ${campaign.title || "este sorteio"}`,
          url: window.location.href,
        });
      } else {
        await copyLink();
      }
    } catch {}
  };

  const goToNumbers = () => {
    const el = numbersRef.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    function onScroll() {
      if (!numbersRef.current) return;
      const rect = numbersRef.current.getBoundingClientRect();
      setShowScrollButton(rect.top > 140);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const organizerPhone = normalizePhone(
    campaign.organizerPhone || campaign.whatsapp || "16999999999"
  );

  const whatsappUrl = `https://wa.me/55${organizerPhone}?text=${encodeURIComponent(
    `Olá! Quero informações sobre ${campaign.title || "o sorteio"}.`
  )}`;

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
          background: #f7f7f7;
          color: #111111;
        }

        body {
          overflow-x: hidden;
        }

        .page {
          min-height: 100vh;
          padding: 12px 10px 120px;
        }

        .wrapper {
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
        }

        .hero {
          overflow: hidden;
          border-radius: 26px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)),
            linear-gradient(180deg, #b10019 0%, #7f0012 100%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow:
            0 20px 50px rgba(0,0,0,0.18),
            inset 0 1px 0 rgba(255,255,255,0.07);
          margin-bottom: 14px;
          color: #fff;
        }

        .heroTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 14px 10px;
        }

        .brandBox {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .logoWrap {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .logoWrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .brandName {
          font-size: 19px;
          font-weight: 900;
          line-height: 1.08;
          color: #fff;
        }

        .heroImageWrap {
          padding: 0 12px 0;
        }

        .heroImg {
          width: 100%;
          height: 340px;
          object-fit: cover;
          display: block;
          border-radius: 22px;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 14px 30px rgba(0,0,0,0.18);
        }

        .heroImageCard {
          position: relative;
        }

        .imageMetaBar {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background: linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.72));
          border-bottom-left-radius: 22px;
          border-bottom-right-radius: 22px;
          overflow: hidden;
        }

        .metaItem {
          padding: 12px 12px 14px;
          color: #fff;
          min-height: 76px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          border-right: 1px solid rgba(255,255,255,0.08);
        }

        .metaItem:last-child {
          border-right: none;
        }

        .metaItem span {
          display: block;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: rgba(255,255,255,0.72);
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }

        .metaItem strong {
          display: block;
          font-size: 15px;
          line-height: 1.2;
          color: #fff;
          word-break: break-word;
        }

        .heroInfo {
          padding: 14px;
        }

        .heroInfo h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.06;
          font-weight: 900;
          letter-spacing: -0.3px;
        }

        .heroDesc {
          margin: 8px 0 0;
          color: rgba(255,255,255,0.87);
          font-size: 14px;
          line-height: 1.45;
        }

        .card {
          background: #ffffff;
          color: #111;
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.08);
          margin-bottom: 14px;
          border: 1px solid #efefef;
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
          box-shadow: inset 0 0 0 1px rgba(152,0,24,0.08);
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

        .secondaryActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
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
          box-shadow: 0 10px 18px rgba(182,134,6,0.18);
          transition: transform 0.15s ease;
        }

        .quickBtn:active {
          transform: scale(0.98);
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

        .numberCard.available:hover {
          transform: translateY(-1px);
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
          animation: pulseSelect 0.22s ease;
        }

        .numberCard.selected small {
          color: rgba(255,255,255,0.88);
        }

        @keyframes pulseSelect {
          0% { transform: scale(0.96); }
          100% { transform: scale(1.03); }
        }

        .selectedSheet {
          position: sticky;
          bottom: 12px;
          z-index: 30;
          background: rgba(255,255,255,0.99);
          color: #111;
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 18px 34px rgba(0,0,0,0.16);
          margin-top: 14px;
          border: 1px solid rgba(0,0,0,0.05);
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

        .chip.white {
          background: #fff;
          color: #8a5c00;
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

        .green {
          color: #0c8b3f !important;
        }

        .cartActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
        }

        .dataSheet {
          position: sticky;
          bottom: 12px;
          z-index: 40;
          border: 1px solid rgba(0,0,0,0.06);
        }

        .dataHeader {
          margin-bottom: 14px;
        }

        .dataBrand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dataLogoWrap {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          overflow: hidden;
          background: #fff7e8;
          border: 1px solid #f0dfb5;
          flex-shrink: 0;
        }

        .dataLogoWrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .dataMini {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 800;
          color: #8a5c00;
          margin-bottom: 4px;
          letter-spacing: 0.4px;
        }

        .dataSummary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }

        .dataSummaryBox {
          background: #fff8e9;
          border: 1px solid #f2dfae;
          border-radius: 18px;
          padding: 14px;
        }

        .dataSummaryBox span {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 800;
          color: #8a5c00;
          margin-bottom: 6px;
        }

        .dataSummaryBox strong {
          display: block;
          font-size: 24px;
          line-height: 1.1;
          color: #111;
        }

        .totalHighlight {
          background: linear-gradient(180deg, #fff5d8 0%, #ffe8a8 100%);
          border-color: #e8c85f;
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

        input:focus, textarea:focus {
          border-color: #b10019;
          box-shadow: 0 0 0 4px rgba(177,0,25,0.08);
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
        .miniBtn {
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
          transition: transform 0.15s ease;
        }

        .primaryBtn {
          border: none;
          color: #fff;
          background: linear-gradient(180deg, #b10019 0%, #850013 100%);
          box-shadow: 0 10px 22px rgba(177,0,25,0.22);
        }

        .primaryBtn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        .outlineBtn {
          border: 1px solid #eadbb4;
          color: #8a5c00;
          background: #fff8e7;
        }

        .successBtn {
          border: none;
          color: #fff;
          background: linear-gradient(180deg, #11a84d 0%, #087c37 100%);
          box-shadow: 0 10px 22px rgba(17,168,77,0.22);
        }

        .whatsBtn {
          border: none;
          color: #fff;
          background: linear-gradient(180deg, #25d366 0%, #17a74d 100%);
          box-shadow: 0 10px 22px rgba(37,211,102,0.22);
        }

        .miniBtn {
          border: 1px solid #eadbb4;
          color: #8a5c00;
          background: #fff;
        }

        .scrollNumbersBtn {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: 18px;
          z-index: 60;
          border: none;
          background: linear-gradient(180deg, #e0b129 0%, #c89410 100%);
          color: #432d00;
          font-weight: 900;
          font-size: 16px;
          min-height: 54px;
          padding: 0 20px;
          border-radius: 999px;
          box-shadow: 0 16px 30px rgba(200,148,16,0.28);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .scrollNumbersBtn span {
          font-size: 22px;
          line-height: 1;
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

        @media (max-width: 640px) {
          .page {
            padding: 10px 9px 120px;
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }

          .heroImg {
            height: 320px;
          }
        }

        @media (max-width: 430px) {
          .gridNumbers {
            grid-template-columns: repeat(5, 1fr);
          }

          .quickButtons {
            grid-template-columns: repeat(4, 1fr);
          }

          .imageMetaBar {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 390px) {
          .gridNumbers {
            grid-template-columns: repeat(4, 1fr);
          }

          .cartActions,
          .actions,
          .secondaryActions,
          .dataSummary {
            grid-template-columns: 1fr;
          }

          .heroImg {
            height: 290px;
          }

          .brandName {
            font-size: 17px;
          }
        }
      `}</style>

      <div className="wrapper">
        <header className="hero">
          <div className="heroTop">
            <div className="brandBox">
              <div className="logoWrap">
                <img
                  src={
                    campaign.logoImage ||
                    "https://via.placeholder.com/80x80?text=CP"
                  }
                  alt="Logo"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://via.placeholder.com/80x80?text=CP";
                  }}
                />
              </div>

              <div className="brandName">
                {campaign.siteName || "Casa Premiada Ribeirão"}
              </div>
            </div>
          </div>

          <div className="heroImageWrap">
            <div className="heroImageCard">
              <img
                src={campaign.coverImage}
                alt={campaign.title}
                className="heroImg"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://via.placeholder.com/900x600?text=Premio";
                }}
              />

              <div className="imageMetaBar">
                <div className="metaItem">
                  <span>Valor por número</span>
                  <strong>{formatMoney(campaign.pricePerNumber)}</strong>
                </div>

                <div className="metaItem">
                  <span>Data</span>
                  <strong>{campaign.drawDate || "A definir"}</strong>
                </div>

                <div className="metaItem">
                  <span>Empresa</span>
                  <strong>{campaign.company || campaign.siteName || "Casa Premiada Ribeirão"}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="heroInfo">
            <h1>{campaign.title || "Prêmio especial"}</h1>

            <p className="heroDesc">
              {campaign.shortDescription ||
                campaign.description ||
                "Participe agora e escolha seus números da sorte."}
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
                    {campaign.company || campaign.siteName || "Casa Premiada Ribeirão"}
                  </div>

                  <div className="contactLine">
                    {campaign.organizerPhone || "(16) 99999-9999"}
                  </div>

                  <div className="secondaryActions">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="whatsBtn"
                    >
                      WhatsApp
                    </a>

                    <button
                      className="miniBtn"
                      onClick={copyLink}
                      type="button"
                    >
                      Copiar link
                    </button>
                  </div>

                  <div className="secondaryActions">
                    <button
                      className="outlineBtn"
                      onClick={shareLink}
                      type="button"
                    >
                      Compartilhar
                    </button>
                  </div>
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

            <section className="card" ref={numbersRef}>
              <div className="chooseBanner">
                <div className="chooseArrow">↓</div>
                <div>
                  <strong>Escolher números</strong>
                  <div className="muted">
                    Toque nos números disponíveis
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
                  <button
                    className="outlineBtn"
                    onClick={clearCart}
                    type="button"
                  >
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
          <section className="card dataSheet">
            <div className="dataHeader">
              <div className="dataBrand">
                <div className="dataLogoWrap">
                  <img
                    src={
                      campaign.logoImage ||
                      "https://via.placeholder.com/80x80?text=CP"
                    }
                    alt="Logo"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://via.placeholder.com/80x80?text=CP";
                    }}
                  />
                </div>

                <div>
                  <div className="dataMini">Finalizar reserva</div>
                  <h2>Seus dados</h2>
                </div>
              </div>
            </div>

            <div className="dataSummary">
              <div className="dataSummaryBox">
                <span>Quantidade</span>
                <strong>{selected.length}</strong>
              </div>

              <div className="dataSummaryBox totalHighlight">
                <span>Total</span>
                <strong>{formatMoney(total)}</strong>
              </div>
            </div>

            <div className="chips">
              {selected.map((n) => (
                <span className="chip white" key={n}>
                  Nº {pad(n)}
                </span>
              ))}
            </div>

            <label>Nome completo</label>
            <input
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              placeholder="Digite seu nome completo"
            />

            <label>Número / WhatsApp</label>
            <input
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              placeholder="Digite seu WhatsApp"
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
                {loading ? "Preparando pagamento..." : "Pagar"}
              </button>
            </div>
          </section>
        )}

        {step === "pix" && (
          <section className="card">
            <h2>Pagamento via Pix</h2>
            <p className="muted">
              Finalize o pagamento para garantir seus números.
            </p>

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
        <button
          className="scrollNumbersBtn"
          onClick={goToNumbers}
          type="button"
        >
          <span>↓</span>
          Escolher números
        </button>
      )}
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
    logoImage: "",
    title: "",
    slug: "",
    shortDescription: "",
    description: "",
    company: "Casa Premiada Ribeirão",
    organizerPhone: "",
    whatsapp: "",
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
    const payload = {
      ...form,
      pricePerNumber: Number(form.pricePerNumber),
      rangeStart: Number(form.rangeStart),
      rangeEnd: Number(form.rangeEnd),
    };

    const res = await fetch(`${API}/admin/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Erro ao criar campanha.");

    alert("Campanha criada.");
    setForm({
      siteName: "Casa Premiada Ribeirão",
      logoImage: "",
      title: "",
      slug: "",
      shortDescription: "",
      description: "",
      company: "Casa Premiada Ribeirão",
      organizerPhone: "",
      whatsapp: "",
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
        <style>{`
          * { box-sizing: border-box; }
          html, body, #root {
            margin: 0;
            padding: 0;
            min-height: 100%;
            font-family: Inter, system-ui, sans-serif;
            background: #f7f7f7;
          }
          .page { min-height: 100vh; padding: 12px 10px 40px; }
          .wrapper { width: 100%; max-width: 980px; margin: 0 auto; }
          .card {
            background: #fff;
            color: #111;
            border-radius: 22px;
            padding: 16px;
            box-shadow: 0 12px 28px rgba(0,0,0,0.08);
            margin-bottom: 14px;
            border: 1px solid #efefef;
          }
          .muted { color: #6d6d6d; font-size: 14px; line-height: 1.45; }
          label {
            display: block;
            margin: 14px 0 6px;
            color: #333;
            font-size: 14px;
            font-weight: 700;
          }
          input {
            width: 100%;
            border: 1px solid #e7e7e7;
            border-radius: 14px;
            padding: 13px 14px;
            font-size: 15px;
            outline: none;
            background: #fff;
          }
          .primaryBtn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 50px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 900;
            cursor: pointer;
            border: none;
            color: #fff;
            background: linear-gradient(180deg, #b10019 0%, #850013 100%);
            box-shadow: 0 10px 22px rgba(177,0,25,0.22);
          }
        `}</style>

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
          background: #f7f7f7;
        }
        .page { min-height: 100vh; padding: 12px 10px 40px; }
        .wrapper { width: 100%; max-width: 980px; margin: 0 auto; }
        .card {
          background: #fff;
          color: #111;
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.08);
          margin-bottom: 14px;
          border: 1px solid #efefef;
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
        .primaryBtn,
        .outlineBtn,
        .miniLink {
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
          transition: transform 0.15s ease;
        }
        .primaryBtn {
          border: none;
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
          padding: 0 16px;
          background: #fff8e7;
          color: #8a5c00;
          border: 1px solid #f2e2b8;
        }
        @media (max-width: 640px) {
          .adminGrid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="wrapper adminWrap">
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
              <label>Nome do site</label>
              <input
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              />
            </div>

            <div>
              <label>URL da logo</label>
              <input
                value={form.logoImage}
                onChange={(e) => setForm({ ...form, logoImage: e.target.value })}
                placeholder="https://..."
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
              <label>Data</label>
              <input
                value={form.drawDate}
                onChange={(e) => setForm({ ...form, drawDate: e.target.value })}
                placeholder="12/04/2026"
              />
            </div>

            <div>
              <label>Empresa</label>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>

            <div>
              <label>Telefone / WhatsApp</label>
              <input
                value={form.organizerPhone}
                onChange={(e) =>
                  setForm({ ...form, organizerPhone: e.target.value })
                }
                placeholder="16999999999"
              />
            </div>

            <div>
              <label>WhatsApp internacional</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="5516999999999"
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
              <label>URL da foto do prêmio</label>
              <input
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              />
            </div>

            <div className="full">
              <label>Descrição curta</label>
              <input
                value={form.shortDescription}
                onChange={(e) =>
                  setForm({ ...form, shortDescription: e.target.value })
                }
                placeholder="Ex: Concorra a uma Air Fryer comprando seus números."
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
  const [campaigns, setCampaigns] = useState([FALLBACK_CAMPAIGN]);

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

        const text = await res.text();
        const data = text ? JSON.parse(text) : [];

        if (Array.isArray(data) && data.length) {
          setCampaigns(data);
        }
      } catch (error) {
        console.error("Erro ao carregar sorteios:", error);
      }
    }

    loadCampaigns();
  }, []);

  if (hash === "#/admin") return <AdminPanel />;

  const slug = hash.replace("#/", "") || "air-fryer";
  const campaign =
    campaigns.find((c) => c.slug === slug) ||
    campaigns[0] ||
    FALLBACK_CAMPAIGN;

  return <PublicCampaign campaign={campaign} />;
}
