import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — SMM Studio",
};

const UPDATED = "27 aprile 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8 text-sm leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-neutral-500">Aggiornata: {UPDATED}</p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Chi siamo</h2>
        <p>
          SMM Studio è uno strumento personale di gestione social per artisti e
          producer musicali italiani. L'applicazione è gestita dal singolo
          titolare dell'account proprietario del deploy. Per qualsiasi
          richiesta sulla privacy puoi scrivere all'email registrata come
          amministratore dell'app.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Quali dati raccogliamo</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Dati account</strong>: email, nome e foto profilo Google
            forniti durante il login OAuth.
          </li>
          <li>
            <strong>Token di accesso social</strong>: per ciascun account
            collegato (Instagram, Facebook, YouTube, TikTok, Spotify) memorizziamo
            un access token (e refresh token quando previsto) cifrato con
            algoritmo AES-256-GCM.
          </li>
          <li>
            <strong>Metriche pubbliche del tuo profilo</strong>: numero di
            follower, statistiche dei post, dati audience aggregati. Solo i dati
            cui tu hai dato accesso esplicitamente nel flusso OAuth.
          </li>
          <li>
            <strong>Contenuti generati</strong>: profili artista, suggerimenti,
            bozze di post, identità di brand, persone target, piani di campagna
            creati dall'utente o suggeriti dall'AI.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Come usiamo i dati</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Generare suggerimenti di contenuto e analisi neuromarketing tramite
            l'API di Anthropic Claude.
          </li>
          <li>
            Mostrare dashboard, grafici di crescita e calendario editoriale
            all'interno dell'applicazione.
          </li>
          <li>
            Sincronizzare le metriche dei tuoi profili social secondo lo schedule
            che hai impostato.
          </li>
        </ul>
        <p className="mt-2">
          Non rivendiamo né condividiamo i tuoi dati con terze parti per scopi
          di marketing.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Servizi terzi</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Vercel</strong> — hosting dell'applicazione.
          </li>
          <li>
            <strong>Neon</strong> — database PostgreSQL gestito dove sono
            persistiti i dati applicativi e i token cifrati.
          </li>
          <li>
            <strong>Anthropic</strong> — generazione di suggerimenti AI; le
            metriche aggregate del tuo profilo possono essere inviate come
            contesto. Anthropic non utilizza i dati API per addestrare i
            modelli.
          </li>
          <li>
            <strong>Google, Meta, TikTok, Spotify</strong> — fornitori OAuth e
            API dei tuoi profili social, soggetti alle rispettive privacy policy.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Conservazione e cancellazione</h2>
        <p>
          I dati vengono mantenuti finché l'account è attivo. Per richiedere la
          cancellazione completa dei tuoi dati basta scollegare gli account
          social dalla pagina Impostazioni e contattare l'amministratore. Sarà
          eliminato anche ogni token cifrato.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sicurezza</h2>
        <p>
          I token OAuth dei social sono cifrati a riposo. La connessione tra
          browser e server è sempre HTTPS. Le credenziali API non sono mai
          condivise lato client.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">I tuoi diritti (GDPR)</h2>
        <p>
          In quanto utente residente nell'Unione Europea hai il diritto di
          accedere, rettificare, cancellare i tuoi dati e opporti al loro
          trattamento. Le richieste vanno indirizzate all'amministratore dell'app.
        </p>
      </section>

      <footer className="border-t pt-4 text-xs text-neutral-500">
        <Link href="/" className="hover:underline">
          ← Torna all'app
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
