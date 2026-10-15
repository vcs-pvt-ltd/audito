import type jsPDF from "jspdf";

/**
 * "Evidence & Remarks" section shared by the audit and CAP PDF reports.
 *
 * - The question reference links to that question's row in Detailed Findings.
 * - Evidence images keep their own proportions (never stretched) and are
 *   embedded clearly: the photo's orientation is applied and it is stored as a
 *   high-quality JPEG of at most 1600 px on the long edge.
 * - A row taller than the space left continues on the next page.
 */

type Rgb = [number, number, number];

export type ReportEvidenceFile = {
  file_path: string;
  file_name?: string | null;
  file_type?: string | null;
};

export type EvidenceReportRow = {
  /** Question number as shown in Detailed Findings, e.g. "1.2.3". */
  qNo: string;
  questionText: string;
  /** Where the question's row is in Detailed Findings, for the link. */
  anchor?: { page: number; y: number };
  remarks?: string | null;
  evidence: ReportEvidenceFile[];
};

export type EvidenceSectionOptions = {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  colors: { PRIMARY: Rgb; DARK: Rgb; TEXT_DARK: Rgb; TEXT_GRAY: Rgb; BORDER: Rgb };
  mediaUrl: (filePath: string) => string;
};

type LoadedImage = { dataUrl: string; width: number; height: number };

const TOP = 65;
const HEADER_H = 26;
const PAD = 8;
const IMAGE_MAX_H = 230;
const EMBED_LONG_EDGE = 1600;
const LINK_BLUE: Rgb = [37, 99, 235];

export function isImageEvidence(ev: ReportEvidenceFile): boolean {
  const type = (ev.file_type || "").toLowerCase();
  if (type === "image" || type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(ev.file_path || ev.file_name || "");
}

function evidenceKind(ev: ReportEvidenceFile): string {
  const type = (ev.file_type || "").toLowerCase();
  const name = (ev.file_name || ev.file_path || "").toLowerCase();
  if (type.startsWith("video") || /\.(mp4|webm|mov|mkv|m4v)$/.test(name)) return "Video";
  if (type.startsWith("audio") || /\.(mp3|wav|ogg|m4a|aac)$/.test(name)) return "Audio";
  if (isImageEvidence(ev)) return "Image";
  return "File";
}

/**
 * Loads an image for the PDF with its real (orientation-corrected) size,
 * re-encoded on white as JPEG so PNG transparency, WebP and rotated phone
 * photos all come out right.
 */
async function loadEvidenceImage(url: string): Promise<LoadedImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") && blob.type !== "application/octet-stream") return null;
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) return null;
      const scale = Math.min(1, EMBED_LONG_EDGE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width, height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** Fits width x height inside maxW x maxH keeping the ratio, never enlarging past the image's own size. */
function fit(width: number, height: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / width, maxH / height, 1);
  return { w: width * scale, h: height * scale };
}

type EvidenceItem =
  | { kind: "image"; url: string; label: string; dataUrl: string; w: number; h: number }
  | { kind: "file"; url: string; label: string; h: number };

export async function drawEvidenceAndRemarks(doc: jsPDF, rows: EvidenceReportRow[], options: EvidenceSectionOptions) {
  const { pageWidth, pageHeight, margin, colors, mediaUrl } = options;
  const { PRIMARY, DARK, TEXT_DARK, TEXT_GRAY, BORDER } = colors;
  const bottom = pageHeight - 80;
  const tableWidth = pageWidth - margin * 2;
  const colRef = tableWidth * 0.26;
  const colEv = tableWidth * 0.44;
  const colRem = tableWidth - colRef - colEv;
  const xEv = margin + colRef;
  const xRem = xEv + colEv;
  const lineH = 11;

  // Load every image once, in parallel.
  const cache = new Map<string, Promise<LoadedImage | null>>();
  for (const row of rows) {
    for (const ev of row.evidence) {
      const url = mediaUrl(ev.file_path);
      if (url && isImageEvidence(ev) && !cache.has(url)) cache.set(url, loadEvidenceImage(url));
    }
  }

  const freshPage = () => {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  };

  const drawHeaders = (y: number) => {
    doc.setFillColor(...PRIMARY);
    doc.rect(margin, y, tableWidth, HEADER_H, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Question", margin + PAD, y + 17);
    doc.text("Evidence / Attachments", xEv + PAD, y + 17);
    doc.text("Remarks", xRem + PAD, y + 17);
    return y + HEADER_H;
  };

  freshPage();
  let cy = TOP;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Evidence & Remarks", margin, cy);
  cy += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("Select a question number to go to that question in Detailed Findings.", margin, cy + 6);
  cy += 16;
  cy = drawHeaders(cy);
  const pageStart = () => TOP + HEADER_H;

  for (const row of rows) {
    // Evidence items with their drawn sizes.
    const items: EvidenceItem[] = [];
    for (const ev of row.evidence) {
      const url = mediaUrl(ev.file_path);
      const label = ev.file_name || ev.file_path.split("/").pop() || "attachment";
      const loaded = url && isImageEvidence(ev) ? await cache.get(url) : null;
      if (loaded) {
        const size = fit(loaded.width, loaded.height, colEv - PAD * 2, IMAGE_MAX_H);
        items.push({ kind: "image", url, label, dataUrl: loaded.dataUrl, w: size.w, h: size.h + 14 });
      } else {
        items.push({ kind: "file", url, label: `${evidenceKind(ev)}: ${label}`, h: 14 });
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const remarkLines: string[] = row.remarks?.trim() ? doc.splitTextToSize(row.remarks.trim(), colRem - PAD * 2) : [];
    doc.setFontSize(8);
    const questionLines: string[] = doc.splitTextToSize(row.questionText || "", colRef - PAD * 2).slice(0, 8);
    const refH = 14 + questionLines.length * 10;
    const evH = items.length ? items.reduce((sum, item) => sum + item.h + 6, -6) : 14;
    const fullH = PAD * 2 + Math.max(refH, evH, (remarkLines.length || 1) * lineH, 30);

    // Start on a new page rather than split a row that fits on one page.
    if (cy + fullH > bottom && fullH <= bottom - pageStart()) {
      freshPage();
      cy = drawHeaders(TOP);
    }

    let itemIndex = 0;
    let remarkIndex = 0;
    let first = true;
    while (first || itemIndex < items.length || remarkIndex < remarkLines.length) {
      const avail = bottom - cy - PAD * 2;
      if (avail < 60) {
        freshPage();
        cy = drawHeaders(TOP);
        continue;
      }

      // Evidence that fits in this part of the row (at least one item on a fresh page).
      const segmentItems: EvidenceItem[] = [];
      let segmentEvH = 0;
      while (itemIndex < items.length) {
        const next = items[itemIndex];
        const needed = segmentEvH + (segmentItems.length ? 6 : 0) + next.h;
        if (needed > avail && (segmentItems.length || cy > pageStart())) break;
        segmentItems.push(next);
        segmentEvH = needed;
        itemIndex++;
      }
      if (!segmentItems.length && itemIndex < items.length && !first && remarkIndex >= remarkLines.length) {
        freshPage();
        cy = drawHeaders(TOP);
        continue;
      }
      const remarkCount = Math.min(remarkLines.length - remarkIndex, Math.floor(avail / lineH));
      const segmentRemarks = remarkLines.slice(remarkIndex, remarkIndex + remarkCount);
      remarkIndex += remarkCount;

      const segmentRefH = first ? Math.min(refH, avail) : 14;
      const segmentH = PAD * 2 + Math.max(segmentRefH, segmentEvH, segmentRemarks.length * lineH, first ? 30 : 14);

      // Cells
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.5);
      doc.rect(margin, cy, colRef, segmentH);
      doc.rect(xEv, cy, colEv, segmentH);
      doc.rect(xRem, cy, colRem, segmentH);

      // Question reference (links to the question in Detailed Findings)
      const refLabel = first ? `Q ${row.qNo}` : `Q ${row.qNo} (continued)`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...(row.anchor ? LINK_BLUE : TEXT_DARK));
      doc.text(refLabel, margin + PAD, cy + PAD + 9);
      if (row.anchor) {
        const labelW = doc.getTextWidth(refLabel);
        doc.setDrawColor(...LINK_BLUE);
        doc.setLineWidth(0.5);
        doc.line(margin + PAD, cy + PAD + 10.5, margin + PAD + labelW, cy + PAD + 10.5);
        // The whole reference cell is clickable.
        doc.link(margin, cy, colRef, segmentH, { pageNumber: row.anchor.page, top: Math.max(0, row.anchor.y - 30) });
      }
      if (first && questionLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_GRAY);
        const fitLines = questionLines.slice(0, Math.max(0, Math.floor((segmentH - PAD * 2 - 14) / 10)));
        doc.text(fitLines, margin + PAD, cy + PAD + 22);
      }

      // Evidence
      let ey = cy + PAD;
      if (segmentItems.length) {
        for (const item of segmentItems) {
          if (item.kind === "image") {
            const imgH = item.h - 14;
            const ix = xEv + PAD + (colEv - PAD * 2 - item.w) / 2;
            doc.addImage(item.dataUrl, "JPEG", ix, ey, item.w, imgH);
            doc.setDrawColor(...BORDER);
            doc.setLineWidth(0.4);
            doc.rect(ix, ey, item.w, imgH);
            if (item.url) doc.link(ix, ey, item.w, imgH, { url: item.url });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...TEXT_GRAY);
            const caption = doc.splitTextToSize(item.label, colEv - PAD * 2)[0] || "";
            doc.text(caption, xEv + colEv / 2, ey + imgH + 10, { align: "center" });
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...LINK_BLUE);
            const text = doc.splitTextToSize(item.label, colEv - PAD * 2)[0] || "";
            doc.text(text, xEv + PAD, ey + 10);
            if (item.url) doc.link(xEv + PAD, ey, colEv - PAD * 2, 12, { url: item.url });
          }
          ey += item.h + 6;
        }
      } else if (first && !items.length) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_GRAY);
        doc.text("No evidence attached", xEv + PAD, cy + PAD + 9);
      }

      // Remarks
      if (segmentRemarks.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXT_DARK);
        doc.text(segmentRemarks, xRem + PAD, cy + PAD + 8);
      } else if (first && !remarkLines.length) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_GRAY);
        doc.text("No remarks provided", xRem + PAD, cy + PAD + 9);
      }

      cy += segmentH;
      first = false;
    }
    cy += 2;
  }
}
