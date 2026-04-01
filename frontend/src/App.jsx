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
      prev.includes(n) ? prev.filter((i) => i !== n) : [...prev, n]
    );
  };

  const randomAdd = (qty) => {
    const available = [];
    for (let i = campaign.rangeStart; i <= campaign.rangeEnd; i++) {
      if (getStatus(i) === "available") available.push(i);
    }

    const shuffled = available.sort(() => 0.5 - Math.random());
    const picks = shuffled.slice(0, qty);

    setSelected((prev) => [...new Set([...prev, ...picks])]);
  };

  const createPix = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API}/create-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numbers: selected,
          customer,
          total,
        }),
      });

      const data = await res.json();
      setPix(data);
      setStep("pix");
    } catch (e) {
      alert("Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/${campaign.whatsapp || "5516999999999"}`;

  const availableCount =
    campaign.rangeEnd - campaign.rangeStart + 1 -
    (campaign.paidNumbers?.length || 0) -
    (campaign.reservedNumbers?.length || 0);

  const paidCount = campaign.paidNumbers?.length || 0;

  return (
    <div style={{ padding: 10 }}>
      <h1>{campaign.title}</h1>

      <p>{formatMoney(campaign.pricePerNumber)} por número</p>

      <button onClick={() => randomAdd(5)}>+5</button>

      <div>
        {Array.from(
          { length: campaign.rangeEnd - campaign.rangeStart + 1 },
          (_, i) => campaign.rangeStart + i
        ).map((n) => (
          <button key={n} onClick={() => toggle(n)}>
            {pad(n)}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div>
          <p>Total: {formatMoney(total)}</p>
          <button onClick={() => setStep("data")}>
            Continuar
          </button>
        </div>
      )}

      {step === "data" && (
        <div>
          <input
            placeholder="Nome"
            onChange={(e) =>
              setCustomer({ ...customer, name: e.target.value })
            }
          />
          <button onClick={createPix}>
            Gerar Pix
          </button>
        </div>
      )}

      {step === "pix" && (
        <div>
          <textarea value={pix?.qr_code || ""} readOnly />
        </div>
      )}
    </div>
  );
}

function AdminPanel() {
  return <div>Painel admin</div>;
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
  const campaign =
    campaigns.find((c) => c.slug === slug) || campaigns[0];

  if (!campaign) return <div>Carregando...</div>;

  return <PublicCampaign campaign={campaign} />;
}
