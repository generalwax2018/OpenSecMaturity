import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { MaturityApp } from "@/components/maturity-app";
import { loadCachedCatalog } from "@/lib/catalog-update";
import "./styles.css";

// Use a newer catalog downloaded earlier, if there is one, before anything renders.
loadCachedCatalog();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <MaturityApp />
    </ErrorBoundary>
  </StrictMode>,
);
