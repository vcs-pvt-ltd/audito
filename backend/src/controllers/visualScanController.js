const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { errorResponse, successResponse } = require('../utils/helpers');
const { AUDITO_AI_UNAVAILABLE_MESSAGE } = require('../utils/aiErrors');
const { resolveEntityNames } = require('../utils/accessHelper');
const OrganizationTreeModel = require('../models/OrganizationTreeModel');
const VisualScanModel = require('../models/VisualScanModel');

const MAX_SCAN_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const PUBLIC_UPLOAD_ROOT = path.resolve(__dirname, '../public/uploads');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCAN_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Upload a JPEG, PNG, or WebP image.'));
  },
});

function receiveScanImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'The image must be 2 MB or smaller.', 400);
    }
    return errorResponse(res, error.message || 'The image could not be uploaded.', 400);
  });
}

function isSupportedImageBuffer(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function buildTreeFromEdges(rootCode, rootEntity, edges, entityMap) {
  const byParentPath = new Map();
  for (const edge of edges) {
    const parts = String(edge.edge_path || edge.org_tree_id).split(',');
    const key = parts.length === 1 ? 'ROOT' : parts.slice(0, -1).join(',');
    if (!byParentPath.has(key)) byParentPath.set(key, []);
    byParentPath.get(key).push(edge);
  }

  const buildChildren = (parentPath, seen = new Set()) => (byParentPath.get(parentPath) || [])
    .filter((edge) => !seen.has(String(edge.org_tree_id)))
    .map((edge) => {
      const nextSeen = new Set(seen);
      nextSeen.add(String(edge.org_tree_id));
      const entity = entityMap.get(edge.child_code) || { name: edge.child_code, entity_type: edge.child_type };
      return {
        org_tree_id: String(edge.org_tree_id),
        entity_code: edge.child_code,
        entity_type: entity.entity_type || edge.child_type,
        name: entity.name || edge.child_code,
        children: buildChildren(String(edge.edge_path || edge.org_tree_id), nextSeen),
      };
    });

  return {
    org_tree_id: null,
    entity_code: rootCode,
    entity_type: rootEntity?.entity_type || 'Organization',
    name: rootEntity?.name || 'Organization',
    children: buildChildren('ROOT'),
  };
}

function findTreeNode(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findTreeNode(child, predicate);
    if (found) return found;
  }
  return null;
}

async function getAuditorScanScope(user) {
  const ownerCode = user.createdByEntityCode || user.entityCode;
  if (!ownerCode) return null;
  const assignedTreeId = user.assignedOrgTreeId ? String(user.assignedOrgTreeId) : null;
  const assignedCode = user.assignedEntityCode || ownerCode;
  const occurrence = await VisualScanModel.getOrganizationOccurrence(assignedTreeId, assignedCode);
  const traversalRoot = occurrence?.root_entity_code || ownerCode;
  const edges = await OrganizationTreeModel.getTreeDescendants(traversalRoot, [traversalRoot]);
  const codes = [traversalRoot, ...edges.map((edge) => edge.child_code)];
  const entityMap = await resolveEntityNames(codes);
  const fullTree = buildTreeFromEdges(traversalRoot, entityMap.get(traversalRoot), edges, entityMap);

  let tree = fullTree;
  if (assignedTreeId) {
    tree = findTreeNode(fullTree, (node) => node.org_tree_id === assignedTreeId);
  } else if (assignedCode !== ownerCode) {
    tree = findTreeNode(fullTree, (node) => node.entity_code === assignedCode);
  }
  if (!tree) return null;
  return { ownerCode, tree };
}

function findAllowedLocation(tree, entityCode, orgTreeId) {
  const normalizedTreeId = orgTreeId ? String(orgTreeId) : null;
  return findTreeNode(tree, (node) => node.entity_code === entityCode && (node.org_tree_id || null) === normalizedTreeId);
}

function collectEntityCodes(tree, codes = new Set()) {
  if (!tree) return codes;
  codes.add(tree.entity_code);
  for (const child of tree.children || []) collectEntityCodes(child, codes);
  return codes;
}

function safeCompactText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function historicalResponseContext(example) {
  const selectedOptions = Array.isArray(example.selected_options)
    ? example.selected_options.map((option) => safeCompactText(option.text, 300)).filter(Boolean)
    : [];
  return {
    source: example.exampleType,
    checklist_question: safeCompactText(example.question_text, 700),
    answer_type: safeCompactText(example.answer_type, 50),
    written_response: safeCompactText(example.answer_text, 700) || null,
    selected_options: selectedOptions,
    marks: {
      obtained: Number(example.marks_obtained || 0),
      available: Number(example.total_marks || 0),
    },
    auditor_remarks: safeCompactText(example.remarks, 700) || null,
    cap_required: Boolean(example.cap_required),
    corrective_action: safeCompactText(example.corrective_action, 700) || null,
    corrective_severity: safeCompactText(example.corrective_severity, 30) || null,
    corrective_status: safeCompactText(example.corrective_status, 30) || null,
    resolution_notes: safeCompactText(example.resolution_notes, 700) || null,
    verified: Boolean(example.verified_at),
  };
}

function getResponseOutputText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') return content.text;
    }
  }
  return '';
}

async function readHistoricalImage(reference) {
  const storedPath = String(reference?.file_path || '').replace(/^[/\\]+/, '');
  const relativePath = storedPath.replace(/^uploads[/\\]/i, '');
  const resolvedPath = path.resolve(PUBLIC_UPLOAD_ROOT, relativePath);
  if (resolvedPath !== PUBLIC_UPLOAD_ROOT && !resolvedPath.startsWith(`${PUBLIC_UPLOAD_ROOT}${path.sep}`)) return null;
  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_REFERENCE_IMAGE_BYTES) return null;
    const buffer = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    if (!isSupportedImageBuffer(buffer, mimeType)) return null;
    return { ...reference, dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}` };
  } catch {
    return null;
  }
}

async function getContext(req, res) {
  try {
    const scope = await getAuditorScanScope(req.user);
    if (!scope) return errorResponse(res, 'No organization area is assigned to this auditor.', 403);
    return successResponse(res, { tree: scope.tree });
  } catch (error) {
    console.error('getVisualScanContext error:', error);
    return errorResponse(res, 'Failed to load the site scan workspace.', 500);
  }
}

async function analyzeImage(req, res) {
  try {
    if (!req.file) return errorResponse(res, 'Capture or upload an image to scan.', 400);
    if (!isSupportedImageBuffer(req.file.buffer, req.file.mimetype)) {
      return errorResponse(res, 'The uploaded file is not a valid JPEG, PNG, or WebP image.', 400);
    }

    const entityCode = safeCompactText(req.body.entity_code, 50);
    const orgTreeId = safeCompactText(req.body.org_tree_id, 50) || null;
    const notes = safeCompactText(req.body.notes, 500);

    const scope = await getAuditorScanScope(req.user);
    if (!scope) return errorResponse(res, 'No organization area is assigned to this auditor.', 403);
    const location = findAllowedLocation(scope.tree, entityCode, orgTreeId);
    if (!location) return errorResponse(res, 'The selected organization area is outside your access.', 403);
    const accessibleEntityCodes = [...collectEntityCodes(scope.tree)];

    const apiKey = process.env.OPENAI_VISUAL_SCAN_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('AI Site Scan is not configured on the backend.');
      return errorResponse(res, AUDITO_AI_UNAVAILABLE_MESSAGE, 503);
    }

    const [issueRows, compliantRows, capRows] = await Promise.all([
      VisualScanModel.getHistoricalAuditEvidence({ ownerEntityCode: scope.ownerCode, selectedEntityCode: entityCode, accessibleEntityCodes, issueOnly: true, limit: 8 }),
      VisualScanModel.getHistoricalAuditEvidence({ ownerEntityCode: scope.ownerCode, selectedEntityCode: entityCode, accessibleEntityCodes, issueOnly: false, limit: 2 }),
      VisualScanModel.getHistoricalCapEvidence({ ownerEntityCode: scope.ownerCode, selectedEntityCode: entityCode, accessibleEntityCodes, limit: 2 }),
    ]);
    const historical = (await Promise.all([
      ...issueRows.map((row) => readHistoricalImage({ ...row, exampleType: 'confirmed issue evidence' })),
      ...compliantRows.map((row) => readHistoricalImage({ ...row, exampleType: 'compliant audit evidence' })),
      ...capRows.map((row) => readHistoricalImage({ ...row, exampleType: 'completed CAP follow-up evidence' })),
    ])).filter(Boolean).slice(0, 12).map((example, index) => ({
      ...example,
      referenceId: `AUDITO-EVIDENCE-${index + 1}`,
    }));
    const issueReferences = historical.filter((example) => example.exampleType === 'confirmed issue evidence');

    if (!issueReferences.length) {
      return successResponse(res, {
        scene_summary: 'Audito has no completed issue evidence with recorded responses for comparison in this organization scope.',
        issue_summary: 'No evidence-backed issue summary can be prepared yet.',
        image_quality: 'usable',
        needs_another_image: false,
        safety_message: 'No issue review was generated because Audito does not have internal evidence to support it.',
        issues: [],
        location: { entity_code: entityCode, org_tree_id: orgTreeId, entity_type: location.entity_type, name: location.name },
        context_used: {
          internal_evidence_records: historical.length,
          historical_issue_examples: 0,
          historical_comparison_examples: historical.length,
        },
      }, 'More reviewed audit issue evidence is needed before Site Scan can compare this image.');
    }

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['scene_summary', 'issue_summary', 'image_quality', 'needs_another_image', 'safety_message', 'issues'],
      properties: {
        scene_summary: { type: 'string' },
        issue_summary: { type: 'string' },
        image_quality: { type: 'string', enum: ['good', 'usable', 'poor'] },
        needs_another_image: { type: 'boolean' },
        safety_message: { type: 'string' },
        issues: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['summary', 'confidence', 'visual_evidence', 'internal_evidence_refs'],
            properties: {
              summary: { type: 'string' },
              confidence: { type: 'integer', minimum: 0, maximum: 100 },
              visual_evidence: { type: 'array', maxItems: 5, items: { type: 'string' } },
              internal_evidence_refs: {
                type: 'array',
                minItems: 1,
                maxItems: 5,
                items: { type: 'string', enum: issueReferences.map((example) => example.referenceId) },
              },
            },
          },
        },
      },
    };

    const content = [{
      type: 'input_text',
      text: [
        `Analyze the current camera image for possible visible issues at ${location.name} (${location.entity_type}).`,
        'This is a closed Audito evidence comparison. Do not perform a general workplace inspection and do not use outside standards or general model knowledge to introduce an issue.',
        'Return an issue only when a visible condition in the current image materially matches an issue pattern explicitly supported by at least one supplied Audito historical evidence record and its recorded response.',
        'Every issue must cite its supporting internal reference ID in internal_evidence_refs. If no internal record supports a visible condition, omit it even if it might normally be considered a problem.',
        'Review the entire current image and every supplied internal evidence record before responding. Return every distinct supported issue visible in the same image, not only the first match.',
        'Combine duplicate historical references for the same visible issue into one concise issue point. Keep genuinely different visible issues as separate points.',
        'Summarize each issue in plain language. Never copy a checklist question, stored answer, or auditor remark verbatim into the issue summary.',
        notes ? `Auditor context: ${notes}` : '',
        'The first image is the current scene. Images after it are labeled historical examples and must never be reported as part of the current scene.',
      ].filter(Boolean).join('\n'),
    }, {
      type: 'input_image',
      image_url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
      detail: 'high',
    }];
    for (const [index, example] of historical.entries()) {
      content.push({
        type: 'input_text',
        text: `${example.referenceId}: ${JSON.stringify(historicalResponseContext(example))}. The next image belongs only to this internal record.`,
      });
      content.push({ type: 'input_image', image_url: example.dataUrl, detail: 'low' });
    }

    const safetyIdentifier = crypto
      .createHash('sha256')
      .update(`${scope.ownerCode}:${req.user.userCode}:${process.env.OPENAI_SAFETY_IDENTIFIER_SECRET || process.env.JWT_SECRET || apiKey}`)
      .digest('hex');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let openAiResponse;
    try {
      openAiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_VISUAL_SCAN_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
          store: false,
          safety_identifier: safetyIdentifier,
          instructions: [
            'You are Audito AI Site Scan, a closed internal-evidence comparison assistant.',
            'Use only the Audito historical evidence images and their supplied responses as the knowledge base for issue review. Do not use outside standards, common safety knowledge, or pretrained knowledge to introduce or classify an issue.',
            'Report only a possible issue that is both visible in the current image and materially supported by a supplied internal evidence record. Cite that record. Otherwise return an empty issues array.',
            'Return one concise plain-language summary point per distinct issue, the internal match confidence, observable details in the current image, and supporting internal reference IDs.',
            'Inspect the full current image and all supplied references. Do not stop after the first issue. Merge duplicate matches and keep different issues separate.',
            'Do not quote or expose checklist questions, stored answers, or auditor remarks. Use them privately as grounding context and summarize the issue in new words.',
            'Never invent hidden conditions, measurements, certifications, identities, or events.',
            'Do not identify, describe, rank, or infer attributes about people. If people are visible, assess only the relevant visible safety condition without identifying anyone.',
            'Historical images are contextual examples only. They may come from a different time or place. Never confuse them with the current image.',
            'If visibility is insufficient, lower confidence and request another image.',
            'Use concise plain language. Never claim the area is fully compliant from a single image.',
            'Confidence is evidence strength, not risk severity. Avoid confidence above 90 unless the condition is clear and unambiguous.',
          ].join('\n'),
          max_output_tokens: 2500,
          input: [{ role: 'user', content }],
          text: { format: { type: 'json_schema', name: 'audito_site_scan_result', strict: true, schema } },
        }),
      });
    } catch (error) {
      return errorResponse(res, error?.name === 'AbortError'
        ? 'The image analysis took too long. Try a clearer, closer image.'
        : 'The AI image service could not be reached. Please try again.', 504);
    } finally {
      clearTimeout(timeout);
    }

    const payload = await openAiResponse.json().catch(() => null);
    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers.get('x-request-id') || '';
      console.error('OpenAI visual scan request failed:', {
        status: openAiResponse.status,
        requestId,
        code: payload?.error?.code || payload?.error?.type || '',
        reason: payload?.error?.message || 'Unknown OpenAI error',
      });
      return errorResponse(res, AUDITO_AI_UNAVAILABLE_MESSAGE, openAiResponse.status === 429 ? 429 : 503);
    }

    let result;
    try {
      result = JSON.parse(getResponseOutputText(payload));
    } catch {
      console.error('OpenAI visual scan returned unreadable structured output.');
      return errorResponse(res, AUDITO_AI_UNAVAILABLE_MESSAGE, 503);
    }
    const evidenceByReferenceId = new Map(issueReferences.map((example) => [example.referenceId, example]));
    const groundedMatches = Array.isArray(result.issues) ? result.issues.filter((issue) => (
      Array.isArray(issue.internal_evidence_refs)
      && issue.internal_evidence_refs.length > 0
      && issue.internal_evidence_refs.every((referenceId) => evidenceByReferenceId.has(referenceId))
    )) : [];
    const seenMatches = new Set();
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const groundedIssues = groundedMatches.reduce((issues, issue) => {
      const referenceIds = [...new Set(issue.internal_evidence_refs)].sort();
      const matchKey = referenceIds.join('|');
      if (seenMatches.has(matchKey)) return issues;
      seenMatches.add(matchKey);
      const references = referenceIds.map((referenceId) => evidenceByReferenceId.get(referenceId)).filter(Boolean);
      const severity = references.reduce((highest, evidence) => {
        const candidate = evidence?.corrective_severity || 'medium';
        return severityOrder[candidate] > severityOrder[highest] ? candidate : highest;
      }, 'low');
      const summary = safeCompactText(issue.summary, 400);
      if (!summary) return issues;
      issues.push({
        summary,
        severity,
        observations: Array.isArray(issue.visual_evidence)
          ? issue.visual_evidence.map((item) => safeCompactText(item, 300)).filter(Boolean).slice(0, 4)
          : [],
        evidence_count: referenceIds.length,
      });
      return issues;
    }, []);
    const issueSummary = groundedIssues.length
      ? safeCompactText(result.issue_summary, 700) || `${groundedIssues.length} distinct evidence-backed issue${groundedIssues.length === 1 ? '' : 's'} identified for auditor review.`
      : 'No issue in the current image matched Audito’s reviewed internal evidence.';
    return successResponse(res, {
      ...result,
      issue_summary: issueSummary,
      issues: groundedIssues,
      safety_message: groundedIssues.length
        ? 'These are visual matches to Audito records, not automatic findings. An auditor must confirm each issue.'
        : '',
      location: { entity_code: entityCode, org_tree_id: orgTreeId, entity_type: location.entity_type, name: location.name },
      context_used: {
        internal_evidence_records: historical.length,
        historical_issue_examples: historical.filter((item) => item.exampleType === 'confirmed issue evidence').length,
        historical_comparison_examples: historical.filter((item) => item.exampleType !== 'confirmed issue evidence').length,
      },
    }, groundedIssues.length ? 'Internal evidence matches are ready for auditor review.' : 'No matching issue was supported by Audito internal evidence.');
  } catch (error) {
    console.error('analyzeVisualScanImage error:', error);
    return errorResponse(res, 'Failed to analyze the image.', 500);
  }
}

module.exports = { receiveScanImage, getContext, analyzeImage };
