import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  setLogLevel,
} from 'firebase/firestore';

setLogLevel('error');

const PROJECT_ID = 'gasto-polo-security-audit';
const RULES = fs.readFileSync('firestore.rules', 'utf8');

function sha256Hex(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

const VALID_REDE_CONFIG = {
  limiteAprovacao: 500,
  alerta1Pct: 80,
  alerta2Pct: 100,
  maxDiversasPct: 5,
  rotuloTamanho: 'Alunos ativos',
};

function makeRedePayload(criadoPor: string, overrides: Record<string, unknown> = {}) {
  return {
    nome: 'Rede Teste',
    criadoPor,
    criadoEm: '2026-11-25T10:00:00.000Z',
    atualizadoEm: '2026-11-25T10:00:00.000Z',
    config: VALID_REDE_CONFIG,
    ...overrides,
  };
}

function makeLancamentoPayload(overrides: Record<string, unknown> = {}) {
  return {
    redeId: 'rede-a',
    data: '2026-11-25',
    competencia: '2026-11',
    poloId: 'polo-a1',
    tipo: 'interno',
    categoriaId: 'cat-1',
    itemId: 'item-1',
    descricao: 'Resma A4',
    fornecedorId: 'forn-1',
    quantidade: 2,
    unidade: 'cx',
    valorUnitario: 100,
    valorTotal: 200,
    formaPagamento: 'PIX',
    responsavelUid: 'uid-op-a1',
    emergencial: false,
    justificativa: '',
    campanhaId: '',
    rateio: {
      ativo: false,
      criterio: 'igual',
      partes: [],
    },
    status: 'pendente',
    comprovanteUrl: '',
    criadoPor: 'uid-op-a1',
    criadoEm: '2026-11-25T10:00:00.000Z',
    atualizadoEm: '2026-11-25T10:00:00.000Z',
    excluido: false,
    ...overrides,
  };
}

let testEnv: RulesTestEnvironment;

test('Firestore Security Rules — Real Emulator Suite (Phase 5 Audit Remediation)', async (t) => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  t.after(async () => {
    await testEnv.cleanup();
  });

  await t.test('1. Autenticação e Verificação de E-mail: bloqueia não autenticado e não verificado', async () => {
    await testEnv.clearFirestore();

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const unverifiedDb = testEnv
      .authenticatedContext('uid-unverified', {
        email: 'unverified@rede.com.br',
        email_verified: false,
      })
      .firestore();
    const verifiedDb = testEnv
      .authenticatedContext('uid-verified', {
        email: 'verified@rede.com.br',
        email_verified: true,
      })
      .firestore();

    // Unauthenticated cannot read or write
    await assertFails(getDoc(doc(unauthDb, 'redes/rede-auth')));
    await assertFails(setDoc(doc(unauthDb, 'redes/rede-auth'), makeRedePayload('uid-unverified')));

    // Authenticated with email_verified == false cannot create a network
    await assertFails(
      setDoc(doc(unverifiedDb, 'redes/rede-auth'), makeRedePayload('uid-unverified'))
    );

    // Authenticated with email_verified == true and criadoPor == uid succeeds
    await assertSucceeds(
      setDoc(doc(verifiedDb, 'redes/rede-auth'), makeRedePayload('uid-verified'))
    );
  });

  await t.test(
    '2. Primeiro Administrador & Remoção do Bypass por E-mail Fixo (isBootstrappedAdmin removido)',
    async () => {
      await testEnv.clearFirestore();

      const creatorUid = 'uid-creator-a';
      const creatorDb = testEnv
        .authenticatedContext(creatorUid, {
          email: 'criador@redea.com.br',
          email_verified: true,
        })
        .firestore();

      // Former hardcoded email user attempting unauthorized access to someone else's network
      const formerHardcodedUid = 'uid-former-hardcoded';
      const formerHardcodedDb = testEnv
        .authenticatedContext(formerHardcodedUid, {
          email: 'bottaraujoalisson@gmail.com',
          email_verified: true,
        })
        .firestore();

      // Step 1: Creator creates Rede A
      await assertSucceeds(
        setDoc(doc(creatorDb, 'redes/rede-a'), makeRedePayload(creatorUid, { nome: 'Rede Alpha' }))
      );

      // Step 2: Former hardcoded email user CANNOT read Rede A or bootstrap themselves as admin of Rede A
      await assertFails(getDoc(doc(formerHardcodedDb, 'redes/rede-a')));
      await assertFails(
        setDoc(doc(formerHardcodedDb, `redes/rede-a/usuarios/${formerHardcodedUid}`), {
          uid: formerHardcodedUid,
          redeId: 'rede-a',
          nome: 'Intruder Hardcoded Email',
          email: 'bottaraujoalisson@gmail.com',
          perfil: 'admin',
          poloIds: [],
          ativo: true,
          criadoEm: '2026-11-25T10:00:00.000Z',
          atualizadoEm: '2026-11-25T10:00:00.000Z',
        })
      );

      // Step 3: Legitimate creator bootstraps themselves as First Admin of Rede A
      await assertSucceeds(
        setDoc(doc(creatorDb, `redes/rede-a/usuarios/${creatorUid}`), {
          uid: creatorUid,
          redeId: 'rede-a',
          nome: 'Criador Rede Alpha',
          email: 'criador@redea.com.br',
          perfil: 'admin',
          poloIds: ['polo-a1'],
          ativo: true,
          criadoEm: '2026-11-25T10:00:00.000Z',
          atualizadoEm: '2026-11-25T10:00:00.000Z',
        })
      );

      // Step 4: Legitimate creator registers their userRedes mapping
      await assertSucceeds(
        setDoc(doc(creatorDb, `userRedes/${creatorUid}`), {
          uid: creatorUid,
          redeId: 'rede-a',
          email: 'criador@redea.com.br',
          perfil: 'admin',
          atualizadoEm: '2026-11-25T10:00:00.000Z',
        })
      );

      // Step 5: Former hardcoded email still CANNOT read or modify Rede A even after bootstrap
      await assertFails(getDoc(doc(formerHardcodedDb, 'redes/rede-a')));
      await assertFails(
        updateDoc(doc(formerHardcodedDb, 'redes/rede-a'), {
          nome: 'Rede Hackeada',
          atualizadoEm: '2026-11-25T11:00:00.000Z',
        })
      );
    }
  );

  await t.test('3. Isolamento Multi-Tenant entre Redes (Rede A vs Rede B)', async () => {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'redes/rede-a'), makeRedePayload('uid-admin-a', { nome: 'Rede A' }));
      await setDoc(doc(adminDb, 'redes/rede-a/usuarios/uid-admin-a'), {
        uid: 'uid-admin-a',
        redeId: 'rede-a',
        nome: 'Admin A',
        email: 'admin@redea.com.br',
        perfil: 'admin',
        poloIds: ['polo-a1'],
        ativo: true,
        criadoEm: '2026-11-25T10:00:00.000Z',
        atualizadoEm: '2026-11-25T10:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'redes/rede-b'), makeRedePayload('uid-admin-b', { nome: 'Rede B' }));
      await setDoc(doc(adminDb, 'redes/rede-b/usuarios/uid-admin-b'), {
        uid: 'uid-admin-b',
        redeId: 'rede-b',
        nome: 'Admin B',
        email: 'admin@redeb.com.br',
        perfil: 'admin',
        poloIds: ['polo-b1'],
        ativo: true,
        criadoEm: '2026-11-25T10:00:00.000Z',
        atualizadoEm: '2026-11-25T10:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'redes/rede-b/polos/polo-b1'), {
        redeId: 'rede-b',
        nome: 'Polo B1',
        cidade: 'Curitiba',
        ativo: true,
        indicadorTamanho: 300,
        criadoEm: '2026-11-25T10:00:00.000Z',
        atualizadoEm: '2026-11-25T10:00:00.000Z',
      });
    });

    const adminADb = testEnv
      .authenticatedContext('uid-admin-a', {
        email: 'admin@redea.com.br',
        email_verified: true,
      })
      .firestore();

    // Admin of Rede A can read Rede A
    await assertSucceeds(getDoc(doc(adminADb, 'redes/rede-a')));

    // Admin of Rede A CANNOT read or write Rede B or any subcollection of Rede B
    await assertFails(getDoc(doc(adminADb, 'redes/rede-b')));
    await assertFails(getDoc(doc(adminADb, 'redes/rede-b/polos/polo-b1')));
    await assertFails(
      setDoc(doc(adminADb, 'redes/rede-b/usuarios/uid-admin-a'), {
        uid: 'uid-admin-a',
        redeId: 'rede-b',
        nome: 'Admin A Invasor',
        email: 'admin@redea.com.br',
        perfil: 'admin',
        poloIds: ['polo-b1'],
        ativo: true,
        criadoEm: '2026-11-25T10:00:00.000Z',
        atualizadoEm: '2026-11-25T10:00:00.000Z',
      })
    );
    // Admin A cannot forge userRedes pointing to Rede B
    await assertFails(
      setDoc(doc(adminADb, 'userRedes/uid-admin-a'), {
        uid: 'uid-admin-a',
        redeId: 'rede-b',
        email: 'admin@redea.com.br',
        perfil: 'admin',
        atualizadoEm: '2026-11-25T10:00:00.000Z',
      })
    );
  });

  await t.test(
    '4. Perfis RBAC (Admin, Gestor, Operador, Leitor, Inativo) e Isolamento por Polo',
    async () => {
      await testEnv.clearFirestore();

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'redes/rede-a'), makeRedePayload('uid-admin-a', { nome: 'Rede A' }));

        const users = [
          {
            uid: 'uid-admin-a',
            nome: 'Admin Rede A',
            email: 'admin@redea.com.br',
            perfil: 'admin',
            poloIds: ['polo-a1', 'polo-a2'],
            ativo: true,
          },
          {
            uid: 'uid-gestor-a1',
            nome: 'Gestor Polo A1',
            email: 'gestor@redea.com.br',
            perfil: 'gestor',
            poloIds: ['polo-a1'],
            ativo: true,
          },
          {
            uid: 'uid-op-a1',
            nome: 'Operador Polo A1',
            email: 'op@redea.com.br',
            perfil: 'operador',
            poloIds: ['polo-a1'],
            ativo: true,
          },
          {
            uid: 'uid-leitor-a1',
            nome: 'Leitor Polo A1',
            email: 'leitor@redea.com.br',
            perfil: 'leitor',
            poloIds: ['polo-a1'],
            ativo: true,
          },
          {
            uid: 'uid-inativo-a1',
            nome: 'Inativo Polo A1',
            email: 'inativo@redea.com.br',
            perfil: 'admin',
            poloIds: ['polo-a1', 'polo-a2'],
            ativo: false,
          },
        ];

        for (const u of users) {
          await setDoc(doc(db, `redes/rede-a/usuarios/${u.uid}`), {
            ...u,
            redeId: 'rede-a',
            criadoEm: '2026-11-25T10:00:00.000Z',
            atualizadoEm: '2026-11-25T10:00:00.000Z',
          });
        }

        // Seed two launches: one in polo-a1, one in polo-a2
        await setDoc(
          doc(db, 'redes/rede-a/lancamentos/lanc-a1'),
          makeLancamentoPayload({
            poloId: 'polo-a1',
            criadoPor: 'uid-op-a1',
            status: 'pendente',
          })
        );
        await setDoc(
          doc(db, 'redes/rede-a/lancamentos/lanc-a2'),
          makeLancamentoPayload({
            poloId: 'polo-a2',
            criadoPor: 'uid-admin-a',
            status: 'pendente',
          })
        );
      });

      const gestorDb = testEnv
        .authenticatedContext('uid-gestor-a1', {
          email: 'gestor@redea.com.br',
          email_verified: true,
        })
        .firestore();
      const opDb = testEnv
        .authenticatedContext('uid-op-a1', {
          email: 'op@redea.com.br',
          email_verified: true,
        })
        .firestore();
      const leitorDb = testEnv
        .authenticatedContext('uid-leitor-a1', {
          email: 'leitor@redea.com.br',
          email_verified: true,
        })
        .firestore();
      const inativoDb = testEnv
        .authenticatedContext('uid-inativo-a1', {
          email: 'inativo@redea.com.br',
          email_verified: true,
        })
        .firestore();

      // A. Inactive user (even with perfil == 'admin') has ZERO access immediately
      await assertFails(getDoc(doc(inativoDb, 'redes/rede-a')));
      await assertFails(getDoc(doc(inativoDb, 'redes/rede-a/lancamentos/lanc-a1')));

      // B. Leitor can read authorized polo-a1 launch, CANNOT read polo-a2 launch, and CANNOT write or audit
      await assertSucceeds(getDoc(doc(leitorDb, 'redes/rede-a/lancamentos/lanc-a1')));
      await assertFails(getDoc(doc(leitorDb, 'redes/rede-a/lancamentos/lanc-a2')));
      await assertFails(
        setDoc(
          doc(leitorDb, 'redes/rede-a/lancamentos/lanc-leitor'),
          makeLancamentoPayload({ criadoPor: 'uid-leitor-a1' })
        )
      );
      await assertFails(
        updateDoc(doc(leitorDb, 'redes/rede-a/lancamentos/lanc-a1'), {
          descricao: 'Tentativa de edição por leitor',
        })
      );
      await assertFails(
        setDoc(doc(leitorDb, 'redes/rede-a/auditoria/aud-leitor'), {
          redeId: 'rede-a',
          entidade: 'lancamento',
          entidadeId: 'lanc-a1',
          acao: 'criar',
          uid: 'uid-leitor-a1',
          resumo: 'Tentativa leitor',
          antes: '',
          depois: '',
          em: '2026-11-25T10:00:00.000Z',
        })
      );

      // C. Operador can create pending launch in polo-a1, CANNOT create in polo-a2, CANNOT self-approve
      await assertSucceeds(
        setDoc(
          doc(opDb, 'redes/rede-a/lancamentos/lanc-op-new'),
          makeLancamentoPayload({
            poloId: 'polo-a1',
            criadoPor: 'uid-op-a1',
            status: 'pendente',
          })
        )
      );
      await assertFails(
        setDoc(
          doc(opDb, 'redes/rede-a/lancamentos/lanc-op-polo2'),
          makeLancamentoPayload({
            poloId: 'polo-a2',
            criadoPor: 'uid-op-a1',
            status: 'pendente',
          })
        )
      );
      // Operador cannot approve their own pending launch
      await assertFails(
        updateDoc(doc(opDb, 'redes/rede-a/lancamentos/lanc-op-new'), {
          status: 'aprovado',
        })
      );
      // Operador can edit description of their own pending launch while keeping status == 'pendente'
      await assertSucceeds(
        updateDoc(doc(opDb, 'redes/rede-a/lancamentos/lanc-op-new'), {
          descricao: 'Resma A4 Reciclada',
        })
      );
      // Operador CANNOT soft-delete (excluido: true) their own launch (Section 7 requirement)
      await assertFails(
        updateDoc(doc(opDb, 'redes/rede-a/lancamentos/lanc-op-new'), {
          excluido: true,
        })
      );
      // Operador cannot escalate their own role to admin in usuarios or userRedes
      await assertFails(
        updateDoc(doc(opDb, 'redes/rede-a/usuarios/uid-op-a1'), {
          perfil: 'admin',
        })
      );
      await assertFails(
        setDoc(doc(opDb, 'userRedes/uid-op-a1'), {
          uid: 'uid-op-a1',
          redeId: 'rede-a',
          email: 'op@redea.com.br',
          perfil: 'admin',
          atualizadoEm: '2026-11-25T10:00:00.000Z',
        })
      );

      // D. Gestor of polo-a1 can approve or soft-delete launch in polo-a1, CANNOT read or modify launch in polo-a2
      await assertSucceeds(
        updateDoc(doc(gestorDb, 'redes/rede-a/lancamentos/lanc-op-new'), {
          status: 'aprovado',
        })
      );
      await assertFails(getDoc(doc(gestorDb, 'redes/rede-a/lancamentos/lanc-a2')));
      await assertFails(
        updateDoc(doc(gestorDb, 'redes/rede-a/lancamentos/lanc-a2'), {
          status: 'aprovado',
        })
      );
      // Gestor CANNOT create or edit a Polo document (reserved for Administrador)
      await assertFails(
        setDoc(doc(gestorDb, 'redes/rede-a/polos/polo-novo'), {
          redeId: 'rede-a',
          nome: 'Polo Tentativa Gestor',
          cidade: 'Campinas',
          ativo: true,
          indicadorTamanho: 100,
          criadoEm: '2026-11-25T10:00:00.000Z',
          atualizadoEm: '2026-11-25T10:00:00.000Z',
        })
      );
      // Gestor CAN soft-delete a launch in their authorized polo-a1
      await assertSucceeds(
        updateDoc(doc(gestorDb, 'redes/rede-a/lancamentos/lanc-a1'), {
          excluido: true,
        })
      );
      // Once lanc-op-new is approved, Operador can no longer edit it
      await assertFails(
        updateDoc(doc(opDb, 'redes/rede-a/lancamentos/lanc-op-new'), {
          descricao: 'Tentativa após aprovado',
        })
      );
    }
  );

  await t.test(
    '5. Fluxo Real de Convites: token SHA-256, expiração, correspondência de e-mail e uso único',
    async () => {
      await testEnv.clearFirestore();

      const nowMillis = Date.now();
      const rawTokenValid = 'tok_valid_single_use_998877665544';
      const tokenHashValid = sha256Hex(rawTokenValid);

      const rawTokenExpired = 'tok_expired_112233445566';
      const tokenHashExpired = sha256Hex(rawTokenExpired);

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'redes/rede-a'), makeRedePayload('uid-admin-a', { nome: 'Rede A' }));
        await setDoc(doc(db, 'redes/rede-a/usuarios/uid-admin-a'), {
          uid: 'uid-admin-a',
          redeId: 'rede-a',
          nome: 'Admin A',
          email: 'admin@redea.com.br',
          perfil: 'admin',
          poloIds: ['polo-a1', 'polo-a2'],
          ativo: true,
          criadoEm: '2026-11-25T10:00:00.000Z',
          atualizadoEm: '2026-11-25T10:00:00.000Z',
        });

        // Expired invite
        await setDoc(doc(db, 'convites/cnv-expired'), {
          redeId: 'rede-a',
          redeNome: 'Rede A',
          nome: 'Convidado Expirado',
          email: 'expirado@redea.com.br',
          perfil: 'operador',
          poloIds: ['polo-a1'],
          status: 'pendente',
          tokenHash: tokenHashExpired,
          aceitoTokenHash: '',
          expiraEm: '2026-11-08T10:00:00.000Z',
          expiraEmMillis: nowMillis - 86_400_000, // expired 24h ago
          criadoPor: 'uid-admin-a',
          criadoEm: '2026-11-01T10:00:00.000Z',
          atualizadoEm: '2026-11-01T10:00:00.000Z',
          aceitoPorUid: '',
          aceitoEm: '',
        });
      });

      const adminDb = testEnv
        .authenticatedContext('uid-admin-a', {
          email: 'admin@redea.com.br',
          email_verified: true,
        })
        .firestore();

      const invitedDb = testEnv
        .authenticatedContext('uid-guest-1', {
          email: 'convidado@redea.com.br',
          email_verified: true,
        })
        .firestore();

      const wrongEmailDb = testEnv
        .authenticatedContext('uid-wrong-email', {
          email: 'outro@redea.com.br',
          email_verified: true,
        })
        .firestore();

      const expiredGuestDb = testEnv
        .authenticatedContext('uid-expired-guest', {
          email: 'expirado@redea.com.br',
          email_verified: true,
        })
        .firestore();

      // A. Admin creates a valid pending invite
      await assertSucceeds(
        setDoc(doc(adminDb, 'convites/cnv-valid-1'), {
          redeId: 'rede-a',
          redeNome: 'Rede A',
          nome: 'Juliana Convidada',
          email: 'convidado@redea.com.br',
          perfil: 'operador',
          poloIds: ['polo-a1'],
          status: 'pendente',
          tokenHash: tokenHashValid,
          aceitoTokenHash: '',
          expiraEm: '2026-12-02T10:00:00.000Z',
          expiraEmMillis: nowMillis + 7 * 86_400_000,
          criadoPor: 'uid-admin-a',
          criadoEm: '2026-11-25T10:00:00.000Z',
          atualizadoEm: '2026-11-25T10:00:00.000Z',
          aceitoPorUid: '',
          aceitoEm: '',
        })
      );

      // B. Before accepting the invite, the invited user CANNOT read Rede A
      await assertFails(getDoc(doc(invitedDb, 'redes/rede-a')));

      // C. User with a DIFFERENT email CANNOT accept the invite even with the valid token hash
      {
        const batch = writeBatch(wrongEmailDb);
        batch.update(doc(wrongEmailDb, 'convites/cnv-valid-1'), {
          status: 'aceito',
          aceitoPorUid: 'uid-wrong-email',
          aceitoEm: '2026-11-25T12:00:00.000Z',
          aceitoTokenHash: tokenHashValid,
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        batch.set(doc(wrongEmailDb, 'redes/rede-a/usuarios/uid-wrong-email'), {
          uid: 'uid-wrong-email',
          redeId: 'rede-a',
          nome: 'Intruso',
          email: 'outro@redea.com.br',
          perfil: 'operador',
          poloIds: ['polo-a1'],
          ativo: true,
          conviteId: 'cnv-valid-1',
          criadoEm: '2026-11-25T12:00:00.000Z',
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        await assertFails(batch.commit());
      }

      // D. Invited user CANNOT accept with a wrong tokenHash
      {
        const batch = writeBatch(invitedDb);
        batch.update(doc(invitedDb, 'convites/cnv-valid-1'), {
          status: 'aceito',
          aceitoPorUid: 'uid-guest-1',
          aceitoEm: '2026-11-25T12:00:00.000Z',
          aceitoTokenHash: sha256Hex('wrong_secret_token'),
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        batch.set(doc(invitedDb, 'redes/rede-a/usuarios/uid-guest-1'), {
          uid: 'uid-guest-1',
          redeId: 'rede-a',
          nome: 'Juliana Convidada',
          email: 'convidado@redea.com.br',
          perfil: 'operador',
          poloIds: ['polo-a1'],
          ativo: true,
          conviteId: 'cnv-valid-1',
          criadoEm: '2026-11-25T12:00:00.000Z',
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        await assertFails(batch.commit());
      }

      // E. Invited user CANNOT escalate perfil (e.g. 'operador' -> 'admin') or add unauthorized polos during acceptance
      {
        const batch = writeBatch(invitedDb);
        batch.update(doc(invitedDb, 'convites/cnv-valid-1'), {
          status: 'aceito',
          aceitoPorUid: 'uid-guest-1',
          aceitoEm: '2026-11-25T12:00:00.000Z',
          aceitoTokenHash: tokenHashValid,
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        batch.set(doc(invitedDb, 'redes/rede-a/usuarios/uid-guest-1'), {
          uid: 'uid-guest-1',
          redeId: 'rede-a',
          nome: 'Juliana Convidada',
          email: 'convidado@redea.com.br',
          perfil: 'admin', // escalation attempt!
          poloIds: ['polo-a1', 'polo-a2'],
          ativo: true,
          conviteId: 'cnv-valid-1',
          criadoEm: '2026-11-25T12:00:00.000Z',
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        await assertFails(batch.commit());
      }

      // F. Expired invite CANNOT be accepted even with matching email and valid tokenHash
      {
        const batch = writeBatch(expiredGuestDb);
        batch.update(doc(expiredGuestDb, 'convites/cnv-expired'), {
          status: 'aceito',
          aceitoPorUid: 'uid-expired-guest',
          aceitoEm: '2026-11-25T12:00:00.000Z',
          aceitoTokenHash: tokenHashExpired,
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        batch.set(doc(expiredGuestDb, 'redes/rede-a/usuarios/uid-expired-guest'), {
          uid: 'uid-expired-guest',
          redeId: 'rede-a',
          nome: 'Convidado Expirado',
          email: 'expirado@redea.com.br',
          perfil: 'operador',
          poloIds: ['polo-a1'],
          ativo: true,
          conviteId: 'cnv-expired',
          criadoEm: '2026-11-25T12:00:00.000Z',
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        await assertFails(batch.commit());
      }

      // G. Legitimate atomic acceptance with matching email, valid SHA-256 tokenHash, and exact perfil + poloIds SUCCEEDS
      {
        const batch = writeBatch(invitedDb);
        batch.update(doc(invitedDb, 'convites/cnv-valid-1'), {
          status: 'aceito',
          aceitoPorUid: 'uid-guest-1',
          aceitoEm: '2026-11-25T12:00:00.000Z',
          aceitoTokenHash: tokenHashValid,
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        batch.set(doc(invitedDb, 'redes/rede-a/usuarios/uid-guest-1'), {
          uid: 'uid-guest-1',
          redeId: 'rede-a',
          nome: 'Juliana Convidada',
          email: 'convidado@redea.com.br',
          perfil: 'operador',
          poloIds: ['polo-a1'],
          ativo: true,
          conviteId: 'cnv-valid-1',
          criadoEm: '2026-11-25T12:00:00.000Z',
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        batch.set(doc(invitedDb, 'userRedes/uid-guest-1'), {
          uid: 'uid-guest-1',
          redeId: 'rede-a',
          email: 'convidado@redea.com.br',
          perfil: 'operador',
          atualizadoEm: '2026-11-25T12:00:00.000Z',
        });
        await assertSucceeds(batch.commit());
      }

      // H. After acceptance, invited user can read Rede A, and the invite CANNOT be reused
      await assertSucceeds(getDoc(doc(invitedDb, 'redes/rede-a')));
      await assertFails(
        updateDoc(doc(invitedDb, 'convites/cnv-valid-1'), {
          status: 'aceito',
          aceitoPorUid: 'uid-guest-1',
          aceitoEm: '2026-11-26T12:00:00.000Z',
          aceitoTokenHash: tokenHashValid,
          atualizadoEm: '2026-11-26T12:00:00.000Z',
        })
      );
    }
  );

  await t.test('6. Integridade da Trilha de Auditoria (Imutável após criação)', async () => {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'redes/rede-a'), makeRedePayload('uid-admin-a', { nome: 'Rede A' }));
      await setDoc(doc(db, 'redes/rede-a/usuarios/uid-admin-a'), {
        uid: 'uid-admin-a',
        redeId: 'rede-a',
        nome: 'Admin A',
        email: 'admin@redea.com.br',
        perfil: 'admin',
        poloIds: ['polo-a1'],
        ativo: true,
        criadoEm: '2026-11-25T10:00:00.000Z',
        atualizadoEm: '2026-11-25T10:00:00.000Z',
      });
    });

    const adminDb = testEnv
      .authenticatedContext('uid-admin-a', {
        email: 'admin@redea.com.br',
        email_verified: true,
      })
      .firestore();

    // Admin can create an audit entry with their own UID
    await assertSucceeds(
      setDoc(doc(adminDb, 'redes/rede-a/auditoria/aud-1'), {
        redeId: 'rede-a',
        entidade: 'lancamento',
        entidadeId: 'lanc-1',
        acao: 'criar',
        uid: 'uid-admin-a',
        resumo: 'Criou lançamento Resma A4',
        antes: '',
        depois: '{"valorTotal":200}',
        em: '2026-11-25T10:00:00.000Z',
      })
    );

    // Nobody (not even Admin) can forge an audit entry with someone else's UID
    await assertFails(
      setDoc(doc(adminDb, 'redes/rede-a/auditoria/aud-forged'), {
        redeId: 'rede-a',
        entidade: 'lancamento',
        entidadeId: 'lanc-1',
        acao: 'criar',
        uid: 'uid-other-person',
        resumo: 'Falsificação de UID',
        antes: '',
        depois: '{}',
        em: '2026-11-25T10:00:00.000Z',
      })
    );

    // Nobody (not even Admin) can update or delete an existing audit log
    await assertFails(
      updateDoc(doc(adminDb, 'redes/rede-a/auditoria/aud-1'), {
        depois: '{"valorTotal":0}',
      })
    );
    await assertFails(deleteDoc(doc(adminDb, 'redes/rede-a/auditoria/aud-1')));
  });
});
