import React from 'react';
import { CheckCircle2, Loader2, Radar, Server, XCircle } from 'lucide-react';
import { capabilities } from '../../capabilities';
import { discoverFarms, farmToProviderConfig, probeFarm, type FarmInfo, type FarmProbeResult } from '../../services/ai/farms';
import type { AiProviderConfig } from '../../services/ai/types';
import { BTN_SECONDARY, Field, INPUT_CLASS } from './controls';
import { displayEndpoint } from './helpers';
import { LanFarmNotice } from './LanFarmNotice';

const SCAN_MS = 4000;

export interface FarmDiscoveryProps {
  /** The form's base-URL value: this component owns the field so the address is typed once. */
  endpoint: string;
  onEndpointChange: (value: string) => void;
  /** The form's optional master key. */
  masterKey: string;
  onMasterKeyChange: (value: string) => void;
  /** Called with a ready-made config when the user picks a discovered farm. */
  onUseFarm: (cfg: AiProviderConfig) => void;
}

const FarmCard: React.FC<{ farm: FarmInfo; busy: boolean; onUse: () => void }> = ({ farm, busy, onUse }) => (
  <li className="flex items-start justify-between gap-3 p-3 rounded-xl bg-elevated border border-line">
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
        <Server className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="truncate">{farm.name || farm.host}</span>
      </div>
      <p className="text-[11px] text-fg-muted font-mono truncate">{farm.endpoint}</p>
      <p className="text-[11px] text-fg-muted">
        {farm.model ? `Model: ${farm.model}` : 'Model not advertised'}
        {farm.capacity?.slots !== undefined ? ` · ${farm.capacity.clients ?? 0}/${farm.capacity.slots} seats in use` : ''}
      </p>
    </div>
    <button type="button" onClick={onUse} disabled={busy} className={`${BTN_SECONDARY} shrink-0`}>
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      <span>Use this farm</span>
    </button>
  </li>
);

/**
 * LlmOnLan farm picker: multicast scan on the desktop build, manual address everywhere.
 * It owns the base-URL and master-key fields of the LlmOnLan form so an address is typed once.
 */
export const FarmDiscovery: React.FC<FarmDiscoveryProps> = ({ endpoint, onEndpointChange, masterKey, onMasterKeyChange, onUseFarm }) => {
  const { canDiscoverFarms, canUseLanFarms } = capabilities();
  const [scanning, setScanning] = React.useState(false);
  const [scanned, setScanned] = React.useState(false);
  const [farms, setFarms] = React.useState<FarmInfo[]>([]);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [usingEndpoint, setUsingEndpoint] = React.useState<string | null>(null);
  const [probing, setProbing] = React.useState(false);
  const [probe, setProbe] = React.useState<FarmProbeResult | null>(null);

  const normalized = displayEndpoint(endpoint, 'llmonlan');

  const scan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      setFarms(await discoverFarms(SCAN_MS));
      setScanned(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const use = async (farm: FarmInfo) => {
    setUsingEndpoint(farm.endpoint);
    try {
      onUseFarm(await farmToProviderConfig(farm, masterKey.trim() || undefined));
      setProbe(null);
    } finally {
      setUsingEndpoint(null);
    }
  };

  const check = async () => {
    if (!normalized) return;
    setProbing(true);
    setProbe(null);
    try {
      setProbe(await probeFarm(normalized, masterKey.trim() || undefined));
    } finally {
      setProbing(false);
    }
  };

  // An https page cannot reach a http LAN address at all, so there is no form worth showing.
  if (!canUseLanFarms) return <LanFarmNotice />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-bold text-fg uppercase tracking-wide">Find a farm</h4>
          {canDiscoverFarms && (
            <button type="button" onClick={scan} disabled={scanning} className={BTN_SECONDARY}>
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
              <span>{scanning ? 'Scanning…' : 'Scan network'}</span>
            </button>
          )}
        </div>

        {canDiscoverFarms ? (
          <>
            {scanning && <p className="text-[11px] text-fg-muted">Listening for farms on the local network… ({SCAN_MS / 1000} s)</p>}
            {scanError && (
              <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">
                Scan failed: {scanError}
              </p>
            )}
            {farms.length > 0 && (
              <ul className="space-y-2">
                {farms.map((farm) => (
                  <FarmCard key={farm.endpoint} farm={farm} busy={usingEndpoint === farm.endpoint} onUse={() => use(farm)} />
                ))}
              </ul>
            )}
            {scanned && !scanning && farms.length === 0 && !scanError && (
              <div className="p-3 rounded-xl bg-elevated border border-line text-[11px] text-fg-muted leading-relaxed space-y-1">
                <p className="text-fg font-semibold">No farm answered during the scan.</p>
                <p>That normally means one of two things:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>the farm is not running — start it with <code className="font-mono">lol up</code> on the GPU machine;</li>
                  <li>the network does not forward multicast — common on corporate and guest Wi-Fi, and always the case across subnets.</li>
                </ul>
                <p>Typing the address below works in both cases.</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-fg-muted leading-relaxed">
            Automatic discovery needs the desktop app: a browser cannot receive the farm’s multicast beacon. Type the farm’s address below
            instead — everything after that works the same.
          </p>
        )}
      </div>

      <Field
        label="Farm address"
        htmlFor="farm-endpoint"
        hint={
          normalized ? (
            <>
              Calls will go to <span className="font-mono text-fg">{normalized}</span>
            </>
          ) : (
            'Accepts 192.168.1.20, box.local:4000 or a full http://host:4000/v1 URL.'
          )
        }
      >
        <div className="flex gap-2">
          <input
            id="farm-endpoint"
            type="text"
            value={endpoint}
            onChange={(e) => {
              onEndpointChange(e.target.value);
              setProbe(null);
            }}
            placeholder="192.168.1.20"
            className={INPUT_CLASS}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="button" onClick={check} disabled={!normalized || probing} className={`${BTN_SECONDARY} shrink-0`}>
            {probing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Check</span>
          </button>
        </div>
      </Field>

      {probe && (
        <div
          role="status"
          className={`p-3 rounded-xl border text-[11px] leading-relaxed space-y-1 ${
            probe.reachable ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {probe.reachable ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            )}
            <span className="text-fg">{probe.reachable ? `Reachable in ${probe.latencyMs} ms` : 'Not reachable'}</span>
          </div>
          {probe.error && <p className="text-fg-muted">{probe.error}</p>}
          {probe.reachable && (
            <p className="text-fg-muted">
              {probe.models.length ? `${probe.models.length} model(s): ${probe.models.join(', ')}` : 'The farm answered but listed no model.'}
            </p>
          )}
        </div>
      )}

      <Field
        label="Master key"
        suffix="optional"
        htmlFor="farm-master-key"
        hint="Only needed if the operator set proxy.masterKey. Farms on a trusted LAN usually run open, so leaving this empty is normal."
      >
        <input
          id="farm-master-key"
          type="password"
          value={masterKey}
          onChange={(e) => onMasterKeyChange(e.target.value)}
          placeholder="Leave empty for an open farm"
          className={INPUT_CLASS}
          autoComplete="off"
        />
      </Field>
    </div>
  );
};
