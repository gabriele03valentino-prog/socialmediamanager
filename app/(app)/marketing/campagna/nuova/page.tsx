import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/components/CampaignForm";
import { getActiveProject } from "@/lib/active-project";

export const dynamic = "force-dynamic";

export default async function NuovaCampagnaPage() {
  const project = await getActiveProject();
  if (!project) redirect("/onboarding");

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

      <CampaignForm />
    </div>
  );
}
