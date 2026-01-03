// Lightweight HTTP utility for consistent error handling

class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

const DEFAULT_TIMEOUT_MS = 10000;

async function fetchJson(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const isHtml = contentType.includes('text/html');

    if (!res.ok) {
      let errorBody;
      let errorMessage;
      
      try {
        // Try to get response text first
        const text = await res.text();
        
        // Check if it's HTML (backend might return HTML error pages)
        if (isHtml || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          // Backend is returning HTML error page (likely service suspended or error page)
          if (res.status === 503) {
            errorMessage = 'Backend service is temporarily unavailable. Please try again later.';
          } else {
            errorMessage = `Backend returned an error page (HTTP ${res.status}). The service may be unavailable.`;
          }
          errorBody = text;
        } else if (isJson) {
          // Try to parse as JSON
          try {
            errorBody = JSON.parse(text);
            errorMessage = errorBody?.message || `Request failed with status ${res.status}`;
          } catch {
            errorBody = text;
            errorMessage = `Request failed with status ${res.status}`;
          }
        } else {
          errorBody = text;
          errorMessage = text || `Request failed with status ${res.status}`;
        }
      } catch (parseError) {
        errorBody = null;
        errorMessage = `Request failed with status ${res.status}`;
      }
      
      throw new ApiError(errorMessage, { status: res.status, url, body: errorBody });
    }

    // Parse successful response
    const text = await res.text();
    if (isJson) {
      try {
        return JSON.parse(text);
      } catch (parseError) {
        throw new ApiError('Invalid JSON response from server', { status: 200, url, body: text });
      }
    }
    return text;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out', { status: 408, url });
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(err?.message || 'Network error', { url });
  } finally {
    clearTimeout(timeoutId);
  }
}

export { fetchJson, ApiError };


