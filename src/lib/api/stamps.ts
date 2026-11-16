import { apiPostForFile } from "@/lib/api/http";

/*
 * Generated digital stamps (API 0.26.0): the person types the text of a
 * company stamp and the API draws it, like a rubber stamp. Saved with the
 * signature (`/v1/me/signature`), placed in STAMP fields, and previewed
 * without a session (signers by link use the preview too).
 */

export type StampShape = "ROUND" | "OVAL" | "RECTANGLE";
export type StampColour = "BLUE" | "RED" | "BLACK" | "GREEN" | "PURPLE";

export type Stamp = {
  shape: StampShape;
  colour: StampColour;
  /** 1-60 characters: along the top arc, or the first line (bold) of a rectangle. */
  top_text: string;
  /** 0-3 lines of at most 30 characters each. */
  centre_lines: string[];
  /** 0-60 characters: along the bottom arc, or the last line. */
  bottom_text: string;
  /** Prints the day the stamp is applied in the centre ("16 NOV 2026"). */
  include_date: boolean;
};

/** A transparent PNG about 600 pixels on its long side. `date` (YYYY-MM-DD) is the day printed when `include_date`. */
export const previewStamp = (stamp: Stamp, date?: string) =>
  apiPostForFile("/v1/stamp-preview", { stamp, ...(date ? { date } : {}) });
