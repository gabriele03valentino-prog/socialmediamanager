import Link from "next/link";
import { auth } from "@/auth";
import { CampaignForm } from "@/components/CampaignForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NuovaCampagnaPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/marketing" className="text-sm text-brand-600 hover:underline">
          ← Marketing
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">Nuova campagna release</h1>
        <p className="text-sm text-neutral-500">
          Claude costruisce un piano editoriale di 5-15 tappe distribuito nei giorni
          prima e dopo il drop, coerente con le persona e ottimizzato sui principi
          brain-predictive di TRIBE v2.
        </p>
      </header>

      {!profile ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          Prima compila il{" "}
          <Link
            href="/impostazioni/profilo"
            className="underline hover:no-underline"
          >
            profilo artista
          </Link>
          .
        </div>
      ) : (
        <CampaignForm />
      )}
    </div>
  );
}
