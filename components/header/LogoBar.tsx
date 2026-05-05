import Image from "next/image";
import Link from "next/link";

export function LogoBar() {
  return (
    <div className="bg-bg flex items-center justify-center px-4 py-4">
      <Link href="/explore" aria-label="Wundervue — home" className="inline-block">
        <Image
          src="/images/wundervue-logo.webp"
          alt="Wundervue"
          width={194}
          height={62}
          priority
          className="h-[62px] w-auto"
        />
      </Link>
    </div>
  );
}
