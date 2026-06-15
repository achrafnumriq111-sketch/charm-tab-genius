import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UpsellSuggestion } from "@/hooks/useUpsell";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, X } from "lucide-react";

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

interface UpsellPromptProps {
  suggestion: UpsellSuggestion | null;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function UpsellPrompt({ suggestion, onAccept, onDismiss }: UpsellPromptProps) {
  if (!suggestion) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={suggestion.rule.id}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[55] w-[90vw] max-w-md"
      >
        <div className="bg-gradient-to-br from-white via-amber-50/80 to-orange-50/60 rounded-3xl border border-amber-200/60 shadow-[0_20px_60px_rgba(251,191,36,0.20),0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm text-foreground">Tip voor je klant</div>
                <div className="text-xs text-amber-700/80">{suggestion.rule.suggestion_type === "upgrade" ? "Upgrade" : suggestion.rule.suggestion_type === "addon" ? "Add-on" : "Combo deal"}</div>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-full hover:bg-black/5 transition text-muted-foreground hover:text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-card/70 rounded-2xl p-3 border border-amber-100/80">
            <div className="text-sm font-medium text-foreground">{suggestion.promptText}</div>
            {suggestion.suggestedProduct?.color && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: suggestion.suggestedProduct.color }} />
                <span className="text-xs text-muted-foreground">{suggestion.suggestedProduct.name}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onAccept}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/20"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Toevoegen {euro(suggestion.price)}
            </Button>
            <Button
              variant="outline"
              onClick={onDismiss}
              className="h-12 rounded-2xl px-6 border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              Nee bedankt
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
