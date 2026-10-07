import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { routeur } from "./routeur";
import "./styles/polices.css";
import "./styles/tokens.css";
import "./styles/base.css";

const racine = document.getElementById("racine");
if (!racine) throw new Error("élément #racine absent de index.html");

createRoot(racine).render(
  <StrictMode>
    <RouterProvider router={routeur} />
  </StrictMode>,
);
