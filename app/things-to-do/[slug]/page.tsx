import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Filters } from "@/lib/types";
import { getLandingPage, getPublishedLandingSlugs } from "@/lib/data/landingPages.server";
import { getMergedListings } from "@/lib/data/listings.server";
import { applyFilters } from "@/lib/filters/applyFilters";
import { buildHref } from "@/lib/filters/buildHref";
import { buildShareUrl } from "@/lib/links";
import { ListingGrid } from "@/components/explore/ListingGrid";

// How many cards to embed before linking out to the full filtered feed.
const COLLECTION_CAP = 12;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return (await getPublishedLandingSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  if (!page) return {};
  const title = page.metaTitle ?? page.title;
  const description = page.metaDescription ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: `/things-to-do/${page.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/things-to-do/${page.slug}`,
      images: page.ogImage ? [page.ogImage] : undefined,
    },
  };
}

export default async function ThingsToDoPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  if (!page) notFound();

  // The page's validated config, forced to grid (the embed is a fixed grid + a
  // "See all" link, never the map/calendar toggle).
  const filters: Filters = { ...page.filterConfig, view: "grid" };
  const filtered = applyFilters(await getMergedListings(), filters);
  const items = filtered.slice(0, COLLECTION_CAP);
  const seeAllHref = buildHref({ filters });

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page.title,
    numberOfItems: items.length,
    itemListElement: items.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: buildShareUrl(l),
      name: l.title,
    })),
  };

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-7">
      {page.aboveHtml && (
        <div
          className="landing-content"
          /* Trusted, team-authored markup (raw HTML / custom code by design). */
          dangerouslySetInnerHTML={{ __html: page.aboveHtml }}
        />
      )}

      <section className="my-10">
        {items.length > 0 ? (
          <>
            <ListingGrid listings={items} />
            {filtered.length > items.length && (
              <div className="mt-6 text-center">
                <Link
                  href={seeAllHref}
                  className="text-coral inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                >
                  See all {filtered.length} →
                </Link>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray text-center text-sm">
            Nothing on the calendar right now — check back soon.
          </p>
        )}
      </section>

      {page.belowHtml && (
        <div className="landing-content" dangerouslySetInnerHTML={{ __html: page.belowHtml }} />
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
    </main>
  );
}
