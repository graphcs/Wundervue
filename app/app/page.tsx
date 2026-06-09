import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Get the App — Wundervue" };

export default function GetTheAppPage() {
  return (
    <ComingSoon
      title="The Wundervue app is coming"
      blurb="We're building native iOS and Android apps so you can take Denver's best events and deals everywhere. Stay tuned."
    />
  );
}
