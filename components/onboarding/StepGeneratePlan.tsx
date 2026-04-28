"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export function StepGeneratePlan() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setStatus("loading");

    fetch("/api/suggestions/generate", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setCount(data?.count ?? 0);
        setStatus("success");
        const t = setTimeout(() => router.push("/suggerimenti"), 2000);
        return () => clearTimeout(t);
      })
      .catch((err) => {
        setErrorMessage(err.message ?? "Errore sconosciuto");
        setStatus("error");
      });
  }, [router]);

  return (
    <div className="space-y-6 py-6 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-600" />
          <div>
            <h2 className="text-lg font-semibold">Claude sta generando il tuo primo piano…</h2>
            <p className="mt-1 text-sm text-gray-600">
              Analizzo nicchia, kind e (se hai connesso) le tue metriche. Ci vogliono ~10 secondi.
            </p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <div>
            <h2 className="text-lg font-semibold">Piano pronto!</h2>
            <p className="mt-1 text-sm text-gray-600">
              {count > 0 ? `${count} suggerimenti generati. ` : ""}
              Ti porto a /suggerimenti…
            </p>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-600" />
          <div>
            <h2 className="text-lg font-semibold">Generazione fallita</h2>
            <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>
            <p className="mt-2 text-xs text-gray-500">
              Probabili cause: ANTHROPIC_API_KEY mancante, rate limit raggiunto, errore di rete.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  started.current = false;
                  setStatus("idle");
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm"
              >
                Riprova
              </button>
              <a
                href="/suggerimenti"
                className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white"
              >
                Vai a Suggerimenti
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
