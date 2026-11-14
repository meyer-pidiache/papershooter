# Networking

The game runs in browsers. The host browser manages lobby membership, scores, clock and host
migration. Players simulate their own bodies and report damage/events. This is not a cheat-resistant
authoritative game server. Changing that trust model would require a protocol/gameplay redesign.

| Component              | Role                                                                         | Required                                           |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Static host            | Serves the compiled frontend                                                 | All play                                           |
| PeerServer             | Exchanges PeerJS signaling/connection metadata                               | Multiplayer                                        |
| STUN                   | Discovers public addresses and candidates                                    | Optional, improves direct connectivity             |
| TURN                   | Relays WebRTC traffic when direct routes fail                                | Optional, needed by some NAT/firewall combinations |
| Project credential API | Keeps provider/signing secrets private and issues temporary TURN credentials | Only for managed temporary credentials             |

Browsers contact STUN/TURN directly. STUN is not a signaling server or a relay. The project's API
does not carry gameplay traffic. A VPS/static host with no API can support solo and direct/STUN
multiplayer; it cannot guarantee connectivity across every network. Node, Go or Rust do not change
that routing constraint. See [ADR 0002](adr/0002-networking-and-credentials.md).

## Public frontend configuration

Vite reads these at development/build time. Rebuild when they change. A deployed static host can
also replace `ice-servers.json` without rebuilding.

| Variable                    | Default                                     | Meaning                                                                    |
| --------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `VITE_STUN_SERVERS`         | Unset                                       | Comma-separated public STUN URLs; an explicitly empty value disables STUN  |
| `VITE_ICE_CONFIG_URL`       | `/ice-servers.json`                         | Optional JSON source when no STUN override is set                          |
| `VITE_TURN_CREDENTIALS_URL` | Unset                                       | Same-origin path or HTTPS URL for expiring TURN credentials                |
| `VITE_PEER_HOST`            | Unset                                       | Use PeerJS Cloud; set a hostname to use another PeerServer                 |
| `VITE_PEER_PORT`            | 443, or 80 for insecure local signaling     | Signaling port when a host is configured                                   |
| `VITE_PEER_PATH`            | `/`                                         | Signaling service path                                                     |
| `VITE_PEER_SECURE`          | `true`                                      | Use secure signaling; `false` is for an explicitly configured local server |
| `VITE_LOBBY_NAMESPACE`      | Legacy compatible production/local prefixes | Separate deployments/protocols when desired                                |

The checked-in `public/ice-servers.json` is an editable deployment default, not a host list embedded
in transport code. Its contract is `{ "iceServers": [{ "urls": ["stun:host:3478"] }] }`. Any valid
STUN host can be supplied. The client retains all valid TURN URLs/ports/transports returned by its
credential endpoint; it does not filter by provider hostname.

Localhost defaults to `doodledev-`; deployed clients retain `doodledistrict-` so the existing lobby
discovery protocol stays compatible. Saved browser preferences migrate from `doodle_*` to `paper_*`
without deleting old values. These compatibility identifiers are intentionally retained.

## Credential API

`GET /api/turn-credentials` returns this provider-independent contract:

```json
{
  "iceServers": [
    {
      "urls": ["turn:relay.example:3478?transport=udp", "turns:relay.example:5349?transport=tcp"],
      "username": "temporary-user",
      "credential": "temporary-password"
    }
  ],
  "expiresAt": 1800000000000
}
```

`expiresAt` is an absolute Unix timestamp in milliseconds. Clients cache/coalesce requests and
renew credentials before expiry. Configuration/provider failures fall back to available ICE
servers and remain retryable. They do not invent permanent credentials or silently select a
different provider. A same-origin endpoint or external HTTPS adapter can implement this contract.

`GET /api/ice-servers` exposes public STUN URLs from runtime environment variables. Compose builds
use it, allowing STUN changes through container recreation. `GET /healthz` reports process health.
All API JSON uses `no-store`. Unsupported methods return 405; missing provider configuration returns
503; provider failure returns a redacted 502. The service bounds rate-limiter memory, coalesces
provider calls and applies a 10 second upstream deadline.

## Private runtime configuration

| Variable                              | Meaning                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `TURN_PROVIDER`                       | `none`, `cloudflare` or `coturn`; if unset, legacy Cloudflare keys enable that adapter |
| `TURN_TTL_SECONDS`                    | 300–172800, default 3600; legacy `CF_TURN_TTL_SECONDS` is still recognized             |
| `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` | Cloudflare TURN key id and private API token                                           |
| `TURN_URLS`, `TURN_SHARED_SECRET`     | coturn URLs and the private REST authentication secret                                 |
| `PAPERSHOOT_STUN_SERVERS`             | Public STUN URLs exposed by the optional runtime endpoint                              |
| `PORT`, `HOST`                        | Native listener, default `3000` / `127.0.0.1`; Docker sets `8080` / `0.0.0.0`          |
| `TRUST_PROXY`                         | Default `false`; honor a proxy IP header only behind a private trusted ingress         |
| `TRUST_PROXY_HEADER`                  | Default `x-real-ip`; the ingress must overwrite this header with a verified IP         |
| `ALLOWED_ORIGINS`                     | Optional comma-separated HTTPS frontend origins for cross-origin API reads             |

For Cloudflare, select `TURN_PROVIDER=cloudflare` and supply both Cloudflare variables. For coturn,
enable its REST authentication/shared secret mechanism, select `TURN_PROVIDER=coturn`, set matching
`TURN_SHARED_SECRET` and list its `turn:`/`turns:` endpoints in `TURN_URLS`. coturn-compatible HMAC-SHA1
credentials follow that protocol; they are not password hashes or a configurable general signing
algorithm. The signing secret never leaves the API. See [coturn documentation](https://github.com/coturn/coturn)
and [Cloudflare credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/).

This is an anonymous game: the endpoint is not an authentication service. CORS is a browser read
policy, not access control. In-memory limits apply per process; scaled/serverless deployments need
an edge/distributed rate limit and provider usage limits. Keep the origin private before trusting
forwarded IPs. A Cloudflare Tunnel ingress can use `cf-connecting-ip` when that route guarantees the
header is overwritten; other proxies can use `x-real-ip` or another configured pure IP header.
