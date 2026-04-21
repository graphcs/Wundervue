import Link from "next/link";
import { ProfileIcon } from "./ProfileIcon";

const NAV_LINKS = [
  { href: "#best-of", label: "Best Of" },
  { href: "#lifestyle", label: "Lifestyle" },
  { href: "#monthly-guides", label: "Monthly Guides" },
  { href: "#spotlights", label: "Spotlights" },
  { href: "#about", label: "About" },
];

export function NavBar() {
  return (
    <nav className="border-border relative flex items-center justify-center border-b px-4 py-3">
      <ul className="flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-dark text-[11px] font-bold uppercase tracking-[0.08em] hover:opacity-70"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <ProfileIcon />
      </div>
    </nav>
  );
}
