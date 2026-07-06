# Legal Change Monitoring Phase 1 Audit

Date: 2026-07-05

## Existing Models Found

- `OfficialSource`: official source registry. Reuse for Diputados/DOF/SJF/SCJN source identity.
- `Document`: canonical document record. Reuse for monitored laws and codes.
- `DocumentVersion`: version record. Reuse for lightweight detected versions.
- `DocumentChange`: existing change record. Reuse as the change event model.
- `DocumentMetadata`: optional metadata extension point.
- `Watchlist`: existing user/org alert rule. Reuse and present visually as "Alertas".
- `Notification`: existing in-app notification model. Reuse for detected change alert rows.
- `AlertRule`: existing advanced alert rule model. Keep available for future alert expansion.
- `IngestRun`: existing batch execution log. Reuse for monitor run summaries if needed.
- `ProcessingJob`: existing async job record. Do not use in Phase 1 manual monitor.

## Existing Fields To Reuse

- `Document.title`
- `Document.source`
- `Document.jurisdiction`
- `Document.documentType`
- `Document.canonicalKey`
- `Document.canonicalUrl`
- `Document.latestVersionHash`
- `DocumentVersion.contentHash`
- `DocumentVersion.rawRef`
- `DocumentVersion.rawText`
- `DocumentVersion.originalText`
- `DocumentVersion.diffSummary`
- `DocumentVersion.versionNumber`
- `DocumentChange.changeType`
- `DocumentChange.changeDescription`
- `DocumentChange.before`
- `DocumentChange.after`
- `Notification.status`
- `Notification.payload`
- `Notification.documentVersionId`
- `Watchlist.type`
- `Watchlist.value`
- `Watchlist.active`

## New Fields Needed

### `Document`

- `shortCode`
- `matter`
- `officialSourceId`
- `officialUrl`
- `officialSourceUrl`
- `currentHash`
- `etag`
- `lastModified`
- `fileSize`
- `lastCheckedAt`
- `lastError`
- `monitoringStatus`
- `changeSummary`

Do not overload `Document.status`; it already exists and may be used for lifecycle/indexing.

### `DocumentVersion`

- `etag`
- `lastModified`
- `fileSize`
- `sourceUrl`
- `metadata`

### `DocumentChange`

- `sourceUrl`
- `detectedAt`
- `previousHash`
- `newHash`
- `priority`
- `reviewStatus`
- `matter`
- `jurisdiction`

## Existing Routes To Reuse

- `/watchlists`: reuse as the lawyer-facing "Alertas" experience.
- `/api/watchlist`: reuse existing watchlist CRUD and extend only if needed.
- `/api/legal/weekly-changes`: adapt later to read `DocumentChange` first.
- `/api/ai/chat-bubble`: adapt later so recent-change questions query `DocumentChange`/`Notification`/`DocumentVersion` first.
- Existing navigation links to `/watchlists`: keep URL if possible, but label as "Alertas".

## Risks Detected

- `Document.status` must not be repurposed for monitoring. Use `monitoringStatus`.
- `fileSize` as Prisma `BigInt` must be serialized in JSON with `fileSize?.toString() ?? null`.
- `DocumentVersion.rawText` and `DocumentVersion.originalText` must remain `null` in the monitor.
- `DocumentChange.before` and `DocumentChange.after` must remain `null` in the monitor.
- `--dry-run` must not create, update, upsert, delete, or touch database rows.
- Official URLs must be validated before seeding, especially Ley de Comercio Exterior (`LCE.pdf`).
- UI must not expose Redis, BullMQ, worker, embeddings, JSON, stack traces, provider names, Gemini, or fallback language.
- The monitor must never run inside the Web Service request path.
