import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa/register";
import { syncEngine } from "./lib/offline/syncEngine";

createRoot(document.getElementById("root")!).render(<App />);

// Bootstrap offline support — both guards are internal:
// • SW registration refuses in Lovable preview / dev / iframes
// • Sync engine is safe to start; it no-ops when offline and dedupes pushes
void registerServiceWorker();
syncEngine.start();
