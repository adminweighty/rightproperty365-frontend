"use client";

import { PhotoManagerFor, type PhotoApi } from "@/components/agent/photo-manager";
import {
  deleteDevelopmentPhoto,
  describeDevelopmentPhoto,
  orderDevelopmentPhotos,
  uploadDevelopmentPhoto,
} from "@/lib/api/developments";
import type { ApiResult } from "@/lib/api/http";
import type { ManagedPhoto, PhotoSize } from "@/lib/api/manage-listings";
import type { ManagedDevelopment, ManagedPhotoOfDevelopment } from "@/lib/developments";
import { PHOTO_LIMIT } from "@/lib/listing-photos";

/** The stored size a variant address names (`…/medium?v=…`); the widest is "large" when it says nothing. */
function sizeOf(url: string, index: number): PhotoSize {
  const named = /\/(large|medium|small)(?:\?|$)/.exec(url)?.[1] as PhotoSize | undefined;
  return named ?? (index === 0 ? "large" : index === 1 ? "medium" : "small");
}

/** A project photo in the shape the photo manager shows (the listing photo's). */
export function toManagedPhoto(photo: ManagedPhotoOfDevelopment): ManagedPhoto {
  const variants = [...(photo.variants ?? [])].sort((a, b) => b.width - a.width);
  return {
    id: photo.id,
    position: photo.position,
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    status: photo.approved ? "APPROVED" : "PENDING_REVIEW",
    url: photo.url,
    variants: variants.map((variant, index) => ({ ...variant, size: sizeOf(variant.url, index) })),
    created_at: "",
  };
}

const CONFLICTS = new Set(["DEVELOPMENT_LOCKED", "DEVELOPMENT_STATE_CONFLICT", "DEVELOPMENT_CHANGED"]);

async function unwrap(answer: Promise<ApiResult<{ development: ManagedDevelopment }>>): Promise<ApiResult<ManagedDevelopment>> {
  const result = await answer;
  return result.ok ? { ...result, data: result.data.development } : result;
}

function developmentPhotoApi(organisationId: string): PhotoApi<ManagedDevelopment> {
  return {
    toSet: (development) => ({
      ownerId: development.id,
      photos: [...development.photos].sort((a, b) => a.position - b.position).map(toManagedPhoto),
      limit: PHOTO_LIMIT,
      isPublic: development.moderation_status === "PUBLISHED",
    }),
    upload: (id, file, onProgress) => unwrap(uploadDevelopmentPhoto(organisationId, id, file, onProgress)),
    describe: (id, photoId, alt) => unwrap(describeDevelopmentPhoto(organisationId, id, photoId, alt)),
    order: (id, photoIds) => unwrap(orderDevelopmentPhotos(organisationId, id, photoIds)),
    remove: (id, photoId) => unwrap(deleteDevelopmentPhoto(organisationId, id, photoId)),
    conflicts: CONFLICTS,
    noun: "project",
  };
}

type Props = {
  organisationId: string;
  development: ManagedDevelopment;
  editable: boolean;
  onChange: (development: ManagedDevelopment) => void;
  onConflict: (message: string) => void;
};

/**
 * The project's photos, with the listing photo manager: upload (with the
 * malware-scan messages of API 0.41.0), describe, reorder and delete. Locked
 * while the project waits for review or is public.
 */
export function DevelopmentPhotos({ organisationId, development, editable, onChange, onConflict }: Props) {
  return (
    <PhotoManagerFor
      owner={development}
      api={developmentPhotoApi(organisationId)}
      editable={editable}
      onChange={onChange}
      onConflict={onConflict}
    />
  );
}
