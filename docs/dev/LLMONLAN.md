# Running the AI on your own LAN with LlmOnLan

[LlmOnLan](https://github.com/b2renger/LlmOnLan) turns one or more GPU machines on a local network
into a single load-balanced, OpenAI-compatible endpoint. RetroPlaningStudio treats such a farm as a
first-class AI provider: everything the app can do with Gemini or OpenAI, it can do with a model
running on a box in the next room, with no data leaving the network.

## What a farm exposes

A farm operator runs `lol up`. That starts three things this app cares about:

| Thing | Where | Used for |
|---|---|---|
| LiteLLM proxy, OpenAI-compatible | `http://<farm-ip>:4000/v1` | Chat completions and model listing |
| UDP discovery beacon | multicast `239.255.43.10`, port `41998`, every 5 s | Finding farms without typing an address |
| Admin panel | `http://<farm-ip>:41997/lol/admin` | Operator only, not touched by this app |

Two details shape the integration. The proxy's master key is optional: `proxy.masterKey` defaults to
`null`, meaning an open proxy on a trusted LAN, so the app must work with and without a key. And
`/v1/models` is ungated even when chat is gated, so the app can list models before the user has
entered a key, which makes the setup screen feel immediate.

## How the app connects

### Discovery, desktop build only

Browsers cannot join a multicast group, so discovery lives in the Electron main process and is
exposed to the app through the preload bridge.

- `electron/farmDiscovery.ts` binds a UDP socket to port `41998`, joins `239.255.43.10` on every
  non-internal IPv4 interface, collects beacons for a few seconds, deduplicates by endpoint, closes.
- `parseBeacon(text, senderAddress)` is a pure function, tested against several payload shapes,
  because the beacon format is the farm's business and may change. It reads the port from
  `proxy.port`, `proxyPort`, `port`, or a full `endpoint` URL, and falls back to 4000. It reads the
  model from `model`, `activeModel`, `defaultModel`, or the first entry of `models`. When the payload
  carries an unroutable host such as `0.0.0.0` or `127.0.0.1`, the sender's address wins — that is
  the address that actually reaches the farm.
- Unknown fields are ignored rather than rejected, so a newer farm still shows up.

In the web build `discoverFarms()` returns an empty list and the user types the address. That is a
one-line difference in the UI, not a different code path.

### Talking to it

A farm is an `AiProviderConfig` with `providerId: 'llmonlan'`, handled by the OpenAI-compatible
adapter with two deliberate differences:

- **The key is optional.** `Authorization: Bearer <key>` is sent only when the user supplied one.
- **No `response_format`.** OpenAI's JSON mode is rejected by several local servers, so for farms the
  app asks for JSON in the prompt instead and parses defensively. `extractJson` tolerates code
  fences, prose around the payload, and braces inside strings — local models produce all three.

`normalizeLlmOnLanEndpoint` accepts what a person would actually type. `192.168.1.20` becomes
`http://192.168.1.20:4000/v1`. A host with a port keeps that port and gains `/v1`. An address that
already ends in `/v1` is left alone. Scheme defaults to `http` because a LAN farm has no certificate.

### Why calls go through the main process

In the packaged desktop app the renderer runs from `file://`, and a LAN farm sends no CORS headers.
Every request therefore goes through `httpFetch`, which routes to `window.desktop.fetch` when the
bridge exists and falls back to `window.fetch` on the web. The renderer never needs to know which it
got. A consequence worth remembering: network errors crossing the IPC boundary lose their error
class, so the error mapper matches on message wording to still report an unreachable farm as a
network problem rather than an unknown one.

## Using it

1. On the GPU machine: `node bin/lol.js up` (or the farm desktop app). Note the address it prints.
2. In RetroPlaningStudio, open Settings, AI providers, Add provider, choose **LlmOnLan farm (LAN)**.
3. Desktop build: press Scan and pick a farm. Web build, or a farm on another subnet: type the
   address.
4. Leave the key empty unless the operator set `proxy.masterKey`.
5. The model list is fetched from the farm. Pick one and press Test connection.
6. Make it the default provider, and every AI feature — structuring notes into a plan, dependency
   analysis, the assistant — now runs on that machine.

## Code map

| File | Responsibility |
|---|---|
| `electron/farmDiscovery.ts` | UDP beacon listener and `parseBeacon` |
| `src/services/ai/farms.ts` | `discoverFarms`, `probeFarm`, `farmToProviderConfig` |
| `src/services/ai/providers/openaiCompatible.ts` | `llmOnLanAdapter`, `normalizeLlmOnLanEndpoint` |
| `src/services/ai/registry.ts` | Catalog entry: no key required, base URL required, can list models |
| `src/services/http/httpClient.ts` | Desktop-aware fetch that sidesteps CORS |

## Limits

- Discovery needs the desktop build and a network that forwards multicast. Many corporate and guest
  networks do not. Manual entry always works.
- A farm on a different subnet will not be discovered; type its address.
- Local models are weaker at strict JSON than the large cloud models. The app retries once with an
  explicit instruction, then falls back to the local heuristic planner and says so plainly.
- The app does not read the farm's seat or capacity information. If the farm is full, the request
  waits as it would for any client.
