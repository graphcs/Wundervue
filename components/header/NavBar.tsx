import { ProfileIcon } from "./ProfileIcon";
import navData from "@/lib/data/wundervue-nav.json";

export function NavBar() {
  return (
    <nav className="border-border relative flex items-center justify-center border-b px-4 py-3">
      <ul className="flex items-center gap-8">
        {navData.nav.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark text-[11px] font-bold uppercase tracking-[0.08em] hover:opacity-70"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <ProfileIcon />
      </div>
    </nav>
  );
}
