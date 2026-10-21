import { createRoot } from "react-dom/client";
import "@copilotkit/react-core/v2/styles.css";
import { App } from "./App.js";
import "./app.css";

const root = document.getElementById("root");

if (root === null) throw new Error("Missing #root element");

createRoot(root).render(<App />);
