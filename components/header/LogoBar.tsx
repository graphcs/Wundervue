import Image from "next/image";
import Link from "next/link";

export function LogoBar() {
  return (
    <div className="bg-bg flex items-center justify-center px-4 py-4">
      <Link href="/explore" aria-label="Wundervue — home" className="inline-block">
        <Image
          src="/images/wundervue-logo.webp"
          alt="Wundervue"
          width={186}
          height={60}
          priority
          className="h-[48px] w-auto"
        />
      </Link>
    </div>
  );
}
