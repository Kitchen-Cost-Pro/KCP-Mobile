# Large Workspace and Long-List Performance

The client bounds initial low-stock DOM rendering to 100 records, exposes deterministic 100-item increments and applies browser rendering containment to operational cards. Search still evaluates the full server-returned list, so all items remain discoverable and selectable. Worker notification generation and dispatch use bounded batches; outbox dedupe prevents repeated scheduled runs from multiplying an event.

Release test dataset:

- 5,000 stocked items across at least 20 locations.
- 1,000 task instances and 1,000 approval requests across all buckets.
- 500 open transfers, 500 purchase orders and at least 10,000 notification tokens across test users.

Measure cold start, workspace bootstrap, filter response, scroll responsiveness, memory, task sync and notification-dispatch duration on minimum supported devices. Targets are no main-thread task over 200 ms during ordinary scrolling, search feedback within 250 ms, no app termination under the dataset, API p95 under the production SLO and stable outbox retry memory. Record the device, OS, build and results in the release ticket; unit tests do not replace this device test.
