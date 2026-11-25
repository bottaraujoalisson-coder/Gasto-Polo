# GastoPolo — Security Specification (Phase 0 TDD & Audit Remediation)

## 1. Data Invariants & Multi-Tenant Architecture
- **No Hardcoded Email Admin Bypass**: There is zero privilege granted by specific email addresses or domains. All administrative authority derives strictly from an active membership document `/redes/{redeId}/usuarios/{request.auth.uid}` with `ativo == true` and `perfil == 'admin'` inside that specific `redeId`.
- **Controlled First Administrator**: A user can create their own initial `admin` membership document `/redes/{redeId}/usuarios/{uid}` ONLY when `uid == request.auth.uid`, no member document exists yet for their UID in that `redeId`, and the parent `/redes/{redeId}` document has `criadoPor == request.auth.uid` (either pre-existing or created atomically in the same batch).
- **Strict Cross-Tenant Isolation**: An administrator or member of `rede-a` has zero read or write access to `rede-b` or any of its subcollections.
- **Real User Invitations (`/convites/{conviteId}`)**:
  - Only an active `admin` of `redeId` can create an invite for `redeId`.
  - Only the SHA-256 `tokenHash` (64 hex chars) of the single-use invite token is stored.
  - Only a verified user whose `request.auth.token.email == existing().email` can accept a `pendente` invite before `existing().expiraEmMillis > request.time.toMillis()`, providing `aceitoTokenHash == existing().tokenHash`.
  - When accepting an invite, the user atomically creates `/redes/{redeId}/usuarios/{request.auth.uid}` with `conviteId`, where `perfil` and `poloIds` MUST match the invite's pre-assigned `perfil` and `poloIds`. Because `get(convite).data.status == 'pendente'` and `getAfter(convite).data.status == 'aceito'`, an invite can never be reused.
- **Strict Role & Polo Isolation**:
  - `admin`: Full access within their linked `redeId` only.
  - `gestor`: Reads/writes only within their authorized `poloIds`, approves pending launches, manages budgets/campaigns/action plans for their polos. Cannot manage network settings, categories, or users.
  - `operador`: Creates launches in their authorized `poloIds` and edits only their own launches while `status == 'pendente'`. Cannot self-approve or edit launches in unauthorized polos.
  - `leitor`: Read-only access to their authorized `poloIds`. Cannot create, update, or delete any document in any collection (including `auditoria`).
  - Inactive users (`ativo == false`): Immediately lose all read and write access across the network.

## 2. The Dirty Dozen Payloads (All Must Return `PERMISSION_DENIED`)
1. Unauthenticated read/write to `/redes/{redeId}` or `/convites/{conviteId}`.
2. Authenticated but unverified (`email_verified: false`) user attempting to create a network, launch, or accept an invite.
3. Email-based privilege escalation attempt: user with any email (including former hardcoded admin email) attempting to read or modify a network they do not belong to.
4. User of `rede-a` attempting to read or modify `/redes/rede-b/lancamentos/{id}`.
5. User attempting to bootstrap themselves as `admin` on an existing `rede-a` where `criadoPor != request.auth.uid`.
6. User attempting to forge `/userRedes/{uid}` pointing to a `redeId` where they have no active `/redes/{redeId}/usuarios/{uid}` document or claiming a higher `perfil`.
7. User attempting to escalate their own `perfil` from `operador` to `admin` in `/redes/{redeId}/usuarios/{uid}`.
8. `operador` restricted to `polo-a` attempting to read or create a launch in `polo-b`.
9. `leitor` attempting to create, update, or delete a launch, supplier, or audit entry.
10. User `B` (`other@rede.com`) attempting to accept an invite addressed to `invited@rede.com`.
11. Invited user attempting to accept an expired invite (`expiraEmMillis <= request.time.toMillis()`) or reuse an already accepted invite (`status == 'aceito'`).
12. Invited user attempting to change their assigned `perfil` from `operador` to `admin` during invite acceptance.
