# KCP Phase 111 — PO/GRV Mobile Receiving

This package contains matching `KCP-Live` and `KCP-Mobile` projects.

## Deploy the Worker first

```bash
cd KCP-Live/cloudflare-v2
npm install
npm run typecheck
npm run deploy
```

After deployment, `/health` must report:

```text
phase111-mobile-po-grv-receiving-sync
```

## Start the mobile app

```bash
cd KCP-Mobile
npm install
npm run dev
```

For native projects, rebuild and sync after the Worker is deployed:

```bash
npm run cap:sync
```

## Receiving flow

1. Open Purchase Orders and select an active PO.
2. Choose **Process PO into GRV**, or open Goods Receiving and select the PO.
3. Enter the quantity received for each line.
4. Review exact, short and over-delivery comparisons.
5. Attach the required delivery photo.
6. Confirm and post the GRV.

The photo is stored on the GRV as evidence. The PO and GRV lists refresh from KCP when the screen opens, every 30 seconds while visible, and when the app regains focus.
