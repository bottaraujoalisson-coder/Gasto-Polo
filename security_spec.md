# GastoPolo — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Multi-Tenant Master Gate**: No document inside `/redes/{redeId}/...` can be read or written unless the user has an active (`ativo == true`) membership record at `/redes/{redeId}/usuarios/$(request.auth.uid)` (or is the creator/bootstrapped admin creating the initial `Rede` and their own `Admin` membership record).
2. **Immediate Revocation**: If a user's `ativo` flag in `/redes/{redeId}/usuarios/{uid}` is set to `false`, all read and write access to the `Rede` and its subcollections is synchronously revoked.
3. **Polo-Level RBAC Isolation**:
   - `admin`: Full access across all polos, categories, users, budgets, and settings in their `redeId`.
   - `gestor`: Can only read/write launches, budgets, campaigns, and action plans where `poloId in usuario.poloIds`, and can approve/reject pending launches in their assigned polos.
   - `operador`: Can only read data for `poloId in usuario.poloIds`, create launches in their assigned `poloIds`, and update their own launches (`criadoPor == request.auth.uid`) only while `status == 'pendente'`.
   - `leitor`: Read-only access limited to their assigned `poloIds`.
4. **Strict Schema & Update-Gap Protection**: Every `create` and `update` validates `isValid[Entity](incoming())`, enforces strict key sets (`hasAll` + `hasOnly`), bounded string lengths (`.size() <= MAX`), bounded arrays (`poloIds.size() <= 50`), and immutable fields (`redeId`, `criadoPor`, `criadoEm`).

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Creating a `Rede` or `Lancamento` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Creating a `Lancamento` when `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read/Write**: User from `rede_A` attempting to read or create a `Lancamento` in `rede_B` -> `PERMISSION_DENIED`.
4. **Inactive User Access**: User with `ativo == false` attempting to read `/redes/{redeId}/lancamentos/{id}` -> `PERMISSION_DENIED`.
5. **Cross-Polo Read (Operador Polo A reading Polo B)**: Operador assigned only to `['polo_A']` attempting to read or list a `Lancamento` with `poloId == 'polo_B'` -> `PERMISSION_DENIED`.
6. **Self-Privilege Escalation**: Operador attempting to update their own `/redes/{redeId}/usuarios/{uid}` `perfil` from `'operador'` to `'admin'` -> `PERMISSION_DENIED`.
7. **Unauthorized Approval by Operador**: Operador attempting to update a pending `Lancamento` `status` to `'aprovado'` when `valorTotal > limiteAprovacao` or modifying another user's launch -> `PERMISSION_DENIED`.
8. **Terminal/Approved Launch Tampering by Operador**: Operador attempting to edit their own `Lancamento` after `status == 'aprovado'` -> `PERMISSION_DENIED`.
9. **Shadow Field Injection**: Injecting an undeclared field `isSuperAdmin: true` into a `Lancamento` or `UsuarioRede` document -> `PERMISSION_DENIED`.
10. **Denial-of-Wallet String Overflow**: Sending a 50KB `descricao` or 2KB `poloId` path variable -> `PERMISSION_DENIED`.
11. **Identity Spoofing on Creation**: Creating a `Lancamento` with `criadoPor` set to another user's UID -> `PERMISSION_DENIED`.
12. **Immutable Field Mutation**: Updating `criadoEm`, `criadoPor`, or `redeId` on an existing `Lancamento` -> `PERMISSION_DENIED`.
