import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAWNIX_SETTINGS_KEY } from '../../constants/storage';

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
}

describe('settings-manager', () => {
  beforeEach(() => {
    vi.resetModules();
    if (typeof localStorage?.clear !== 'function') {
      Object.defineProperty(globalThis, 'localStorage', {
        value: createStorageMock(),
        configurable: true,
      });
    }
    localStorage.clear();
  });

  it('preserves saved provider type and auth type for managed providers', async () => {
    vi.doMock('../crypto-utils', () => ({
      CryptoUtils: {
        testCrypto: async () => false,
        isEncrypted: () => false,
        decrypt: async (value: string) => value,
        encrypt: async (value: string) => value,
      },
    }));

    vi.doMock('../config-indexeddb-writer', () => ({
      configIndexedDBWriter: {
        saveConfig: async () => {},
      },
    }));

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://api.tu-zi.com/v1',
        },
        providerProfiles: [
          {
            id: 'legacy-default',
            name: '兔子 AI',
            providerType: 'custom',
            baseUrl: 'https://api.tu-zi.com/v1',
            apiKey: 'legacy-key',
            authType: 'query',
            enabled: true,
            capabilities: {},
          },
          {
            id: 'tuzi-origin',
            name: '兔子 原价',
            providerType: 'gemini-compatible',
            baseUrl: 'https://example.com/custom-endpoint',
            apiKey: 'origin-key',
            authType: 'header',
            enabled: true,
            capabilities: {},
          },
        ],
      })
    );

    const {
      providerProfilesSettings,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      TUZI_ORIGINAL_PROVIDER_PROFILE_ID,
      TUZI_CODEX_PROVIDER_PROFILE_ID,
    } = await import('../settings-manager');

    const profiles = providerProfilesSettings.get();
    const legacyProfile = profiles.find(
      (profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID
    );
    const tuziOriginProfile = profiles.find(
      (profile) => profile.id === TUZI_ORIGINAL_PROVIDER_PROFILE_ID
    );
    const tuziCodexProfile = profiles.find(
      (profile) => profile.id === TUZI_CODEX_PROVIDER_PROFILE_ID
    );

    expect(legacyProfile).toMatchObject({
      providerType: 'custom',
      authType: 'query',
    });
    expect(tuziOriginProfile).toMatchObject({
      providerType: 'gemini-compatible',
      authType: 'header',
      pricingGroup: 'default',
    });
    expect(tuziCodexProfile).toMatchObject({
      pricingGroup: 'codex',
    });
  });
});
