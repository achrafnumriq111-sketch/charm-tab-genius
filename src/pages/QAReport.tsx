import { useEffect, useState } from "react";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import { Download, Printer, FileText } from "lucide-react";

/**
 * QA Report viewer — renders /qa-report.md as styled HTML and exposes:
 *   • Print → user picks "Save as PDF" in the browser dialog
 *   • Download HTML — standalone styled file
 *   • Download Markdown — raw source
 *
 * Mounted at /admin/qa-report (platform-admin only).
 */
export default function QAReport() {
  const [md, setMd] = useState<string>("");
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/qa-report.md", { cache: "no-store" });
      const text = await r.text();
      setMd(text);
      marked.setOptions({ gfm: true, breaks: false });
      const parsed = await marked.parse(text);
      setHtml(parsed);
      setLoading(false);
    })();
  }, []);

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildStandaloneHtml = () => `<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8" />
<title>QA Report — DOTTS</title>
<style>
  body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 2rem; border-bottom: 2px solid #b8860b; padding-bottom: .5rem; }
  h2 { font-size: 1.4rem; margin-top: 2rem; color: #2a2a2a; }
  h3 { font-size: 1.1rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .9rem; }
  th, td { border: 1px solid #ddd; padding: .5rem .75rem; text-align: left; vertical-align: top; }
  th { background: #f7f4ec; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  code { background: #f4f4f4; padding: .15rem .35rem; border-radius: 3px; font-size: .85em; }
  pre { background: #1e1e1e; color: #e0e0e0; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; color: inherit; padding: 0; }
  a { color: #b8860b; }
  hr { border: 0; border-top: 1px solid #e0e0e0; margin: 2rem 0; }
  ul, ol { padding-left: 1.5rem; }
  @media print {
    body { max-width: none; }
    h1, h2, h3 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head><body>${html}</body></html>`;

  return (
    <div className="min-h-screen" style={{ background: "#0c0c0e" }}>
      {/* Toolbar — hidden when printing */}
      <div
        className="sticky top-0 z-10 border-b print:hidden"
        style={{ background: "#16161a", borderColor: "#2a2a2e" }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center gap-3">
          <FileText className="w-5 h-5" style={{ color: "#b8860b" }} />
          <h1 className="text-lg font-semibold flex-1" style={{ color: "#e8e2d2" }}>
            QA Report
          </h1>
          <Button
            onClick={() => window.print()}
            disabled={loading}
            size="sm"
            className="gap-2"
            style={{ background: "#b8860b", color: "#1a1a1a" }}
          >
            <Printer className="w-4 h-4" />
            Print / PDF
          </Button>
          <Button
            onClick={() => downloadFile("QA-REPORT.html", buildStandaloneHtml(), "text/html")}
            disabled={loading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            HTML
          </Button>
          <Button
            onClick={() => downloadFile("QA-REPORT.md", md, "text/markdown")}
            disabled={loading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Markdown
          </Button>
        </div>
      </div>

      {/* Rendered report */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <p style={{ color: "#888" }}>Bezig met laden…</p>
        ) : (
          <article
            className="qa-report-html"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>

      {/* Print-friendly + content styles */}
      <style>{`
        .qa-report-html { color: #e8e2d2; line-height: 1.7; }
        .qa-report-html h1 { font-size: 2rem; border-bottom: 2px solid #b8860b; padding-bottom: .5rem; margin-bottom: 1rem; }
        .qa-report-html h2 { font-size: 1.4rem; margin-top: 2.5rem; color: #f0e6cc; }
        .qa-report-html h3 { font-size: 1.1rem; margin-top: 1.5rem; }
        .qa-report-html table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .9rem; }
        .qa-report-html th, .qa-report-html td { border: 1px solid #333; padding: .5rem .75rem; text-align: left; vertical-align: top; }
        .qa-report-html th { background: #1f1f23; font-weight: 600; color: #b8860b; }
        .qa-report-html tr:nth-child(even) td { background: #16161a; }
        .qa-report-html code { background: #1f1f23; padding: .15rem .35rem; border-radius: 3px; font-size: .85em; color: #f0c674; }
        .qa-report-html pre { background: #1e1e1e; padding: 1rem; border-radius: 6px; overflow-x: auto; }
        .qa-report-html pre code { background: transparent; padding: 0; }
        .qa-report-html a { color: #b8860b; }
        .qa-report-html hr { border: 0; border-top: 1px solid #2a2a2e; margin: 2rem 0; }
        .qa-report-html ul, .qa-report-html ol { padding-left: 1.5rem; }
        @media print {
          body { background: white !important; }
          .qa-report-html { color: #1a1a1a !important; }
          .qa-report-html th { background: #f7f4ec !important; color: #1a1a1a !important; }
          .qa-report-html tr:nth-child(even) td { background: #fafafa !important; }
          .qa-report-html td { background: white !important; color: #1a1a1a !important; border-color: #ddd !important; }
          .qa-report-html h1, .qa-report-html h2, .qa-report-html h3 { color: #1a1a1a !important; }
        }
      `}</style>
    </div>
  );
}
