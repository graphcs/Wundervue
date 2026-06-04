import { probeImage, type ImageProbeOk, type ImageProbeFail } from "./imageProbe";
import { generateImage, type GenerateInput } from "./generateImage";
import { uploadListingImage, isStorageBucketUrl } from "./uploadImage";
import { extractOgImageFromUrl } from "./sourceImage";

// Decides what image to attach to a listing. Order:
//
//   1. If image_url already points at our Storage bucket, keep it (no work).
//   2. If we have a source page URL, fetch its og:image first — that's where
//      Eventbrite, library calendars, Meetup etc. publish the full-resolution
//      event poster, and it's almost always higher quality than a connector
//      thumbnail (SerpAPI's gstatic CDN strips images down to ~300-500px).
//      Probe and mirror to Storage if it passes.
//   3. Fall back to the connector-provided URL (Instagram displayUrl,
//      SerpAPI thumbnail, scraper <img src>). Probe and mirror if it passes.
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

// Simpleview / Cloudinary CDNs serve a tiny blurred placeholder by default and
// stash the real asset behind a lazy attr that's often still small or in a
// format we can't probe (avif). The transform segment after `/image/upload/`
// is freely rewritable, so request a large, high-quality landscape JPG that
// clears the probe's quality gate. No-op for any other URL.
function upgradeCdnImage(url: string): string {
  if (!/(assets\.simpleviewinc\.com|res\.cloudinary\.com)\//.test(url)) return url;
  return url.replace(/(\/image\/upload\/)([^/]+)(\/)/, (m, p1, seg, p3) =>
    /(^|,)(c_|w_|h_|q_|f_|e_|g_|ar_|dpr_)/.test(seg)
      ? `${p1}c_fill,f_jpg,w_1200,h_675,q_80${p3}`
      : m,
  );
}

export async function resolveListingImage(input: PipelineInput): Promise<PipelineResult> {
  if (isStorageBucketUrl(input.sourceImageUrl)) {
    return { url: input.sourceImageUrl as string, source: "existing" };
  }

  let lastReason: string | undefined;
  // A real image that failed only the quality gate (too small / wrong aspect).
  // Kept as a last-ditch fallback so we never drop a listing that has a genuine
  // poster just because it isn't card-perfect and AI generation also failed.
  let degraded: ImageProbeFail | undefined;

  // Step 1: og:image from the source page when we have one — almost always
  // the highest-resolution image available, since publishers tune the OG tag
  // for social cards. One extra HTTP fetch on the happy path, but
  // extractOgImageFromUrl caps at 65KB and stops at </head>.
  if (input.sourcePageUrl) {
    const ogRaw = await extractOgImageFromUrl(input.sourcePageUrl);
    const ogUrl = ogRaw ? upgradeCdnImage(ogRaw) : ogRaw;
    if (ogUrl) {
      const probe = await probeImage(ogUrl);
      if (probe.ok) {
        return await uploadProbed(input.slug, probe, "og-image");
      }
      lastReason = `og:image ${probe.reason}`;
      if (probe.bytes) degraded = probe;
    } else {
      lastReason = "no og:image on source page";
    }
  }

  // Step 2: connector-provided image as fallback.
  if (input.sourceImageUrl) {
    const probe = await probeImage(upgradeCdnImage(input.sourceImageUrl));
    if (probe.ok) {
      return await uploadProbed(input.slug, probe, "scraped", lastReason);
    }
    lastReason = probe.reason;
    // Prefer the og:image as the degraded fallback (higher res); only take the
    // connector image if og didn't leave us one.
    if (!degraded && probe.bytes) degraded = probe;
  } else if (!lastReason) {
    lastReason = "no source url";
  }

  // Step 3: AI generation as last resort.
  try {
    const generated = await generateImage(input.meta);
    const upload = await uploadListingImage({
      slug: input.slug,
      bytes: generated.bytes,
      contentType: generated.contentType,
      ext: generated.ext,
    });
    return { url: upload.publicUrl, source: "generated", reason: lastReason };
  } catch (genErr) {
    // Step 4: graceful degradation — AI generation failed, but if we found a
    // real (if imperfect) source image, use it rather than dropping the
    // listing. Only when there's genuinely nothing usable do we propagate.
    if (degraded?.bytes && degraded.contentType && degraded.ext) {
      const upload = await uploadListingImage({
        slug: input.slug,
        bytes: degraded.bytes,
        contentType: degraded.contentType,
        ext: degraded.ext,
      });
      return {
        url: upload.publicUrl,
        source: "scraped",
        reason: `ai-gen failed (${genErr instanceof Error ? genErr.message : String(genErr)}); used source image (${lastReason})`,
      };
    }
    throw genErr;
  }
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
