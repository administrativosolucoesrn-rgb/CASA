import React, { useEffect, useMemo, useState } from "react";

const API = "const API = "https://casapremiada.onrender.com/api";

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
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: ""
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
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)
    );
  };

  const randomAdd = (qty) => {
    const pool = [];
    for (let i = campaign.rangeStart; i <= campaign.rangeEnd; i++) {
      if (getStatus(i) === "available" && !selected.includes(i)) pool.push(i);
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setSelected((prev) => [...prev, ...shuffled.slice(0, qty)].slice(0, 5).sort((a, b) => a - b));
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
          customer
        })
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

  return (
    <div className="page">
      <div className="wrapper">
        <header className="hero" style={{ "--primary": campaign.theme?.primary, "--accent": campaign.theme?.accent }}>
          <div className="logoBox">{campaign.siteName}</div>
          <img src={campaign.coverImage} alt={campaign.title} className="heroImg" />
          <div className="heroInfo">
            <h1>{campaign.title}</h1>
            <p>{campaign.description}</p>
            <div className="metaRow">
              <span>Valor por número: <strong>{formatMoney(campaign.pricePerNumber)}</strong></span>
              <span>Sorteio: <strong>{campaign.drawDate || "a definir"}</strong></span>
            </div>
          </div>
        </header>

        {step === "grid" && (
          <>
            <section className="card">
              <h2>Escolha seus números</h2>
              <p className="muted">Você pode selecionar manualmente ou usar números aleatórios.</p>
              <div className="legend">
                <span><i className="dot available"></i>Disponível</span>
                <span><i className="dot reserved"></i>Reservado</span>
                <span><i className="dot paid"></i>Pago</span>
              </div>
              <div className="randomButtons">
                {[1,2,3,5].map((n) => (
                  <button key={n} className="outlineBtn" onClick={() => randomAdd(n)}>+{n} aleatório</button>
                ))}
              </div>
            </section>

            <section className="gridNumbers">
              {Array.from({ length: campaign.rangeEnd - campaign.rangeStart + 1 }, (_, idx) => campaign.rangeStart + idx).map((n) => {
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
                      {isSelected ? "Selecionado" : status === "available" ? "Disponível" : status === "reserved" ? "Reservado" : "Pago"}
                    </small>
                  </button>
                );
              })}
            </section>

            <section className="bottomSheet">
              <h3>Números selecionados</h3>
              <div className="chips">
                {selected.length ? selected.map((n) => <span key={n} className="chip">Nº {pad(n)}</span>) : <span className="muted">Nenhum número selecionado</span>}
              </div>
              <div className="totalRow">
                <span>Total</span>
                <strong>{formatMoney(total)}</strong>
              </div>
              <button className="primaryBtn" disabled={!selected.length} onClick={() => setStep("data")}>
                Continuar para pagamento
              </button>
            </section>
          </>
        )}

        {step === "data" && (
          <section className="card">
            <h2>Seus dados</h2>
            <div className="summary">
              <div className="chips">
                {selected.map((n) => <span className="chip white" key={n}>Nº {pad(n)}</span>)}
              </div>
              <div className="summaryRow"><span>Quantidade</span><strong>{selected.length}</strong></div>
              <div className="summaryRow"><span>Total</span><strong className="green">{formatMoney(total)}</strong></div>
            </div>

            <label>Nome</label>
            <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            <label>WhatsApp</label>
            <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            <label>E-mail</label>
            <input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
            <label>CPF</label>
            <input value={customer.cpf} onChange={(e) => setCustomer({ ...customer, cpf: e.target.value })} />

            <div className="actions">
              <button className="outlineBtn" onClick={() => setStep("grid")}>Voltar</button>
              <button className="successBtn" disabled={!customer.name || !customer.phone || loading} onClick={createPix}>
                {loading ? "Gerando Pix..." : "Gerar Pix"}
              </button>
            </div>
          </section>
        )}

        {step === "pix" && (
          <section className="card">
            <h2>Pagamento via Pix</h2>
            <p className="muted">Finalize para garantir seus números.</p>
            <div className="summary">
              <div className="summaryRow"><span>Status</span><strong>{pix?.status || "-"}</strong></div>
              <div className="summaryRow"><span>Total</span><strong className="green">{formatMoney(total)}</strong></div>
            </div>

            {pix?.qr_code_base64 ? (
              <img
                className="qrImage"
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code Pix"
              />
            ) : (
              <div className="demoBox">Modo demonstração: configure o token do Mercado Pago no backend.</div>
            )}

            <label>Pix copia e cola</label>
            <textarea rows="6" readOnly value={pix?.qr_code || ""} />

            <button
              className="primaryBtn greenBtn"
              onClick={() => navigator.clipboard.writeText(pix?.qr_code || "")}
            >
              Copiar código Pix
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function AdminPanel() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("admin_token") || "");
  const [campaigns, setCampaigns] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    siteName: "CASAPREMIADARIBEIRAO",
    title: "",
    slug: "",
    description: "",
    pricePerNumber: 2,
    rangeStart: 150,
    rangeEnd: 500,
    drawDate: "",
    coverImage: "",
    theme: { primary: "#b40019", secondary: "#ffffff", accent: "#d4af37" }
  });

  const headers = token ? {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  } : { "Content-Type": "application/json" };

  const load = async () => {
    if (!token) return;
    const [cRes, oRes] = await Promise.all([
      fetch(`${API}/admin/campaigns`, { headers }),
      fetch(`${API}/admin/orders`, { headers })
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
      body: JSON.stringify({ password })
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
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Erro ao criar campanha.");
    alert("Campanha criada.");
    setForm({
      siteName: "CASAPREMIADARIBEIRAO",
      title: "",
      slug: "",
      description: "",
      pricePerNumber: 2,
      rangeStart: 150,
      rangeEnd: 500,
      drawDate: "",
      coverImage: "",
      theme: { primary: "#b40019", secondary: "#ffffff", accent: "#d4af37" }
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
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="primaryBtn" onClick={login}>Entrar</button>
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
            <button className="outlineBtn smallBtn" onClick={() => {
              localStorage.removeItem("admin_token");
              setToken("");
            }}>Sair</button>
          </div>

          <div className="adminGrid">
            <div>
              <label>Nome do site</label>
              <input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
            </div>
            <div>
              <label>Prêmio</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label>Slug do link</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="ex: iphone-15" />
            </div>
            <div>
              <label>Preço por número</label>
              <input type="number" value={form.pricePerNumber} onChange={(e) => setForm({ ...form, pricePerNumber: e.target.value })} />
            </div>
            <div>
              <label>Começa em</label>
              <input type="number" value={form.rangeStart} onChange={(e) => setForm({ ...form, rangeStart: e.target.value })} />
            </div>
            <div>
              <label>Termina em</label>
              <input type="number" value={form.rangeEnd} onChange={(e) => setForm({ ...form, rangeEnd: e.target.value })} />
            </div>
            <div>
              <label>Data do sorteio</label>
              <input value={form.drawDate} onChange={(e) => setForm({ ...form, drawDate: e.target.value })} placeholder="2026-05-10" />
            </div>
            <div>
              <label>URL da foto</label>
              <input value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} />
            </div>
            <div className="full">
              <label>Descrição</label>
              <textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label>Cor principal</label>
              <input value={form.theme.primary} onChange={(e) => setForm({ ...form, theme: { ...form.theme, primary: e.target.value } })} />
            </div>
            <div>
              <label>Cor secundária</label>
              <input value={form.theme.secondary} onChange={(e) => setForm({ ...form, theme: { ...form.theme, secondary: e.target.value } })} />
            </div>
            <div>
              <label>Cor destaque</label>
              <input value={form.theme.accent} onChange={(e) => setForm({ ...form, theme: { ...form.theme, accent: e.target.value } })} />
            </div>
          </div>

          <button className="primaryBtn" onClick={createCampaign}>Criar campanha</button>
        </section>

        <section className="card">
          <h2>Campanhas</h2>
          <div className="list">
            {campaigns.map((item) => (
              <div className="listItem" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <div className="muted">{item.slug} • {formatMoney(item.pricePerNumber)} • {item.rangeStart} até {item.rangeEnd}</div>
                </div>
                <a className="miniLink" href={`#/${item.slug}`}>Abrir</a>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Compradores / reservas</h2>
          <div className="list">
            {orders.length ? orders.map((item) => (
              <div className="listItem" key={item.id}>
                <div>
                  <strong>{item.customer?.name || "Sem nome"}</strong>
                  <div className="muted">{item.customer?.phone || "-"} • {item.campaignSlug} • {item.selectedNumbers?.join(", ")}</div>
                </div>
                <span className="badge">{item.status}</span>
              </div>
            )) : <p className="muted">Ainda não há reservas.</p>}
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
          <section className="card"><h2>Carregando campanha...</h2></section>
        </div>
      </div>
    );
  }

  return <PublicCampaign campaign={campaign} />;
}
