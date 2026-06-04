"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useFollowedVenues } from "@/lib/hooks/useFollowedVenues";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ONBOARDING_INTERESTS } from "@/lib/data/categories";
import { ONBOARDING_NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { LIFESTYLE_OPTIONS } from "@/lib/data/lifestyleOptions";
import type { Listing, ListingType, ListingSource, LifestyleTag } from "@/lib/types";
import { ListingGrid } from "@/components/explore/ListingGrid";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Interests & Neighborhoods" },
  { id: "saved", label: "Saved" },
  { id: "following", label: "Following" },
  { id: "billing", label: "Billing" },
  { id: "notifications", label: "Notifications" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AccountPage() {
  const ctx = useAuthContext();
  const [tab, setTab] = useState<TabId>("profile");

  // Honor ?tab= on first load without needing a Suspense boundary.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((tab) => tab.id === t)) setTab(t as TabId);
  }, []);

  if (!ctx.hydrated) {
    return <div className="text-gray mx-auto max-w-[980px] px-7 py-20 text-center text-[14px]">Loading…</div>;
  }
  if (!ctx.isLoggedIn || !ctx.profile) {
    return (
      <div className="mx-auto max-w-[980px] px-7 py-24 text-center">
        <h1 className="text-dark text-[24px] font-medium">Your account</h1>
        <p className="text-gray mt-2 text-[14px]">Sign in to manage your profile, saves, and preferences.</p>
        <button
          type="button"
          onClick={() => ctx.openOnboarding(0)}
          className="bg-dark rounded-pill mt-5 px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
        >
          Sign in
        </button>
      </div>
    );
  }

  const profile = ctx.profile;
  const initialChar = profile.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="mx-auto max-w-[980px] px-5 py-8 sm:px-7">
      <header className="mb-6 flex items-center gap-4">
        <div className="bg-coral flex h-14 w-14 items-center justify-center rounded-full text-lg font-medium text-white">
          {initialChar}
        </div>
        <div className="min-w-0">
          <h1 className="text-dark text-[22px] font-medium leading-tight">{profile.name || "Your account"}</h1>
          <p className="text-gray truncate text-[13px]">{profile.email}</p>
        </div>
        {profile.plan === "insider" && (
          <span className="bg-coral ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Insider
          </span>
        )}
      </header>

      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="md:w-[220px] md:shrink-0">
          <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-[13px] font-medium transition-colors ${
                  tab === t.id ? "bg-dark text-white" : "text-graphite hover:bg-tag-bg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {tab === "profile" && <ProfileTab />}
          {tab === "preferences" && <PreferencesTab />}
          {tab === "saved" && <SavedTab />}
          {tab === "following" && <FollowingTab />}
          {tab === "billing" && <BillingTab />}
          {tab === "notifications" && <NotificationsTab />}
        </div>
      </div>
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="border-border mb-5 rounded-xl border bg-white p-5">
      <h2 className="text-dark text-[15px] font-semibold">{title}</h2>
      {desc && <p className="text-gray mt-0.5 text-[13px]">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileTab() {
  const { profile, updateProfile, resetPassword, signOut } = useAuthContext();
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);

  if (!profile) return null;

  const dirty = name !== profile.name || email !== profile.email;

  return (
    <>
      {banner && <div className="bg-coral/10 text-coral mb-4 rounded-lg px-4 py-2 text-[13px] font-medium">{banner}</div>}
      <Card title="Profile details">
        <div className="flex max-w-[420px] flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-dark text-[12px] font-medium">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="border-border focus:border-dark rounded-lg border px-3 py-2 text-sm focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-dark text-[12px] font-medium">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-border focus:border-dark rounded-lg border px-3 py-2 text-sm focus:outline-none" />
          </label>
          <button
            type="button"
            disabled={!dirty || !name || !email}
            onClick={async () => {
              await updateProfile({ name, email });
              setBanner("Profile updated.");
              setTimeout(() => setBanner(null), 1800);
            }}
            className="bg-dark rounded-pill self-start px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save changes
          </button>
        </div>
      </Card>

      <Card title="Password" desc="We'll email you a secure link to set a new password.">
        <button
          type="button"
          onClick={async () => {
            setBanner(null);
            try {
              await resetPassword(profile.email);
              setBanner(`Password reset link sent to ${profile.email}. Check your inbox.`);
            } catch (err) {
              setBanner(
                `Couldn't send reset email: ${err instanceof Error ? err.message : "unknown error"}`,
              );
            }
            setTimeout(() => setBanner(null), 4000);
          }}
          className="border-dark text-dark rounded-pill border-[1.5px] px-5 py-2 text-[13px] font-medium hover:bg-dark hover:text-white"
        >
          Send reset email
        </button>
      </Card>

      <Card title="Danger zone" desc="Sign out everywhere and clear your local session.">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Sign out of Wundervue on this device?")) void signOut();
          }}
          className="border-coral text-coral hover:bg-coral rounded-pill border-[1.5px] px-5 py-2 text-[13px] font-medium hover:text-white"
        >
          Sign out
        </button>
      </Card>
    </>
  );
}

function PreferencesTab() {
  const { profile, updateProfile } = useAuthContext();
  if (!profile) return null;

  const toggle = <T extends string>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <>
      <Card title="Interests" desc="We use these for your personalized recommendations.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ONBOARDING_INTERESTS.map((opt) => {
            const active = profile.interests.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateProfile({ interests: toggle(profile.interests, opt.id) })}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition-colors ${active ? "border-dark bg-[#f9f9f9]" : "border-border hover:border-dark"}`}
              >
                <span className="text-base leading-none">{opt.icon}</span>
                <span className="text-dark flex-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Neighborhoods" desc="Areas of Denver you want to explore.">
        <div className="flex flex-wrap gap-1.5">
          {ONBOARDING_NEIGHBORHOODS.map((n) => {
            const active = profile.neighborhoods.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => updateProfile({ neighborhoods: toggle(profile.neighborhoods, n) })}
                className={`rounded-pill border-[1.5px] px-3.5 py-1 text-[12px] font-medium transition-colors ${active ? "border-dark bg-dark text-white" : "border-border text-graphite hover:border-dark"}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Lifestyle">
        <div className="flex flex-col gap-1.5">
          {LIFESTYLE_OPTIONS.map((opt) => {
            const active = profile.lifestyle.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateProfile({ lifestyle: toggle(profile.lifestyle, opt.id) })}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-dark bg-[#f9f9f9]" : "border-border hover:border-dark"}`}
              >
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-[1.5px] ${active ? "border-dark bg-dark" : "border-[#ccc] bg-white"}`}>
                  {active && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </span>
                <div className="flex-1 leading-tight">
                  <div className="text-dark text-[13px] font-medium">{opt.label}</div>
                  <div className="text-gray text-[11px]">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}

const LISTING_COLUMNS =
  "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags";

function rowToListing(r: Record<string, unknown>): Listing {
  return {
    id: r.id as string, slug: r.slug as string, type: r.type as ListingType, title: r.title as string,
    description: (r.description as string) ?? "", venueId: (r.venue_id as string) ?? "", venueName: "",
    address: (r.address as string) ?? "", neighborhood: (r.neighborhood as string) ?? "", category: (r.category as string) ?? "",
    startAt: (r.date_start as string) ?? "", endAt: (r.date_end as string) ?? null, dateDisplay: (r.date_display as string) ?? "",
    timeDisplay: (r.time_display as string) ?? "", isFree: Boolean(r.is_free), dealValue: (r.deal_value as string) ?? undefined,
    imageUrl: (r.image_url as string) ?? "", source: r.source as ListingSource, sourceUrl: (r.source_url as string) ?? undefined,
    tags: ((r.tags as string[]) ?? []) as LifestyleTag[], lat: null, lng: null,
  };
}

function SavedTab() {
  const { favorites } = useFavorites();
  const { openSavedEvents } = useAuthContext();
  const [saved, setSaved] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const ids = Array.from(favorites);
  const key = ids.slice().sort().join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setSaved([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sb = getSupabaseBrowserClient();
      const { data } = await sb.from("listings").select(LISTING_COLUMNS).in("id", ids);
      if (cancelled) return;
      setSaved(((data ?? []) as Array<Record<string, unknown>>).map((r) => rowToListing(r)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <Card title="Saved events & deals" desc="Organize saves into folders and share them.">
      <div className="mb-4">
        <button type="button" onClick={openSavedEvents} className="bg-dark rounded-pill px-5 py-2 text-[13px] font-medium text-white hover:opacity-90">
          Manage saves & folders
        </button>
      </div>
      {loading ? (
        <p className="text-gray text-[13px]">Loading…</p>
      ) : saved.length === 0 ? (
        <p className="text-gray text-[13px]">
          Nothing saved yet. <Link href="/explore" className="text-coral font-medium hover:underline">Browse events</Link>.
        </p>
      ) : (
        <ListingGrid listings={saved} />
      )}
    </Card>
  );
}

interface FollowedVenueRow {
  id: string; slug: string; name: string; description: string; address: string; neighborhood: string; upcomingCount: number;
}

function FollowingTab() {
  const { followed } = useFollowedVenues();
  const [venues, setVenues] = useState<FollowedVenueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const slugs = Array.from(followed);
  const key = slugs.slice().sort().join(",");

  useEffect(() => {
    if (slugs.length === 0) {
      setVenues([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sb = getSupabaseBrowserClient();
      const { data: vRows } = await sb.from("venues").select("id, slug, name, description, address, neighborhood").in("slug", slugs);
      const rows = (vRows ?? []) as Array<Omit<FollowedVenueRow, "upcomingCount">>;
      const ids = rows.map((v) => v.id);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const counts = new Map<string, number>();
      if (ids.length) {
        const { data: lRows } = await sb.from("listings").select("venue_id").in("venue_id", ids).not("published_at", "is", null).gte("date_start", today.toISOString());
        for (const r of (lRows ?? []) as Array<{ venue_id: string }>) counts.set(r.venue_id, (counts.get(r.venue_id) ?? 0) + 1);
      }
      if (cancelled) return;
      setVenues(rows.map((v) => ({ ...v, upcomingCount: counts.get(v.id) ?? 0 })).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <Card title="Followed venues" desc="Places you follow to keep up with their events.">
      {loading ? (
        <p className="text-gray text-[13px]">Loading…</p>
      ) : venues.length === 0 ? (
        <p className="text-gray text-[13px]">
          Not following any venues yet. <Link href="/venues" className="text-coral font-medium hover:underline">Explore venues</Link>.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {venues.map((v) => (
            <li key={v.slug} className="flex items-center justify-between gap-4 py-3">
              <Link href={`/venues/${v.slug}`} className="min-w-0 flex-1">
                <h3 className="text-dark text-[14px] font-medium">{v.name}</h3>
                <p className="text-gray truncate text-[12px]">{v.neighborhood || v.address}</p>
              </Link>
              <span className="text-coral shrink-0 text-[12px] font-medium">{v.upcomingCount} upcoming</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BillingTab() {
  const { profile, openUpgrade, openManageSub, subscription } = useAuthContext();
  if (!profile) return null;
  const insider = profile.plan === "insider";
  return (
    <Card title="Subscription">
      <div className={`rounded-xl border-2 p-4 ${insider ? "border-coral" : "border-border"}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-dark text-[15px] font-medium">{insider ? "Wundervue Insider" : "Wundervue Explorer"}</div>
            <div className="text-gray mt-0.5 text-[13px]">{insider ? "$4.99 / month" : "Free forever"}</div>
            {subscription?.currentPeriodEnd && insider && (
              <div className="text-gray mt-1 text-[12px]">
                {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </div>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${insider ? "bg-coral text-white" : "bg-tag-bg text-graphite"}`}>
            {insider ? "Active" : "Free"}
          </span>
        </div>
        <div className="mt-4">
          {insider ? (
            <button type="button" onClick={openManageSub} className="border-dark text-dark rounded-pill border-[1.5px] px-5 py-2 text-[13px] font-medium hover:bg-dark hover:text-white">
              Manage subscription
            </button>
          ) : (
            <button type="button" onClick={openUpgrade} className="bg-coral rounded-pill px-5 py-2 text-[13px] font-medium text-white hover:opacity-90">
              Upgrade to Insider
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

const NOTIF_KEY = "wv.notifPrefs";
function NotificationsTab() {
  const [prefs, setPrefs] = useState({ email: true, deals: true, reminders: false });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) setPrefs({ ...prefs, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const rows: Array<{ k: keyof typeof prefs; label: string; desc: string }> = [
    { k: "email", label: "Email updates", desc: "Weekly recommendations tailored to you" },
    { k: "deals", label: "Deal alerts", desc: "New deals in your neighborhoods" },
    { k: "reminders", label: "Event reminders", desc: "A ping the day of your saved events" },
  ];
  return (
    <Card title="Notifications" desc="Choose what you'd like to hear about. Delivery is rolling out soon.">
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.k} className="border-border flex items-center justify-between gap-4 border-b py-3 last:border-0">
            <div>
              <div className="text-dark text-[13px] font-medium">{r.label}</div>
              <div className="text-gray text-[12px]">{r.desc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[r.k]}
              onClick={() => set({ [r.k]: !prefs[r.k] })}
              className={`relative h-6 w-[42px] shrink-0 rounded-full transition-colors ${prefs[r.k] ? "bg-coral" : "bg-[#d5d5d5]"}`}
            >
              <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all" style={{ left: prefs[r.k] ? 21 : 3 }} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
