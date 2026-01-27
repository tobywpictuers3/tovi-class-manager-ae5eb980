// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import App from "./App";
import BrandProvider from "@/brand/BrandProvider";
import { ThemeProvider } from "@/brand/ThemeProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrandProvider />
    <ThemeProvider defaultTheme="system">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
