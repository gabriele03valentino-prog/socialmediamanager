import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveProject } from "@/lib/active-project";
import { WizardShell } from "@/components/onboarding/WizardShell";
import { StepKindPicker } from "@/components/onboarding/StepKindPicker";
import { StepIdentity } from "@/components/onboarding/StepIdentity";
import { StepSocialConnect } from "@/components/onboarding/StepSocialConnect";
import { StepGeneratePlan } from "@/components/onboarding/StepGeneratePlan";

export const dynamic = "force-dynamic";

interface SearchParams {
  step?: string;
}

function parseStep(raw: string | undefined): 1 | 2 | 3 | 4 {
  const n = Number(raw);
  if (n === 2 || n === 3 || n === 4) return n;
  return 1;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const step = parseStep(params.step);

  if (step === 1) {
    return (
      <WizardShell
        step={1}
        title="Che tipo di creator sei?"
        subtitle="Scegli la categoria che meglio descrive il tuo progetto. Influenza i suggerimenti che Claude genererà."
      >
        <StepKindPicker />
      </WizardShell>
    );
  }

  if (step === 2) {
    return (
      <WizardShell
        step={2}
        title="Identità del progetto"
        subtitle="Solo il nome è obbligatorio. Più dati = suggerimenti più mirati."
      >
        <StepIdentity />
      </WizardShell>
    );
  }

  // Step 3 + 4 richiedono progetto attivo
  const project = await getActiveProject();
  if (!project) redirect("/onboarding?step=1");

  if (step === 3) {
    const accounts = await prisma.socialAccount.findMany({
      where: { projectId: project.id },
      select: { platform: true },
    });
    const connected = accounts.map((a) => a.platform);
    return (
      <WizardShell
        step={3}
        title="Collega un social (opzionale)"
        subtitle="Più dati passi a Claude, più i suggerimenti saranno tarati sulle tue metriche reali."
      >
        <StepSocialConnect connected={connected} />
      </WizardShell>
    );
  }

  // Step 4
  return (
    <WizardShell
      step={4}
      title="Generazione primo piano settimanale"
      subtitle="Claude sta lavorando — questa pagina si aggiorna da sola."
    >
      <StepGeneratePlan />
    </WizardShell>
  );
}
