# Security Specification — Axiom Calc & Collaborative Research Studio

## 1. Data Invariants
1. **User PII Isolation**: `/users/{userId}` documents (including email) are strictly readable and writable only by `request.auth.uid == userId` with verified email.
2. **Formula Ownership**: `/users/{userId}/formulas/{formulaId}` requires `ownerId == request.auth.uid`, path `userId == request.auth.uid`, valid ID format, server timestamps (`request.time`), and strict key/size limits.
3. **Workspace Master Gate**: `/workspaces/{workspaceId}/items/{itemId}` and `/workspaces/{workspaceId}/members/{memberId}` cannot exist without a valid parent `/workspaces/{workspaceId}` document, and item writes require the actor to be either the workspace `ownerId` or a verified member in `/workspaces/{workspaceId}/members/{request.auth.uid}`.
4. **Immutable Provenance**: `ownerId`, `authorId`, `workspaceId`, and `createdAt` cannot be modified after creation.
5. **No Shadow Fields or Oversized Payloads**: Every `create` validates exact `hasAll` + `hasOnly` keys; every `update` validates `affectedKeys().hasOnly(...)` + full `isValidEntity(incoming())`; every string enforces `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on User Profile**: `{ uid, displayName, createdAt, updatedAt, isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` blocks `isAdmin`).
2. **Identity Spoofing on Formula**: Creating `/users/alice/formulas/f1` as `bob` or setting `ownerId: "alice"` as `bob` -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: Creating formula when `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
4. **ID Poisoning**: Creating `/users/alice/formulas/<1500-char-junk>` -> `PERMISSION_DENIED` (`isValidId` fails).
5. **Timestamp Forgery**: Creating formula with client-supplied past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
6. **PII Leak Attempt**: User `bob` attempting `get` on `/users/alice` -> `PERMISSION_DENIED`.
7. **Blanket List Scraping**: Attempting `list` on `/users` or `/workspaces` without `ownerId`/`visibility` constraint -> `PERMISSION_DENIED`.
8. **Orphaned Workspace Item**: Creating `/workspaces/nonexistent/items/i1` -> `PERMISSION_DENIED` (`exists()` parent check fails).
9. **Unauthorized Workspace Item Write**: User `charlie` (non-member) creating an item in a `private` workspace -> `PERMISSION_DENIED`.
10. **Role Self-Elevation in Member Join**: User `bob` joining a shared workspace with `role: "owner"` -> `PERMISSION_DENIED` (`role == "researcher"` enforced for self-join).
11. **Value Poisoning on Update**: Updating `title` on a workspace item with a 5,000-character string or changing `authorId` -> `PERMISSION_DENIED`.
12. **Immutable Timestamp Tampering on Update**: Modifying `createdAt` during an `update` on a formula or item -> `PERMISSION_DENIED`.
