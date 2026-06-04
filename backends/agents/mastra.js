import { getDefaultLLMConfig } from './providers.js';

let _mastraInstance = null;

class AgentError extends Error {
  constructor(code, message, retryable, status) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

class Agent {
  constructor(id) {
    this.id = id;
  }

  async generate(prompt, options = {}) {
    const llmConfig = getDefaultLLMConfig();

    if (!llmConfig) {
      throw new AgentError(
        'NO_LLM_CONFIGURED',
        'No LLM provider is configured. Set up an API key in Settings \u2192 API Keys.',
        false,
        null,
      );
    }

    const baseUrl = llmConfig.baseUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    const body = {
      model: llmConfig.model,
      messages: [{ role: 'user', content: String(prompt) }],
      max_tokens: 4096,
    };

    if (options.output === 'object') {
      body.response_format = { type: 'json_object' };
    }

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${llmConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new AgentError(
        'NETWORK_ERROR',
        `Failed to reach LLM provider: ${err.message}`,
        true,
        null,
      );
    }

    if (!res.ok) {
      let errorBody;
      try { errorBody = await res.json(); } catch { errorBody = {}; }
      const errMsg = errorBody?.error?.message || errorBody?.error || `HTTP ${res.status}`;

      if (res.status === 401) {
        throw new AgentError(
          'MISSING_KEY',
          `Authentication failed for ${llmConfig.provider}: ${errMsg}`,
          false,
          res.status,
        );
      }
      throw new AgentError(
        'API_ERROR',
        `LLM API error (${res.status}): ${errMsg}`,
        res.status >= 500,
        res.status,
      );
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new AgentError('INVALID_RESPONSE', 'LLM returned non-JSON response', false, res.status);
    }

    const text = data?.choices?.[0]?.message?.content || '';
    let object = null;
    if (options.output === 'object' && text) {
      try {
        object = JSON.parse(text);
      } catch {
        /* text is available even if JSON parse fails */
      }
    }

    return { text, object };
  }
}

const AGENT_IDS = [
  'scriptAgent',
  'characterCastingAgent',
  'locationSetAgent',
  'storyboardAgent',
  'beatOutlineAgent',
  'promptEngineerAgent',
  'generationAgent',
  'consistencyAuditorAgent',
  'spatialAnnotationAgent',
  'audioAgent',
  'sequenceAssemblyAgent',
  'finishColorAgent',
  'visualAnalysisAgent',
  'conceptAnalysisAgent',
];

class MastraFacade {
  constructor() {
    this._agents = Object.fromEntries(AGENT_IDS.map((id) => [id, new Agent(id)]));
  }

  getAgentById(id) {
    const agent = this._agents[id];
    if (!agent) {
      throw new AgentError('UNKNOWN_AGENT', `No agent registered with id "${id}"`, false, null);
    }
    return agent;
  }
}

function getMastra() {
  if (!_mastraInstance) {
    _mastraInstance = new MastraFacade();
  }
  return _mastraInstance;
}

function resolveDefaultModel() {
  const config = getDefaultLLMConfig();
  if (!config) return null;
  return {
    provider: config.provider,
    model: config.model,
    configured: true,
  };
}

function reload() {
  /* Keys are re-read on every generate() call via getDefaultLLMConfig(),
     so no cache to invalidate. This hook exists so proxy.js can call it
     after key saves for consistency. */
}

export { getMastra, resolveDefaultModel, reload, AgentError };
