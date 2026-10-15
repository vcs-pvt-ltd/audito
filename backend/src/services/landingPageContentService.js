const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_CHARACTERS = 50000;
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

let pageCache = null;

const decodeHtml = (value) => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_match, code) => {
    const point = Number(code);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
  })
  .replace(/&#x([\da-f]+);/gi, (_match, code) => {
    const point = parseInt(code, 16);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
  });

const htmlToPublicText = (html) => {
  const bodyMatch = String(html || '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch?.[1] || String(html || '');
  const withoutExecutableContent = body
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|hr)\b[^>]*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|main|nav|h[1-6]|li|tr|table|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const seen = new Set();
  return decodeHtml(withoutExecutableContent)
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => {
      if (!line || line.length < 2 || seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .join('\n')
    .slice(0, MAX_CONTENT_CHARACTERS);
};

const configuredLandingUrl = () => {
  const rawUrl = String(process.env.FRONTEND_URL || '').trim();
  if (!rawUrl) {
    const error = new Error('The Audito landing assistant is not configured. FRONTEND_URL is required.');
    error.statusCode = 503;
    throw error;
  }
  let url;
  try { url = new URL(rawUrl); }
  catch (_) {
    const error = new Error('The configured Audito frontend URL is invalid.');
    error.statusCode = 503;
    throw error;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    const error = new Error('The configured Audito frontend URL must use http or https without credentials.');
    error.statusCode = 503;
    throw error;
  }
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
};

const cacheTtlMs = () => {
  const requested = Number(process.env.LANDING_ASSISTANT_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS);
  return Number.isFinite(requested)
    ? Math.min(60 * 60 * 1000, Math.max(60 * 1000, requested))
    : DEFAULT_CACHE_TTL_MS;
};

const fetchLandingHtml = async (configuredUrl) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let currentUrl = configuredUrl;
    for (let redirectCount = 0; redirectCount < 3; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        headers: { Accept: 'text/html', 'User-Agent': 'Audito-Landing-Assistant/1.0' },
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        const nextUrl = new URL(response.headers.get('location'), currentUrl);
        if (nextUrl.origin !== configuredUrl.origin) {
          const error = new Error('The Audito frontend redirected outside its configured origin.');
          error.statusCode = 502;
          throw error;
        }
        currentUrl = nextUrl;
        continue;
      }
      if (!response.ok) {
        const error = new Error(`The Audito frontend returned HTTP ${response.status}.`);
        error.statusCode = 502;
        throw error;
      }
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('text/html')) {
        const error = new Error('The Audito frontend did not return an HTML landing page.');
        error.statusCode = 502;
        throw error;
      }
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > MAX_HTML_BYTES) {
        const error = new Error('The Audito landing page is too large to read safely.');
        error.statusCode = 502;
        throw error;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_HTML_BYTES) {
        const error = new Error('The Audito landing page is too large to read safely.');
        error.statusCode = 502;
        throw error;
      }
      return { html: buffer.toString('utf8'), finalUrl: currentUrl.href };
    }
    const error = new Error('The Audito frontend redirected too many times.');
    error.statusCode = 502;
    throw error;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('The Audito landing page did not respond in time.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getLandingPageContent = async () => {
  const configuredUrl = configuredLandingUrl();
  if (pageCache && pageCache.origin === configuredUrl.origin && pageCache.expiresAt > Date.now()) {
    return pageCache.value;
  }
  const { html, finalUrl } = await fetchLandingHtml(configuredUrl);
  const content = htmlToPublicText(html);
  if (content.length < 100) {
    const error = new Error('The Audito landing page did not contain enough readable public content.');
    error.statusCode = 502;
    throw error;
  }
  const value = { url: finalUrl, content, fetchedAt: new Date().toISOString() };
  pageCache = { origin: configuredUrl.origin, expiresAt: Date.now() + cacheTtlMs(), value };
  return value;
};

module.exports = { getLandingPageContent, htmlToPublicText };
