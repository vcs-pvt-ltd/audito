export type OrganizationLogoCrop = "wide" | "square";
export type OrganizationLogoCropArea = { x: number; y: number; width: number; height: number };

export const ORGANIZATION_LOGO_CROPS: Record<OrganizationLogoCrop, { label: string; ratio: number }> = {
  wide: { label: "Report header", ratio: 3 / 1 },
  square: { label: "Square", ratio: 1 },
};

const MAX_OUTPUT_BYTES = 650 * 1024;

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error("Unable to prepare the organization logo."));
  reader.readAsDataURL(blob);
});

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("Unable to compress the organization logo."));
  }, "image/jpeg", quality);
});

/** Crops and compresses a logo for safe, consistent report branding. */
export async function prepareOrganizationLogo(file: File, crop: OrganizationLogoCrop, cropArea?: OrganizationLogoCropArea): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error("Organization logo must be a PNG or JPEG image.");
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const source = new Image();
    source.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(source);
    };
    source.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected organization logo."));
    };
    source.src = objectUrl;
  });

  const targetRatio = ORGANIZATION_LOGO_CROPS[crop].ratio;
  let sourceWidth: number;
  let sourceHeight: number;
  let sourceX: number;
  let sourceY: number;

  if (cropArea) {
    sourceWidth = Math.min(Math.max(1, cropArea.width), image.naturalWidth);
    sourceHeight = Math.min(Math.max(1, cropArea.height), image.naturalHeight);
    sourceX = Math.min(Math.max(0, cropArea.x), image.naturalWidth - sourceWidth);
    sourceY = Math.min(Math.max(0, cropArea.y), image.naturalHeight - sourceHeight);
  } else {
    sourceWidth = image.naturalWidth;
    sourceHeight = image.naturalHeight;
    sourceX = 0;
    sourceY = 0;
    if (sourceWidth / sourceHeight > targetRatio) {
      const croppedWidth = sourceHeight * targetRatio;
      sourceX = (sourceWidth - croppedWidth) / 2;
      sourceWidth = croppedWidth;
    } else {
      const croppedHeight = sourceWidth / targetRatio;
      sourceY = (sourceHeight - croppedHeight) / 2;
      sourceHeight = croppedHeight;
    }
  }

  const maxOutputWidth = crop === "wide" ? 1200 : 720;
  let outputWidth = Math.min(Math.round(sourceWidth), maxOutputWidth);
  let outputHeight = Math.max(1, Math.round(outputWidth / targetRatio));
  const canvas = document.createElement("canvas");

  for (let quality = 0.88; ; quality -= 0.08) {
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare the organization logo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

    const blob = await canvasToBlob(canvas, Math.max(quality, 0.4));
    if (blob.size <= MAX_OUTPUT_BYTES) return readAsDataUrl(blob);

    if (quality <= 0.4) {
      if (outputWidth <= 300) {
        throw new Error("This image could not be optimized below 700 KB. Please choose a simpler image.");
      }
      outputWidth = Math.max(300, Math.round(outputWidth * 0.8));
      outputHeight = Math.max(1, Math.round(outputWidth / targetRatio));
      quality = 0.96;
    }
  }
}
