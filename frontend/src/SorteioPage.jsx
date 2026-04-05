import { useEffect, useState } from "react";

export default function SorteioPage() {
  const [numeros, setNumeros] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const preco = 2;

  // gerar números
  useEffect(() => {
    const lista = [];
    for (let i = 1; i <= 200; i++) {
      lista.push({ numero: i, status: "livre" });
    }
    setNumeros(lista);
  }, []);

  // selecionar número
  function toggleNumero(n) {
    if (selecionados.includes(n)) {
      setSelecionados(selecionados.filter((x) => x !== n));
    } else {
      setSelecionados([...selecionados, n]);
    }
  }

  // números aleatórios
  function gerarAleatorios(qtd = 5) {
    const livres = numeros
      .filter((n) => n.status === "livre")
      .map((n) => n.numero);

    const sorteados = [];

    while (sorteados.length < qtd && livres.length > 0) {
      const index = Math.floor(Math.random() * livres.length);
      sorteados.push(livres[index]);
      livres.splice(index, 1);
    }

    setSelecionados(sorteados);
  }

  const total = selecionados.length * preco;

  function reservar() {
    alert("Reservado! Agora finalize o pagamento.");
  }

  function pagar() {
    alert("Abrir checkout (PIX / Cartão)");
  }

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      
      {/* TOPO */}
      <div style={{ padding: 15, textAlign: "center" }}>
        <h2 style={{ margin: 0 }}>Casa Premiada Ribeirão</h2>
        <p style={{ color: "#666" }}>Escolha seus números e concorra</p>
      </div>

      {/* IMAGEM */}
      <img
        src="https://via.placeholder.com/400x300"
        style={{ width: "100%", borderRadius: 10 }}
      />

      {/* INFO */}
      <div style={{ padding: 15 }}>
        <h3>🔥 Air Fryer Premium</h3>
        <p>💰 R$2,00 por número</p>
      </div>

      {/* BOTÕES */}
      <div style={{ padding: 15, display: "flex", gap: 10 }}>
        <button
          onClick={() => gerarAleatorios(5)}
          style={{
            flex: 1,
            background: "green",
            color: "#fff",
            padding: 12,
            borderRadius: 8,
            border: "none",
          }}
        >
          Números Aleatórios
        </button>
      </div>

      {/* GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 5,
          padding: 10,
        }}
      >
        {numeros.map((n) => (
          <div
            key={n.numero}
            onClick={() => toggleNumero(n.numero)}
            style={{
              padding: 10,
              textAlign: "center",
              borderRadius: 6,
              background: selecionados.includes(n.numero)
                ? "#28a745"
                : "#eee",
              color: selecionados.includes(n.numero)
                ? "#fff"
                : "#000",
              fontWeight: "bold",
            }}
          >
            {n.numero}
          </div>
        ))}
      </div>

      {/* BOX FIXO */}
      {selecionados.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            width: "100%",
            background: "#fff",
            borderTop: "1px solid #ddd",
            padding: 15,
          }}
        >
          <div>
            <b>{selecionados.length} números</b> = R$ {total}
          </div>

          {!nome && (
            <>
              <input
                placeholder="Seu nome"
                onChange={(e) => setNome(e.target.value)}
                style={{ width: "100%", marginTop: 8 }}
              />
              <input
                placeholder="WhatsApp"
                onChange={(e) => setTelefone(e.target.value)}
                style={{ width: "100%", marginTop: 8 }}
              />
            </>
          )}

          <button
            onClick={reservar}
            style={{
              width: "100%",
              marginTop: 10,
              background: "#28a745",
              color: "#fff",
              padding: 12,
              border: "none",
              borderRadius: 8,
            }}
          >
            Reservar
          </button>

          <button
            onClick={pagar}
            style={{
              width: "100%",
              marginTop: 8,
              background: "#000",
              color: "#fff",
              padding: 12,
              border: "none",
              borderRadius: 8,
            }}
          >
            Pagar
          </button>
        </div>
      )}

      {/* WHATSAPP FIXO */}
      <a
        href="https://wa.me/5599999999999"
        target="_blank"
        style={{
          position: "fixed",
          bottom: 100,
          right: 20,
          background: "#25D366",
          color: "#fff",
          padding: 15,
          borderRadius: "50%",
          textDecoration: "none",
          fontWeight: "bold",
        }}
      >
        W
      </a>
    </div>
  );
}
