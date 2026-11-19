"use client";

import qrcode from "qrcode-generator";
import { useId, useMemo } from "react";

type Props = {
  /** The otpauth:// address the authenticator app reads. */
  uri: string;
  /** The API's own drawing of the code, as SVG markup, when it sends one. */
  svg?: string | null;
  /** Id of the text that holds the key for typing, read after the image. */
  describedBy?: string;
};

/** The dark squares of the code as one SVG path, one unit per module, with a 4-module quiet zone. */
function qrPath(uri: string): { size: number; path: string } | null {
  try {
    const code = qrcode(0, "M");
    code.addData(uri);
    code.make();
    const count = code.getModuleCount();
    const parts: string[] = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (code.isDark(row, col)) parts.push(`M${col + 4} ${row + 4}h1v1h-1z`);
      }
    }
    return { size: count + 8, path: parts.join("") };
  } catch {
    return null;
  }
}

/**
 * The QR code an authenticator app scans. The API's SVG is shown as an image
 * (so nothing in it can run), else the code is drawn here. Always dark on
 * white, so every camera can read it.
 */
export function MfaQr({ uri, svg, describedBy }: Props) {
  const labelId = useId();
  const drawn = useMemo(() => (svg ? null : qrPath(uri)), [svg, uri]);
  const label = "QR code for your authenticator app. Scan this code, or enter the key below.";

  const frame = "block size-56 max-w-full rounded-md border border-line bg-white p-2";

  if (svg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URL; next/image adds nothing here.
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        alt={label}
        aria-describedby={describedBy}
        width={224}
        height={224}
        className={frame}
      />
    );
  }

  if (!drawn) {
    return (
      <p className="rounded-md border border-dashed border-line-strong p-4 text-sm text-muted">
        We could not draw the QR code. Enter the key below in your authenticator app instead.
      </p>
    );
  }

  return (
    <svg
      role="img"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      viewBox={`0 0 ${drawn.size} ${drawn.size}`}
      shapeRendering="crispEdges"
      className={`${frame} text-ink`}
    >
      <title id={labelId}>{label}</title>
      <rect width={drawn.size} height={drawn.size} className="fill-white" />
      <path d={drawn.path} fill="currentColor" />
    </svg>
  );
}
