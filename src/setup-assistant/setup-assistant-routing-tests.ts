interface RoutingTestDeps {
  routingModalities: string[];
  setupSteps: Array<{ id: string }>;
  getCurrentStep: () => number;
  getState: () => any;
  getTestAborts: () => Record<string, AbortController>;
  setTestAbort: (mod: string, controller: AbortController | null) => void;
  getVendorTestAborts: () => Record<string, AbortController>;
  collectCurrentStep: (idx: number) => void;
  saveProgress: () => void;
  renderSetupStep: (idx: number) => void;
  fetchModels: (
    providerId: string,
    key: string,
    baseUrl: string,
    mod: string,
    signal?: AbortSignal
  ) => Promise<any>;
  modalityChipLabel: (mod: string) => string;
  applyVendorCatalogFetchResult?: (vendorId: string, providerId: string, mod: string, result: any) => void;
  setVendorModalityCatalog?: (vendorId: string, providerId: string, mod: string, result: any) => void;
  ensureModelId: (mod: string) => void;
  refreshModelSelect: (mod: string) => void;
  saveStepData: (mod: string) => void;
  triggerModelActivityBlink?: (mod: string) => void;
  afterSuccessfulTest?: (
    mod: string,
    listedModels: any[],
    fetchedAt: number,
    modalityState: any,
    result: any
  ) => void;
  syncModalityProviderFromVendor: (mod: string) => void;
  vendorById: (vendorId: string) => any;
  keyFromInput: (mod: string) => string;
  setTestStatus: (mod: string, statusType: string, message: string, rawHtml?: boolean) => void;
}

export async function testVendorAllModalities(vendor: any, deps: RoutingTestDeps): Promise<void> {
  const localKey = String(vendor?.apiKey || '').trim();
  if (!vendor?.id || !localKey) {
    vendor.status = 'err';
    vendor.statusMsg = 'No API key to test.';
    if (deps.setupSteps[deps.getCurrentStep()]?.id === 'providers') deps.renderSetupStep(deps.getCurrentStep());
    return;
  }

  const vendorTestAborts = deps.getVendorTestAborts();
  if (vendorTestAborts[vendor.id]) {
    try {
      vendorTestAborts[vendor.id].abort();
    } catch {
      // noop
    }
  }
  const controller = new AbortController();
  vendorTestAborts[vendor.id] = controller;

  const key = String(vendor.apiKey || '').trim();
  const baseUrl = vendor.baseUrl || '';
  const providerId = vendor.providerId;

  const fetches = deps.routingModalities.map((mod) =>
    deps
      .fetchModels(providerId, key, baseUrl, mod, controller.signal)
      .then((result) => ({ mod, result }))
      .catch((e) => ({ mod, error: e }))
  );

  let settled: any[];
  try {
    settled = await Promise.all(fetches);
  } catch (e: any) {
    delete vendorTestAborts[vendor.id];
    if (e?.name === 'AbortError') return;
    vendor.status = 'err';
    vendor.statusMsg = e?.message || 'Test failed.';
    if (deps.setupSteps[deps.getCurrentStep()]?.id === 'providers') deps.renderSetupStep(deps.getCurrentStep());
    deps.saveProgress();
    return;
  }

  delete vendorTestAborts[vendor.id];

  let anyOk = false;
  const firstErrMsg: string[] = [];

  for (const { mod, result, error } of settled) {
    if (error) {
      if (error.name === 'AbortError') return;
      firstErrMsg.push(`${deps.modalityChipLabel(mod)}: ${error.message}`);
      continue;
    }
    if ((result.ok || result.rateLimit) && result.models?.length > 0) {
      anyOk = true;
      if (typeof deps.applyVendorCatalogFetchResult === 'function') {
        deps.applyVendorCatalogFetchResult(vendor.id, providerId, mod, result);
      } else if (typeof deps.setVendorModalityCatalog === 'function') {
        deps.setVendorModalityCatalog(vendor.id, providerId, mod, result);
      }
    } else if (result.rateLimit) {
      anyOk = true;
      if (typeof deps.applyVendorCatalogFetchResult === 'function') {
        deps.applyVendorCatalogFetchResult(vendor.id, providerId, mod, result);
      } else if (typeof deps.setVendorModalityCatalog === 'function') {
        deps.setVendorModalityCatalog(vendor.id, providerId, mod, result);
      }
    } else if (!result.ok && result.message) {
      firstErrMsg.push(`${deps.modalityChipLabel(mod)}: ${result.message}`);
    }
  }

  if (anyOk) {
    vendor.status = 'ok';
    vendor.statusMsg = '';
  } else {
    vendor.status = 'err';
    vendor.statusMsg = firstErrMsg.length
      ? firstErrMsg[0].replace(/^[^:]+:\s*/, '')
      : 'No models found. Check your API key.';
  }

  if (deps.setupSteps[deps.getCurrentStep()]?.id === 'providers') deps.renderSetupStep(deps.getCurrentStep());
  deps.saveProgress();
}

export async function runConnectionTest(
  mod: string,
  options: { updateUi?: boolean } | undefined,
  deps: RoutingTestDeps
): Promise<any> {
  const updateUi = !options || options.updateUi !== false;
  deps.collectCurrentStep(deps.getCurrentStep());

  const state = deps.getState();
  const s = state[mod];
  deps.syncModalityProviderFromVendor(mod);
  const testBtn = document.getElementById(`sa-test-btn-${mod}`) as HTMLButtonElement | null;
  const key = deps.keyFromInput(mod);
  const vendor = deps.vendorById(s.vendorId);
  const hasServerKey = Boolean(vendor?.hasServerKey);

  if (!key && !hasServerKey) {
    if (updateUi) deps.setTestStatus(mod, 'err', 'Assign a provider with an API key first.');
    return { ok: false, rateLimit: false, message: 'Assign a provider with an API key first.', noKey: true };
  }

  const testAborts = deps.getTestAborts();
  if (testAborts[mod]) {
    try {
      testAborts[mod].abort();
    } catch {
      // noop
    }
  }
  const controller = new AbortController();
  deps.setTestAbort(mod, controller);

  state[mod].status = 'testing';
  if (updateUi) {
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Testing…';
    }
    deps.setTestStatus(mod, 'testing', 'Connecting…');
  }

  const resetTestBtn = () => {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.innerHTML =
        '<i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test Connection &amp; List Models';
    }
  };

  try {
    const result = await deps.fetchModels(
      s.providerId || deps.vendorById(s.vendorId)?.providerId,
      key,
      s.baseUrl || deps.vendorById(s.vendorId)?.baseUrl || '',
      mod,
      controller.signal
    );
    if (updateUi) resetTestBtn();

    state[mod].status = result.ok ? 'ok' : result.rateLimit ? 'ratelimit' : 'err';
    state[mod].statusMsg = result.message;

    if (result.ok || result.rateLimit) {
      const listedModels = result.models || [];
      const fetchedAt = Date.now();
      state[mod].listedModels = listedModels;
      state[mod].fetchedAt = fetchedAt;
      deps.ensureModelId(mod);
      deps.refreshModelSelect(mod);

      if (typeof deps.afterSuccessfulTest === 'function') {
        deps.afterSuccessfulTest(mod, listedModels, fetchedAt, s, result);
      }

      if (typeof deps.applyVendorCatalogFetchResult === 'function' && s.vendorId) {
        deps.applyVendorCatalogFetchResult(s.vendorId, s.providerId, mod, { ...result, fetchedAt });
      } else if (typeof deps.setVendorModalityCatalog === 'function' && s.vendorId) {
        deps.setVendorModalityCatalog(s.vendorId, s.providerId, mod, { ...result, fetchedAt });
      }

      if (typeof deps.triggerModelActivityBlink === 'function') deps.triggerModelActivityBlink(mod);

      if (updateUi) {
        const count = listedModels.length;
        const msg = result.rateLimit
          ? `Rate limited — key is likely valid. <small>(${result.message})</small>`
          : count
            ? `<i class=\"fa-solid fa-circle-check\"></i> Connected — ${count} model${count !== 1 ? 's' : ''} listed.`
            : '<i class="fa-solid fa-circle-check"></i> Connected — no models listed by provider.';
        deps.setTestStatus(mod, result.rateLimit ? 'ratelimit' : 'ok', msg, true);
      }

      deps.saveStepData(mod);
      deps.saveProgress();
      return { ok: result.ok, rateLimit: result.rateLimit, message: result.message };
    }

    if (updateUi) deps.setTestStatus(mod, 'err', result.message);
    deps.saveProgress();
    return { ok: false, rateLimit: false, message: result.message || 'Connection failed.' };
  } catch (e: any) {
    if (updateUi) resetTestBtn();
    if (e?.name === 'AbortError') return { ok: false, rateLimit: false, message: 'Cancelled.', aborted: true };
    state[mod].status = 'err';
    state[mod].statusMsg = e?.message;
    if (updateUi) deps.setTestStatus(mod, 'err', `Unexpected error: ${e?.message}`);
    deps.saveProgress();
    return { ok: false, rateLimit: false, message: e?.message };
  }
}
