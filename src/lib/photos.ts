import type { StaticImageData } from "next/image";
import agents from "@/assets/images/agents.jpg";
import cityBulawayo from "@/assets/images/city-bulawayo.jpg";
import cityHarare from "@/assets/images/city-harare.jpg";
import cityVictoriaFalls from "@/assets/images/city-victoria-falls.jpg";
import apartmentAvenues from "@/assets/images/listing-apartment-avenues.jpg";
import apartmentAvondale from "@/assets/images/listing-apartment-avondale.jpg";
import apartmentBelgravia from "@/assets/images/listing-apartment-belgravia.jpg";
import cottageGreystonePark from "@/assets/images/listing-cottage-greystone-park.jpg";
import houseBorrowdale from "@/assets/images/listing-house-borrowdale.jpg";
import houseBurnside from "@/assets/images/listing-house-burnside.jpg";
import houseGlenLorne from "@/assets/images/listing-house-glen-lorne.jpg";
import houseHighlands from "@/assets/images/listing-house-highlands.jpg";
import houseMutare from "@/assets/images/listing-house-mutare.jpg";
import houseSuburbsBulawayo from "@/assets/images/listing-house-suburbs-bulawayo.jpg";
import houseVictoriaFalls from "@/assets/images/listing-house-victoria-falls.jpg";
import officeCbd from "@/assets/images/listing-office-cbd.jpg";
import officeEastlea from "@/assets/images/listing-office-eastlea.jpg";
import plotMutare from "@/assets/images/listing-plot-mutare.jpg";
import standHillside from "@/assets/images/listing-stand-hillside.jpg";
import standRuwa from "@/assets/images/listing-stand-ruwa.jpg";
import townhouseGreendale from "@/assets/images/listing-townhouse-greendale.jpg";
import townhouseMountPleasant from "@/assets/images/listing-townhouse-mount-pleasant.jpg";
import type { Photo } from "@/lib/api/types";

/**
 * Photos.
 *
 * The API stores a photo as `/assets/images/<file>.jpg` with its alt text and
 * pixel size. Object storage and uploads are not built, so today those files
 * are the ones bundled from src/assets/images. Bundled files get hashed URLs,
 * responsive sizes and a blur placeholder from next/image, so a photo whose
 * file name is bundled is served from the bundle; any other photo is served
 * from the URL the API gave, with the API's width and height.
 *
 * This is a file-name index of assets, not content: which photo a listing
 * has, and its alt text, always come from the API.
 */
const bundled: Record<string, StaticImageData> = {
  "agents.jpg": agents,
  "city-bulawayo.jpg": cityBulawayo,
  "city-harare.jpg": cityHarare,
  "city-victoria-falls.jpg": cityVictoriaFalls,
  "listing-apartment-avenues.jpg": apartmentAvenues,
  "listing-apartment-avondale.jpg": apartmentAvondale,
  "listing-apartment-belgravia.jpg": apartmentBelgravia,
  "listing-cottage-greystone-park.jpg": cottageGreystonePark,
  "listing-house-borrowdale.jpg": houseBorrowdale,
  "listing-house-burnside.jpg": houseBurnside,
  "listing-house-glen-lorne.jpg": houseGlenLorne,
  "listing-house-highlands.jpg": houseHighlands,
  "listing-house-mutare.jpg": houseMutare,
  "listing-house-suburbs-bulawayo.jpg": houseSuburbsBulawayo,
  "listing-house-victoria-falls.jpg": houseVictoriaFalls,
  "listing-office-cbd.jpg": officeCbd,
  "listing-office-eastlea.jpg": officeEastlea,
  "listing-plot-mutare.jpg": plotMutare,
  "listing-stand-hillside.jpg": standHillside,
  "listing-stand-ruwa.jpg": standRuwa,
  "listing-townhouse-greendale.jpg": townhouseGreendale,
  "listing-townhouse-mount-pleasant.jpg": townhouseMountPleasant,
};

export type ResolvedPhoto = {
  /** A bundled image (optimised, with a blur placeholder) or the API's URL. */
  src: StaticImageData | string;
  /** The URL to use in metadata and structured data. */
  url: string;
  alt: string;
  width: number;
  height: number;
  bundled: boolean;
};

const fileName = (url: string) => url.split(/[?#]/)[0].split("/").pop() ?? "";

export function resolvePhoto(photo: Photo): ResolvedPhoto {
  const image = photo.url.startsWith("/assets/images/") ? bundled[fileName(photo.url)] : undefined;
  if (image) {
    return {
      src: image,
      url: image.src,
      alt: photo.alt,
      width: image.width,
      height: image.height,
      bundled: true,
    };
  }
  return { src: photo.url, url: photo.url, alt: photo.alt, width: photo.width, height: photo.height, bundled: false };
}

/** The cover photo: the first one. Undefined when the listing has no photos. */
export function coverPhoto(photos: Photo[]): ResolvedPhoto | undefined {
  return photos[0] ? resolvePhoto(photos[0]) : undefined;
}

/**
 * City tile artwork on the landing page, by file name `city-<city code>.jpg`.
 * A city without artwork borrows a listing photo, or shows a neutral frame.
 */
export function cityArtwork(cityCode: string): StaticImageData | undefined {
  return bundled[`city-${cityCode}.jpg`];
}
