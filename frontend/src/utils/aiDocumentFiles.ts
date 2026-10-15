export const AI_DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.xlsm,.xlsb,.xlt,.xltx,.xltm";

const AI_DOCUMENT_EXTENSIONS = new Set(
  AI_DOCUMENT_ACCEPT.split(",").map(extension => extension.slice(1))
);

export const AI_DOCUMENT_FORMAT_LABEL = "PDF, Word, text, CSV, or Excel (XLS, XLSX, XLSM, XLSB, XLT, XLTX, XLTM)";

export function aiDocumentExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function isSupportedAiDocument(file: File) {
  return AI_DOCUMENT_EXTENSIONS.has(aiDocumentExtension(file.name));
}

// Guided onboarding reads more formats through the backend document reader.
export const ONBOARDING_DOCUMENT_ACCEPT = `${AI_DOCUMENT_ACCEPT},.pptx,.png,.jpg,.jpeg,.webp`;
const ONBOARDING_DOCUMENT_EXTENSIONS = new Set(ONBOARDING_DOCUMENT_ACCEPT.split(",").map(extension => extension.slice(1)));
export const ONBOARDING_DOCUMENT_FORMAT_LABEL = "Excel, CSV, Word, PowerPoint, PDF, text, or a photo of a paper sheet";

export function isSupportedOnboardingDocument(file: File) {
  return ONBOARDING_DOCUMENT_EXTENSIONS.has(aiDocumentExtension(file.name));
}
