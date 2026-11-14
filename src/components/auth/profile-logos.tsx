"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { VerifiedMark } from "@/components/listings/advertiser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo-mark";
import { listMyProfiles, removeProfileLogo, uploadProfileLogo, type MyProfile } from "@/lib/api/profiles";
import { LOGO_ACCEPT, LOGO_FORMATS_NOTE, logoProblem } from "@/lib/logo-rules";

type Notice = { tone: "status" | "alert"; text: string };

/** One public profile: its logo or initials, and the controls to change or remove the logo. */
function ProfileLogo({ profile, onChanged }: { profile: MyProfile; onChanged: (profile: MyProfile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const id = `profile-logo-${profile.kind}-${profile.slug}`;

  async function upload(file: File) {
    const problem = logoProblem(file);
    if (problem) return setNotice({ tone: "alert", text: problem });
    setBusy("uploading");
    setNotice({ tone: "status", text: `Uploading ${file.name}…` });
    const result = await uploadProfileLogo(profile, file);
    setBusy(null);
    if (result.ok) {
      onChanged(result.data.profile);
      setNotice({ tone: "status", text: "The new logo is saved. It can take a minute to show on your profile and listings." });
    } else {
      const { failure } = result;
      setNotice({
        tone: "alert",
        text:
          // The API says only what is wrong ("must be between 128x128 and 4096x4096 pixels").
          (failure.fields?.file ? `The image ${failure.fields.file}.` : undefined) ??
          (failure.status === 403 ? "Only the owner or a manager of this business can change its logo." : failure.message),
      });
    }
  }

  async function remove() {
    setBusy("removing");
    setConfirming(false);
    setNotice({ tone: "status", text: "Removing the logo…" });
    const result = await removeProfileLogo(profile);
    setBusy(null);
    if (result.ok) {
      onChanged({ ...profile, logo: null });
      setNotice({ tone: "status", text: "The logo was removed. Your initials are shown in its place." });
    } else {
      setNotice({
        tone: "alert",
        text: result.failure.status === 403 ? "Only the owner or a manager of this business can remove its logo." : result.failure.message,
      });
    }
  }

  return (
    <li aria-labelledby={`${id}-name`} className="rounded-lg border border-line p-4">
      <div className="flex items-center gap-4">
        <LogoMark name={profile.name} logo={profile.logo} className="size-16 text-xl" />
        <div className="min-w-0">
          <p id={`${id}-name`} className="break-words font-semibold text-ink">
            <Link href={`/directory/${profile.kind}/${profile.slug}`} className="text-primary-ink hover:underline">
              {profile.name}
            </Link>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <VerifiedMark verified={profile.verified} />
            {profile.logo ? "Logo shown" : "No logo: initials shown"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* The file input is driven by the button, which is the labelled, focusable control. */}
        <input
          ref={input}
          type="file"
          accept={LOGO_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          variant="secondary"
          disabled={busy !== null}
          aria-busy={busy === "uploading"}
          aria-describedby={`${id}-name ${id}-notice`}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" />
          {busy === "uploading" ? "Uploading…" : profile.logo ? "Upload a new logo" : "Upload a logo"}
        </Button>
        {profile.logo && !confirming && (
          <Button variant="ghost" disabled={busy !== null} aria-busy={busy === "removing"} onClick={() => setConfirming(true)}>
            {busy === "removing" ? "Removing…" : "Remove logo"}
          </Button>
        )}
      </div>

      {confirming && (
        <div role="group" aria-label="Confirm removing the logo" className="mt-3 rounded-md bg-sunken p-3 text-sm text-ink">
          <p>Remove the logo of {profile.name}? Your initials are then shown on your profile and listings.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={remove}>
              Yes, remove it
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      <div id={`${id}-notice`} className="mt-2 text-sm">
        <p role="status" className="text-muted">
          {notice?.tone === "status" ? notice.text : notice ? "" : LOGO_FORMATS_NOTE}
        </p>
        <p role="alert" className="text-danger">
          {notice?.tone === "alert" ? notice.text : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * "Your public profile" on the account page: each profile the signed-in
 * person belongs to, with its logo and the controls to replace or remove it.
 * Nothing is shown to someone without a profile, or when the list cannot be
 * read: the block is an extra, not the page.
 */
export function ProfileLogos({ className }: { className?: string }) {
  const [profiles, setProfiles] = useState<MyProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    listMyProfiles().then((result) => {
      if (!cancelled && result.ok) setProfiles(result.data.profiles);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (profiles.length === 0) return null;

  return (
    <Card className={className}>
      <h2 className="text-2xl">{profiles.length === 1 ? "Your public profile" : "Your public profiles"}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        The logo is public. It is shown on the profile under Professionals and beside the name on listings. Without
        one, the initials are shown.
      </p>
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {profiles.map((profile) => (
          <ProfileLogo
            key={`${profile.kind}/${profile.slug}`}
            profile={profile}
            onChanged={(next) =>
              setProfiles((current) => current.map((item) => (item.kind === next.kind && item.slug === next.slug ? next : item)))
            }
          />
        ))}
      </ul>
    </Card>
  );
}
