import { apiFetch } from "@/lib/api/http";
import type { Logo } from "@/lib/api/types";

/**
 * The public profiles the signed-in person belongs to, and their logos.
 * A logo is public: it is shown on the profile and beside the advertiser's
 * name on listings. Who may change one is decided by the API (the owner or a
 * manager of an organisation; an agent for their own profile).
 */
export type MyProfile = { kind: string; slug: string; name: string; verified: boolean; logo: Logo | null };

export const listMyProfiles = () => apiFetch<{ profiles: MyProfile[] }>("/v1/me/profiles");

const logoPath = (profile: Pick<MyProfile, "kind" | "slug">) =>
  `/v1/me/profiles/${encodeURIComponent(profile.kind)}/${encodeURIComponent(profile.slug)}/logo`;

/** PNG or JPEG, at most 2 MB, 128 to 4096 pixels on each side. 415, 413 or 400 on `fields.file` otherwise. */
export function uploadProfileLogo(profile: Pick<MyProfile, "kind" | "slug">, file: File) {
  const form = new FormData();
  form.set("file", file);
  return apiFetch<{ profile: MyProfile }>(logoPath(profile), { method: "PUT", body: form });
}

export const removeProfileLogo = (profile: Pick<MyProfile, "kind" | "slug">) =>
  apiFetch<null>(logoPath(profile), { method: "DELETE" });
