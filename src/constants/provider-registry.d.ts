export interface ProviderRuntimeEntry {
  slotId: string;
  name: string;
  providerId: string;
  proxyTarget: string;
  envKey: string;
  envBaseUrlKey?: string;
  defaultBaseUrl: string;
  authHeader: string;
}

export declare const PROVIDER_RUNTIME_REGISTRY: ReadonlyArray<ProviderRuntimeEntry>;

export declare function providerRuntimeByProxyTarget(): Record<string, ProviderRuntimeEntry>;
export declare function providerRuntimeBySlotId(): Record<string, ProviderRuntimeEntry>;
export declare function defaultProxyTargetForProvider(providerId: string): string;
