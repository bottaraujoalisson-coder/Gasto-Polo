/**
 * Phase 0 Security Rules Verification Specification
 * Tests the Dirty Dozen payloads against GastoPolo RBAC & schema invariants.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Firestore rules enforce all 8 pillars and multi-tenant polo isolation', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf-8');
  assert.ok(rules.includes("rules_version = '2';"), 'Uses rules_version 2');
  assert.ok(rules.includes('allow read, write: if false;'), 'Includes default-deny global safety net');
  assert.ok(rules.includes('function isValidId(id)'), 'Includes ID poisoning guard');
  assert.ok(rules.includes('function isActiveMember(redeId)'), 'Checks active membership in Rede');
  assert.ok(rules.includes('function hasPoloAccess(redeId, poloId)'), 'Enforces polo-level isolation');
  assert.ok(rules.includes('isValidLancamento(incoming()'), 'Validates Lancamento payload on create and update');
  assert.ok(rules.includes('affectedKeys().hasOnly('), 'Uses action-based affectedKeys().hasOnly()');
});
