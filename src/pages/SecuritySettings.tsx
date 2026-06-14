import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, Smartphone, ArrowLeft } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Factor {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  status: "verified" | "unverified";
  created_at: string;
}

export default function SecuritySettings() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState("");

  // Enrollment state
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrUri: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setError(error.message);
    else setFactors([...(data.totp || [])] as Factor[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setError("");
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `SAAKOUK ${new Date().toLocaleDateString("nl-NL")}`,
      });
      if (error) { setError(error.message); return; }
      setEnrollment({
        factorId: data.id,
        qrUri: data.totp.uri,
        secret: data.totp.secret,
      });
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!enrollment || !/^\d{6}$/.test(verifyCode)) {
      setError("Voer 6 cijfers in");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
      if (chErr) { setError(chErr.message); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: ch.id,
        code: verifyCode,
      });
      if (vErr) { setError(vErr.message); return; }
      setEnrollment(null);
      setVerifyCode("");
      await load();
    } finally {
      setVerifying(false);
    }
  };

  const cancelEnroll = async () => {
    if (enrollment) {
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
      setEnrollment(null);
      setVerifyCode("");
      await load();
    }
  };

  const removeFactor = async (id: string) => {
    if (!confirm("MFA uitschakelen? Je account is daarna alleen met wachtwoord beveiligd.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) setError(error.message);
    else load();
  };

  if (employee && !["owner", "manager"].includes(employee.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Alleen eigenaren en managers hebben toegang.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs mb-4"
        style={{ color: "#7c6bc4" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Terug
      </button>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-semibold mb-1" style={{ color: "#2a2a3a" }}>
          Beveiliging
        </h1>
        <p className="text-xs mb-6" style={{ color: "#8b8b9e" }}>
          Bescherm jouw eigenaar-account met tweestapsverificatie (TOTP).
        </p>
      </motion.div>

      {/* Active factors */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,249,255,0.78))",
          border: "1px solid rgba(255,255,255,0.72)",
          boxShadow: "0 12px 40px rgba(160,175,219,0.12)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4" style={{ color: "#7c6bc4" }} />
          <span className="text-sm font-semibold" style={{ color: "#2a2a3a" }}>
            Authenticator app
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : factors.filter((f) => f.status === "verified").length === 0 ? (
          <div className="text-xs mb-3" style={{ color: "#8b8b9e" }}>
            Nog niet ingeschakeld. Gebruik Google Authenticator, 1Password of een andere TOTP app.
          </div>
        ) : (
          <div className="space-y-2 mb-3">
            {factors.filter((f) => f.status === "verified").map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <ShieldCheck className="w-4 h-4" style={{ color: "#22c55e" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "#2a2a3a" }}>
                    {f.friendly_name || "TOTP"}
                  </div>
                  <div className="text-[11px]" style={{ color: "#9b9bab" }}>
                    Sinds {new Date(f.created_at).toLocaleDateString("nl-NL")}
                  </div>
                </div>
                <button
                  onClick={() => removeFactor(f.id)}
                  className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}
                >
                  <ShieldOff className="w-3.5 h-3.5" /> Uit
                </button>
              </div>
            ))}
          </div>
        )}

        {!enrollment && (
          <button
            onClick={startEnroll}
            disabled={enrolling}
            className="h-10 px-4 rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, rgba(172,155,255,0.85), rgba(140,120,220,0.9))",
              color: "#fff",
            }}
          >
            {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            Authenticator toevoegen
          </button>
        )}
      </div>

      {/* Enrollment flow */}
      {enrollment && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 mb-6"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,249,255,0.85))",
            border: "1px solid rgba(124,107,196,0.25)",
            boxShadow: "0 12px 40px rgba(160,175,219,0.18)",
          }}
        >
          <div className="text-sm font-semibold mb-3" style={{ color: "#2a2a3a" }}>
            Scan de QR-code
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="bg-white p-3 rounded-xl flex-shrink-0 mx-auto">
              <QRCodeSVG value={enrollment.qrUri} size={160} level="M" />
            </div>
            <div className="flex-1 text-xs space-y-2" style={{ color: "#5a5a72" }}>
              <p>1. Open je authenticator app.</p>
              <p>2. Scan de QR of voer de geheime sleutel handmatig in:</p>
              <code
                className="block p-2 rounded-lg text-[11px] break-all"
                style={{ background: "rgba(0,0,0,0.04)", fontFamily: "monospace" }}
              >
                {enrollment.secret}
              </code>
              <p>3. Voer de 6-cijfer code uit de app in:</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              className="flex-1 h-11 px-4 rounded-lg text-center outline-none"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(0,0,0,0.08)",
                fontSize: 20,
                letterSpacing: "0.4em",
                fontVariantNumeric: "tabular-nums",
              }}
            />
            <button
              onClick={verifyEnrollment}
              disabled={verifying || verifyCode.length !== 6}
              className="h-11 px-4 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.85), rgba(22,163,74,0.9))",
                color: "#fff",
              }}
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Bevestigen"}
            </button>
            <button
              onClick={cancelEnroll}
              className="h-11 px-3 rounded-lg text-xs"
              style={{ color: "#9b9bab" }}
            >
              Annuleer
            </button>
          </div>
        </motion.div>
      )}

      {error && (
        <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
          {error}
        </div>
      )}
    </div>
  );
}
