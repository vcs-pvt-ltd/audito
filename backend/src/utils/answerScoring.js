// Audito scores every choice question on a 10-point scale: the marks of its
// answer options total exactly 10. These helpers bring document scores onto
// that scale and supply default marks for common answer sets when the
// document does not score its answers.

const POSITIVE = /^(yes|y|ok|okay|pass|passed|complies|comply|compliant|complied|conform|conforms|conforming|satisfactory|satisfied|good|acceptable|adequate|available|implemented|in place|done|achieved|true|correct|present|approved|met|fully compliant|fully met|fully implemented)$/;
const PARTIAL = /^(partial|partially|partly|partially compliant|partially met|partially implemented|some|minor|minor nc|fair|average|needs improvement|need improvement|in progress|ongoing)$/;
const NEUTRAL = /^(n\/a|na|n\.a|not applicable|not observed|not seen|not checked|not verified)$/;
const NEGATIVE = /^(no|n|fail|failed|non compliant|noncompliant|non conforming|nonconforming|non conformity|nonconformity|nc|major|major nc|not compliant|not available|not implemented|not done|not met|not in place|unsatisfactory|poor|inadequate|missing|absent|false|incorrect|rejected)$/;

const CHOICE_TYPES = new Set(['single_option', 'multiple_options', 'dropdown']);
const label = text => String(text || '').toLowerCase().replace(/[-_]/g, ' ').replace(/[.!]+$/, '').replace(/\s+/g, ' ').trim();

function classify(text) {
  const value = label(text);
  if (NEUTRAL.test(value)) return 'neutral';
  if (POSITIVE.test(value)) return 'positive';
  if (PARTIAL.test(value)) return 'partial';
  if (NEGATIVE.test(value)) return 'negative';
  return null;
}

// Scales non-negative marks to total 10 with at most two decimals; the
// rounding remainder goes to the highest mark.
function scaleToTen(marks) {
  const total = marks.reduce((sum, mark) => sum + mark, 0);
  if (!(total > 0) || marks.some(mark => !(mark >= 0))) return null;
  const scaled = marks.map(mark => Math.round((mark / total) * 1000) / 100);
  const remainder = Math.round((10 - scaled.reduce((sum, mark) => sum + mark, 0)) * 100) / 100;
  const top = scaled.indexOf(Math.max(...scaled));
  scaled[top] = Math.round((scaled[top] + remainder) * 100) / 100;
  return scaled;
}

// Default marks: the one positive answer earns the points, partial answers a
// share, and negative or not-applicable answers none. Unknown answer sets get
// no defaults.
function defaultMarks(options) {
  const classes = options.map(option => classify(option.option_text));
  if (classes.some(kind => !kind) || classes.filter(kind => kind === 'positive').length !== 1) return null;
  const hasPartial = classes.includes('partial');
  return scaleToTen(classes.map(kind => kind === 'positive' ? (hasPartial ? 2 : 1) : kind === 'partial' ? 1 : 0));
}

// Returns the question with marks on Audito's scale and how they were set:
// 'document' (scaled from the document's scores), 'default', or null when the
// marks were left as they were.
function scoreQuestion(question) {
  const options = question.options || [];
  if (!CHOICE_TYPES.has(question.answer_type) || options.length < 2 || options.length > 5) return { question, applied: null };
  let marks = options.map(option => (typeof option.marks === 'number' && Number.isFinite(option.marks) ? option.marks : null));
  // Answers a document leaves out of scoring (such as N/A) earn nothing.
  if (marks.some(mark => mark !== null)) marks = marks.map((mark, i) => (mark === null && classify(options[i].option_text) === 'neutral' ? 0 : mark));
  if (marks.every(mark => mark !== null)) {
    const total = marks.reduce((sum, mark) => sum + mark, 0);
    if (Math.abs(total - 10) <= 0.01) return { question, applied: null };
    const scaled = scaleToTen(marks);
    return scaled ? { question: { ...question, options: options.map((o, i) => ({ ...o, marks: scaled[i] })) }, applied: 'document' } : { question, applied: null };
  }
  if (marks.some(mark => mark !== null)) return { question, applied: null };
  const defaults = defaultMarks(options);
  return defaults ? { question: { ...question, options: options.map((o, i) => ({ ...o, marks: defaults[i] })) }, applied: 'default' } : { question, applied: null };
}

module.exports = { classify, scaleToTen, defaultMarks, scoreQuestion, CHOICE_TYPES };
