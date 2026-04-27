import Link from "next/link";

export const metadata = {
  title: "Terms of Service — SMM Studio",
};

const UPDATED = "27 aprile 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8 text-sm leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-neutral-500">Aggiornati: {UPDATED}</p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Accettazione dei Termini</h2>
        <p>
          Utilizzando SMM Studio (di seguito "il Servizio") accetti integralmente
          questi Termini. Se non li accetti, non utilizzare il Servizio.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Cosa fa il Servizio</h2>
        <p>
          SMM Studio è uno strumento di assistenza alla gestione social per
          artisti e producer musicali. Sincronizza in lettura le metriche dei
          profili social collegati e usa l'AI di Anthropic Claude per generare
          suggerimenti di contenuto, brief di branding e piani di campagna.
        </p>
        <p className="mt-2">
          Il Servizio <strong>non pubblica automaticamente</strong> contenuti
          sui tuoi profili. Sei tu, in piena autonomia e responsabilità, a
          decidere se e cosa pubblicare.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Account e accesso</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            L'accesso al Servizio è autorizzato solo per gli email indicati
            dall'amministratore.
          </li>
          <li>
            Sei responsabile della sicurezza delle tue credenziali Google e dei
            token social che concedi.
          </li>
          <li>
            Puoi scollegare in qualsiasi momento i tuoi profili social dalla
            pagina Impostazioni.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Uso accettabile</h2>
        <p>Ti impegni a:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Non utilizzare il Servizio per attività illecite o ingannevoli.</li>
          <li>
            Non tentare di aggirare le restrizioni di accesso, le quote API o
            le funzionalità di sicurezza.
          </li>
          <li>
            Non inserire nei contenuti generati materiale protetto da copyright
            di terzi senza autorizzazione.
          </li>
          <li>
            Rispettare i termini di servizio delle piattaforme collegate
            (Instagram, Facebook, YouTube, TikTok, Spotify).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Contenuti generati dall'AI</h2>
        <p>
          I suggerimenti, le caption, i brief di brand e i neuro-score forniti
          dal Servizio sono generati da modelli AI e possono contenere
          imprecisioni o riferimenti culturali datati. <strong>Sei tu il
          responsabile editoriale</strong> di ciò che pubblichi: rivedi sempre
          i contenuti prima di renderli pubblici.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Limitazioni di responsabilità</h2>
        <p>
          Il Servizio è fornito "così com'è", senza garanzie di disponibilità,
          accuratezza o adeguatezza a uno scopo specifico. L'amministratore
          non è responsabile per perdita di dati, downtime, modifiche alle API
          delle piattaforme social o decisioni di marketing prese sulla base dei
          suggerimenti AI.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Modifiche</h2>
        <p>
          Questi Termini possono essere aggiornati nel tempo. Le modifiche sono
          efficaci dalla data indicata in cima al documento.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Legge applicabile</h2>
        <p>
          Questi Termini sono regolati dalla legge italiana. Per qualsiasi
          controversia è competente il foro di residenza dell'amministratore.
        </p>
      </section>

      <footer className="border-t pt-4 text-xs text-neutral-500">
        <Link href="/" className="hover:underline">
          ← Torna all'app
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
