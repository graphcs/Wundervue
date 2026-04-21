import { useState, useEffect } from "react";

const FONT_FACES = `
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Regular.woff') format('woff'); font-weight: 400; font-style: normal; }
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Italic.woff') format('woff'); font-weight: 400; font-style: italic; }
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Light.woff') format('woff'); font-weight: 300; font-style: normal; }
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Medium.woff') format('woff'); font-weight: 500; font-style: normal; }
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Medium_Italic.woff') format('woff'); font-weight: 500; font-style: italic; }
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Bold_Italic.woff') format('woff'); font-weight: 700; font-style: italic; }
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Black.woff') format('woff'); font-weight: 900; font-style: normal; }
@font-face { font-family: 'Omnes'; src: url('/mnt/user-data/outputs/Omnes_Black_Italic.woff') format('woff'); font-weight: 900; font-style: italic; }
* { margin:0; padding:0; box-sizing:border-box; }
`;

const F = "'Omnes', -apple-system, sans-serif";
const DARK = "#121821";
const CORAL = "#ff535b";
const GRAY = "#86898a";
const BORDER = "#e0e0e0";
const BG = "#fffdf7";

const OB_INTERESTS = [
  { id: "concerts", label: "Concerts & Live Music", icon: "🎵" },
  { id: "food", label: "Food & Drink", icon: "🍽" },
  { id: "outdoor", label: "Outdoor & Nature", icon: "🏔️" },
  { id: "arts", label: "Arts & Culture", icon: "🎨" },
  { id: "nightlife", label: "Nightlife & Bars", icon: "🌙" },
  { id: "sports", label: "Sports & Fitness", icon: "⚽" },
  { id: "comedy", label: "Comedy & Shows", icon: "😂" },
  { id: "markets", label: "Markets & Pop-Ups", icon: "🛍" },
  { id: "wellness", label: "Wellness & Yoga", icon: "🧘" },
  { id: "family", label: "Family & Kids", icon: "👨‍👩‍👧" },
  { id: "dogs", label: "Dog-Friendly", icon: "🐕" },
  { id: "free", label: "Free Events", icon: "✨" },
];
const OB_HOODS = ["RiNo", "LoHi", "Highlands", "Cherry Creek", "Downtown", "Capitol Hill", "Baker", "Wash Park", "Golden", "South Broadway", "City Park", "Sloan's Lake"];

const NEIGHBORHOODS = ["All Denver", "RiNo", "LoHi", "Highlands", "Cherry Creek", "Downtown", "Baker", "Capitol Hill", "Golden", "Wash Park"];
const CATEGORIES = ["All", "Music", "Food & Drink", "Outdoor", "Arts & Culture", "Markets", "Sports", "Comedy", "Wellness"];
const DATE_OPTIONS = ["Any Date", "Today", "This Weekend", "This Week", "This Month", "Next Month"];

const LISTINGS = [
  { id: 1, addr: "4500 National Western Dr, Denver", type: "event", venue: "The Mission Ballroom", title: "Indie Night at The Mission Ballroom", desc: "Live performances featuring three local indie bands with an outdoor patio afterparty. All ages welcome.", hood: "RiNo", cat: "Music", date: "Sat, Apr 12", time: "8:00 PM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImcwIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzJkMWI2OSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlODVkNGEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2cwKSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPuKZqzwvdGV4dD4KPC9zdmc+", source: "Instagram", free: false, tags: ["date-night"] },
  { id: 2, addr: "1575 Boulder St, Denver", type: "deal", venue: "Lola Coastal Mexican", title: "BOGO Tacos at Lola Coastal Mexican", desc: "Buy one get one free street tacos every Friday. Dine-in only, all day long.", hood: "LoHi", cat: "Food & Drink", date: "Every Friday", time: "All Day", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImcxIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzhiNDUxMyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmNGE0NjAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2cxKSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfjb08L3RleHQ+Cjwvc3ZnPg==", source: "Website", free: false, dealValue: "BOGO", tags: [] },
  { id: 3, addr: "32nd Ave & Lowell Blvd, Denver", type: "both", venue: "Highlands Farmers' Market", title: "Highlands Farmers' Market Opening Weekend", desc: "Season opener with 40+ local vendors, live bluegrass, and kids activities. First 100 visitors get a free tote bag.", hood: "Highlands", cat: "Markets", date: "Sun, Apr 13", time: "9:00 AM – 1:00 PM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImcyIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzJlN2QzMiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM4MWM3ODQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2cyKSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfjL88L3RleHQ+Cjwvc3ZnPg==", source: "Instagram", free: false, dealValue: "Free Tote", tags: ["family", "dog-friendly"] },
  { id: 4, addr: "North Table Mountain Trailhead, Golden", type: "event", venue: "North Table Mountain", title: "Group Hike: North Table Mountain Loop", desc: "Casual 5-mile group hike with panoramic views of the Front Range. Dogs welcome, all skill levels.", hood: "Golden", cat: "Outdoor", date: "Sat, Apr 12", time: "7:30 AM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImczIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzE1NjVjMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NGI1ZjYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2czKSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPuKbsDwvdGV4dD4KPC9zdmc+", source: "Meetup", free: true, tags: ["dog-friendly", "outdoor"] },
  { id: 5, addr: "2201 Arapahoe St, Denver", type: "deal", venue: "Great Divide Brewing", title: "$5 Pints All Weekend at Great Divide", desc: "Celebrate the spring tap release with $5 pints on all new seasonal brews. Taproom only.", hood: "Cherry Creek", cat: "Food & Drink", date: "Apr 12–13", time: "12–10 PM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9Imc0IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2JmMzYwYyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjhhNjUiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2c0KSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfjbo8L3RleHQ+Cjwvc3ZnPg==", source: "Instagram", free: false, dealValue: "$5 Pints", tags: [] },
  { id: 6, addr: "Santa Fe Dr & 10th Ave, Denver", type: "event", venue: "Santa Fe Art District", title: "First Friday Art Walk on Santa Fe", desc: "Denver's iconic monthly art walk with 30+ galleries opening their doors. Live music, food trucks, and street performers.", hood: "Downtown", cat: "Arts & Culture", date: "Fri, May 2", time: "5:30 – 9:30 PM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9Imc1IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzRhMTQ4YyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNjZTkzZDgiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2c1KSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfjqg8L3RleHQ+Cjwvc3ZnPg==", source: "Website", free: true, tags: ["date-night", "family"] },
  { id: 7, addr: "2620 16th St, Denver", type: "deal", venue: "Little Man Ice Cream", title: "20% Off All Pastries at Little Man Ice Cream", desc: "Spring pastry promotion — 20% off croissants, danishes, and muffins before 10 AM.", hood: "LoHi", cat: "Food & Drink", date: "Through Apr 30", time: "Before 10 AM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9Imc2IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2U2NTEwMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmZmI3NGQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2c2KSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfpZA8L3RleHQ+Cjwvc3ZnPg==", source: "Instagram", free: false, dealValue: "20% Off", tags: [] },
  { id: 8, addr: "916 Broadway, Denver", type: "event", venue: "The Squire Lounge", title: "Comedy Night at The Squire Lounge", desc: "Stand-up showcase featuring five Denver comedians. Two-drink minimum. 21+ only.", hood: "Capitol Hill", cat: "Comedy", date: "Thu, Apr 17", time: "9:00 PM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9Imc3IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzFhMjM3ZSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM5ZmE4ZGEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2c3KSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfmII8L3RleHQ+Cjwvc3ZnPg==", source: "Instagram", free: false, tags: ["date-night"] },
  { id: 9, addr: "1079 S Broadway, Denver", type: "both", venue: "Wash Park Brewing", title: "Dog Day at Wash Park Brewing", desc: "Bring your pup for a dog-friendly afternoon on the patio. Free dog treat with every pint purchased.", hood: "Wash Park", cat: "Food & Drink", date: "Sun, Apr 20", time: "12 – 5 PM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9Imc4IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMzNjkxZSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNhZWQ1ODEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2c4KSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfkJU8L3RleHQ+Cjwvc3ZnPg==", source: "Instagram", free: false, dealValue: "Free Treat", tags: ["dog-friendly"] },
  { id: 10, addr: "101 W 14th Ave, Denver", type: "event", venue: "Civic Center Park", title: "Sunrise Yoga in Civic Center Park", desc: "Free outdoor yoga session open to all levels. Bring your own mat. Weather permitting.", hood: "Downtown", cat: "Wellness", date: "Sat, Apr 19", time: "6:30 AM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9Imc5IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwNjk1YyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM4MGNiYzQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiBmaWxsPSJ1cmwoI2c5KSIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiPvCfp5g8L3RleHQ+Cjwvc3ZnPg==", source: "Website", free: true, tags: ["outdoor"] },
  { id: 11, addr: "3825 W 32nd Ave, Denver", type: "deal", venue: "Snooze Eatery", title: "Kids Eat Free at Snooze Eatery", desc: "Kids 10 and under eat free with every adult entrée. Valid Saturday and Sunday brunch.", hood: "Highlands", cat: "Food & Drink", date: "Weekends", time: "Brunch Hours", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImcxMCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmNTdmMTciLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZmZmMTc2Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNTAwIiBoZWlnaHQ9IjM0MCIgZmlsbD0idXJsKCNnMTApIi8+CiAgPHRleHQgeD0iMjUwIiB5PSIxODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iNjAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4zKSI+8J+RtjwvdGV4dD4KPC9zdmc+", source: "Website", free: false, dealValue: "Kids Free", tags: ["family"] },
  { id: 12, addr: "3501 Wazee St, Denver", type: "event", venue: "RiNo Art District", title: "Vintage Vinyl Pop-Up at RiNo Art District", desc: "Local collectors selling rare and classic vinyl records. DJs spinning all day. Cash and Venmo accepted.", hood: "RiNo", cat: "Arts & Culture", date: "Sat, Apr 26", time: "10 AM – 4 PM", img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iMzQwIiB2aWV3Qm94PSIwIDAgNTAwIDM0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImcxMSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMzNzQ3NGYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojOTBhNGFlIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNTAwIiBoZWlnaHQ9IjM0MCIgZmlsbD0idXJsKCNnMTEpIi8+CiAgPHRleHQgeD0iMjUwIiB5PSIxODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iNjAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4zKSI+8J+OtTwvdGV4dD4KPC9zdmc+", source: "Instagram", free: true, tags: [] },
];

const MAP_POSITIONS = [
  { id: 1, top: "22%", left: "62%" }, { id: 2, top: "18%", left: "24%" },
  { id: 3, top: "28%", left: "35%" }, { id: 4, top: "12%", left: "80%" },
  { id: 5, top: "65%", left: "60%" }, { id: 6, top: "48%", left: "40%" },
  { id: 7, top: "20%", left: "20%" }, { id: 8, top: "55%", left: "30%" },
  { id: 9, top: "72%", left: "48%" }, { id: 10, top: "45%", left: "44%" },
  { id: 11, top: "30%", left: "32%" }, { id: 12, top: "25%", left: "58%" },
];

const HOOD_LABELS = [
  { name: "LoHi", top: "16%", left: "18%" },
  { name: "RiNo", top: "20%", left: "56%" },
  { name: "Highlands", top: "30%", left: "28%" },
  { name: "Downtown", top: "46%", left: "36%" },
  { name: "Capitol Hill", top: "52%", left: "26%" },
  { name: "Cherry Creek", top: "63%", left: "55%" },
  { name: "Wash Park", top: "70%", left: "42%" },
  { name: "Baker", top: "60%", left: "20%" },
  { name: "Golden", top: "10%", left: "78%" },
];

function Badge({ type }) {
  const styles = {
    event: { bg: DARK, label: "EVENT" },
    deal: { bg: CORAL, label: "DEAL" },
    both: { bg: "#333", label: "EVENT + DEAL" },
  };
  const s = styles[type];
  return (
    <span style={{
      position: "absolute", top: 10, left: 10, background: s.bg, color: "#fff",
      fontSize: 9, fontWeight: 700, letterSpacing: 1.2, padding: "4px 10px",
      borderRadius: 50, fontFamily: F, zIndex: 2
    }}>{s.label}</span>
  );
}

function FreeBadge() {
  return (
    <span style={{
      position: "absolute", top: 10, right: 44, background: "#0e7a9a", color: "#fff",
      fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "4px 8px",
      borderRadius: 50, fontFamily: F
    }}>FREE</span>
  );
}

function FavBtn({ active, onClick }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      position: "absolute", top: 6, right: 6, width: 30, height: 30,
      borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      transition: "transform 0.15s", padding: 0
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "#121821" : "none"} stroke="#121821" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  );
}

function DealTag({ value }) {
  if (!value) return null;
  return (
    <span style={{
      background: "rgba(232,93,74,0.1)", color: CORAL, fontSize: 11,
      fontWeight: 700, padding: "3px 8px", borderRadius: 4, fontFamily: F
    }}>{value}</span>
  );
}

export default function ExplorePage() {
  const [activeType, setActiveType] = useState("All");
  const [selectedHoods, setSelectedHoods] = useState(new Set());
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [dateFilter, setDateFilter] = useState("Any Date");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [lifestyleActive, setLifestyleActive] = useState(new Set());
  const [freeOnly, setFreeOnly] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [favorites, setFavorites] = useState(new Set([2]));
  const [selectedCard, setSelectedCard] = useState(null);
  const [fullPageView, setFullPageView] = useState(false);
  const [venueView, setVenueView] = useState(null); // venue name string
  const [sort, setSort] = useState("relevance");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showSavedEvents, setShowSavedEvents] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showManageSub, setShowManageSub] = useState(false);
  const [followedVenues, setFollowedVenues] = useState(new Set());
  const [showSavedVenues, setShowSavedVenues] = useState(false);

  const VENUE_INFO = {
    "The Mission Ballroom": { desc: "Denver's premier 4,000-capacity concert venue in the RiNo Art District, featuring state-of-the-art sound and a moving floor.", addr: "4500 National Western Dr, Denver" },
    "Lola Coastal Mexican": { desc: "Vibrant coastal Mexican restaurant in LoHi serving creative tacos, ceviches, and craft margaritas.", addr: "1575 Boulder St, Denver" },
    "Highlands Farmers' Market": { desc: "Seasonal open-air market featuring 40+ local vendors with fresh produce, artisan goods, and live music.", addr: "32nd Ave & Lowell Blvd, Denver" },
    "North Table Mountain": { desc: "Popular hiking destination in Golden with panoramic views of the Front Range and Denver metro area.", addr: "North Table Mountain Trailhead, Golden" },
    "Great Divide Brewing": { desc: "Award-winning craft brewery with a taproom and patio, known for their Yeti Imperial Stout and seasonal releases.", addr: "2201 Arapahoe St, Denver" },
    "Santa Fe Art District": { desc: "Denver's creative heart — home to 30+ galleries, studios, and creative spaces along Santa Fe Drive.", addr: "Santa Fe Dr & 10th Ave, Denver" },
    "Little Man Ice Cream": { desc: "Iconic LoHi creamery housed in a giant cream can, serving handcrafted ice cream and fresh pastries.", addr: "2620 16th St, Denver" },
    "The Squire Lounge": { desc: "Beloved Capitol Hill dive bar and comedy venue with a laid-back atmosphere and strong drinks.", addr: "916 Broadway, Denver" },
    "Wash Park Brewing": { desc: "Neighborhood brewery near Wash Park with a dog-friendly patio and rotating tap list.", addr: "1079 S Broadway, Denver" },
    "Civic Center Park": { desc: "Downtown Denver's central green space hosting free community events, farmers markets, and outdoor fitness.", addr: "101 W 14th Ave, Denver" },
    "Snooze Eatery": { desc: "Popular brunch spot in the Highlands known for creative pancake flights and eggs Benedict variations.", addr: "3825 W 32nd Ave, Denver" },
    "RiNo Art District": { desc: "Denver's trendiest neighborhood filled with street art, galleries, breweries, and creative pop-up events.", addr: "3501 Wazee St, Denver" },
  };

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obStep, setObStep] = useState(0);
  const [obName, setObName] = useState("");
  const [obEmail, setObEmail] = useState("");
  const [obPassword, setObPassword] = useState("");
  const [obPlan, setObPlan] = useState(null);
  const [obInterests, setObInterests] = useState(new Set());
  const [obHoods, setObHoods] = useState(new Set());
  const [obLifestyle, setObLifestyle] = useState(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = FONT_FACES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('[data-dropdown]')) { setOpenDropdown(null); setShowProfileMenu(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleFav = (id) => setFavorites(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleLifestyle = (t) => setLifestyleActive(prev => {
    const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n;
  });

  const filtered = LISTINGS.filter(l => {
    if (activeType === "Events" && l.type !== "event") return false;
    if (activeType === "Deals" && l.type !== "deal") return false;
    if (activeType === "Events + Deals" && l.type !== "both") return false;
    if (selectedHoods.size > 0 && !selectedHoods.has(l.hood)) return false;
    if (selectedCats.size > 0 && !selectedCats.has(l.cat)) return false;
    if (freeOnly && !l.free) return false;
    if (lifestyleActive.has("🐕 Dog-Friendly") && !l.tags.includes("dog-friendly")) return false;
    if (lifestyleActive.has("👨‍👩‍👧 Family") && !l.tags.includes("family")) return false;
    if (lifestyleActive.has("🌙 Date Night") && !l.tags.includes("date-night")) return false;
    if (lifestyleActive.has("🏔️ Outdoor") && !l.tags.includes("outdoor")) return false;
    return true;
  });

  const filteredIds = new Set(filtered.map(l => l.id));
  const displayedListings = venueView ? filtered.filter(l => l.venue === venueView) : filtered;

  const Pill = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      padding: "6px 16px", borderRadius: 50, fontSize: 12, fontWeight: 700,
      cursor: "pointer", border: `1.5px solid ${active ? DARK : "#d0d0d0"}`,
      background: active ? DARK : "#fffdf7", color: active ? "#fff" : "#4d4e4f",
      fontFamily: F, whiteSpace: "nowrap", transition: "all 0.15s",
      display: "inline-flex", alignItems: "center", gap: 4
    }}>
      {label}
    </button>
  );

  const DropdownPill = ({ label, options, value, onChange, dropKey }) => (
    <div style={{ position: "relative" }} data-dropdown="true">
      <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === dropKey ? null : dropKey); }} style={{
        padding: "6px 16px", borderRadius: 50, fontSize: 12, fontWeight: 700,
        cursor: "pointer", border: `1.5px solid ${value !== options[0] ? DARK : "#d0d0d0"}`,
        background: value !== options[0] ? DARK : "#fffdf7",
        color: value !== options[0] ? "#fff" : "#4d4e4f",
        fontFamily: F, whiteSpace: "nowrap", transition: "all 0.15s",
        display: "inline-flex", alignItems: "center", gap: 4
      }}>
        {value === options[0] ? label : value}
        <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
      </button>
      {openDropdown === dropKey && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fffdf7",
          border: "1px solid #e0e0e0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 50, minWidth: 180, padding: "6px 0", maxHeight: 240, overflowY: "auto"
        }}>
          {options.map(opt => (
            <div key={opt} onClick={() => { onChange(opt); setOpenDropdown(null); }}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: value === opt ? 500 : 400,
                color: value === opt ? DARK : "#4d4e4f", cursor: "pointer", fontFamily: F,
                background: value === opt ? "#f0f0f0" : "transparent",
                transition: "background 0.1s"
              }}
              onMouseEnter={e => e.target.style.background = "#f0f0f0"}
              onMouseLeave={e => e.target.style.background = value === opt ? "#f0f0f0" : "transparent"}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const MultiDropdownPill = ({ label, options, selected, onChange, dropKey }) => {
    const toggleOption = (opt) => {
      const next = new Set(selected);
      if (opt === options[0]) {
        // "All" option clears everything
        onChange(new Set());
      } else {
        next.has(opt) ? next.delete(opt) : next.add(opt);
        onChange(next);
      }
    };
    const pillLabel = selected.size === 0 ? label : selected.size === 1 ? [...selected][0] : `${selected.size} selected`;
    const isActive = selected.size > 0;
    return (
      <div style={{ position: "relative" }} data-dropdown="true">
        <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === dropKey ? null : dropKey); }} style={{
          padding: "6px 16px", borderRadius: 50, fontSize: 12, fontWeight: 700,
          cursor: "pointer", border: `1.5px solid ${isActive ? DARK : "#d0d0d0"}`,
          background: isActive ? DARK : "#fffdf7",
          color: isActive ? "#fff" : "#4d4e4f",
          fontFamily: F, whiteSpace: "nowrap", transition: "all 0.15s",
          display: "inline-flex", alignItems: "center", gap: 4
        }}>
          {pillLabel}
          <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
        </button>
        {openDropdown === dropKey && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fffdf7",
            border: "1px solid #e0e0e0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50, minWidth: 200, padding: "6px 0", maxHeight: 280, overflowY: "auto"
          }}>
            {options.map(opt => {
              const isAll = opt === options[0];
              const isChecked = isAll ? selected.size === 0 : selected.has(opt);
              return (
                <div key={opt} onClick={(e) => { e.stopPropagation(); toggleOption(opt); }}
                  style={{
                    padding: "8px 16px", fontSize: 13, fontWeight: 500,
                    color: isChecked ? DARK : "#4d4e4f", cursor: "pointer", fontFamily: F,
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.1s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: 3,
                    border: `1.5px solid ${isChecked ? DARK : "#ccc"}`,
                    background: isChecked ? DARK : "#fffdf7",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff", flexShrink: 0, lineHeight: 1,
                    textAlign: "center", verticalAlign: "middle"
                  }}>
                    {isChecked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                  {opt}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const DetailPanel = ({ listing, onClose }) => (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: fullPageView ? "100%" : 440,
      background: "#fffdf7", boxShadow: fullPageView ? "none" : "-4px 0 30px rgba(0,0,0,0.15)",
      zIndex: 200, overflowY: "auto", fontFamily: F, transition: "width 0.3s ease"
    }}>
      {/* Top bar with back/close */}
      {fullPageView && (
        <div style={{ padding: "12px 28px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setFullPageView(false)} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 500, color: GRAY, cursor: "pointer", fontFamily: F }}>← Back to results</button>
          <button onClick={() => { onClose(); setFullPageView(false); }} style={{ background: "none", border: "none", fontSize: 18, color: GRAY, cursor: "pointer" }}>✕</button>
        </div>
      )}
      <div style={{ maxWidth: fullPageView ? 720 : "100%", margin: fullPageView ? "0 auto" : 0 }}>
        <div style={{ position: "relative" }}>
          <img src={listing.img} alt="" style={{ width: "100%", height: fullPageView ? 360 : 240, objectFit: "cover", display: "block" }} />
          <Badge type={listing.type} />
          {listing.free && <FreeBadge />}
          {!fullPageView && (
            <button onClick={onClose} style={{
              position: "absolute", top: 12, right: 12, width: 32, height: 32,
              borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none",
              color: "#fff", fontSize: 18, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center"
            }}>✕</button>
          )}
        </div>
        <div style={{ padding: fullPageView ? "28px 0" : 24 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ background: "#f0f0f0", padding: "3px 10px", borderRadius: 50, fontSize: 11, fontWeight: 500, color: "#4d4e4f" }}>{listing.hood}</span>
            <span style={{ background: "#f0f0f0", padding: "3px 10px", borderRadius: 50, fontSize: 11, fontWeight: 500, color: "#4d4e4f" }}>{listing.cat}</span>
            {listing.dealValue && <DealTag value={listing.dealValue} />}
          </div>
          <h2 style={{ fontSize: fullPageView ? 28 : 22, fontWeight: 500, marginBottom: 8, lineHeight: 1.3 }}>{listing.title}</h2>

          <p style={{ fontSize: 15, color: "#4d4e4f", lineHeight: 1.6, marginBottom: 16 }}>{listing.desc}</p>
          
          {/* Venue + Address + Get Directions */}
          <div style={{ marginBottom: 20 }}>
            <div onClick={() => { setVenueView(listing.venue); onClose(); setFullPageView(false); }}
              style={{ fontSize: 14, color: CORAL, fontWeight: 500, cursor: "pointer", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {listing.venue}
            </div>
            <div style={{ fontSize: 13, color: "#4d4e4f", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#86898a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {listing.addr}
            </div>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(listing.addr)}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 500, color: CORAL, textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Get Directions
            </a>
          </div>
          
          <div style={{ background: "#f9f9f9", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div><div style={{ fontSize: 10, fontWeight: 500, color: GRAY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Date</div><div style={{ fontSize: 14, fontWeight: 500 }}>{listing.date}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, fontWeight: 500, color: GRAY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Time</div><div style={{ fontSize: 14, fontWeight: 500 }}>{listing.time}</div></div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, color: GRAY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Venue</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{listing.venue}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <button onClick={() => toggleFav(listing.id)} style={{
              flex: 1, padding: "12px 0", borderRadius: 50, border: `1.5px solid ${DARK}`,
              background: favorites.has(listing.id) ? DARK : "#fffdf7",
              color: favorites.has(listing.id) ? "#fff" : DARK,
              fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={favorites.has(listing.id) ? "#fff" : "none"} stroke={favorites.has(listing.id) ? "#fff" : DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {favorites.has(listing.id) ? "Favorited" : "Favorite"}
            </button>
            <button style={{
              flex: 1, padding: "12px 0", borderRadius: 50, border: `1.5px solid ${DARK}`,
              background: "#fffdf7", color: DARK, fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: F
            }}>
              ↗ Share
            </button>
          </div>

          {/* Save to Calendar */}
          <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(listing.title)}&dates=20260412/20260413&details=${encodeURIComponent(listing.desc)}&location=${encodeURIComponent(listing.addr)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: 12 }}>
            <button style={{
              width: "100%", padding: "12px 0", borderRadius: 50, border: `1.5px solid ${DARK}`,
              background: "#fffdf7", color: DARK, fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: F,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Save to Google Calendar
            </button>
          </a>

          {/* View Full Page button */}
          {!fullPageView && (
            <button onClick={() => setFullPageView(true)} style={{
              width: "100%", padding: "12px 0", borderRadius: 50, border: "none",
              background: "none", color: GRAY, fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: F, marginBottom: 16
            }}>View Full Page →</button>
          )}

          <div style={{ borderTop: "1px solid #eee", paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: GRAY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Source</div>
            <a href="#" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 500, color: CORAL, textDecoration: "none"
            }}>
              View original post on {listing.source} ↗
            </a>
          </div>

          {/* Related events from same venue (full page only) */}
          {fullPageView && (() => {
            const related = LISTINGS.filter(l => l.venue === listing.venue && l.id !== listing.id);
            if (related.length === 0) return null;
            return (
              <div style={{ borderTop: "1px solid #eee", paddingTop: 24, marginTop: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: DARK, marginBottom: 16 }}>More from {listing.venue}</div>
                <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
                  {related.map(r => (
                    <div key={r.id} onClick={() => setSelectedCard(r)} style={{ minWidth: 200, cursor: "pointer", borderRadius: 8, border: "1px solid #eee", overflow: "hidden" }}>
                      <img src={r.img} alt="" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                      <div style={{ padding: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>{r.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#fffdf7", minHeight: "100vh", fontFamily: F }}>
      {/* Overlay for detail panel */}
      {selectedCard && (
        <>
          <div onClick={() => setSelectedCard(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 199
          }} />
          <DetailPanel listing={selectedCard} onClose={() => setSelectedCard(null)} />
        </>
      )}

      {/* TOP BAR */}
      <div style={{
        background: "linear-gradient(90deg, #82FFC5 0%, #94F6FF 100%)", color: "#1a1a1a", fontSize: 11, fontWeight: 700,
        letterSpacing: 1.5, padding: "7px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span style={{ cursor: "pointer" }}>🔥 TRENDING</span>
        <div style={{ display: "flex", gap: 14 }}>
          <span>f</span><span>◻</span><span>in</span>
        </div>
      </div>

      {/* HEADER */}
      <div style={{ background: "#fffdf7", textAlign: "center", padding: "16px 28px 0", borderBottom: "1px solid #eee", position: "relative", zIndex: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <img src="data:image/png;base64,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" alt="Wundervue — discover local." style={{ height: 48, margin: "0 auto", display: "block", width: "auto" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["Best Of ▾", "Lifestyle ▾", "Monthly Guides ▾", "Spotlights", "About ▾"].map(item => (
              <span key={item} style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#222", padding: "10px 12px", cursor: "pointer" }}>{item}</span>
            ))}
          </div>
          {/* Profile Icon */}
          <div style={{ position: "absolute", right: 0, top: "30%", transform: "translateY(-50%)" }} data-dropdown="true">
            {!isLoggedIn ? (
              <button onClick={() => { setShowOnboarding(true); setObStep(0); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", border: `1.5px solid ${BORDER}`, background: "#fffdf7", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </button>
            ) : (
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", border: `1.5px solid ${CORAL}`, background: CORAL, cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: F }}>
                {(obName || "U").charAt(0).toUpperCase()}
              </button>
            )}

            {/* Profile Dropdown Menu */}
            {showProfileMenu && isLoggedIn && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#fffdf7",
                border: "1px solid #e0e0e0", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 200, minWidth: 220, padding: "8px 0", fontFamily: F
              }}>
                {/* User info */}
                <div style={{ padding: "12px 18px 10px", borderBottom: "1px solid #eee" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: DARK }}>{obName || "User"}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{obEmail || "user@email.com"}</div>
                  {obPlan === "insider" && <span style={{ display: "inline-block", marginTop: 6, background: CORAL, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 50, letterSpacing: 0.5 }}>INSIDER</span>}
                </div>

                {/* Menu items */}
                {[
                  { id: "saved", label: "Saved Events", count: favorites.size },
                  { id: "venues", label: "Saved Venues", count: followedVenues.size },
                  { id: "settings", label: "Account Settings" },
                  { id: "subscription", label: obPlan === "insider" ? "Manage Subscription" : "Upgrade to Insider" },
                ].map(item => (
                  <div key={item.label} onClick={() => { setShowProfileMenu(false); if (item.id === "saved") setShowSavedEvents(true); if (item.id === "venues") setShowSavedVenues(true); if (item.id === "settings") setShowSettings(true); if (item.id === "subscription" && obPlan === "insider") setShowManageSub(true); if (item.id === "subscription" && obPlan !== "insider") setShowUpgrade(true); }}
                    style={{ padding: "10px 18px", fontSize: 13, fontWeight: 500, color: DARK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {item.id === "saved" && <svg width="16" height="16" viewBox="0 0 24 24" fill={DARK} stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>}
                        {item.id === "venues" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
                        {item.id === "settings" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
                        {item.id === "subscription" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
                      </span>
                      {item.label}
                    </span>
                    {item.count !== undefined && <span style={{ background: "#f0f0f0", borderRadius: 50, padding: "1px 8px", fontSize: 11, fontWeight: 500, color: GRAY }}>{item.count}</span>}
                  </div>
                ))}

                {/* Divider + Logout */}
                <div style={{ borderTop: "1px solid #eee", marginTop: 4, paddingTop: 4 }}>
                  <div onClick={() => { setIsLoggedIn(false); setShowProfileMenu(false); setObName(""); setObEmail(""); setObPassword(""); setObPlan(null); }}
                    style={{ padding: "10px 18px", fontSize: 13, fontWeight: 500, color: GRAY, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    </span>
                    Log Out
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DISCOVERY BAR */}
      <div style={{ background: BG, borderBottom: `1px solid ${BORDER}`, padding: "16px 28px 12px", overflow: "visible", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Search */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#bdc1c3", pointerEvents: "none" }}>🔍</span>
              <input type="text" placeholder="Search events, deals, and things to do in Denver..."
                style={{ width: "100%", padding: "11px 14px 11px 38px", fontSize: 14, fontFamily: F, border: "1px solid #d5d5d5", borderRadius: 50, background: "#fffdf7", color: "#222", outline: "none" }}
              />
            </div>
            <button style={{ background: DARK, color: "#fff", border: "none", padding: "11px 24px", borderRadius: 50, fontSize: 12, fontWeight: 500, fontFamily: F, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>Search</button>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingBottom: 2 }}>
            {["All", "Events", "Deals", "Events + Deals"].map(t => (
              <Pill key={t} label={t} active={activeType === t} onClick={() => setActiveType(t)} />
            ))}
            <div style={{ width: 1, height: 18, background: "#d5d5d5", flexShrink: 0 }} />
            {/* Date Range Filter */}
            <div style={{ position: "relative" }} data-dropdown="true">
              <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === "date" ? null : "date"); }} style={{
                padding: "6px 16px", borderRadius: 50, fontSize: 12, fontWeight: 700,
                cursor: "pointer", border: `1.5px solid ${dateFilter !== "Any Date" ? DARK : "#d0d0d0"}`,
                background: dateFilter !== "Any Date" ? DARK : "#fffdf7",
                color: dateFilter !== "Any Date" ? "#fff" : "#4d4e4f",
                fontFamily: F, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4
              }}>
                {dateFilter === "Custom" && customDateFrom && customDateTo ? `${customDateFrom} – ${customDateTo}` : dateFilter === "Any Date" ? "Date" : dateFilter}
                <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
              </button>
              {openDropdown === "date" && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fffdf7",
                  border: "1px solid #e0e0e0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  zIndex: 50, minWidth: 220, padding: "6px 0"
                }} data-dropdown="true">
                  {DATE_OPTIONS.map(opt => (
                    <div key={opt} onClick={() => { setDateFilter(opt); if (opt !== "Custom") setOpenDropdown(null); }}
                      style={{ padding: "8px 16px", fontSize: 13, fontWeight: dateFilter === opt ? 500 : 400, color: dateFilter === opt ? DARK : "#4d4e4f", cursor: "pointer", fontFamily: F, background: dateFilter === opt ? "#f0f0f0" : "transparent" }}
                      onMouseEnter={e => e.target.style.background = "#f0f0f0"}
                      onMouseLeave={e => e.target.style.background = dateFilter === opt ? "#f0f0f0" : "transparent"}
                    >{opt}</div>
                  ))}
                  <div onClick={() => setDateFilter("Custom")}
                    style={{ padding: "8px 16px", fontSize: 13, fontWeight: dateFilter === "Custom" ? 500 : 400, color: dateFilter === "Custom" ? DARK : "#4d4e4f", cursor: "pointer", fontFamily: F, background: dateFilter === "Custom" ? "#f0f0f0" : "transparent", borderTop: "1px solid #eee", marginTop: 4, paddingTop: 12 }}
                    onMouseEnter={e => e.target.style.background = "#f0f0f0"}
                    onMouseLeave={e => e.target.style.background = dateFilter === "Custom" ? "#f0f0f0" : "transparent"}
                  >Custom Range</div>
                  {dateFilter === "Custom" && (
                    <div style={{ padding: "12px 16px", display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, fontWeight: 500, color: GRAY, display: "block", marginBottom: 4 }}>From</label>
                        <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)}
                          style={{ width: "100%", padding: "8px", fontSize: 12, fontFamily: F, border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", color: DARK }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, fontWeight: 500, color: GRAY, display: "block", marginBottom: 4 }}>To</label>
                        <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)}
                          style={{ width: "100%", padding: "8px", fontSize: 12, fontFamily: F, border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", color: DARK }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <MultiDropdownPill label="Neighborhood" options={NEIGHBORHOODS} selected={selectedHoods} onChange={setSelectedHoods} dropKey="hood" />
            <MultiDropdownPill label="Category" options={CATEGORIES} selected={selectedCats} onChange={setSelectedCats} dropKey="cat" />
            <div style={{ width: 1, height: 18, background: "#d5d5d5", flexShrink: 0 }} />
            {["🐕 Dog-Friendly", "👨‍👩‍👧 Family", "🌙 Date Night", "🏔️ Outdoor"].map(t => (
              <Pill key={t} label={t} active={lifestyleActive.has(t)} onClick={() => toggleLifestyle(t)} />
            ))}
            <div style={{ width: 1, height: 18, background: "#d5d5d5", flexShrink: 0 }} />
            <Pill label="Free Only" active={freeOnly} onClick={() => setFreeOnly(!freeOnly)} />

            {/* View toggle */}
            <div style={{ marginLeft: "auto", display: "flex", flexShrink: 0 }}>
              {["grid", "map"].map(v => (
                <button key={v} onClick={() => setViewMode(v)} style={{
                  padding: "6px 14px", border: `1.5px solid ${viewMode === v ? DARK : "#d0d0d0"}`,
                  borderRight: v === "grid" ? "none" : undefined,
                  borderRadius: v === "grid" ? "6px 0 0 6px" : "0 6px 6px 0",
                  background: viewMode === v ? DARK : "#fffdf7", color: viewMode === v ? "#fff" : "#86898a",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F,
                  display: "flex", alignItems: "center", gap: 4
                }}>
                  {v === "grid" ? "⊞" : "📍"} {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 28px 60px" }}>

        {/* Venue Profile Header */}
        {venueView && (() => {
          const vi = VENUE_INFO[venueView] || { desc: "", addr: "" };
          const isFollowed = followedVenues.has(venueView);
          return (
            <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Venue</div>
                  <div style={{ fontSize: 22, fontWeight: 500, color: DARK, marginBottom: 4 }}>{venueView}</div>
                  <div style={{ fontSize: 13, color: GRAY }}>
                    {LISTINGS.filter(l => l.venue === venueView).length} events & deals · {LISTINGS.find(l => l.venue === venueView)?.hood}
                  </div>
                </div>
                <button onClick={() => setVenueView(null)} style={{
                  background: "none", border: "none", fontSize: 18, color: GRAY,
                  cursor: "pointer", padding: 4
                }}>✕</button>
              </div>

              {vi.desc && <p style={{ fontSize: 13, color: "#4d4e4f", lineHeight: 1.6, marginBottom: 14 }}>{vi.desc}</p>}

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4d4e4f", marginBottom: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {vi.addr}
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(vi.addr)}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: CORAL, textDecoration: "none", marginBottom: 16 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                Get Directions
              </a>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { const n = new Set(followedVenues); isFollowed ? n.delete(venueView) : n.add(venueView); setFollowedVenues(n); }} style={{
                  padding: "9px 22px", borderRadius: 50, border: `1.5px solid ${DARK}`,
                  background: isFollowed ? DARK : "#fff", color: isFollowed ? "#fff" : DARK,
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F,
                  display: "inline-flex", alignItems: "center", gap: 6
                }}>
                  {isFollowed ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Following</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Follow</>
                  )}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Results header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 14, color: "#86898a" }}>
            Showing <strong style={{ color: "#222", fontWeight: 500 }}>{(venueView ? filtered.filter(l => l.venue === venueView) : filtered).length}</strong> results
            {selectedHoods.size === 1 && <> in <strong style={{ color: "#222" }}>{[...selectedHoods][0]}</strong></>}
            {selectedHoods.size > 1 && <> in <strong style={{ color: "#222" }}>{selectedHoods.size} neighborhoods</strong></>}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{
            fontSize: 12, fontWeight: 500, padding: "6px 12px", border: "1px solid #ddd",
            borderRadius: 6, fontFamily: F, color: "#4d4e4f", cursor: "pointer", background: "#fffdf7"
          }}>
            <option value="relevance">Sort: Relevance</option>
            <option value="date">Sort: Date (Soonest)</option>
            <option value="popular">Sort: Most Popular</option>
          </select>
        </div>

        {viewMode === "grid" ? (
          /* GRID VIEW */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {displayedListings.map(l => (
              <div key={l.id} onClick={() => setSelectedCard(l)} style={{
                background: "#fffdf7", borderRadius: 10, overflow: "hidden",
                border: "1px solid #eee", cursor: "pointer",
                transition: "box-shadow 0.2s, transform 0.2s"
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ position: "relative", height: 170, overflow: "hidden" }}>
                  <img src={l.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <Badge type={l.type} />
                  {l.free && <FreeBadge />}
                  <FavBtn active={favorites.has(l.id)} onClick={() => toggleFav(l.id)} />
                </div>
                <div style={{ padding: "12px 14px 16px" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <span style={{ background: "#f0f0f0", padding: "2px 8px", borderRadius: 50, fontSize: 10, fontWeight: 500, color: "#4d4e4f" }}>{l.hood}</span>
                    <span style={{ background: "#f0f0f0", padding: "2px 8px", borderRadius: 50, fontSize: 10, fontWeight: 500, color: "#4d4e4f" }}>{l.cat}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, marginBottom: 6, color: "#222" }}>{l.title}</div>
                  <div style={{
                    fontSize: 13, color: "#86898a", lineHeight: 1.5, marginBottom: 10,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"
                  }}>{l.desc}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#333", display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86898a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {l.date}
                    </span>
                    {l.dealValue ? <DealTag value={l.dealValue} /> : (
                      <span style={{ fontSize: 11, color: "#bdc1c3" }}>via {l.source} ↗</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {displayedListings.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>No results found</div>
                <div style={{ fontSize: 14, color: GRAY }}>Try adjusting your filters or search terms</div>
              </div>
            )}
          </div>
        ) : (
          /* MAP VIEW — split layout */
          <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, minHeight: 600 }}>
            {/* Listings sidebar */}
            <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}>
              {displayedListings.map(l => (
                <div key={l.id} onClick={() => setSelectedCard(l)} style={{
                  display: "flex", gap: 12, padding: 10, borderRadius: 8,
                  border: "1px solid #eee", cursor: "pointer", transition: "box-shadow 0.15s",
                  background: "#fffdf7"
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                >
                  <div style={{ position: "relative", width: 110, height: 80, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    <img src={l.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <span style={{
                      position: "absolute", top: 4, left: 4,
                      background: l.type === "deal" ? CORAL : DARK,
                      color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: 0.8,
                      padding: "2px 6px", borderRadius: 50
                    }}>{l.type === "both" ? "E+D" : l.type.toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
                    <div style={{ fontSize: 11, color: GRAY, marginBottom: 2 }}>{l.hood} · {l.cat}</div>
                    <div style={{ fontSize: 10, color: "#bdc1c3", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.addr}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#4d4e4f", display: "flex", alignItems: "center", gap: 4 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#86898a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> {l.date}</span>
                      {l.dealValue && <DealTag value={l.dealValue} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Map */}
            <div style={{
              borderRadius: 12, overflow: "hidden", border: "1px solid #e0e0e0",
              position: "sticky", top: 180, height: "calc(100vh - 260px)",
              background: "linear-gradient(180deg, #e8e4df 0%, #d8d3cc 100%)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                {/* Grid lines */}
                <div style={{
                  position: "absolute", inset: 0, opacity: 0.3,
                  backgroundImage: "linear-gradient(0deg, transparent 49%, rgba(255,255,255,0.5) 49%, rgba(255,255,255,0.5) 51%, transparent 51%), linear-gradient(90deg, transparent 49%, rgba(255,255,255,0.5) 49%, rgba(255,255,255,0.5) 51%, transparent 51%)",
                  backgroundSize: "100% 55px, 70px 100%"
                }} />

                {/* Hood labels */}
                {HOOD_LABELS.map(h => (
                  <span key={h.name} style={{
                    position: "absolute", top: h.top, left: h.left,
                    fontSize: 9, fontWeight: 500, color: "#bdc1c3",
                    letterSpacing: 1.5, textTransform: "uppercase", fontFamily: F
                  }}>{h.name}</span>
                ))}

                {/* Pins */}
                {MAP_POSITIONS.map(p => {
                  const listing = LISTINGS.find(l => l.id === p.id);
                  if (!listing || !filteredIds.has(p.id)) return null;
                  return (
                    <div key={p.id} onClick={() => setSelectedCard(listing)} style={{
                      position: "absolute", top: p.top, left: p.left,
                      width: 28, height: 28, borderRadius: "50% 50% 50% 0",
                      transform: "rotate(-45deg)",
                      background: listing.type === "deal" ? CORAL : listing.type === "both" ? "#4d4e4f" : DARK,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.25)", cursor: "pointer",
                      transition: "transform 0.15s", zIndex: 2
                    }}
                      onMouseEnter={e => e.currentTarget.style.transform = "rotate(-45deg) scale(1.25)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "rotate(-45deg) scale(1)"}
                    >
                      <span style={{ transform: "rotate(45deg)", color: "#fff", fontSize: 11, fontWeight: 500 }}>
                        {listing.type === "deal" ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
                        ) : listing.type === "both" ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        )}
                      </span>
                    </div>
                  );
                })}

                {/* Legend */}
                <div style={{
                  position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.92)",
                  borderRadius: 8, padding: "8px 14px", display: "flex", gap: 14,
                  fontSize: 10, fontWeight: 500, color: "#666", boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
                }}>
                  {[["Event", DARK], ["Deal", CORAL], ["Both", "#4d4e4f"]].map(([label, color]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Zoom */}
                <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  {["+", "−"].map(z => (
                    <button key={z} style={{
                      width: 30, height: 30, borderRadius: 6, background: "#fffdf7",
                      border: "1px solid #ddd", fontSize: 16, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#4d4e4f"
                    }}>{z}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Load More */}
        {displayedListings.length > 0 && viewMode === "grid" && (
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button style={{
              padding: "12px 40px", borderRadius: 50, border: `2px solid ${DARK}`,
              background: "#fffdf7", color: DARK, fontSize: 12, fontWeight: 500,
              letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", fontFamily: F,
              transition: "all 0.2s"
            }}
              onMouseEnter={e => { e.target.style.background = DARK; e.target.style.color = "#fff"; }}
              onMouseLeave={e => { e.target.style.background = "#fffdf7"; e.target.style.color = DARK; }}
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* ACCOUNT SETTINGS PAGE */}
      {showSettings && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 250 }} onClick={() => setShowSettings(false)} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, background: BG, zIndex: 251, boxShadow: "-4px 0 30px rgba(0,0,0,0.15)", overflowY: "auto", fontFamily: F }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: BG, zIndex: 2 }}>
              <h2 style={{ fontSize: 20, fontWeight: 500, color: DARK }}>Account Settings</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer", padding: 4 }}>✕</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Profile Section */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Profile</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: CORAL, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 500, fontFamily: F }}>
                    {(obName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: DARK }}>{obName || "User"}</div>
                    <div style={{ fontSize: 13, color: GRAY }}>{obEmail || "user@email.com"}</div>
                  </div>
                </div>

                {[["Full Name", obName || "User"], ["Email", obEmail || "user@email.com"]].map(([label, val]) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>{label}</label>
                    <input defaultValue={val} style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} />
                  </div>
                ))}
                <button style={{ padding: "10px 24px", borderRadius: 50, border: "none", background: DARK, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Save Changes</button>
              </div>

              {/* Subscription Section */}
              <div style={{ marginBottom: 28, borderTop: "1px solid #eee", paddingTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Subscription</div>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: DARK, display: "flex", alignItems: "center", gap: 6 }}>
                      {obPlan === "insider" ? "Insider Plan" : "Explorer Plan (Free)"}
                      {obPlan === "insider" && <span style={{ background: CORAL, color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 50 }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{obPlan === "insider" ? "$4.99/month" : "Free forever"}</div>
                  </div>
                  {obPlan !== "insider" && (
                    <button onClick={() => { setShowSettings(false); setShowUpgrade(true); }} style={{ padding: "8px 18px", borderRadius: 50, border: "none", background: CORAL, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Upgrade</button>
                  )}
                </div>
              </div>

              {/* Password Section */}
              <div style={{ marginBottom: 28, borderTop: "1px solid #eee", paddingTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Password</div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>Current Password</label>
                  <input type="password" placeholder="Enter current password" style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>New Password</label>
                  <input type="password" placeholder="Enter new password" style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} />
                </div>
                <button style={{ padding: "10px 24px", borderRadius: 50, border: "none", background: DARK, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Update Password</button>
              </div>

              {/* Notifications Section */}
              <div style={{ marginBottom: 28, borderTop: "1px solid #eee", paddingTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Notifications</div>
                {[["Email updates", "Weekly digest of events and deals", true], ["Deal alerts", "Get notified about new deals in your area", true], ["Event reminders", "Reminders for saved events", false]].map(([label, sub, on]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{label}</div>
                      <div style={{ fontSize: 11, color: GRAY }}>{sub}</div>
                    </div>
                    <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? CORAL : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: on ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Danger Zone */}
              <div style={{ paddingTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Danger Zone</div>
                <button style={{ padding: "10px 24px", borderRadius: 50, border: `1.5px solid ${CORAL}`, background: "none", color: CORAL, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Delete Account</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MANAGE SUBSCRIPTION MODAL */}
      {showManageSub && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, backdropFilter: "blur(2px)" }} onClick={() => setShowManageSub(false)} />
          <div style={{ position: "fixed", inset: 0, zIndex: 301, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: BG, borderRadius: 16, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: F }}>
              <button onClick={() => setShowManageSub(false)} style={{ position: "absolute", top: 16, right: 16, zIndex: 5, background: "none", border: "none", cursor: "pointer", fontSize: 20, color: GRAY, padding: 4 }}>✕</button>

              <div style={{ padding: "32px 32px 28px" }}>
                <h2 style={{ fontSize: 22, fontWeight: 500, color: DARK, marginBottom: 4 }}>Manage Subscription</h2>
                <p style={{ fontSize: 13, color: GRAY, marginBottom: 24 }}>You're on the Insider plan.</p>

                {/* Current Plan Card */}
                <div style={{ background: "#fff", border: `1.5px solid ${CORAL}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: DARK, display: "flex", alignItems: "center", gap: 8 }}>
                        Insider Plan
                        <span style={{ background: CORAL, color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: 50 }}>ACTIVE</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 500, color: DARK, marginTop: 4 }}>$4.99 <span style={{ fontSize: 13, color: GRAY }}>/month</span></div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
                    {[
                      ["Next billing date", "May 14, 2026"],
                      ["Payment method", "•••• 3456"],
                      ["Member since", "Apr 14, 2026"],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: GRAY }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Your Benefits */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Your Benefits</div>
                  {["Personalized daily recommendations", "Unlimited saves & favorites", "Advanced lifestyle filters", "Save to Google Calendar", "Early access notifications", "Exclusive deals (coming soon)"].map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4d4e4f", marginBottom: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </div>
                  ))}
                </div>

                {/* Update Payment */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Payment Method</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>Visa ending in 3456</div>
                        <div style={{ fontSize: 11, color: GRAY }}>Expires 08/28</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: CORAL, fontWeight: 500, cursor: "pointer" }}>Update</span>
                  </div>
                </div>

                {/* Cancel */}
                <div style={{ borderTop: "1px solid #eee", paddingTop: 20, marginTop: 8 }}>
                  <button onClick={() => { setObPlan("free"); setShowManageSub(false); }} style={{
                    width: "100%", padding: "12px 0", borderRadius: 50,
                    border: `1.5px solid ${BORDER}`, background: "none",
                    color: GRAY, fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: F
                  }}>Cancel Subscription</button>
                  <div style={{ textAlign: "center", fontSize: 11, color: GRAY, marginTop: 8 }}>Your benefits continue until the end of the billing period.</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* UPGRADE TO INSIDER MODAL */}
      {showUpgrade && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, backdropFilter: "blur(2px)" }} onClick={() => setShowUpgrade(false)} />
          <div style={{ position: "fixed", inset: 0, zIndex: 301, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: BG, borderRadius: 16, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: F }}>
              <button onClick={() => setShowUpgrade(false)} style={{ position: "absolute", top: 16, right: 16, zIndex: 5, background: "none", border: "none", cursor: "pointer", fontSize: 20, color: GRAY, padding: 4 }}>✕</button>

              {/* Hero */}
              <div style={{ background: `linear-gradient(135deg, ${CORAL} 0%, #ff8a6b 100%)`, padding: "36px 32px", borderRadius: "16px 16px 0 0", textAlign: "center", color: "#fff" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                <h2 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Upgrade to Insider</h2>
                <p style={{ fontSize: 14, opacity: 0.9 }}>Unlock the full Wundervue experience</p>
              </div>

              <div style={{ padding: "24px 32px 32px" }}>
                {/* Price */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <span style={{ fontSize: 36, fontWeight: 500, color: DARK }}>$4.99</span>
                  <span style={{ fontSize: 14, color: GRAY }}> /month</span>
                </div>

                {/* Features */}
                <div style={{ marginBottom: 24 }}>
                  {[
                    ["Personalized daily recommendations", "Events tailored to your interests"],
                    ["Unlimited saves & favorites", "No more 5-event limit"],
                    ["Advanced lifestyle filters", "Dog-friendly, date night, family & more"],
                    ["Save to Google Calendar", "Sync events to your calendar"],
                    ["Early access notifications", "Be first to know about new events"],
                    ["Exclusive deals", "Members-only discounts (coming soon)"],
                  ].map(([title, sub]) => (
                    <div key={title} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                      <svg style={{ flexShrink: 0, marginTop: 2 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{title}</div>
                        <div style={{ fontSize: 11, color: GRAY }}>{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button onClick={() => { setShowUpgrade(false); setObPlan("insider"); setObStep(2); setShowOnboarding(true); }} style={{
                  width: "100%", padding: "14px 0", borderRadius: 50, border: "none",
                  background: DARK, color: "#fff", fontSize: 14, fontWeight: 500,
                  cursor: "pointer", fontFamily: F, marginBottom: 8
                }}>Start Insider — $4.99/month</button>

                <div style={{ textAlign: "center", fontSize: 11, color: GRAY }}>Cancel anytime. No commitment.</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SAVED VENUES PAGE */}
      {showSavedVenues && (() => {
        const savedVenuesList = [...followedVenues];
        return (
          <>
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 250 }} onClick={() => setShowSavedVenues(false)} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: BG, zIndex: 251, boxShadow: "-4px 0 30px rgba(0,0,0,0.15)", overflowY: "auto", fontFamily: F }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: BG, zIndex: 2 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: DARK, marginBottom: 2 }}>Saved Venues</h2>
                  <p style={{ fontSize: 13, color: GRAY }}>{savedVenuesList.length} {savedVenuesList.length === 1 ? "venue" : "venues"} followed</p>
                </div>
                <button onClick={() => setShowSavedVenues(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer", padding: 4 }}>✕</button>
              </div>

              {savedVenuesList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 24px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: DARK, marginBottom: 6 }}>No saved venues yet</div>
                  <div style={{ fontSize: 13, color: GRAY, marginBottom: 20 }}>Follow venues to get updates on their events and deals.</div>
                  <button onClick={() => setShowSavedVenues(false)} style={{ padding: "10px 28px", borderRadius: 50, border: `1.5px solid ${DARK}`, background: DARK, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Browse Events</button>
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  {savedVenuesList.map(vName => {
                    const vi = VENUE_INFO[vName] || { desc: "", addr: "" };
                    const venueListings = LISTINGS.filter(l => l.venue === vName);
                    return (
                      <div key={vName} onClick={() => { setVenueView(vName); setShowSavedVenues(false); }}
                        style={{ padding: 16, borderRadius: 10, border: "1px solid #eee", marginBottom: 10, cursor: "pointer", background: "#fff", transition: "box-shadow 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 16, fontWeight: 500, color: DARK, marginBottom: 4 }}>{vName}</div>
                            {vi.desc && <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{vi.desc}</div>}
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: GRAY, marginBottom: 4 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              {vi.addr}
                            </div>
                            <div style={{ fontSize: 11, color: CORAL, fontWeight: 500 }}>{venueListings.length} active events & deals</div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); const n = new Set(followedVenues); n.delete(vName); setFollowedVenues(n); }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, marginLeft: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* SAVED EVENTS PAGE */}
      {showSavedEvents && (() => {
        const savedListings = LISTINGS.filter(l => favorites.has(l.id));
        return (
          <>
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 250 }} onClick={() => setShowSavedEvents(false)} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: BG, zIndex: 251, boxShadow: "-4px 0 30px rgba(0,0,0,0.15)", overflowY: "auto", fontFamily: F }}>
              {/* Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: BG, zIndex: 2 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: DARK, marginBottom: 2 }}>Saved Events</h2>
                  <p style={{ fontSize: 13, color: GRAY }}>{savedListings.length} {savedListings.length === 1 ? "event" : "events"} saved</p>
                </div>
                <button onClick={() => setShowSavedEvents(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer", padding: 4 }}>✕</button>
              </div>

              {savedListings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 24px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: DARK, marginBottom: 6 }}>No saved events yet</div>
                  <div style={{ fontSize: 13, color: GRAY, marginBottom: 20 }}>Tap the heart icon on any event to save it here.</div>
                  <button onClick={() => setShowSavedEvents(false)} style={{ padding: "10px 28px", borderRadius: 50, border: `1.5px solid ${DARK}`, background: DARK, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Browse Events</button>
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  {savedListings.map(l => (
                    <div key={l.id} onClick={() => { setSelectedCard(l); setShowSavedEvents(false); }}
                      style={{ display: "flex", gap: 14, padding: 12, borderRadius: 10, border: "1px solid #eee", marginBottom: 10, cursor: "pointer", background: "#fff", transition: "box-shadow 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                    >
                      <div style={{ position: "relative", width: 100, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                        <img src={l.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <span style={{ position: "absolute", top: 4, left: 4, background: l.type === "deal" ? CORAL : DARK, color: "#fff", fontSize: 7, fontWeight: 700, letterSpacing: 0.8, padding: "2px 5px", borderRadius: 50 }}>
                          {l.type === "both" ? "E+D" : l.type.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                          <span style={{ background: "#f0f0f0", padding: "1px 6px", borderRadius: 50, fontSize: 9, fontWeight: 500, color: "#4d4e4f" }}>{l.hood}</span>
                          <span style={{ background: "#f0f0f0", padding: "1px 6px", borderRadius: 50, fontSize: 9, fontWeight: 500, color: "#4d4e4f" }}>{l.cat}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: GRAY }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {l.date}
                          {l.dealValue && <> · <span style={{ color: CORAL, fontWeight: 500 }}>{l.dealValue}</span></>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: GRAY, marginTop: 2 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {l.venue}
                        </div>
                      </div>
                      {/* Remove from saved */}
                      <button onClick={(e) => { e.stopPropagation(); toggleFav(l.id); }}
                        style={{ alignSelf: "center", background: "none", border: "none", cursor: "pointer", padding: 6, flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={CORAL} stroke={CORAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ONBOARDING MODAL */}
      {showOnboarding && (() => {
        const obToggle = (set, setter, val) => { const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); setter(n); };
        const obNext = () => { if (obStep === 1 && obPlan === "free") setObStep(6); else if (obStep === 1) setObStep(2); else setObStep(obStep + 1); };
        const obPrev = () => { if (obStep === 6 && obPlan === "free") setObStep(1); else if (obStep === 3) setObStep(2); else setObStep(obStep - 1); };
        const obCanProceed = obStep === 0 ? obName && obEmail && obPassword.length >= 6 : obStep === 1 ? obPlan !== null : obStep === 3 ? obInterests.size >= 3 : obStep === 4 ? obHoods.size >= 1 : true;
        const ObCheck = ({ on }) => (<span style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${on ? DARK : "#ccc"}`, background: on ? DARK : "#fffdf7", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}</span>);
        return (
          <>
            <div onClick={() => setShowOnboarding(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, backdropFilter: "blur(2px)" }} />
            <div style={{ position: "fixed", inset: 0, zIndex: 301, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ background: BG, borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: F }}>
                <button onClick={() => setShowOnboarding(false)} style={{ position: "absolute", top: 16, right: 16, zIndex: 5, background: "none", border: "none", cursor: "pointer", fontSize: 20, color: GRAY, padding: 4 }}>✕</button>
                <div style={{ padding: "32px 36px 28px" }}>
                  {obStep > 0 && obStep < 6 && <button onClick={obPrev} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 500, color: GRAY, cursor: "pointer", fontFamily: F, marginBottom: 16, padding: 0 }}>← Back</button>}
                  {obStep === -1 && <button onClick={() => setObStep(0)} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 500, color: GRAY, cursor: "pointer", fontFamily: F, marginBottom: 16, padding: 0 }}>← Back to Sign Up</button>}

                  {/* Step -1: Log In */}
                  {obStep === -1 && (<div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>Welcome back</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 20 }}>Log in to your Wundervue account.</p>
                    <button style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: `1.5px solid ${BORDER}`, background: "#fff", color: DARK, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Log in with Google
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}><div style={{ flex: 1, height: 1, background: BORDER }} /><span style={{ fontSize: 12, color: GRAY }}>or</span><div style={{ flex: 1, height: 1, background: BORDER }} /></div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>Email</label>
                      <input value={obEmail} onChange={e => setObEmail(e.target.value)} type="email" placeholder="jane@example.com" style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>Password</label>
                      <input value={obPassword} onChange={e => setObPassword(e.target.value)} type="password" placeholder="Enter your password" style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} />
                    </div>
                    <div style={{ textAlign: "right", marginBottom: 18 }}>
                      <span style={{ fontSize: 12, color: CORAL, fontWeight: 500, cursor: "pointer" }}>Forgot password?</span>
                    </div>
                    <button onClick={() => { setIsLoggedIn(true); setShowOnboarding(false); }} disabled={!obEmail || obPassword.length < 6} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: obEmail && obPassword.length >= 6 ? DARK : "#ccc", color: "#fff", fontSize: 13, fontWeight: 500, cursor: obEmail && obPassword.length >= 6 ? "pointer" : "not-allowed", fontFamily: F }}>Log In</button>
                    <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: GRAY }}>Don't have an account? <span onClick={() => setObStep(0)} style={{ color: CORAL, fontWeight: 500, cursor: "pointer" }}>Sign up</span></div>
                  </div>)}

                  {/* Step 0: Create Account */}
                  {obStep === 0 && (<div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>Create your account</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 20 }}>Join Wundervue and discover the best of Denver.</p>
                    <button onClick={obNext} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: `1.5px solid ${BORDER}`, background: "#fff", color: DARK, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Continue with Google
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}><div style={{ flex: 1, height: 1, background: BORDER }} /><span style={{ fontSize: 12, color: GRAY }}>or</span><div style={{ flex: 1, height: 1, background: BORDER }} /></div>
                    {[["Full Name", obName, setObName, "text", "Jane Doe"], ["Email", obEmail, setObEmail, "email", "jane@example.com"], ["Password", obPassword, setObPassword, "password", "At least 6 characters"]].map(([label, val, setter, type, ph]) => (
                      <div key={label} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>{label}</label>
                        <input value={val} onChange={e => setter(e.target.value)} type={type} placeholder={ph} style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} />
                      </div>
                    ))}
                    <button onClick={obNext} disabled={!obCanProceed} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: obCanProceed ? DARK : "#ccc", color: "#fff", fontSize: 13, fontWeight: 500, cursor: obCanProceed ? "pointer" : "not-allowed", fontFamily: F, marginTop: 4 }}>Continue</button>
                    <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: GRAY }}>Already have an account? <span onClick={() => setObStep(-1)} style={{ color: CORAL, fontWeight: 500, cursor: "pointer" }}>Log in</span></div>
                  </div>)}

                  {/* Step 1: Choose Plan */}
                  {obStep === 1 && (<div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>Choose your plan</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 20 }}>Start free or unlock the full experience.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["free", "Explorer", "$0", "/forever", ["Browse all events & deals", "Basic filters", "Favorite up to 5 events", "Share with friends"]], ["insider", "Insider", "$4.99", "/month", ["Everything in Explorer, plus:", "Personalized recommendations", "Unlimited saves & calendar sync", "Advanced lifestyle filters", "Exclusive deals (coming soon)"]]].map(([id, name, price, per, feats]) => (
                      <div key={id} onClick={() => setObPlan(id)} style={{ border: `2px solid ${obPlan === id ? (id === "insider" ? CORAL : DARK) : BORDER}`, borderRadius: 10, padding: 14, cursor: "pointer", background: obPlan === id ? (id === "insider" ? "#fff5f5" : "#f8f8f6") : "#fff", position: "relative" }}>
                        {obPlan === id && <div style={{ position: "absolute", top: 12, right: 12 }}><ObCheck on={true} /></div>}
                        {id === "insider" && <span style={{ background: CORAL, color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 50, letterSpacing: 0.5, marginBottom: 4, display: "inline-block" }}>POPULAR</span>}
                        <div style={{ fontSize: 15, fontWeight: 500, color: DARK, marginBottom: 2 }}>{name}</div>
                        <div style={{ fontSize: 18, fontWeight: 500, color: DARK, marginBottom: 8 }}>{price} <span style={{ fontSize: 11, color: GRAY }}>{per}</span></div>
                        {feats.map((f, i) => <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 11, color: "#4d4e4f", marginBottom: 3, lineHeight: 1.4 }}><svg style={{ flexShrink: 0, marginTop: 1 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={id === "insider" ? CORAL : DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{f}</div>)}
                      </div>
                    ))}
                    </div>
                    <button onClick={obNext} disabled={!obCanProceed} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: obCanProceed ? DARK : "#ccc", color: "#fff", fontSize: 13, fontWeight: 500, cursor: obCanProceed ? "pointer" : "not-allowed", fontFamily: F, marginTop: 16 }}>{obPlan === "free" ? "Get Started" : "Continue"}</button>
                  </div>)}

                  {/* Step 2: Payment */}
                  {obStep === 2 && (<div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>Complete your subscription</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 18 }}>Insider plan — $4.99/month. Cancel anytime.</p>
                    <div style={{ background: "#f4f4f2", borderRadius: 10, padding: 14, marginBottom: 18, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 500 }}>Wundervue Insider</span><span style={{ fontSize: 13, fontWeight: 500 }}>$4.99/mo</span></div>
                    {[["Card Number", "1234 5678 9012 3456"]].map(([l, p]) => <div key={l} style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>{l}</label><input placeholder={p} style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} /></div>)}
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                      {[["Expiry", "MM / YY"], ["CVC", "123"]].map(([l, p]) => <div key={l} style={{ flex: 1 }}><label style={{ fontSize: 11, fontWeight: 500, color: DARK, display: "block", marginBottom: 4 }}>{l}</label><input placeholder={p} style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: F, border: `1.5px solid ${BORDER}`, borderRadius: 8, background: "#fff", color: DARK, outline: "none" }} /></div>)}
                    </div>
                    <button onClick={obNext} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: DARK, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Subscribe — $4.99/month</button>
                    <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: GRAY }}>Secure payment. Cancel anytime.</div>
                  </div>)}

                  {/* Step 3: Interests */}
                  {obStep === 3 && (<div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>What are you into?</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 4 }}>Pick at least 3 to personalize your recommendations.</p>
                    <p style={{ fontSize: 12, color: CORAL, fontWeight: 500, marginBottom: 18 }}>{obInterests.size} selected{obInterests.size < 3 && ` · ${3 - obInterests.size} more needed`}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {OB_INTERESTS.map(item => { const on = obInterests.has(item.id); return (
                        <div key={item.id} onClick={() => obToggle(obInterests, setObInterests, item.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${on ? DARK : BORDER}`, background: on ? "#f4f4f2" : "#fff", cursor: "pointer" }}>
                          <span style={{ fontSize: 16 }}>{item.icon}</span><span style={{ fontSize: 12, fontWeight: 500, color: DARK, flex: 1 }}>{item.label}</span><ObCheck on={on} />
                        </div>
                      ); })}
                    </div>
                    <button onClick={obNext} disabled={!obCanProceed} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: obCanProceed ? DARK : "#ccc", color: "#fff", fontSize: 13, fontWeight: 500, cursor: obCanProceed ? "pointer" : "not-allowed", fontFamily: F, marginTop: 20 }}>Continue</button>
                    <button onClick={obNext} style={{ width: "100%", padding: "8px 0", border: "none", background: "none", color: GRAY, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Skip this step</button>
                  </div>)}

                  {/* Step 4: Neighborhoods */}
                  {obStep === 4 && (<div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>Your neighborhoods</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 18 }}>Where do you like to explore?</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {OB_HOODS.map(h => { const on = obHoods.has(h); return (
                        <button key={h} onClick={() => obToggle(obHoods, setObHoods, h)} style={{ padding: "8px 16px", borderRadius: 50, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1.5px solid ${on ? DARK : "#d0d0d0"}`, background: on ? DARK : "#fff", color: on ? "#fff" : "#4d4e4f", fontFamily: F }}>{h}</button>
                      ); })}
                    </div>
                    <button onClick={obNext} disabled={!obCanProceed} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: obCanProceed ? DARK : "#ccc", color: "#fff", fontSize: 13, fontWeight: 500, cursor: obCanProceed ? "pointer" : "not-allowed", fontFamily: F, marginTop: 24 }}>Continue</button>
                    <button onClick={obNext} style={{ width: "100%", padding: "8px 0", border: "none", background: "none", color: GRAY, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Skip this step</button>
                  </div>)}

                  {/* Step 5: Lifestyle */}
                  {obStep === 5 && (<div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>Tell us about you</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 18 }}>Select all that apply.</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[{ id: "kids", label: "I have kids", sub: "Family-friendly events" }, { id: "dog", label: "I have a dog", sub: "Dog-friendly spots" }, { id: "couple", label: "Looking for date ideas", sub: "Date night events" }, { id: "foodie", label: "I'm a foodie", sub: "Restaurant deals & food events" }, { id: "new", label: "I'm new to Denver", sub: "Help exploring the city" }].map(item => { const on = obLifestyle.has(item.id); return (
                        <div key={item.id} onClick={() => obToggle(obLifestyle, setObLifestyle, item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${on ? DARK : BORDER}`, background: on ? "#f4f4f2" : "#fff", cursor: "pointer" }}>
                          <ObCheck on={on} /><div><div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{item.label}</div><div style={{ fontSize: 11, color: GRAY }}>{item.sub}</div></div>
                        </div>
                      ); })}
                    </div>
                    <button onClick={() => setObStep(6)} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: DARK, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F, marginTop: 20 }}>Finish Setup</button>
                    <button onClick={() => setObStep(6)} style={{ width: "100%", padding: "8px 0", border: "none", background: "none", color: GRAY, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Skip for now</button>
                  </div>)}

                  {/* Step 6: Confirmation */}
                  {obStep === 6 && (<div style={{ textAlign: "center", paddingTop: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: DARK, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: DARK }}>{obPlan === "insider" ? "Welcome, Insider!" : "You're all set!"}</h2>
                    <p style={{ fontSize: 14, color: GRAY, marginBottom: 24 }}>{obPlan === "insider" ? "Your personalized recommendations are ready." : "Your free account is ready. Start exploring!"}</p>
                    <button onClick={() => { setIsLoggedIn(true); setShowOnboarding(false); }} style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: DARK, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F }}>Start Exploring Denver</button>
                  </div>)}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
