import {
  TrendingUp, ShoppingCart, Package, Users, Star, LayoutGrid, UserCircle,
  BarChart3, DollarSign, Smartphone, ChefHat, ShieldCheck, WifiOff, Settings,
  type LucideIcon,
} from "lucide-react";

export interface HelpSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: "Insights" | "Operations" | "Sales" | "Team" | "Settings";
  /** When true, the article has its own custom page route. Otherwise rendered via generic HelpArticle. */
  custom?: boolean;
  /** Generic content for non-custom articles. */
  sections?: HelpSection[];
  /** Extra keywords to make search more forgiving. */
  keywords?: string[];
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "forecasting",
    title: "Forecasting",
    description: "Anticipate revenue, demand, staffing and inventory needs.",
    icon: TrendingUp,
    category: "Insights",
    custom: true,
    keywords: [
      "revenue", "omzet", "forecast", "voorspelling", "prognose", "staffing",
      "personeel", "inventory", "voorraad", "weather", "weer", "MAPE",
      "purchasing", "inkoop", "holidays", "feestdagen",
    ],
  },
  {
    slug: "pos",
    title: "Point of Sale (POS)",
    description: "Ring up orders, manage tickets and accept payments.",
    icon: ShoppingCart,
    category: "Sales",
    sections: [
      {
        heading: "Overview",
        body: "The POS lets your staff take orders, split bills, attach customers and accept payments — all from an iPad or tablet.",
      },
      {
        heading: "Tickets & carts",
        body: "Each table (or walk-in) has its own ticket. Switching tables preserves the open cart so you can return to it later without losing items.",
      },
    ],
    keywords: ["till", "kassa", "checkout", "cart", "ticket", "ipad", "tablet"],
  },
  {
    slug: "inventory",
    title: "Inventory",
    description: "Master stock, perishables, waste and stocktakes.",
    icon: Package,
    category: "Operations",
    sections: [
      {
        heading: "Master stock vs perishables",
        body: "Master stock tracks long-life items. Perishables decrement dynamically from sales via product recipes.",
      },
      {
        heading: "Waste & counts",
        body: "Log waste with a reason and run periodic counts to reconcile expected vs actual stock.",
      },
    ],
    keywords: ["stock", "voorraad", "waste", "derving", "count", "telling"],
  },
  {
    slug: "loyalty",
    title: "Loyalty & PassKit",
    description: "Apple/Google Wallet loyalty passes for repeat customers.",
    icon: Star,
    category: "Sales",
    sections: [
      {
        heading: "How it works",
        body: "Customers add a digital loyalty pass to their wallet. Each purchase updates the pass automatically with their points balance.",
      },
    ],
    keywords: ["passkit", "wallet", "punten", "points", "rewards"],
  },
  {
    slug: "floor-plan",
    title: "Visual Floor Plan",
    description: "Design tables, sections and virtual delivery channels.",
    icon: LayoutGrid,
    category: "Operations",
    sections: [
      {
        heading: "Editor",
        body: "Drag tables onto the 2D editor, set capacity and group by section. Virtual tables represent delivery channels like Uber Eats.",
      },
      {
        heading: "Statuses",
        body: "Tables show colour-coded statuses: free, seated, ordering, awaiting payment and cleaning.",
      },
    ],
    keywords: ["tables", "tafels", "plattegrond", "uber eats", "delivery"],
  },
  {
    slug: "customers",
    title: "Customers",
    description: "Mandatory name, email and phone for every customer record.",
    icon: UserCircle,
    category: "Sales",
    sections: [
      {
        heading: "Required fields",
        body: "Name, email and phone are strictly mandatory when creating a new customer to ensure clean marketing and loyalty data.",
      },
    ],
    keywords: ["klant", "crm", "contact", "email", "phone"],
  },
  {
    slug: "analytics",
    title: "Analytics & Reports",
    description: "KPIs, heatmaps, accounting exports and dashboards.",
    icon: BarChart3,
    category: "Insights",
    sections: [
      {
        heading: "Dashboards",
        body: "Daily KPIs (revenue, orders, average ticket) and heatmaps for hour-of-day and day-of-week performance.",
      },
      {
        heading: "Accounting export",
        body: "Export VAT-split sales (9% food/drink, 21% retail/other) for your bookkeeper.",
      },
    ],
    keywords: ["kpi", "report", "rapport", "heatmap", "accounting", "boekhouding"],
  },
  {
    slug: "cash-closing",
    title: "Cash Closing",
    description: "Blind count with four-eyes PIN and owner audit.",
    icon: DollarSign,
    category: "Operations",
    sections: [
      {
        heading: "Blind count",
        body: "Cashiers count cash without seeing the expected total. A second PIN (four-eyes) verifies the count before posting.",
      },
      {
        heading: "Owner audit",
        body: "Owners can review every closing with full variance reporting.",
      },
    ],
    keywords: ["kassa", "afsluiten", "telling", "audit", "variance"],
  },
  {
    slug: "qr-ordering",
    title: "QR Ordering",
    description: "Auto-accept guest orders with Kanban board.",
    icon: Smartphone,
    category: "Sales",
    sections: [
      {
        heading: "Customer data",
        body: "Guests must provide name, email and phone before placing a QR order — this keeps the customer database clean.",
      },
      {
        heading: "Kanban board",
        body: "Incoming orders appear on a board: New → In progress → Ready → Delivered.",
      },
    ],
    keywords: ["qr code", "self order", "guest", "kanban"],
  },
  {
    slug: "prep-station",
    title: "Prep Station (KDS)",
    description: "Kitchen display routing, live timers and statuses.",
    icon: ChefHat,
    category: "Operations",
    sections: [
      {
        heading: "Routing",
        body: "Items are routed to the right station (bar, kitchen, matcha bar) based on product configuration.",
      },
      {
        heading: "Timers",
        body: "Each ticket shows a live elapsed timer so staff prioritise the oldest orders.",
      },
    ],
    keywords: ["kds", "kitchen", "keuken", "bar"],
  },
  {
    slug: "team-roles",
    title: "Team & Roles (RBAC)",
    description: "6-digit PIN login, team roles and module permissions.",
    icon: ShieldCheck,
    category: "Team",
    sections: [
      {
        heading: "Roles",
        body: "Owner, Manager, Cashier and Kitchen each see only the modules they need. Role checks are server-enforced.",
      },
      {
        heading: "PIN login",
        body: "Staff log in with a 6-digit PIN. Every order is permanently attributed to the active employee.",
      },
    ],
    keywords: ["rbac", "permissions", "rol", "pin", "login"],
  },
  {
    slug: "offline-mode",
    title: "Offline Mode",
    description: "PWA with Dexie outbox; orders sync when reconnected.",
    icon: WifiOff,
    category: "Settings",
    sections: [
      {
        heading: "How it works",
        body: "When the connection drops, orders are queued locally with UUID idempotency keys. They sync automatically when you reconnect, using last-write-wins.",
      },
    ],
    keywords: ["offline", "pwa", "dexie", "outbox", "sync"],
  },
  {
    slug: "settings",
    title: "Settings",
    description: "Business hours, VAT, hardware (cash drawer) and more.",
    icon: Settings,
    category: "Settings",
    sections: [
      {
        heading: "Business hours",
        body: "Mon–Thu 10–22, Fri–Sat 10–00, Sun 12–00. Drives forecasting and prep windows.",
      },
      {
        heading: "VAT",
        body: "Dual-layer: 9% on food/drinks, 21% on retail/other.",
      },
      {
        heading: "Hardware",
        body: "Epson ESC/POS cash drawer is controlled via WebUSB.",
      },
    ],
    keywords: ["instellingen", "btw", "vat", "cash drawer", "lade", "epson", "webusb"],
  },
];

export function getArticle(slug: string) {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function searchArticles(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_ARTICLES;
  return HELP_ARTICLES.filter((a) => {
    const hay = [
      a.title,
      a.description,
      a.category,
      ...(a.keywords ?? []),
      ...(a.sections?.flatMap((s) => [s.heading, s.body, ...(s.bullets ?? [])]) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
