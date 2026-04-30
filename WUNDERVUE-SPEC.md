# Wundervue — Development Spec

Denver events & deals discovery platform. "Upside app but for local businesses."

**Live site (WordPress, editorial only):** wundervue.com
**Prototype reference:** `wundervue-explore.jsx` (open in browser for interactive preview of all features)

---

## Tech Stack

- **Frontend:** Next.js (App Router) deployed on Vercel
- **Backend/DB:** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Payments:** Stripe (subscription billing)
- **Maps:** Google Maps API or Mapbox
- **CMS:** WordPress stays for editorial content (phase 1); headless migration later
- **Font:** Omnes (custom, .woff files provided — weights: 300, 400, 500, 700, 900 + italics)

---

## Brand / Design Tokens

```
--coral:       #ff535b    /* primary brand, CTAs, badges, active states */
--dark:        #121821    /* primary text, buttons, dark UI */
--graphite:    #4d4e4f    /* secondary text */
--gray:        #86898a    /* muted text, placeholders, icons */
--chrome:      #bdc1c3    /* placeholder text */
--bg:          #fffdf7    /* page background */
--tag-bg:      #f0f0f0    /* pill tags, card backgrounds */
--border:      #e0e0e0    /* input borders, dividers */
--free-badge:  #0e7a9a    /* free event badge */
--trending-gradient: linear-gradient(90deg, #82FFC5, #94F6FF)
```

**Typography:** Omnes family. Logo = Black Italic (900). Nav = Bold (700) 11px uppercase. Filter pills = Bold (700) 12px. Body/titles = Medium (500). Fallback: `'Omnes', -apple-system, sans-serif`.

**Buttons:** Dark rounded pills (`#121821`), border-radius 50px. Outline variant: 1.5px solid border. No teal/green on interactive elements.

---

## Data Model (Supabase)

### `listings`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| type | enum | `event` / `deal` / `both` |
| title | text | |
| description | text | |
| venue_id | uuid FK | → venues.id |
| address | text | Full address |
| neighborhood | text | RiNo, LoHi, Highlands, Cherry Creek, Downtown, Baker, Capitol Hill, Golden, Wash Park |
| category | text | Music, Food & Drink, Outdoor, Arts & Culture, Markets, Sports, Comedy, Wellness |
| date_start | timestamp | |
| date_end | timestamp? | Nullable |
| date_display | text | Human-readable, e.g. "Every Friday" |
| time_display | text | Human-readable, e.g. "8:00 PM" |
| is_free | boolean | |
| deal_value | text? | e.g. "BOGO", "20% Off" |
| image_url | text | |
| source | text | Instagram, Website, Meetup |
| source_url | text | Link to original post |
| tags | text[] | `date-night`, `dog-friendly`, `family`, `outdoor` |
| lat | float | |
| lng | float | |
| created_at | timestamp | |

### `venues`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| name | text | |
| description | text | Short venue description |
| address | text | |
| neighborhood | text | |
| image_url | text? | |
| lat | float | |
| lng | float | |

### `profiles` (extends Supabase Auth)
| Field | Type | Notes |
|-------|------|-------|
| user_id | uuid FK | → auth.users.id |
| name | text | |
| plan | enum | `free` / `insider` |
| interests | text[] | Selected categories |
| neighborhoods | text[] | Selected neighborhoods |
| lifestyle | text[] | `kids`, `dog`, `couple`, `foodie`, `new` |
| created_at | timestamp | |

### `favorites`
| Field | Type | Notes |
|-------|------|-------|
| user_id | uuid FK | |
| listing_id | uuid FK | |
| created_at | timestamp | |

Free tier: enforce max 5 favorites via RLS policy or application logic. Show upgrade prompt when limit hit.

### `followed_venues`
| Field | Type | Notes |
|-------|------|-------|
| user_id | uuid FK | |
| venue_id | uuid FK | |
| created_at | timestamp | |

### `subscriptions`
| Field | Type | Notes |
|-------|------|-------|
| user_id | uuid FK | |
| stripe_customer_id | text | |
| stripe_subscription_id | text | |
| status | text | active, canceled, past_due |
| current_period_end | timestamp | |

---

## Data Ingestion (where events come from)

Events are not user-submitted in MVP — they're scraped from third-party sources, normalized via LLM, deduplicated, and persisted to `listings`. Each row's `source` / `source_url` columns attribute back to the origin so users can click through to book/RSVP.

Source configs live in `lib/ingest/sources.ts`; the orchestrator (`lib/ingest/orchestrator.ts`) dispatches to one of four connectors based on the source's `connector` field.

### Connectors

| Connector | What it pulls from | Use case |
|-----------|-------------------|----------|
| `serpEvents` | **SerpAPI's Google Events engine** — i.e. the structured event cards Google surfaces for queries like "events in Denver this weekend". This is online search, not a direct site scrape. | Broad, multi-category, multi-venue coverage. Cheap (~$0.01/query), so daily/weekly cadence. The bulk of the catalog. |
| `instagram` | **Apify's `apify/instagram-scraper` actor** — fetches recent posts from a specific IG handle. | Per-venue deep dives for places we follow closely (e.g. Mission Ballroom) where Google Events misses announcements. |
| `apifyWeb` | **Apify's `apify/cheerio-scraper` actor** — runs a configurable `pageFunction` against a start URL on Apify's infrastructure. | JS-light niche sites Google Events doesn't index, when we want Apify to handle the crawl/proxy. |
| `cheerioWeb` | **Direct in-process fetch + Cheerio parse** of a single URL using configured CSS selectors. Sets `User-Agent: WundervueBot/1.0 (+https://wundervue.com)`. | Simple static HTML pages where we don't need Apify's overhead. |

**Not used:** no direct ticketing-platform APIs (Eventbrite/Ticketmaster/Meetup), no Facebook events, no headless browser. JS-heavy sites are deferred to Apify if needed.

### The `source` field on listings

The `source` column stores the human-readable label from `SourceConfig.sourceLabel` (currently `"Website"` for all SerpAPI-derived rows, `"Instagram"` for IG-derived rows). `source_url` stores the click-through link from the upstream item (e.g. the Google Events `link`, or the Instagram post permalink).

### Pipeline stages

1. **Fetch** — connector returns `RawItem[]`.
2. **URL liveness check** — drop items whose `sourceUrl` is 404/410/DNS-dead before paying for an LLM call.
3. **Normalize** — LLM extracts structured fields (title, dates, venue, category, etc.).
4. **Image resolution** — `lib/ingest/imagePipeline.ts` picks an image per row in this order: existing Storage URL → og:image scraped from `sourceUrl` → connector-provided thumbnail → AI-generated (Flux 2 Pro). og:image is intentionally tried *before* the connector thumbnail because publishers tune Open Graph tags for full-resolution social cards, while connector thumbnails (especially SerpAPI's gstatic CDN) are downscaled to ~300–500px. Probe failures fall through to the next option; the row is only dropped if AI generation itself fails (auth error, API outage, malformed response).
5. **Dedup** — deterministic hash-based upsert, then an LLM fuzzy-cluster pass to catch paraphrased duplicates across sources.
6. **Persist** — upsert into `listings`; record run stats. Three consecutive failures auto-disable a source.

### Operational queries

- `listings_dedup_rate_daily` view — per-source per-UTC-day `seen` / `duplicates` / `dup_rate`. Watch for sudden jumps (>30% above baseline) per source — the most common cause is a connector regressing into emitting unstable `source_id`s, which the fuzzy clusterer would otherwise mask. Migration: `supabase/migrations/20260430000000_listings_dedup_rate_view.sql`.

### Deployment requirements

- **Vercel Pro plan required.** `app/api/ingest/run`, `run-tier`, and `app/api/maintenance` all set `export const maxDuration = 300`. Hobby plan caps Node functions at 60s — deploying there would clamp `maxDuration` and leave runs truncated mid-batch. If Hobby is the target, drop `maxDuration` to 60 and reduce `URL_CHECK_CONCURRENCY` / `IMAGE_PIPELINE_CONCURRENCY` in `orchestrator.ts` so a single source fits inside the new cap. The 1h `STALE_RUNNING_MS` floor in `lib/ingest/persist.ts` is conservative enough for any cap below 1h and doesn't need adjusting.

---

## URL Structure (SEO-critical)

Filtered views MUST generate crawlable, indexable URLs. This is a core growth strategy — ranking for queries like "things to do in RiNo this weekend."

```
/explore                          → main discovery page
/explore/rino                     → filtered by neighborhood
/explore/food-drink               → filtered by category
/explore/rino/food-drink          → combined
/explore?date=this-weekend&free=true → query params for date/lifestyle
/events/[slug]                    → individual event (SSR)
/deals/[slug]                     → individual deal (SSR)
/venues/[slug]                    → venue profile (SSR)
```

Each page needs unique `<title>`, `<meta description>`, and Open Graph tags. Use `generateStaticParams` for neighborhood/category combos, dynamic SSR for individual pages.

---

## Page: Global Header

Three layers, present on all pages:

1. **Trending bar:** full-width gradient (#82FFC5 → #94F6FF), "TRENDING" label left, social icons right
2. **Logo bar:** centered Wundervue logo (transparent PNG on #fffdf7 bg)
3. **Nav bar:** centered links (Best Of, Lifestyle, Monthly Guides, Spotlights, About) + profile icon absolute-right

**Profile icon behavior:**
- Logged out → outline person SVG in 34px circle with border → click opens onboarding modal
- Logged in → coral filled circle with user initial → click opens profile dropdown menu

---

## Page: Explore (Discovery)

### Discovery Bar
Sticky below header. Flex-wrap layout (NOT horizontal scroll). Contains:

- Search input + dark "Search" button
- Type toggles: All / Events / Deals / Events+Deals (pill buttons)
- Date Range dropdown: presets (Today, This Weekend, This Week, This Month, Next Month) + "Custom Range" with From/To date pickers inline
- Neighborhood: multi-select dropdown with checkboxes
- Category: multi-select dropdown with checkboxes
- Lifestyle pills: Dog-Friendly, Family, Date Night, Outdoor (toggle on/off)
- Free Only: toggle pill
- Grid / Map: segmented control

### Grid View (default)
3-column card grid. Each card:
- Gradient image (170px, real images in prod)
- Type badge top-left (EVENT coral bg / DEAL dark bg / EVENT + DEAL)
- Free badge top-left below type badge (#0E7A9A)
- SVG heart favorite top-right (outline = not saved, filled = saved)
- Neighborhood + Category pill tags
- Title (16px Medium 500)
- Description (13px gray, 2-line clamp via `-webkit-line-clamp: 2`)
- Calendar icon + date | deal value tag OR "via [source]" attribution

**No venue name on cards.** Venue appears in detail panel only.

### Map View
Split layout:
- Left sidebar (380px): scrollable compact listing cards
- Right: sticky Google Map with color-coded SVG pins (calendar = event, percent = deal, star = both)

### Detail Panel (slide-out)
440px from right. Contains:
- Hero image (240px) with type badge, free badge, close ✕ button
- Tags row (neighborhood, category, deal value)
- Title
- Description
- **Venue block:** venue name (clickable, coral, house icon) → address (pin icon) → "Get Directions" link (compass icon, opens Google Maps in new tab: `https://www.google.com/maps/dir/?api=1&destination={encoded_address}`)
- Date/Time/Venue info box (gray bg, rounded)
- Favorite + Share buttons (side by side, dark pill outline)
- Save to Google Calendar button (full width, calendar icon, opens `https://calendar.google.com/calendar/render?action=TEMPLATE&text={title}&details={desc}&location={addr}`)
- "View Full Page →" link
- Source attribution link ("View original post on [source] ↗")

### Full Page View
Detail panel expands to 100% width:
- "← Back to results" top bar
- Content centered at max-width 720px
- Larger hero (360px)
- All detail panel content
- "More from [Venue]" section: horizontal scroll of related events from same venue
- **SEO:** must be a real URL (`/events/[slug]`) rendered with SSR

### Venue Profile
When venue name is clicked anywhere, results filter to that venue. Profile header appears above grid:
- Venue name (22px Medium)
- Event count + neighborhood
- Description paragraph
- Address with pin icon
- "Get Directions" link (coral)
- Follow / Following toggle button (+ icon → checkmark when following)
- ✕ close button to clear filter

---

## Auth & Onboarding Flow

Modal overlay on the website (backdrop blur, centered, 520px max-width). ✕ close button on all steps.

### Create Account (step 0)
- "Continue with Google" button (Google logo SVG)
- "or" divider
- Full Name, Email, Password fields (password min 6 chars)
- Continue button (disabled until valid)
- "Already have an account? Log in" → switches to login step

### Log In (step -1)
- "Log in with Google" button
- "or" divider
- Email, Password fields
- "Forgot password?" link (right-aligned, coral)
- Log In button (disabled until email + password >= 6)
- "Don't have an account? Sign up" → back to step 0

### Choose Plan (step 1)
Two cards **side by side** in the 520px modal (compact sizing):

**Explorer (Free):** $0/forever. Browse all, basic filters, 5 favorites, share.

**Insider ($4.99/mo):** POPULAR badge. Everything free plus: personalized recommendations, unlimited saves & calendar sync, advanced lifestyle filters, exclusive deals (coming soon).

Free path: step 0 → step 1 → confirmation (step 6).
Insider path: step 0 → step 1 → payment → interests → neighborhoods → lifestyle → confirmation.

### Payment (step 2, Insider only)
- Plan summary (Wundervue Insider, $4.99/mo)
- Card Number, Expiry, CVC, Name on Card
- "Subscribe — $4.99/month" button
- Integrate Stripe Elements here

### Interests (step 3, Insider only)
2-column grid, 12 categories with emoji + checkbox. Min 3 required. "Skip this step" link at bottom.
Categories: Concerts & Live Music, Food & Drink, Outdoor & Nature, Arts & Culture, Nightlife & Bars, Sports & Fitness, Comedy & Shows, Markets & Pop-Ups, Wellness & Yoga, Family & Kids, Dog-Friendly, Free Events.

### Neighborhoods (step 4, Insider only)
Pill toggle buttons for 12 neighborhoods. Min 1 required. "Skip this step" link.
RiNo, LoHi, Highlands, Cherry Creek, Downtown, Capitol Hill, Baker, Wash Park, Golden, South Broadway, City Park, Sloan's Lake.

### Lifestyle (step 5, Insider only)
Checkbox list with descriptions. "Skip for now" link.
- I have kids → family-friendly events
- I have a dog → dog-friendly spots
- Looking for date ideas → date night events
- I'm a foodie → restaurant deals & food events
- I'm new to Denver → help exploring the city

### Confirmation (step 6)
Checkmark icon, welcome message (varies by plan), "Start Exploring Denver" button closes modal and sets logged-in state.

---

## User Account

### Profile Dropdown Menu
Opens from coral initial circle. Items (all SVG icons):
- User info: name, email, INSIDER badge if applicable
- Saved Events (filled heart icon, count) → opens panel
- Saved Venues (house icon, count) → opens panel
- Account Settings (gear icon) → opens panel
- Upgrade to Insider / Manage Subscription (credit card icon) → opens modal
- Log Out (arrow icon, **gray color** — not highlighted)

### Saved Events Panel
Slide-in from right, 520px. Sticky header with title + count.
- Horizontal cards: 100×80 thumbnail with type badge, tags, title, date, venue, deal value
- Coral filled heart on each card → click to unfavorite (real-time removal)
- Empty state: heart icon, "No saved events yet", "Browse Events" button
- Click card → opens detail panel

### Saved Venues Panel
Slide-in from right, 520px. Sticky header with title + count.
- Venue cards: name, description (2-line clamp), address, active event count (coral)
- ✕ button to unfollow
- Empty state: house icon, "No saved venues yet", "Browse Events" button
- Click card → navigates to venue filtered view

### Account Settings Panel
Slide-in from right, 480px. Sections:

**Profile:** avatar (56px coral circle with initial), name + email fields, Save Changes button
**Subscription:** current plan card with status badge, Upgrade button if free (opens upgrade modal)
**Password:** current + new password fields, Update Password button
**Notifications:** toggle switches (coral) for Email updates, Deal alerts, Event reminders — each with title + description
**Danger Zone:** Delete Account button (coral outline)

### Upgrade to Insider Modal
Centered, 440px max. Coral gradient hero (#FF535B → #FF8A6B), sparkle icon, title, subtitle. Price ($4.99/mo centered). 6 feature rows with coral checkmarks (title + description each). CTA: "Start Insider — $4.99/month" → opens payment step in onboarding. "Cancel anytime" note.

### Manage Subscription Modal
Centered, 440px max. For existing Insiders:
- Active plan card (coral border): name, ACTIVE badge, $4.99/mo, next billing date, payment method (masked), member since
- Benefits checklist (coral checks)
- Payment method card with "Update" link
- Cancel Subscription button (gray outline), "benefits continue until end of billing period" note
- Cancel sets plan to free

---

## Free vs Paid Tier Logic

### Free (Explorer)
- Browse all events & deals
- Basic filters (type, date, neighborhood, category)
- Favorite up to 5 items → show upgrade prompt at limit
- Share with friends
- Save to Google Calendar

### Paid (Insider — $4.99/month via Stripe)
- All free features
- Lifestyle filters (dog-friendly, family, date night, outdoor)
- Personalized daily recommendations (based on interests/neighborhoods/lifestyle prefs)
- Unlimited favorites
- Early access notifications
- Exclusive deals (coming soon, post-launch)

**Launch plan:** Build full premium features. Launch free-only for 3–6 months while securing exclusive deals from local businesses. Then activate subscriptions.

---

## Future Phases (not in MVP)

- **Exclusive deals / card-linking:** Upside-style cashback via linked credit cards at partner businesses
- **Business self-serve portal:** Businesses submit their own events/deals
- **Mobile app:** Native iOS/Android
- **Headless CMS migration:** Move WordPress editorial into the web app
- **Custom itineraries:** AI-generated weekend plans based on user preferences
- **Savings dashboard:** Running total of money saved through deals
