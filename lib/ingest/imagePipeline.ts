import { probeImage, type ImageProbeOk } from "./imageProbe";
import { generateImage, type GenerateInput } from "./generateImage";
import { uploadListingImage, isStorageBucketUrl } from "./uploadImage";
import { extractOgImageFromUrl } from "./sourceImage";

// Decides what image to attach to a listing. Order:
//
//   1. If image_url already points at our Storage bucket, keep it (no work).
//   2. Probe the connector-provided URL (e.g. SerpAPI's gstatic thumbnail,
//      Instagram displayUrl, web scraper's <img src>). If it passes the size
//      + ratio check, mirror it to Storage.
//   3. If we have a source page URL, fetch it and read its og:image meta tag
//      — that's where Eventbrite, library calendars, Meetup etc. publish the
//      full-resolution event poster. Probe that, mirror if it passes.
//   4. Generate a Flux 2 Pro image and upload that.
//
// Returns the final public URL. Throws when every option fails — callers
// decide whether to drop the listing.

export interface PipelineInput {
  slug: string;
  sourceImageUrl: string | null | undefined;
  // The article / event page URL. When present we'll mine it for og:image
  // before falling through to AI generation — it's almost always higher
  // quality than whatever the connector handed us.
  sourcePageUrl?: string | null;
  meta: GenerateInput;
}

export interface PipelineResult {
  url: string;
  source: "existing" | "scraped" | "og-image" | "generated";
  reason?: string; // why we fell back when source !== "scraped"
}

export async function resolveListingImage(input: PipelineInput): Promise<PipelineResult> {
  if (isStorageBucketUrl(input.sourceImageUrl)) {
    return { url: input.sourceImageUrl as string, source: "existing" };
  }

  let lastReason: string | undefined;

  // Step 1: connector-provided image.
  if (input.sourceImageUrl) {
    const probe = await probeImage(input.sourceImageUrl);
    if (probe.ok) {
      return await uploadProbed(input.slug, probe, "scraped");
    }
    lastReason = probe.reason;
  } else {
    lastReason = "no source url";
  }

  // Step 2: og:image from the source page (only when the connector image was
  // missing or failed the probe — we don't fetch the page on the happy path).
  if (input.sourcePageUrl) {
    const ogUrl = await extractOgImageFromUrl(input.sourcePageUrl);
    if (ogUrl) {
      const probe = await probeImage(ogUrl);
      if (probe.ok) {
        return await uploadProbed(input.slug, probe, "og-image", lastReason);
      }
      lastReason = `og:image ${probe.reason}`;
    }
  }

  // Step 3: AI generation as last resort.
  const generated = await generateImage(input.meta);
  const upload = await uploadListingImage({
    slug: input.slug,
    bytes: generated.bytes,
    contentType: generated.contentType,
    ext: generated.ext,
  });
  return { url: upload.publicUrl, source: "generated", reason: lastReason };
}

async function uploadProbed(
  slug: string,
  probe: ImageProbeOk,
  source: PipelineResult["source"],
  reason?: string,
): Promise<PipelineResult> {
  const upload = await uploadListingImage({
    slug,
    bytes: probe.bytes,
    contentType: probe.contentType,
    // Animated gifs get re-keyed as png; bytes unchanged but ext stays simple.
    ext: probe.ext === "gif" ? "png" : probe.ext,
  });
  return { url: upload.publicUrl, source, reason };
}
