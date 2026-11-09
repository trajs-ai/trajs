import "@astryxdesign/core/astryx.css";
import "@astryxdesign/core/reset.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Missing the #root element the site mounts into.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
