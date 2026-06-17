import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ToastProvider from "./components/ToastContext.jsx";
import { I18nProvider } from "./i18n.jsx";
import "./index.css";
import { CookiesProvider } from "react-cookie";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <CookiesProvider>
          <App />
        </CookiesProvider>
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>,
);
