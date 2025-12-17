import type { CapturedRequest } from '@shared/types';

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)} s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format timestamp to time string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format timestamp to full date/time string
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Get status code CSS class
 */
export function getStatusClass(status: number): string {
  if (status === 0) return 'status-0';
  if (status >= 200 && status < 300) return 'status-2xx';
  if (status >= 300 && status < 400) return 'status-3xx';
  if (status >= 400 && status < 500) return 'status-4xx';
  if (status >= 500) return 'status-5xx';
  return 'status-0';
}

/**
 * Get method CSS class
 */
export function getMethodClass(method: string): string {
  return method.toUpperCase();
}

/**
 * Truncate URL for display
 */
export function truncateUrl(url: string, maxLength = 80): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

/**
 * Extract path from URL
 */
export function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

/**
 * Pretty print JSON with syntax highlighting (returns HTML)
 */
export function prettyPrintJson(data: string | object): string {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;
    return JSON.stringify(json, null, 2);
  } catch {
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

/**
 * Check if string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decode base64 string
 */
export function decodeBase64(str: string): string {
  try {
    return atob(str);
  } catch {
    return str;
  }
}

/**
 * Decode JWT token
 */
export function decodeJwt(token: string): { header: any; payload: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Auto-decode content (base64, JWT, URL encoded)
 */
export function autoDecodeContent(content: string): { decoded: string; type: string } {
  // Check for JWT
  if (content.match(/^eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
    const jwt = decodeJwt(content);
    if (jwt) {
      return { 
        decoded: JSON.stringify({ header: jwt.header, payload: jwt.payload }, null, 2),
        type: 'JWT' 
      };
    }
  }
  
  // Check for base64
  if (content.match(/^[A-Za-z0-9+\/=]{20,}$/) && content.length % 4 === 0) {
    try {
      const decoded = atob(content);
      // Verify it's printable text
      if (/^[\x20-\x7E\s]+$/.test(decoded)) {
        return { decoded, type: 'Base64' };
      }
    } catch {}
  }
  
  // Check for URL encoded
  if (content.includes('%')) {
    try {
      const decoded = decodeURIComponent(content);
      if (decoded !== content) {
        return { decoded, type: 'URL Encoded' };
      }
    } catch {}
  }
  
  return { decoded: content, type: 'Plain' };
}

/**
 * Detect content type category
 */
export function detectContentCategory(contentType: string): 'json' | 'html' | 'xml' | 'text' | 'image' | 'binary' | 'form' | 'unknown' {
  const ct = contentType.toLowerCase();
  
  if (ct.includes('application/json') || ct.includes('text/json')) return 'json';
  if (ct.includes('text/html')) return 'html';
  if (ct.includes('application/xml') || ct.includes('text/xml')) return 'xml';
  if (ct.includes('text/')) return 'text';
  if (ct.includes('image/')) return 'image';
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) return 'form';
  if (ct.includes('application/octet-stream') || ct.includes('application/pdf') || ct.includes('application/zip')) return 'binary';
  
  return 'unknown';
}

/**
 * Parse form data
 */
export function parseFormData(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = body.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      result[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }
  
  return result;
}

/**
 * Find patterns in response body
 */
export function findPatterns(body: string): { type: string; value: string; index: number }[] {
  const patterns: { type: string; value: string; index: number }[] = [];
  
  // JWT tokens
  const jwtRegex = /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g;
  let match;
  while ((match = jwtRegex.exec(body)) !== null) {
    patterns.push({ type: 'JWT', value: match[0], index: match.index });
  }
  
  // Base64 strings (at least 20 chars)
  const base64Regex = /(?:[A-Za-z0-9+\/]{4}){5,}(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?/g;
  while ((match = base64Regex.exec(body)) !== null) {
    if (match[0].length >= 20 && !match[0].includes('eyJ')) { // Exclude JWTs
      patterns.push({ type: 'Base64', value: match[0], index: match.index });
    }
  }
  
  // API keys (common patterns)
  const apiKeyRegex = /(?:api[_-]?key|apikey|api[_-]?secret|app[_-]?key|auth[_-]?token)['":\s]*['":]?\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi;
  while ((match = apiKeyRegex.exec(body)) !== null) {
    patterns.push({ type: 'API Key', value: match[1], index: match.index });
  }
  
  // Bearer tokens
  const bearerRegex = /Bearer\s+([a-zA-Z0-9_-]+\.?[a-zA-Z0-9_-]*\.?[a-zA-Z0-9_-]*)/gi;
  while ((match = bearerRegex.exec(body)) !== null) {
    patterns.push({ type: 'Bearer Token', value: match[1], index: match.index });
  }
  
  return patterns;
}

/**
 * Generate cURL command from request
 */
export function generateCurl(request: CapturedRequest): string {
  let curl = `curl -X ${request.method} '${request.url}'`;
  
  for (const [key, value] of Object.entries(request.requestHeaders)) {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
      curl += ` \\\n  -H '${key}: ${value}'`;
    }
  }
  
  if (request.requestBody) {
    const escapedBody = request.requestBody.replace(/'/g, "'\\''");
    curl += ` \\\n  -d '${escapedBody}'`;
  }
  
  return curl;
}

/**
 * Generate Python requests code from request
 */
export function generatePython(request: CapturedRequest): string {
  const headers = { ...request.requestHeaders };
  delete headers['host'];
  delete headers['content-length'];
  
  let code = `import requests\n\n`;
  code += `url = "${request.url}"\n\n`;
  code += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
  
  if (request.requestBody) {
    const contentType = request.requestHeaders['content-type'] || '';
    if (contentType.includes('application/json')) {
      try {
        const jsonData = JSON.parse(request.requestBody);
        code += `json_data = ${JSON.stringify(jsonData, null, 4)}\n\n`;
        code += `response = requests.${request.method.toLowerCase()}(url, headers=headers, json=json_data)\n`;
      } catch {
        code += `data = """${request.requestBody}"""\n\n`;
        code += `response = requests.${request.method.toLowerCase()}(url, headers=headers, data=data)\n`;
      }
    } else {
      code += `data = """${request.requestBody}"""\n\n`;
      code += `response = requests.${request.method.toLowerCase()}(url, headers=headers, data=data)\n`;
    }
  } else {
    code += `response = requests.${request.method.toLowerCase()}(url, headers=headers)\n`;
  }
  
  code += `\nprint(response.status_code)\nprint(response.text)`;
  
  return code;
}
