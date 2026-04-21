import type { Venue } from "@/lib/types";

export const VENUES: Venue[] = [
  {
    id: "mission-ballroom",
    slug: "mission-ballroom",
    name: "The Mission Ballroom",
    description:
      "Denver's premier 4,000-capacity concert venue in the RiNo Art District, featuring state-of-the-art sound and a moving floor.",
    address: "4500 National Western Dr, Denver",
    neighborhood: "RiNo",
    lat: 39.775,
    lng: -104.964,
  },
  {
    id: "lola-coastal-mexican",
    slug: "lola-coastal-mexican",
    name: "Lola Coastal Mexican",
    description:
      "Vibrant coastal Mexican restaurant in LoHi serving creative tacos, ceviches, and craft margaritas.",
    address: "1575 Boulder St, Denver",
    neighborhood: "LoHi",
    lat: 39.76,
    lng: -105.009,
  },
  {
    id: "highlands-farmers-market",
    slug: "highlands-farmers-market",
    name: "Highlands Farmers' Market",
    description:
      "Seasonal open-air market featuring 40+ local vendors with fresh produce, artisan goods, and live music.",
    address: "32nd Ave & Lowell Blvd, Denver",
    neighborhood: "Highlands",
    lat: 39.762,
    lng: -105.037,
  },
  {
    id: "north-table-mountain",
    slug: "north-table-mountain",
    name: "North Table Mountain",
    description:
      "Popular hiking destination in Golden with panoramic views of the Front Range and Denver metro area.",
    address: "North Table Mountain Trailhead, Golden",
    neighborhood: "Golden",
    lat: 39.789,
    lng: -105.226,
  },
  {
    id: "great-divide-brewing",
    slug: "great-divide-brewing",
    name: "Great Divide Brewing",
    description:
      "Award-winning craft brewery with a taproom and patio, known for their Yeti Imperial Stout and seasonal releases.",
    address: "2201 Arapahoe St, Denver",
    neighborhood: "Cherry Creek",
    lat: 39.751,
    lng: -104.989,
  },
  {
    id: "santa-fe-art-district",
    slug: "santa-fe-art-district",
    name: "Santa Fe Art District",
    description:
      "Denver's creative heart — home to 30+ galleries, studios, and creative spaces along Santa Fe Drive.",
    address: "Santa Fe Dr & 10th Ave, Denver",
    neighborhood: "Downtown",
    lat: 39.732,
    lng: -104.999,
  },
  {
    id: "little-man-ice-cream",
    slug: "little-man-ice-cream",
    name: "Little Man Ice Cream",
    description:
      "Iconic LoHi creamery housed in a giant cream can, serving handcrafted ice cream and fresh pastries.",
    address: "2620 16th St, Denver",
    neighborhood: "LoHi",
    lat: 39.758,
    lng: -105.011,
  },
  {
    id: "the-squire-lounge",
    slug: "the-squire-lounge",
    name: "The Squire Lounge",
    description:
      "Beloved Capitol Hill dive bar and comedy venue with a laid-back atmosphere and strong drinks.",
    address: "916 Broadway, Denver",
    neighborhood: "Capitol Hill",
    lat: 39.734,
    lng: -104.987,
  },
  {
    id: "wash-park-brewing",
    slug: "wash-park-brewing",
    name: "Wash Park Brewing",
    description:
      "Neighborhood brewery near Wash Park with a dog-friendly patio and rotating tap list.",
    address: "1079 S Broadway, Denver",
    neighborhood: "Wash Park",
    lat: 39.7,
    lng: -104.987,
  },
  {
    id: "civic-center-park",
    slug: "civic-center-park",
    name: "Civic Center Park",
    description:
      "Downtown Denver's central green space hosting free community events, farmers markets, and outdoor fitness.",
    address: "101 W 14th Ave, Denver",
    neighborhood: "Downtown",
    lat: 39.738,
    lng: -104.991,
  },
  {
    id: "snooze-eatery",
    slug: "snooze-eatery",
    name: "Snooze Eatery",
    description:
      "Popular brunch spot in the Highlands known for creative pancake flights and eggs Benedict variations.",
    address: "3825 W 32nd Ave, Denver",
    neighborhood: "Highlands",
    lat: 39.763,
    lng: -105.035,
  },
  {
    id: "rino-art-district",
    slug: "rino-art-district",
    name: "RiNo Art District",
    description:
      "Denver's trendiest neighborhood filled with street art, galleries, breweries, and creative pop-up events.",
    address: "3501 Wazee St, Denver",
    neighborhood: "RiNo",
    lat: 39.77,
    lng: -104.983,
  },
];

const BY_ID = new Map(VENUES.map((v) => [v.id, v]));
const BY_SLUG = new Map(VENUES.map((v) => [v.slug, v]));
const BY_NAME = new Map(VENUES.map((v) => [v.name, v]));

export function getVenue(id: string): Venue | undefined {
  return BY_ID.get(id);
}

export function getVenueBySlug(slug: string): Venue | undefined {
  return BY_SLUG.get(slug);
}

export function getVenueByName(name: string): Venue | undefined {
  return BY_NAME.get(name);
}
