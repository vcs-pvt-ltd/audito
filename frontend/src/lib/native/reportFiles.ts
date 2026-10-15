import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNativeApp } from "./platform";

/**
 * Saving a generated PDF report.
 *
 * Website: the browser download, as before. Android app: the PDF is written to
 * the app's cache and offered through the Android share sheet, where the auditor
 * saves it (Files, Drive) or sends it. No storage permission is needed. Report
 * files are removed from the cache an hour later, the next time a report is
 * made or the app starts.
 */

const REPORT_DIR = "reports";
const KEEP_MS = 60 * 60 * 1000;

type PdfDocument = { save: (fileName: string) => unknown; output: (type: "datauristring") => string };

export type ReportSaveResult = "downloaded" | "shared" | "cancelled";

export async function saveReportPdf(doc: PdfDocument, fileName: string): Promise<ReportSaveResult> {
  if (!isNativeApp()) {
    doc.save(fileName);
    return "downloaded";
  }

  await removeOldReportFiles();
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf("base64,") + "base64,".length);
  const safeName = fileName.replace(/[\\/:*?"<>|]+/g, "-").trim() || "report.pdf";
  const { uri } = await Filesystem.writeFile({
    path: `${REPORT_DIR}/${safeName}`,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  try {
    await Share.share({ title: safeName, url: uri, dialogTitle: "Save or share report" });
    return "shared";
  } catch (error) {
    // Closing the share sheet without choosing an app is not an error.
    if (/cancel/i.test(error instanceof Error ? error.message : String(error))) return "cancelled";
    throw error;
  }
}

/** Deletes report files older than an hour from the app cache. */
export async function removeOldReportFiles(maxAgeMs = KEEP_MS): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { files } = await Filesystem.readdir({ path: REPORT_DIR, directory: Directory.Cache });
    const now = Date.now();
    await Promise.all(files
      .filter((file) => file.type === "file" && now - Number(file.mtime || 0) > maxAgeMs)
      .map((file) => Filesystem.deleteFile({ path: `${REPORT_DIR}/${file.name}`, directory: Directory.Cache }).catch(() => undefined)));
  } catch {
    // No reports folder yet.
  }
}
