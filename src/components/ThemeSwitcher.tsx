import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import clsx from "clsx";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Licht", icon: Sun },
  { value: "dark", label: "Donker", icon: Moon },
  { value: "system", label: "Systeem", icon: Monitor },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Thema"
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              active ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
