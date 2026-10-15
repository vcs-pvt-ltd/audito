const path = require('path');
const XLSX = require('xlsx');

// Excel files arrive with inconsistent MIME types across browsers and
// operating systems, so the extension is the authoritative allow-list. Every
// workbook format is converted to a macro-free XLSX before it is sent to the
// AI provider. The source upload is never executed or persisted here.
const SPREADSHEET_EXTENSIONS = new Set([
  '.csv', '.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm',
]);

const AI_DOCUMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.txt', '.md', ...SPREADSHEET_EXTENSIONS,
]);

function extensionOf(fileName) {
  return path.extname(String(fileName || '')).toLowerCase();
}

function isSupportedAiDocument(file) {
  return AI_DOCUMENT_EXTENSIONS.has(extensionOf(file?.originalname));
}

function prepareAiDocument(file) {
  const extension = extensionOf(file?.originalname);
  if (!SPREADSHEET_EXTENSIONS.has(extension) || extension === '.csv') return file;

  try {
    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellText: true,
      cellFormula: false,
      bookVBA: false,
    });
    if (!workbook.SheetNames.length) throw new Error('Workbook has no worksheets.');

    const baseName = path.basename(String(file.originalname || 'spreadsheet'), extension);
    return {
      ...file,
      originalname: `${baseName}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', bookVBA: false }),
    };
  } catch (error) {
    const invalidWorkbook = new Error('The Excel file could not be read. Check that it is not damaged or password-protected.');
    invalidWorkbook.statusCode = 400;
    invalidWorkbook.cause = error;
    throw invalidWorkbook;
  }
}

module.exports = {
  AI_DOCUMENT_EXTENSIONS,
  SPREADSHEET_EXTENSIONS,
  isSupportedAiDocument,
  prepareAiDocument,
};
