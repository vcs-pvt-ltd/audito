/** Evidence photos may be up to 5 MB so they stay sharp in reports (same limit as the API). */
export const MAX_EVIDENCE_IMAGE_BYTES = 5 * 1024 * 1024;
/** Video and audio evidence stays at 2 MB. */
export const MAX_EVIDENCE_MEDIA_BYTES = 2 * 1024 * 1024;

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why an evidence file is too large to upload, or null when it fits. */
export function evidenceSizeProblem(file: { size: number; type: string }): string | null {
  if (file.type.startsWith("image/")) {
    return file.size > MAX_EVIDENCE_IMAGE_BYTES ? `Images must be 5 MB or less (this one is ${formatMb(file.size)}).` : null;
  }
  return file.size > MAX_EVIDENCE_MEDIA_BYTES ? `Video and audio must be 2 MB or less (this one is ${formatMb(file.size)}).` : null;
}

export type OptimizedImageResult = {
  file: File;
  optimized: boolean;
};

type OptimizeImageOptions = {
  maxBytes?: number;
  maxLongEdge?: number;
  minLongEdge?: number;
  fallbackName?: string;
};

// Only high qualities: a clear image matters more than a small file.
const JPEG_QUALITIES = [0.92, 0.9, 0.88, 0.85, 0.82];

function renderJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Keeps evidence images untouched when they already fit the upload policy.
 * Larger images are converted once, without cropping, using high JPEG quality
 * first and smaller dimensions only when that is necessary (never below a
 * 2048 px long edge by default, so details stay readable).
 */
export async function optimizeEvidenceImage(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  const maxBytes = options.maxBytes ?? MAX_EVIDENCE_IMAGE_BYTES;
  const maxLongEdge = options.maxLongEdge ?? 4096;
  const minLongEdge = Math.min(options.minLongEdge ?? 2048, maxLongEdge);

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be optimized.");
  }
  if (file.size <= maxBytes) return { file, optimized: false };

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loaded = new window.Image();
      loaded.onload = () => resolve(loaded);
      loaded.onerror = () => reject(new Error("The selected image could not be read."));
      loaded.src = sourceUrl;
    });

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const sourceLongEdge = Math.max(sourceWidth, sourceHeight);
    if (!sourceWidth || !sourceHeight || !sourceLongEdge) {
      throw new Error("The selected image has invalid dimensions.");
    }

    let scale = Math.min(1, maxLongEdge / sourceLongEdge);
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");

    while (true) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is not supported in this browser.");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      // JPEG has no transparency. A white background avoids black areas when a
      // transparent PNG or WebP is supplied as evidence.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of JPEG_QUALITIES) {
        const blob = await renderJpeg(canvas, quality);
        if (blob && blob.size <= maxBytes) {
          const baseName = file.name.replace(/\.[^/.]+$/, "") || options.fallbackName || "evidence";
          return {
            file: new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
              lastModified: file.lastModified,
            }),
            optimized: true,
          };
        }
      }

      const longEdge = Math.max(width, height);
      if (longEdge <= minLongEdge) break;
      const nextLongEdge = Math.max(minLongEdge, Math.round(longEdge * 0.85));
      const nextScale = nextLongEdge / longEdge;
      width = Math.max(1, Math.round(width * nextScale));
      height = Math.max(1, Math.round(height * nextScale));
    }

    throw new Error(
      `This image could not be reduced below ${formatMb(maxBytes)} without losing too much detail. Try a smaller image.`
    );
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
