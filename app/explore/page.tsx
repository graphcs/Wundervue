import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// The feed lives at "/" now; keep /explore working by forwarding (query intact).
export default async function ExplorePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (v) qs.set(k, v);
  }
  // For-You used to be a view mode (?view=for-you); it's a feed tab now. Map old
  // links/bookmarks so they still land on For-You instead of falling back to All.
  if (qs.get("view") === "for-you") {
    qs.delete("view");
    qs.set("tab", "for-you");
  }
  const q = qs.toString();
  redirect(q ? `/?${q}` : "/");
}
