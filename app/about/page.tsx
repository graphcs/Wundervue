import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "About Us — Wundervue" };

export default function AboutPage() {
  return (
    <ComingSoon
      title="About Wundervue"
      blurb="Wundervue helps you discover the best events, deals, and things to do in Denver. More about our story soon."
    />
  );
}
