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

export default function SorteioPage() {
  const { slug } = useParams();

  const [sorteio, setSorteio] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [customer, setCustomer] = useState({
    nome: "",
    whatsapp: "",
  });

  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    loadSorteio();
  }, [slug]);

  async function loadSorteio() {
    const res = await fetch(`${API_URL}/api/sorteios/${slug}`);
    const data = await res.json();
    setSorteio(data);
  }

  function toggleNumber(num) {
    setSelectedNumbers((prev) => {
      if (prev.includes(num)) {
        return prev.filter((n) => n !== num);
      }
      return [...prev, num].sort((a, b) => a - b);
    });
  }

  function clearSelection() {
    setSelectedNumbers([]);
    setShowCheckout(false);
  }

  const totalValue = selectedNumbers.length * (sorteio?.price || 0);

  return (
    <div style={styles.page}>

      {/* TOPO */}
      <div style={styles.topBar}>
        <strong>CASA PREMIADA</strong>
      </div>

      {/* IMAGEM */}
      <img src={sorteio?.image} style={styles.hero} />

      {/* INFO */}
      <div style={styles.card}>
        <h1>{sorteio?.title}</h1>
        <p>Sorteio: {new Date(sorteio?.drawDate).toLocaleDateString()}</p>
        <p>{formatCurrency(sorteio?.price)} por número</p>
      </div>

      {/* COMPARTILHAR (MENOR) */}
      <div style={styles.shareRow}>
        <button style={styles.smallBtn}>WhatsApp</button>
        <button style={styles.smallBtn}>Copiar</button>
      </div>

      {/* NUMEROS */}
      <div style={styles.grid}>
        {Array.from({ length: sorteio?.totalNumbers || 0 }, (_, i) => {
          const num = i + 1;
          const active = selectedNumbers.includes(num);

          return (
            <button
              key={num}
              onClick={() => toggleNumber(num)}
              style={{
                ...styles.number,
                ...(active ? styles.active : {}),
              }}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* BOTÃO ESCOLHER (SOME QUANDO TEM NUMERO) */}
      {selectedNumbers.length === 0 && (
        <button style={styles.floating}>
          ↑ Escolher números ↓
        </button>
      )}

      {/* CARRINHO FIXO */}
      {selectedNumbers.length > 0 && (
        <div style={styles.cart}>
          <div>
            <strong>{selectedNumbers.length} números</strong>
            <div>{formatCurrency(totalValue)}</div>
          </div>

          <div style={styles.cartActions}>
            <button style={styles.clearBtn} onClick={clearSelection}>
              Limpar
            </button>

            <button
              style={styles.payBtn}
              onClick={() => setShowCheckout(true)}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT */}
      {showCheckout && (
        <div style={styles.checkout}>
          <h2>Finalizar</h2>

          <input
            placeholder="Nome"
            value={customer.nome}
            onChange={(e) =>
              setCustomer({ ...customer, nome: e.target.value })
            }
          />

          <input
            placeholder="WhatsApp"
            value={formatPhone(customer.whatsapp)}
            onChange={(e) =>
              setCustomer({
                ...customer,
                whatsapp: onlyDigits(e.target.value),
              })
            }
          />

          <button style={styles.payBtn}>Pagar</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    paddingBottom: 120,
    background: "#f2f2f2",
  },

  topBar: {
    padding: 12,
    background: "#fff",
    position: "sticky",
    top: 0,
  },

  hero: {
    width: "100%",
    height: 300,
    objectFit: "cover",
  },

  card: {
    padding: 16,
    background: "#fff",
    margin: 12,
    borderRadius: 16,
  },

  shareRow: {
    display: "flex",
    gap: 8,
    padding: 12,
  },

  smallBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ccc",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 8,
    padding: 12,
  },

  number: {
    padding: 18,
    borderRadius: 12,
    background: "#fff",
    border: "1px solid #ccc",
  },

  active: {
    background: "#10b981",
    color: "#fff",
  },

  floating: {
    position: "fixed",
    bottom: 20,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 16,
    background: "#10b981",
    color: "#fff",
    fontWeight: "bold",
  },

  cart: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 -5px 20px rgba(0,0,0,0.1)",
  },

  cartActions: {
    display: "flex",
    gap: 8,
  },

  clearBtn: {
    padding: 10,
    background: "#eee",
    borderRadius: 10,
  },

  payBtn: {
    padding: 12,
    background: "#15803d",
    color: "#fff",
    borderRadius: 10,
  },

  checkout: {
    padding: 16,
    background: "#fff",
    margin: 12,
    borderRadius: 16,
  },
};
