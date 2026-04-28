import Link from "next/link";
import { redirect } from "next/navigation";
import {
  type BrandIdentityData,
  BrandIdentityView,
} from "@/components/BrandIdentityView";
import { BrandIdentityGenerator } from "@/components/BrandIdentityGenerator";
import { CoverBriefGenerator } from "@/components/CoverBriefGenerator";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IdentitaPage() {
  const project = await getActiveProject();
  if (!project) redirect("/onboarding");

  const brand = await prisma.brandIdentity.findUnique({
    where: { projectId: project.id },
  });

  const hasIdentity = !!(brand && brand.palette);

  const identityData: BrandIdentityData | null = hasIdentity
    ? {
        palette: brand!.palette as unknown as BrandIdentityData["palette"],
        typography: brand!.typography as unknown as BrandIdentityData["typography"],
        toneOfVoice:
          brand!.toneOfVoice as unknown as BrandIdentityData["toneOfVoice"],
        moodKeywords: brand!.moodKeywords,
        logoBrief: brand!.logoBrief ?? "",
        logoSvg: brand!.logoSvg ?? "",
        claudeDesignPrompt: brand!.claudeDesignPrompt ?? "",
        mjPrompt: brand!.mjPrompt ?? "",
      }
    : null;

  const coverBriefs = Array.isArray(brand?.coverBriefs)
    ? (brand!.coverBriefs as unknown as Array<{
        title: string;
        brief: string;
        claudeDesignPrompt: string;
        mjPrompt: string;
        ideogramPrompt: string;
        createdAt?: string;
      }>)
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link href="/brand" className="text-sm text-brand-600 hover:underline">
          ← Brand
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">Identità visiva</h1>
        <p className="text-sm text-neutral-500">
          Palette, typography, mood e prompt pronti da incollare su
          <a
            href="https://claude.ai/design"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-brand-600 hover:underline"
          >
            claude.ai/design
          </a>{" "}
          (o Midjourney/Ideogram).
        </p>
      </header>

      <BrandIdentityGenerator hasExisting={hasIdentity} />

      {identityData ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <BrandIdentityView data={identityData} />
        </div>
      ) : null}

      {hasIdentity ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Cover release</h2>
          <p className="text-sm text-neutral-500">
            Per ogni singolo, EP o album genera un brief coerente con la
            brand identity. Il risultato include prompt pronti per Claude
            Design, Midjourney e Ideogram.
          </p>
          <CoverBriefGenerator existing={coverBriefs} />
        </section>
      ) : null}
    </div>
  );
}
