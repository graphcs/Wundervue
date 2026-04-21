import { TrendingBar } from "./TrendingBar";
import { LogoBar } from "./LogoBar";
import { NavBar } from "./NavBar";

export function Header() {
  return (
    <header className="bg-bg sticky top-0 z-40">
      <TrendingBar />
      <LogoBar />
      <NavBar />
    </header>
  );
}
