import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Stories — Wundervue" };

export default function StoriesPage() {
  return (
    <ComingSoon
      title="Stories"
      blurb="Local stories, interviews, and behind-the-scenes from Denver's scene are coming soon."
    />
  );
}
