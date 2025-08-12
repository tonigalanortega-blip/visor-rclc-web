import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

function mountApp() {
  const el = document.getElementById("root");
  if (!el) return setTimeout(mountApp, 50); // espera si root aún no está
  ReactDOM.createRoot(el).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

mountApp();
