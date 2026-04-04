import { Routes, Route, Navigate } from "react-router-dom";
import SorteioPage from "./SorteioPage";
import AdminPage from "./AdminPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SorteioPage />} />
      <Route path="/admin" element={<AdminPage />} />

      {/* opcional: se alguém entrar em rota inexistente, volta para a pública */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
