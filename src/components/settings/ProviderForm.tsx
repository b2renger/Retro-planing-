import React from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { listModels, testConnection, type ConnectionTestResult } from '../../services/ai/client';
import { PROVIDER_CATALOG } from '../../services/ai/registry';
import type { AiProviderConfig, AiProviderId, ModelInfo } from '../../services/ai/types';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, Field, INPUT_CLASS, LINK_CLASS } from './controls';
import { FarmDiscovery } from './FarmDiscovery';
import { canLoadModels, displayEndpoint, draftToConfig, missingRequirements, secretsStorageNote, uniqueLabel } from './helpers';

const OTHER = '__other__';

export interface ProviderFormProps {
  family: AiProviderId;
  /** Present when editing an existing provider; absent when adding one. */
  existing?: AiProviderConfig | null;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Add / edit form for one provider. The fields shown follow `PROVIDER_CATALOG`: a key only when the
 * family needs one, a base URL only when it must be pointed somewhere, and the LlmOnLan family gets
 * the farm finder instead of a plain URL field.
 */
export const ProviderForm: React.FC<ProviderFormProps> = ({ family, existing, onDone, onCancel }) => {
  const { aiSettings, addAiProvider, updateAiProvider, secretsBackend, secretsReady } = useApp();
  const entry = PROVIDER_CATALOG[family];
  const isFarm = family === 'llmonlan';

  const [label, setLabel] = React.useState(
    () => existing?.label ?? uniqueLabel(entry.label, aiSettings.providers.map((p) => p.label)),
  );
  const [apiKey, setApiKey] = React.useState(existing?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = React.useState(existing?.baseUrl ?? entry.defaultBaseUrl ?? '');
  const [model, setModel] = React.useState(existing?.model ?? entry.defaultModel);

  const [models, setModels] = React.useState<ModelInfo[]>([]);
  const [fromFallback, setFromFallback] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);
  const [loadingModels, setLoadingModels] = React.useState(false);
  const [customModel, setCustomModel] = React.useState(false);

  const [testing, setTesting] = React.useState(false);
  const [test, setTest] = React.useState<ConnectionTestResult | null>(null);

  // The stored key arrives late on desktop (OS keychain). Take it when it lands so an edit never
  // saves an empty key over a real one.
  React.useEffect(() => {
    if (existing?.apiKey) setApiKey(existing.apiKey);
  }, [existing?.apiKey]);

  /** Editing while the keychain is still loading would overwrite the stored key with an empty one. */
  const keysLoading = !secretsReady && !!existing;

  const draft = { id: existing?.id, providerId: family, label, apiKey, baseUrl, model };
  const missing = missingRequirements(family, draft);
  const normalizedBaseUrl = displayEndpoint(baseUrl, family);

  const loadModels = async () => {
    setLoadingModels(true);
    setListError(null);
    try {
      const res = await listModels(draftToConfig(draft));
      setModels(res.models);
      setFromFallback(res.fromFallback);
      setListError(res.error?.message ?? null);
      if (!model && res.models[0]) setModel(res.models[0].id);
    } finally {
      setLoadingModels(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await testConnection(draftToConfig(draft)));
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    const cfg = draftToConfig(draft);
    if (existing) {
      updateAiProvider(existing.id, { label: cfg.label, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model });
    } else {
      addAiProvider({ providerId: cfg.providerId, label: cfg.label, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, enabled: true });
    }
    onDone();
  };

  const useFarm = (cfg: AiProviderConfig) => {
    setBaseUrl(cfg.baseUrl ?? '');
    if (cfg.model) setModel(cfg.model);
    if (!existing) setLabel(uniqueLabel(cfg.label, aiSettings.providers.map((p) => p.label)));
    setModels([]);
    setTest(null);
  };

  const modelInList = models.some((m) => m.id === model);
  const selectValue = customModel || (model && !modelInList) ? OTHER : model;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onCancel} className={BTN_GHOST}>
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <a href={entry.docsUrl} target="_blank" rel="noreferrer" className={`${LINK_CLASS} text-[11px] inline-flex items-center gap-1`}>
          <span>{entry.label} docs</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <h3 className="text-sm font-bold text-fg">
        {existing ? `Edit ${existing.label}` : `Add ${entry.label}`}
      </h3>

      <Field label="Name" htmlFor="provider-label" hint="How this provider appears in the list. Rename it freely.">
        <input id="provider-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT_CLASS} />
      </Field>

      {isFarm ? (
        <FarmDiscovery endpoint={baseUrl} onEndpointChange={setBaseUrl} masterKey={apiKey} onMasterKeyChange={setApiKey} onUseFarm={useFarm} />
      ) : (
        <>
          {entry.requiresBaseUrl && (
            <Field
              label="Base URL"
              htmlFor="provider-base-url"
              hint={
                normalizedBaseUrl ? (
                  <>
                    Calls will go to <span className="font-mono text-fg">{normalizedBaseUrl}</span>
                  </>
                ) : (
                  'Address of the server, e.g. http://localhost:11434/v1'
                )
              }
            >
              <input
                id="provider-base-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={entry.defaultBaseUrl ?? 'http://localhost:11434/v1'}
                className={INPUT_CLASS}
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          )}

          {entry.requiresKey ? (
            <Field
              label="API key"
              htmlFor="provider-key"
              hint={
                <>
                  {secretsStorageNote(secretsBackend)}{' '}
                  <a href={entry.docsUrl} target="_blank" rel="noreferrer" className={LINK_CLASS}>
                    Get a key
                  </a>
                  {!secretsReady && ' · loading the stored key…'}
                </>
              }
            >
              <input
                id="provider-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={entry.keyHint}
                className={INPUT_CLASS}
                autoComplete="off"
                disabled={keysLoading}
              />
            </Field>
          ) : (
            <Field label="API key" suffix="optional" htmlFor="provider-key" hint={`${entry.keyHint}. ${secretsStorageNote(secretsBackend)}`}>
              <input
                id="provider-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave empty if the server is open"
                className={INPUT_CLASS}
                autoComplete="off"
                disabled={keysLoading}
              />
            </Field>
          )}
        </>
      )}

      <Field
        label="Model"
        htmlFor="provider-model"
        hint={
          fromFallback
            ? models.length > 0
              ? `The model list could not be fetched${listError ? ` (${listError})` : ''}, so these are the defaults shipped with the app. Typing a model name also works.`
              : `The model list could not be fetched${listError ? ` (${listError})` : ''}, and this provider ships no default list — type the model name.`
            : 'Ask the provider for its models, or type the name yourself.'
        }
      >
        <div className="space-y-2">
          <div className="flex gap-2">
            {models.length > 0 ? (
              <select
                id="provider-model"
                value={selectValue}
                onChange={(e) => {
                  if (e.target.value === OTHER) {
                    setCustomModel(true);
                  } else {
                    setCustomModel(false);
                    setModel(e.target.value);
                  }
                }}
                className={INPUT_CLASS}
              >
                {!model && <option value="">Select a model…</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label ?? m.id}
                  </option>
                ))}
                <option value={OTHER}>Other…</option>
              </select>
            ) : (
              <input
                id="provider-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={entry.defaultModel || 'model name'}
                className={INPUT_CLASS}
                spellCheck={false}
                autoComplete="off"
              />
            )}
            {entry.canListModels && (
              <button type="button" onClick={loadModels} disabled={!canLoadModels(family, draft) || loadingModels} className={`${BTN_SECONDARY} shrink-0`}>
                {loadingModels && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Load models</span>
              </button>
            )}
          </div>
          {models.length > 0 && selectValue === OTHER && (
            <input
              type="text"
              aria-label="Model name"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Type a model name"
              className={INPUT_CLASS}
              spellCheck={false}
              autoComplete="off"
            />
          )}
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={runTest} disabled={missing.length > 0 || testing} className={BTN_SECONDARY}>
          {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{testing ? 'Testing…' : 'Test connection'}</span>
        </button>
        <button type="button" onClick={save} disabled={missing.length > 0 || keysLoading} className={BTN_PRIMARY}>
          {existing ? 'Save changes' : 'Add provider'}
        </button>
        {missing.length > 0 && <span className="text-[11px] text-fg-muted">Still needed: {missing.join(', ')}.</span>}
        {keysLoading && <span className="text-[11px] text-fg-muted">Waiting for the stored key to load from the keychain…</span>}
      </div>

      {test && (
        <div
          role="status"
          className={`p-3 rounded-xl border text-[11px] leading-relaxed space-y-1 ${
            test.ok ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold text-fg">
            {test.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            )}
            <span>{test.ok ? `Answered in ${test.latencyMs} ms` : 'The request failed'}</span>
          </div>
          <p className="text-fg-muted">{test.message}</p>
          {test.ok && <p className="text-fg-muted">Model that answered: <span className="font-mono text-fg">{test.model}</span></p>}
          {test.sampleReply && (
            <p className="text-fg-muted">
              Reply: <span className="font-mono text-fg">{test.sampleReply.slice(0, 200)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
