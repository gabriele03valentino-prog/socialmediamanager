import { signOut } from "@/auth";

export function UserMenu({
  name,
  email,
  image,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="mt-auto space-y-2">
      <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name ?? "user"}
            className="h-7 w-7 rounded-full"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{name ?? "Utente"}</div>
          <div className="truncate text-[10px] text-neutral-500">{email ?? ""}</div>
        </div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-md px-3 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Esci
        </button>
      </form>
      <div className="px-2 text-[10px] text-neutral-400">
        v0.1 · made for italian artists
      </div>
    </div>
  );
}
