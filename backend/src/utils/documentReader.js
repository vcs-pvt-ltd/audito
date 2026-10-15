const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const XLSX = require('xlsx');

// Turns an uploaded document into plain text with exact locations (sheet and
// cell, paragraph, table row, slide or line) so AI suggestions can cite where
// they came from. Uploads are untrusted: nothing is executed (macros are never
// loaded), formula helper noise is dropped, and hidden content is labelled.
// PDFs, legacy Word files and images are passed to the AI as files instead.

const OOXML_SHEETS = new Set(['.xlsx', '.xlsm', '.xltx', '.xltm']);
const LEGACY_SHEETS = new Set(['.xls', '.xlsb', '.xlt', '.csv']);
const TEXT_FILES = new Set(['.txt', '.md']);
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const FILE_TYPES = { '.pdf': 'application/pdf', '.doc': 'application/msword' };
const ONBOARDING_DOCUMENT_EXTENSIONS = new Set([...OOXML_SHEETS, ...LEGACY_SHEETS, ...TEXT_FILES, '.docx', '.pptx', ...Object.keys(IMAGE_TYPES), ...Object.keys(FILE_TYPES)]);

const PART_CHARS = 12000;
const MAX_TEXT_CHARS = 1500000;
const MAX_CELLS = 2000000;

const extensionOf = name => path.extname(String(name || '')).toLowerCase();
const isSupportedOnboardingDocument = file => ONBOARDING_DOCUMENT_EXTENSIONS.has(extensionOf(file?.originalname));
const oneLine = value => String(value ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
const quote = value => oneLine(value).slice(0, 1500);
const decodeXml = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec))).replace(/&amp;/g, '&');

function readError(message) { const error = new Error(message); error.statusCode = 400; return error; }

// Split long text into parts on line boundaries. Every later part repeats the
// heading lines so the AI keeps the column meaning and sheet context.
function splitParts(fileName, label, heading, lines) {
  const parts = [];
  let current = [];
  let size = 0;
  const flush = () => { if (current.length) parts.push(current); current = []; size = 0; };
  for (const line of lines) {
    if (size + line.length > PART_CHARS && current.length) flush();
    current.push(line); size += line.length + 1;
  }
  flush();
  return parts.map((partLines, index) => ({
    label: parts.length > 1 ? `${label} (part ${index + 1} of ${parts.length})` : label,
    text: [`File "${fileName}" — ${parts.length > 1 ? `${label}, part ${index + 1} of ${parts.length}` : label}`, ...heading,
      ...(index ? ['Top of this section, repeated for context:', ...parts[0].slice(0, 8), '…'] : []), ...partLines].join('\n'),
  }));
}

// Excel dropdown lists usually hold the answer choices of an audit sheet.
function describeDropdowns(validations) {
  const byChoices = new Map();
  for (const [address, rule] of Object.entries(validations || {})) {
    if (rule?.type !== 'list' || !rule.formulae?.[0]) continue;
    const formula = String(rule.formulae[0]);
    if (/#REF!/i.test(formula)) continue;
    const choices = /^".*"$/.test(formula) ? formula.slice(1, -1).split(',').map(oneLine).filter(Boolean).join(' | ') : `values from ${formula}`;
    if (!byChoices.has(choices)) byChoices.set(choices, []);
    byChoices.get(choices).push(...address.replace(/^range:/, '').split(/\s+/));
  }
  return [...byChoices.entries()].map(([choices, addresses]) => {
    const columns = [...new Set(addresses.map(a => a.replace(/[0-9:$]+.*$/, '')))].join(', ');
    return `Answer dropdown in column ${columns} (${addresses.length} cell${addresses.length === 1 ? '' : 's'}, e.g. ${addresses.slice(0, 3).join(', ')}): ${choices}`;
  });
}

// Formulas that compare an answer with text (for example T33="YES") usually
// define how the workbook scores answers. One example per column is kept.
function noteScoringFormula(scoring, address, formula, hidden) {
  const text = oneLine(formula);
  const column = address.replace(/\d+$/, '');
  if (!text || scoring.has(column) || scoring.size >= 6 || !/[=<>]\s*"[^"]*"/.test(text)) return;
  scoring.set(column, `column ${column}${hidden ? ' (hidden)' : ''}, e.g. ${address}: =${text.slice(0, 240)}`);
}
function describeScoring(scoring) {
  return scoring.size ? [`Scoring formulas (how this sheet scores answers): ${[...scoring.values()].join('; ')}`] : [];
}

function sheetLines(rows) {
  return rows.filter(row => row.cells.length).map(row => `${row.hidden ? '(hidden row) ' : ''}${row.cells.map(([address, value]) => `${address}: ${value}`).join(' | ')}`);
}

// Words typical of an audit sheet's column header row.
const HEADER_WORDS = /^(s\/?n|sl\.?|no\.?|#|ref\.?|item|clause|question|questions|requirement|requirements|criteria|criterion|check ?point|description|activity|area|department|section|location|responsib\w*|yes|no|n\/a|na|status|compliance|compliant|rating|score|scores|marks|points|weight\w*|max\w*|result|remarks?|comments?|findings?|observations?|evidence|action\w*|guidance|notes?)\b/i;

// The row that names the columns (for example "No | Requirement | YES | NO |
// Remarks"). Long sheets are split into parts; repeating this row in every
// part keeps the meaning of each column clear far below the top of the sheet.
function headerRow(rows) {
  for (const row of rows.slice(0, 60)) {
    const cells = row.cells.filter(([, value]) => value.length <= 60);
    if (row.hidden || cells.length < 3 || cells.length !== row.cells.length) continue;
    if (cells.filter(([, value]) => HEADER_WORDS.test(value)).length >= 2) {
      return `Column headers (row ${cells[0][0].replace(/^[A-Z]+/, '')}, repeated for context): ${cells.map(([address, value]) => `column ${address.replace(/\d+$/, '')} = ${value}`).join(' | ')}`;
    }
  }
  return '';
}

async function readOoxmlWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const parts = [];
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount * Math.max(sheet.columnCount, 1) > MAX_CELLS) throw readError(`Sheet "${sheet.name}" has too many cells to read. Upload a smaller audit sheet.`);
    const hiddenColumns = new Set();
    for (let column = 1; column <= sheet.columnCount; column++) if (sheet.getColumn(column).hidden) hiddenColumns.add(column);
    const rows = [];
    const notes = [];
    const scoring = new Map();
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        if (cell.type === ExcelJS.ValueType.Merge) return;
        if (cell.note) notes.push(`Note on ${cell.address}: ${quote(typeof cell.note === 'string' ? cell.note : (cell.note.texts || []).map(t => t.text).join(''))}`);
        const isFormula = cell.type === ExcelJS.ValueType.Formula;
        if (isFormula) noteScoringFormula(scoring, cell.address, cell.formula, hiddenColumns.has(column));
        const value = isFormula ? cell.result : cell.value;
        // Calculated numbers, errors and helper columns are scoring machinery of
        // a past audit, not checklist content.
        if (isFormula && (typeof value !== 'string' || hiddenColumns.has(column))) return;
        if (value && typeof value === 'object' && 'error' in value) return;
        const text = value instanceof Date ? value.toISOString().slice(0, 10) : quote(isFormula ? value : cell.text);
        if (text && !/^#(REF|N\/A|VALUE|DIV\/0|NAME|NULL|NUM)[!?]?$/i.test(text)) cells.push([cell.address, text]);
      });
      rows.push({ hidden: Boolean(row.hidden), cells });
    });
    const lines = sheetLines(rows);
    if (!lines.length) continue;
    const merges = (sheet.model.merges || []).slice(0, 40);
    const heading = [
      sheet.state !== 'visible' ? 'This sheet is hidden in the workbook.' : '',
      hiddenColumns.size ? `Hidden columns (helper values removed): ${[...hiddenColumns].map(c => sheet.getColumn(c).letter).join(', ')}` : '',
      headerRow(rows),
      ...describeDropdowns(sheet.dataValidations?.model),
      ...describeScoring(scoring),
      merges.length ? `Merged cells: ${merges.join(', ')}` : '',
      ...notes.slice(0, 50),
    ].filter(Boolean);
    parts.push(...splitParts(file.originalname, `Sheet "${sheet.name}"`, heading, lines).map(part => ({ ...part, sheet: sheet.name })));
  }
  return parts;
}

function readLegacyWorkbook(file) {
  const workbook = XLSX.read(file.buffer, { type: 'buffer', cellText: true, cellFormula: true, cellStyles: true, bookVBA: false });
  const parts = [];
  workbook.SheetNames.forEach((name, index) => {
    const sheet = workbook.Sheets[name];
    if (!sheet?.['!ref']) return;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    if ((range.e.r + 1) * (range.e.c + 1) > MAX_CELLS) throw readError(`Sheet "${name}" has too many cells to read. Upload a smaller audit sheet.`);
    const hiddenColumns = new Set((sheet['!cols'] || []).map((column, i) => column?.hidden ? i : -1).filter(i => i >= 0));
    const rows = [];
    const scoring = new Map();
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[address];
        if (cell?.f) noteScoringFormula(scoring, address, cell.f, hiddenColumns.has(c));
        if (!cell || cell.t === 'e' || cell.t === 'z') continue;
        if (cell.f && (cell.t !== 's' || hiddenColumns.has(c))) continue;
        const text = quote(cell.w ?? cell.v);
        if (text) cells.push([address, text]);
      }
      rows.push({ hidden: Boolean(sheet['!rows']?.[r]?.hidden), cells });
    }
    const lines = sheetLines(rows);
    if (!lines.length) return;
    const heading = [
      workbook.Workbook?.Sheets?.[index]?.Hidden ? 'This sheet is hidden in the workbook.' : '',
      hiddenColumns.size ? `Hidden columns (helper values removed): ${[...hiddenColumns].map(c => XLSX.utils.encode_col(c)).join(', ')}` : '',
      headerRow(rows),
      ...describeScoring(scoring),
    ].filter(Boolean);
    // A CSV file has one unnamed sheet; its cells are cited by the file name.
    const csv = extensionOf(file.originalname) === '.csv';
    const sheetName = csv ? oneLine(file.originalname) : name;
    if (csv) heading.unshift(`Cite cells of this table as ${sheetName}!Cell, for example ${sheetName}!B2.`);
    parts.push(...splitParts(file.originalname, csv ? 'Table' : `Sheet "${name}"`, heading, lines).map(part => ({ ...part, sheet: sheetName })));
  });
  return parts;
}

// Paragraph text of a WordprocessingML or DrawingML fragment.
function paragraphText(xml) {
  const checkbox = /<w14:checked w14:val="(1|true)"/.test(xml) ? '☒ ' : /<w14:checkbox/.test(xml) ? '☐ ' : '';
  const pieces = [];
  const run = /<(w|a):t(?:\s[^>]*)?>([\s\S]*?)<\/\1:t>|<(?:w|a):(?:tab|br)\/>/g;
  let match;
  while ((match = run.exec(xml))) pieces.push(match[2] === undefined ? ' ' : decodeXml(match[2]));
  return (checkbox + pieces.join('')).replace(/\s+/g, ' ').trim();
}

// Top-level <w:p> and <w:tbl> elements of a Word body, in document order.
function wordBlocks(xml) {
  const blocks = [];
  const tag = /<(\/?)w:(tbl|p)(?=[\s>/])[^>]*?(\/?)>/g;
  let depth = 0, start = -1, kind = '', match;
  while ((match = tag.exec(xml))) {
    const [, closing, name, selfClosing] = match;
    if (selfClosing) continue;
    if (!closing) {
      if (depth === 0) { start = match.index; kind = name; }
      if (name === kind || name === 'tbl') depth++;
    } else if (depth && (name === kind || name === 'tbl')) {
      depth--;
      if (depth === 0) blocks.push({ kind, xml: xml.slice(start, tag.lastIndex) });
    }
  }
  return blocks;
}

async function readDocx(file) {
  const zip = await JSZip.loadAsync(file.buffer);
  const body = await zip.file('word/document.xml')?.async('string');
  if (!body) throw readError('This Word document could not be read. Save it again as .docx or PDF.');
  const lines = [];
  for (const name of Object.keys(zip.files).filter(n => /^word\/header\d*\.xml$/.test(n)).sort()) {
    const text = paragraphText(await zip.file(name).async('string'));
    if (text) lines.push(`Page header: ${text}`);
  }
  let paragraph = 0, table = 0;
  for (const block of wordBlocks(body)) {
    if (block.kind === 'p') {
      paragraph++;
      const text = paragraphText(block.xml);
      if (!text) continue;
      const style = /<w:pStyle w:val="([^"]+)"/.exec(block.xml)?.[1] || '';
      const list = /<w:numPr>/.test(block.xml) ? '• ' : '';
      lines.push(`Paragraph ${paragraph}${/heading|title/i.test(style) ? ` [${style}]` : ''}: ${list}${text}`);
    } else {
      table++;
      let row = 0;
      for (const rowXml of block.xml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || []) {
        row++;
        const cells = (rowXml.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || []).map(cell => (cell.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || []).map(paragraphText).filter(Boolean).join(' / '));
        if (cells.some(Boolean)) lines.push(`Table ${table}, row ${row}: ${cells.map(c => c || '—').join(' | ')}`);
      }
    }
  }
  return splitParts(file.originalname, 'Document', [], lines);
}

async function readPptx(file) {
  const zip = await JSZip.loadAsync(file.buffer);
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  const lines = [];
  for (const name of slides) {
    const number = name.match(/(\d+)\.xml$/)[1];
    for (const p of (await zip.file(name).async('string')).match(/<a:p>[\s\S]*?<\/a:p>/g) || []) {
      const text = paragraphText(p);
      if (text) lines.push(`Slide ${number}: ${text}`);
    }
  }
  return splitParts(file.originalname, 'Presentation', [], lines);
}

function readPlainText(file) {
  const lines = file.buffer.toString('utf8').replace(/^﻿/, '').split(/\r?\n/)
    .map((line, index) => [index + 1, oneLine(line)]).filter(([, line]) => line).map(([number, line]) => `Line ${number}: ${line.slice(0, 2000)}`);
  return splitParts(file.originalname, 'Text', [], lines);
}

// Returns { name, kind: 'text' | 'file' | 'image', parts, mimetype, data }.
async function readDocument(file) {
  const extension = extensionOf(file.originalname);
  const name = oneLine(file.originalname).slice(0, 160) || 'document';
  if (FILE_TYPES[extension] || IMAGE_TYPES[extension]) {
    return { name, kind: IMAGE_TYPES[extension] ? 'image' : 'file', parts: [{ label: name, text: '' }], mimetype: IMAGE_TYPES[extension] || FILE_TYPES[extension], data: file.buffer.toString('base64') };
  }
  let parts;
  try {
    if (OOXML_SHEETS.has(extension)) {
      const signature = file.buffer.subarray(0, 4).toString('hex');
      // Some workbooks use features ExcelJS cannot parse; SheetJS still reads
      // their values. Old binary workbooks saved with a new extension also work.
      if (signature.startsWith('504b')) parts = await readOoxmlWorkbook(file).catch(error => { if (error.statusCode) throw error; return readLegacyWorkbook(file); });
      else if (signature === 'd0cf11e0') parts = readLegacyWorkbook(file);
      else throw new Error('Not a workbook');
    } else if (LEGACY_SHEETS.has(extension)) parts = readLegacyWorkbook(file);
    else if (extension === '.docx') parts = await readDocx(file);
    else if (extension === '.pptx') parts = await readPptx(file);
    else if (TEXT_FILES.has(extension)) parts = readPlainText(file);
    else throw readError(`${name} is not a supported document type.`);
  } catch (error) {
    if (error.statusCode) throw error;
    throw readError(`${name} could not be read. Check that it is not damaged or password-protected.`);
  }
  if (!parts.length) throw readError(`${name} has no readable text. If it is a scan, upload it as PDF or an image.`);
  if (parts.reduce((sum, part) => sum + part.text.length, 0) > MAX_TEXT_CHARS) throw readError(`${name} is too large to review at once. Split it into smaller files.`);
  return { name, kind: 'text', parts };
}

module.exports = { readDocument, isSupportedOnboardingDocument, ONBOARDING_DOCUMENT_EXTENSIONS, PART_CHARS, paragraphText, wordBlocks, headerRow };
