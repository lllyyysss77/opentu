/* eslint-disable no-restricted-globals */
/**
 * 多 CDN 智能回退策略
 *
 * 加载优先级：
 * 1. Service Worker 缓存
 * 2. 当前版本可用且健康的首选 CDN
 * 3. 其他健康 CDN
 * 4. 本地服务器（回退）
 */

// 开发模式检测
const isDevelopment =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export type CDNName = 'jsdelivr' | 'unpkg' | 'local';

export interface CDNPreference {
  cdn: CDNName;
  latency: number;
  timestamp: number;
  version: string;
}

// CDN 源配置
export interface CDNSource {
  name: Exclude<CDNName, 'local'>;
  // URL 模板，{version} 和 {path} 会被替换
  urlTemplate: string;
  // 健康检查路径
  healthCheckPath: string;
  // 是否启用
  enabled: boolean;
  // 优先级（数字越小优先级越高）
  priority: number;
}

// CDN 健康状态
interface CDNHealthStatus {
  name: string;
  isHealthy: boolean;
  lastCheckTime: number;
  failCount: number;
  // 上次成功时间
  lastSuccessTime: number;
  lastFailureReason?: string;
}

// 配置常量
const CDN_CONFIG = {
  packageName: 'aitu-app',
  healthCheckInterval: 5 * 60 * 1000,
  degradeTimeout: 60 * 1000,
  failThreshold: 3,
  fetchTimeout: 1500,
  preferenceCacheExpiry: 60 * 60 * 1000,
  preferenceCacheName: 'drawnix-cdn-v1',
  preferenceCacheKey:
    typeof location !== 'undefined'
      ? new URL('/__sw__/cdn-preference', location.origin).href
      : 'https://opentu.local/__sw__/cdn-preference',
};

// CDN 源列表（按默认优先级排序）
const CDN_SOURCES: CDNSource[] = [
  {
    name: 'jsdelivr',
    urlTemplate: 'https://cdn.jsdelivr.net/npm/aitu-app@{version}/{path}',
    healthCheckPath: 'version.json',
    enabled: true,
    priority: 1,
  },
  {
    name: 'unpkg',
    urlTemplate: 'https://unpkg.com/aitu-app@{version}/{path}',
    healthCheckPath: 'version.json',
    enabled: true,
    priority: 2,
  },
];

const cdnHealthStatus: Map<string, CDNHealthStatus> = new Map();
let persistedCDNPreference: CDNPreference | null = null;
let hasLoadedPersistedPreference = false;
let loadPreferencePromise: Promise<void> | null = null;

function initHealthStatus(forceReset = false): void {
  if (forceReset) {
    cdnHealthStatus.clear();
  }

  CDN_SOURCES.forEach((source) => {
    if (!cdnHealthStatus.has(source.name)) {
      cdnHealthStatus.set(source.name, {
        name: source.name,
        isHealthy: true,
        lastCheckTime: 0,
        failCount: 0,
        lastSuccessTime: Date.now(),
      });
    }
  });
}

initHealthStatus();

function isCDNName(value: unknown): value is CDNName {
  return value === 'jsdelivr' || value === 'unpkg' || value === 'local';
}

function sanitizeCDNPreference(value: unknown): CDNPreference | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const cdn = record['cdn'];
  const version = record['version'];

  if (!isCDNName(cdn) || typeof version !== 'string' || version.trim() === '') {
    return null;
  }

  const latency = Number(record['latency']);
  const timestamp = Number(record['timestamp']);

  return {
    cdn,
    version: version.trim(),
    latency: Number.isFinite(latency) && latency >= 0 ? latency : 0,
    timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
  };
}

function isFreshPreference(preference: CDNPreference | null, version?: string): boolean {
  if (!preference) {
    return false;
  }

  if (version && preference.version !== version) {
    return false;
  }

  return Date.now() - preference.timestamp <= CDN_CONFIG.preferenceCacheExpiry;
}

async function readPersistedPreference(): Promise<CDNPreference | null> {
  if (typeof caches === 'undefined') {
    return null;
  }

  try {
    const cache = await caches.open(CDN_CONFIG.preferenceCacheName);
    const response = await cache.match(CDN_CONFIG.preferenceCacheKey);
    if (!response?.ok) {
      return null;
    }

    return sanitizeCDNPreference(await response.json());
  } catch (error) {
    console.warn('[CDN Fallback] Failed to read persisted CDN preference:', error);
    return null;
  }
}

export async function ensureCDNPreferenceLoaded(): Promise<void> {
  if (hasLoadedPersistedPreference) {
    return;
  }

  if (!loadPreferencePromise) {
    loadPreferencePromise = (async () => {
      persistedCDNPreference = await readPersistedPreference();
      hasLoadedPersistedPreference = true;
      loadPreferencePromise = null;
    })();
  }

  await loadPreferencePromise;
}

export async function setCDNPreference(
  preference: CDNPreference | null
): Promise<void> {
  persistedCDNPreference = sanitizeCDNPreference(preference);
  hasLoadedPersistedPreference = true;

  if (typeof caches === 'undefined') {
    return;
  }

  try {
    const cache = await caches.open(CDN_CONFIG.preferenceCacheName);

    if (!persistedCDNPreference) {
      await cache.delete(CDN_CONFIG.preferenceCacheKey);
      return;
    }

    await cache.put(
      CDN_CONFIG.preferenceCacheKey,
      new Response(JSON.stringify(persistedCDNPreference), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    );
  } catch (error) {
    console.warn('[CDN Fallback] Failed to persist CDN preference:', error);
  }
}

export function getCDNPreference(): CDNPreference | null {
  return persistedCDNPreference;
}

export function markCDNSuccess(cdnName: string): void {
  const status = cdnHealthStatus.get(cdnName);
  if (status) {
    status.isHealthy = true;
    status.failCount = 0;
    status.lastSuccessTime = Date.now();
    status.lastCheckTime = Date.now();
    status.lastFailureReason = undefined;
  }
}

export function markCDNFailure(cdnName: string, reason?: string): void {
  const status = cdnHealthStatus.get(cdnName);
  if (status) {
    status.failCount++;
    status.lastCheckTime = Date.now();
    status.lastFailureReason = reason;

    if (status.failCount >= CDN_CONFIG.failThreshold) {
      status.isHealthy = false;
      console.warn(
        `[CDN Fallback] ${cdnName} marked as unhealthy after ${status.failCount} failures`
      );
    }
  }
}

export function isCDNAvailable(cdnName: string): boolean {
  const status = cdnHealthStatus.get(cdnName);
  if (!status) return false;

  if (status.isHealthy) return true;

  const now = Date.now();
  if (now - status.lastCheckTime > CDN_CONFIG.degradeTimeout) {
    console.log(`[CDN Fallback] Trying to recover ${cdnName}...`);
    return true;
  }

  return false;
}

function getPreferredCDNName(version: string): Exclude<CDNName, 'local'> | null {
  const preference = persistedCDNPreference;
  if (!preference || !isFreshPreference(preference, version) || preference.cdn === 'local') {
    return null;
  }

  return isCDNAvailable(preference.cdn) ? preference.cdn : null;
}

export function getAvailableCDNs(version?: string): CDNSource[] {
  const preferredName = version ? getPreferredCDNName(version) : null;

  return CDN_SOURCES.filter(
    (source) => source.enabled && isCDNAvailable(source.name)
  ).sort((a, b) => {
    if (preferredName && a.name === preferredName && b.name !== preferredName) {
      return -1;
    }
    if (preferredName && b.name === preferredName && a.name !== preferredName) {
      return 1;
    }
    return a.priority - b.priority;
  });
}

function cleanResourcePath(resourcePath: string): string {
  const versionPrefixPattern = /^\/?(aitu-app@[\d.]+\/)/;
  return resourcePath.replace(versionPrefixPattern, '/');
}

export function buildCDNUrl(
  source: CDNSource,
  version: string,
  resourcePath: string
): string {
  const cleanPath = cleanResourcePath(resourcePath);
  return source.urlTemplate
    .replace('{version}', version)
    .replace('{path}', cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath);
}

async function fetchWithTimeout(
  url: string,
  timeout: number = CDN_CONFIG.fetchTimeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getLocalUrl(localOrigin: string, resourcePath: string): string {
  const cleanPath = cleanResourcePath(resourcePath);
  return `${localOrigin}/${cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath}`;
}

async function isValidCDNResponse(response: Response, cdnName: string): Promise<boolean> {
  const contentType = response.headers.get('Content-Type') || '';
  const isValidContentType =
    contentType.includes('javascript') ||
    contentType.includes('css') ||
    contentType.includes('json') ||
    contentType.includes('font') ||
    contentType.includes('image') ||
    contentType.includes('woff') ||
    contentType.includes('application/octet-stream');

  if (!isValidContentType) {
    markCDNFailure(cdnName, `invalid-content-type:${contentType}`);
    console.warn(`[CDN Fallback] ${cdnName} invalid Content-Type: ${contentType}`);
    return false;
  }

  const contentLength = parseInt(
    response.headers.get('Content-Length') || '0',
    10
  );
  const isTextResource =
    contentType.includes('javascript') ||
    contentType.includes('css') ||
    contentType.includes('json');

  if (isTextResource && contentLength > 0 && contentLength < 50) {
    markCDNFailure(cdnName, `response-too-small:${contentLength}`);
    console.warn(
      `[CDN Fallback] ${cdnName} response too small: ${contentLength} bytes`
    );
    return false;
  }

  const clonedResponse = response.clone();
  try {
    const reader = clonedResponse.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      reader.cancel();
      if (value) {
        const textSample = new TextDecoder().decode(value.slice(0, 200));
        const looksLikeHtml =
          textSample.includes('<!DOCTYPE') ||
          textSample.includes('<html') ||
          textSample.includes('<HTML') ||
          textSample.includes('Not Found') ||
          textSample.includes('404');

        if (isTextResource && looksLikeHtml) {
          markCDNFailure(cdnName, 'html-error-page');
          console.warn(
            `[CDN Fallback] ${cdnName} returned HTML instead of ${contentType}`
          );
          return false;
        }
      }
    }
  } catch {
    // 采样失败不阻止使用（可能是二进制文件）
  }

  return true;
}

export async function fetchFromCDNWithFallback(
  resourcePath: string,
  version: string,
  localOrigin: string
): Promise<{ response: Response; source: string } | null> {
  if (isDevelopment) {
    console.log('[CDN Fallback] 开发模式，跳过 CDN 回退');
    return null;
  }

  await ensureCDNPreferenceLoaded();

  const availableCDNs = getAvailableCDNs(version);

  for (const cdn of availableCDNs) {
    const url = buildCDNUrl(cdn, version, resourcePath);

    try {
      console.log(`[CDN Fallback] Trying ${cdn.name}: ${url}`);
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        markCDNFailure(cdn.name, `status:${response.status}`);
        console.warn(`[CDN Fallback] ${cdn.name} returned ${response.status}`);
        continue;
      }

      if (!(await isValidCDNResponse(response, cdn.name))) {
        continue;
      }

      markCDNSuccess(cdn.name);
      console.log(`[CDN Fallback] Success from ${cdn.name}`);
      return { response, source: cdn.name };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'timeout'
          : 'network-error';
      markCDNFailure(cdn.name, reason);
      console.warn(`[CDN Fallback] ${cdn.name} failed:`, error);
    }
  }

  try {
    const localUrl = getLocalUrl(localOrigin, resourcePath);
    console.log(`[CDN Fallback] Trying local server: ${localUrl}`);

    const response = await fetchWithTimeout(localUrl);
    if (response.ok) {
      console.log('[CDN Fallback] Success from local server');
      return { response, source: 'local' };
    }
  } catch (error) {
    console.warn('[CDN Fallback] Local server failed:', error);
  }

  console.error(`[CDN Fallback] All sources failed for: ${resourcePath}`);
  return null;
}

export async function performHealthCheck(
  version: string
): Promise<Map<string, boolean>> {
  await ensureCDNPreferenceLoaded();

  const results = new Map<string, boolean>();

  for (const source of CDN_SOURCES) {
    if (!source.enabled) continue;

    const url = buildCDNUrl(source, version, source.healthCheckPath);

    try {
      const response = await fetchWithTimeout(url, 5000);
      const isHealthy = response.ok;
      results.set(source.name, isHealthy);

      if (isHealthy) {
        markCDNSuccess(source.name);
      } else {
        markCDNFailure(source.name, `status:${response.status}`);
      }
    } catch {
      results.set(source.name, false);
      markCDNFailure(source.name, 'health-check-failed');
    }
  }

  return results;
}

export function getCDNStatusReport(): Array<{
  name: string;
  status: CDNHealthStatus;
  preferred: boolean;
}> {
  const preferredName = isFreshPreference(persistedCDNPreference)
    ? persistedCDNPreference?.cdn
    : null;

  return Array.from(cdnHealthStatus.entries()).map(([name, status]) => ({
    name,
    status,
    preferred: preferredName === name,
  }));
}

export function resetCDNStatus(): void {
  initHealthStatus(true);
  console.log('[CDN Fallback] All CDN status reset');
}

export function getCDNConfig() {
  return {
    ...CDN_CONFIG,
    sources: CDN_SOURCES,
    preference: persistedCDNPreference,
  };
}
