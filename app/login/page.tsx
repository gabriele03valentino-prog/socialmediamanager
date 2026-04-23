import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo = "/" } = await searchParams;

  async function doSignIn(formData: FormData) {
    "use server";
    const rt = formData.get("redirectTo")?.toString() || "/";
    await signIn("google", { redirectTo: rt });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="mb-1 text-xl font-semibold">SMM Studio</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Accedi per usare il tuo social media manager.
        </p>
        <form action={doSignIn}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
          >
            Continua con Google
          </button>
        </form>
      </div>
    </div>
  );
}
