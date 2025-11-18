## Solana Smart Wallet Flow (Faremeter Facilitator)

This document summarizes the current Solana smart-wallet flow powered by the Faremeter facilitator that lives in `new-facilitator/`.

### Why the change?

- We now settle x402 paywalls through Squads/Crossmint smart wallets on Solana instead of Base USDC wallets.
- The Faremeter facilitator handles Solana-specific settlement details (`recentBlockhash`, `feePayer`, `decimals`, partial signing, final submission) so the n8n node only needs to forward signed requirements.
- The entire wallet experience assumes Solana: every locator, balance query, and facilitator call uses Solana primitives.

### Client (Checkout → Paywall Request)

- `shared/actions/checkout/paywallRequest.operation.ts` now:
  - Creates a Crossmint smart wallet via `@faremeter/wallet-crossmint` (cluster derived from credentials env).
  - Uses `@faremeter/x-solana-settlement` + `@faremeter/fetch` to reproduce the reference `crossmint-payment.ts` workflow:
    1. POST the resource URL to trigger a 402.
    2. Feed the returned `accepts` payload into `processPaymentRequiredResponse`.
    3. Re-submit the request with the `X-PAYMENT` header produced by the handler (encoded Solana transaction).
  - Returns the facilitator requirement, payment payload, and resource response; there are no “rules” or private keys anymore—only a Crossmint smart wallet address.

### Server (Checkout Trigger → Paywall Webhook)

- `CrossmintCheckoutTrigger` automatically uses the hosted facilitator (`https://facilitator.corbits.dev`) and only lists `solana:usdc` tokens.
- `shared/actions/checkout/PaywallWebhook.operation.ts` now:
  - Builds plain Solana payment requirements (USDC mint per env).
  - Calls the facilitator `/accepts` endpoint (`requestFacilitatorAccepts`) before responding with a 402 so that `extra` fields (`feePayer`, `recentBlockhash`, `decimals`) are always fresh.
  - When an `X-PAYMENT` header is present, finds the matching requirement and calls `/settle` on the facilitator instead of the old Corbits API.
  - Validation is reduced to schema checks; all deep verification happens inside Faremeter.

### Wallet Nodes

- `CrossmintWallets` is Solana-only again:
  - No `chainType` toggles or EVM hints.
  - Balance queries always target `chains=solana`.
  - `Admin Signer` instructions reference base58 Solana keys exclusively.

### Dependencies

- Added: `@faremeter/fetch`, `@faremeter/wallet-crossmint`, `@faremeter/x-solana-settlement`.
- No generic EVM helpers are required; only Solana-specific tooling is bundled.

### Running the Facilitator

1. `cd new-facilitator/faremeter`
2. Follow `README.md` → configure `ADMIN_KEYPAIR_PATH` (fee payer) and launch `apps/facilitator`.
3. Point the Paywall Trigger’s `Facilitator URL` to that server (default `http://127.0.0.1:4000`).

### Configuration Checklist

- Crossmint Checkout (client):
  - Supply the protected resource URL.
  - Provide the Crossmint smart wallet address (must belong to your project and be funded with Solana USDC).

- Crossmint Checkout Trigger (server):
  - Facilitator URL is fixed to `https://facilitator.corbits.dev`.
  - Configure `tokens` with `solana:usdc`, pay-to Solana address, and desired USDC amount (decimal → auto-converted to atomic units).

With these changes, every paywall transaction flows exactly like the provided `crossmint-payment.ts` demo: Solana smart wallet ↔️ Faremeter facilitator ↔️ resource URL.

