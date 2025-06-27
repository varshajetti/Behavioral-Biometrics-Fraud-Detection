import { createRoot } from "react-dom/client";
import App from "./App";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<App />);
} else {
  console.error("❌ No root element found");
}
