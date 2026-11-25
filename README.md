# GastoPolo — SaaS de Controle e Otimização de Gastos por Polo

SaaS multi-tenant para gestão de despesas operacionais e de marketing, tetos orçamentários, rateios entre polos, alertas automáticos de desperdício e relatórios mensais em PDF (A4).

## 1. Configuração do Firebase

1. **Projeto e Banco Cloud Firestore**:
   - A configuração do aplicativo está em `firebase-applet-config.json`.
   - As regras de segurança multi-tenant com isolamento por perfil (`admin`, `gestor`, `operador`, `leitor`) e `poloIds` estão em [`firestore.rules`](./firestore.rules).
   - Os índices compostos necessários estão listados em [`firestore.indexes.json`](./firestore.indexes.json).

2. **Autenticação (Firebase Authentication)**:
   - O provedor **Google** já vem habilitado automaticamente.
   - Para utilizar login por **E-mail e Senha**, acesse o Console do Firebase → **Authentication** → **Sign-in method** → habilite **Email/Password**.

3. **Implantação das Regras e Índices via Firebase CLI (opcional em ambiente externo)**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

## 2. Índices Compostos do Firestore (`firestore.indexes.json`)

- `lancamentos`: `(excluido ASC, competencia ASC, data DESC)`
- `lancamentos`: `(poloId ASC, excluido ASC, competencia ASC, data DESC)`
- `lancamentos`: `(poloId ASC, status ASC, data DESC)`
- `orcamentos`: `(mes ASC, poloId ASC)`
- `auditoria`: `(entidade ASC, em DESC)`

## 3. Testes Automatizados de Regras de Negócio e Segurança

```bash
npx --yes tsx --test src/utils/financeRules.test.ts
npx --yes tsx --test firestore.rules.test.ts
npx eslint firestore.rules
```
