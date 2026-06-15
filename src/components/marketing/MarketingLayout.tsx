import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Prijzen" },
  { to: "/demo", label: "Demo" },
  { to: "/contact", label: "Contact" },
];

export function MarketingLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="w-7 h-7 rounded-lg bg-foreground text-background grid place-items-center text-xs">·</span>
            DOTTS
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Inloggen
            </Link>
            <Link
              to="/signup"
              className="px-4 py-1.5 rounded-md text-sm bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              Start gratis
            </Link>
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex-1"
      >
        {children}
      </motion.main>

      <footer className="border-t border-border/60 mt-24">
        <div className="max-w-6xl mx-auto px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
          <div>
            <div className="font-semibold mb-2">DOTTS</div>
            <p className="text-muted-foreground">
              De moderne kassa voor specialty horeca. Gebouwd in Amsterdam.
            </p>
          </div>
          <div>
            <div className="font-medium mb-2">Product</div>
            <ul className="space-y-1 text-muted-foreground">
              <li><Link to="/features" className="hover:text-foreground">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-foreground">Prijzen</Link></li>
              <li><Link to="/demo" className="hover:text-foreground">Demo</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-medium mb-2">Bedrijf</div>
            <ul className="space-y-1 text-muted-foreground">
              <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
              <li><Link to="/signup" className="hover:text-foreground">Aanmelden</Link></li>
              <li><Link to="/login" className="hover:text-foreground">Inloggen</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-medium mb-2">Juridisch</div>
            <ul className="space-y-1 text-muted-foreground">
              <li>Privacy</li>
              <li>Voorwaarden</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} DOTTS — Alle rechten voorbehouden.
        </div>
      </footer>
    </div>
  );
}
