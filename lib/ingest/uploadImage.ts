import { getServiceClient } from "./persist";

const BUCKET = "listings-images";

export interface UploadInput {
  slug: string;
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}

export interface UploadResult {
  publicUrl: string;
  path: string;
}

// Mirrors any image (scraped or AI-generated) into the public listings-images
// bucket so the rendered card never points at an upstream URL we don't control.
// Slug is unique on listings, so it's a safe storage key — re-ingesting the
// same row overwrites in place via upsert.
export async function uploadListingImage(input: UploadInput): Promise<UploadResult> {
  const client = getServiceClient();
  const path = `${input.slug}.${input.ext}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, input.bytes, {
      contentType: input.contentType,
      upsert: true,
      cacheControl: "31536000", // 1 year — we rewrite under the same path on re-ingest
    });
  if (error) throw new Error(`storage upload failed: ${error.message}`);

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}

export async function deleteListingImagesBySlug(slugs: string[]): Promise<number> {
  if (slugs.length === 0) return 0;
  const client = getServiceClient();
  // We don't track the extension we wrote, so try the common ones. The Storage
  // API ignores misses inside a remove([…]) call — failures only happen for
  // bucket/permission errors, not "object not found".
  const paths = slugs.flatMap((s) => [`${s}.jpg`, `${s}.png`, `${s}.webp`]);
  const { data, error } = await client.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(`storage delete failed: ${error.message}`);
  return data?.length ?? 0;
}

export function isStorageBucketUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(`/storage/v1/object/public/${BUCKET}/`);
}
