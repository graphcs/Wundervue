"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuthContext } from "@/components/auth/AuthProvider";

type Status = "joining" | "signin" | "upgrade" | "error";

// Edit-link landing: an Insider who opens it joins the folder as a collaborator
// and is redirected into it. Guests/free see a sign-in / upgrade prompt.
export default function JoinFolderPage() {
  const params = useParams<{ share_slug: string }>();
  const slug = params.share_slug;
  const router = useRouter();
  const { openUpgrade, openOnboarding, isLoggedIn } = useAuthContext();
  const [status, setStatus] = useState<Status>("joining");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/folders/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareSlug: slug }),
        });
        if (cancelled) return;
        if (res.ok) {
          router.replace(`/folders/${slug}`);
          return;
        }
        if (res.status === 401) setStatus("signin");
        else if (res.status === 403) setStatus("upgrade");
        else setStatus("error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 sm:px-7 py-20 text-center">
      {status === "joining" && <p className="text-gray text-[15px]">Joining this collection…</p>}

      {status === "signin" && (
        <>
          <h1 className="text-dark text-[20px] font-medium">Sign in to collaborate</h1>
          <p className="text-gray mt-1.5 text-[14px]">You&apos;ve been invited to edit this collection. Sign in to continue.</p>
          <button
            type="button"
            onClick={() => openOnboarding(0)}
            className="bg-dark rounded-pill mt-5 px-6 py-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            Sign in
          </button>
        </>
      )}

      {status === "upgrade" && (
        <>
          <h1 className="text-dark text-[20px] font-medium">Collaboration is an Insider feature</h1>
          <p className="text-gray mt-1.5 text-[14px]">
            Upgrade to Insider to edit shared collections. You can still view this one.
          </p>
          <div className="mt-5 flex gap-3">
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => openUpgrade()}
                className="bg-dark rounded-pill px-6 py-3 text-[13px] font-medium text-white hover:opacity-90"
              >
                Upgrade to Insider
              </button>
            )}
            <Link
              href={`/folders/${slug}`}
              className="border-border rounded-pill border px-6 py-3 text-[13px] font-medium hover:bg-tag-bg"
            >
              View collection
            </Link>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-dark text-[20px] font-medium">That link didn&apos;t work</h1>
          <p className="text-gray mt-1.5 text-[14px]">The collection may have been removed or the link is invalid.</p>
          <Link
            href="/explore"
            className="bg-dark rounded-pill mt-5 px-6 py-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            Explore Wundervue
          </Link>
        </>
      )}
    </div>
  );
}
