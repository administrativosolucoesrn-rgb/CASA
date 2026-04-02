import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminPage from "./AdminPage";
import SorteioPage from "./SorteioPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/sorteio/:slug" element={<SorteioPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
