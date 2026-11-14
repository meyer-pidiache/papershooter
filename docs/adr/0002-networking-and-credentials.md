# 0002: Networking and credentials

Date: 2026-11-14. Status: accepted.

## Context

PeerJS uses a signaling server to introduce browsers. WebRTC uses ICE to find a route: STUN discovers
public addresses; TURN relays traffic when a direct route fails. A TURN server does not replace
signaling. Match authority and score keeping remain in the host browser.

The old client had a built-in list of public STUN hosts and selected only known Cloudflare TURN
URLs. Its Node service exchanged a Cloudflare API token for temporary relay credentials.

## Decision

Keep browser WebRTC and PeerJS. Make signaling options, lobby namespace, public STUN URLs and the
optional credentials endpoint configurable. Pass valid provider-independent ICE entries to PeerJS;
do not require Cloudflare hostnames in the client. The browser contacts STUN/TURN directly.

Static hosting needs no project API for solo play or STUN-only networking. Private signing secrets
and provider API tokens require a trusted service when minting short-lived TURN credentials. Keep
that service optional and small, with provider adapters for Cloudflare and the HMAC credential
scheme supported by coturn. A custom HTTPS credential endpoint can implement the same JSON contract.
Do not publish permanent TURN credentials or provider secrets in Vite variables.

## Alternatives and consequences

- Removing signaling would require another way to exchange offers, answers and ICE candidates.
- STUN-only networking is simpler but cannot connect every NAT/firewall combination.
- Go/Rust could reduce a Node runtime's footprint, but token exchange is infrequent I/O, outside
  the gameplay loop. There is no measured throughput problem. A second backend language adds
  toolchains and deployment work without evidence of benefit.
- An authoritative game server could improve cheat resistance; it is a gameplay/protocol redesign
  outside a behavior-preserving refactor. Existing host migration and lobby discovery remain.

Keep the deployed lobby namespace compatible by default and isolate localhost lobbies. A custom
namespace is recommended for intentionally separate deployments or future incompatible protocols.

## Evidence

- [PeerJS signaling and self hosting](https://peerjs.com/client/getting-started)
- [WebRTC protocols: ICE, STUN and TURN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols)
- [Cloudflare temporary credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
