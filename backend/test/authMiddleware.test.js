// authenticate / authorize middleware with signed test tokens. The user
// models are stubbed per test, so no database is touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Non-secret value used only by these tests.
const SECRET = 'audito-test-jwt-secret';
process.env.JWT_SECRET = SECRET;

const AdminModel = require('../src/models/AdminModel');
const AuditorModel = require('../src/models/AuditorModel');
const OrganizationUserModel = require('../src/models/OrganizationUserModel');
const { authenticate, authorize } = require('../src/middleware/auth');

const original = {
  admin: AdminModel.findById,
  auditor: AuditorModel.findById,
  organizationUser: OrganizationUserModel.findById,
};

test.afterEach(() => {
  AdminModel.findById = original.admin;
  AuditorModel.findById = original.auditor;
  OrganizationUserModel.findById = original.organizationUser;
});

function stubModels({ admin = null, auditor = null, organizationUser = null } = {}) {
  const calls = [];
  const fail = name => async id => { calls.push([name, id]); throw new Error(`${name} should not be called`); };
  AdminModel.findById = admin ? async id => (calls.push(['admin', id]), admin) : fail('admin');
  AuditorModel.findById = auditor ? async id => (calls.push(['auditor', id]), auditor) : fail('auditor');
  OrganizationUserModel.findById = organizationUser
    ? async id => (calls.push(['organizationUser', id]), organizationUser)
    : fail('organizationUser');
  return calls;
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function run(middleware, headers = {}, user) {
  const req = { headers, user };
  const res = mockRes();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

const bearer = (payload, secret = SECRET, options = { expiresIn: '1h' }) => ({
  authorization: `Bearer ${jwt.sign(payload, secret, options)}`,
});

const activeAdmin = { id: 7, admin_id: 'ADM-7', email: 'a@example.test', role: 'admin', is_active: 1,
  account_type: 'company', entity_type: 'company', entity_code: 'CMP-1', org_level: 1 };
const activeAuditor = { id: 9, auditor_id: 'AUD-9', email: 'b@example.test', is_active: 1, user_type: 'internal',
  assigned_entity_type: 'factory', assigned_entity_code: 'FAC-1', assigned_org_tree_id: 3, created_by_entity_code: 'CMP-1' };
const activeOrgUser = { id: 11, organization_user_id: 'OU-11', email: 'c@example.test', is_active: 1, user_type: 'head',
  assigned_entity_type: 'unit', assigned_entity_code: null, created_by_entity_code: 'CMP-1' };

test('rejects a request without a bearer token', async () => {
  stubModels();
  for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'bearer x' }]) {
    const { res, nextCalled } = await run(authenticate, headers);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Access denied. No token provided.');
  }
});

test('rejects a token signed with another secret', async () => {
  stubModels();
  const { res, nextCalled } = await run(authenticate, bearer({ userId: 'ADM-7', role: 'admin' }, 'wrong-secret'));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid token.');
});

test('rejects a malformed token', async () => {
  stubModels();
  const { res } = await run(authenticate, { authorization: 'Bearer not.a.jwt' });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid token.');
});

test('rejects an expired token', async () => {
  stubModels();
  const expired = { userId: 'ADM-7', role: 'admin', exp: Math.floor(Date.now() / 1000) - 60 };
  const { res } = await run(authenticate, bearer(expired, SECRET, {}));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Token has expired.');
});

test('rejects an unknown role', async () => {
  stubModels();
  const { res } = await run(authenticate, bearer({ userId: 'X', role: 'superuser' }));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid token role.');
});

test('auditor_app client tokens are only valid for auditors', async () => {
  stubModels();
  const { res } = await run(authenticate, bearer({ userId: 'ADM-7', role: 'admin', client: 'auditor_app' }));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid token role.');
});

test('admin token attaches the admin user', async () => {
  const calls = stubModels({ admin: activeAdmin });
  const { req, nextCalled } = await run(authenticate, bearer({ userId: 'ADM-7', role: 'admin' }));
  assert.equal(nextCalled, true);
  assert.deepEqual(calls, [['admin', 'ADM-7']]);
  assert.deepEqual(req.user, {
    id: 7, userCode: 'ADM-7', email: 'a@example.test', role: 'admin', accountType: 'company',
    entityType: 'company', entityCode: 'CMP-1', orgLevel: 1,
  });
});

test('legacy adminId claim and missing role default to admin', async () => {
  const calls = stubModels({ admin: activeAdmin });
  const { nextCalled } = await run(authenticate, bearer({ adminId: 'ADM-7' }));
  assert.equal(nextCalled, true);
  assert.deepEqual(calls, [['admin', 'ADM-7']]);
});

test('audito_admin keeps its role from the database record', async () => {
  stubModels({ admin: { ...activeAdmin, role: 'audito_admin' } });
  const { req } = await run(authenticate, bearer({ userId: 'ADM-7', role: 'audito_admin' }));
  assert.equal(req.user.role, 'audito_admin');
});

test('deactivated and missing admins are refused', async () => {
  stubModels({ admin: { ...activeAdmin, is_active: 0 } });
  let { res, nextCalled } = await run(authenticate, bearer({ userId: 'ADM-7', role: 'admin' }));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);

  AdminModel.findById = async () => null;
  ({ res, nextCalled } = await run(authenticate, bearer({ userId: 'ADM-7', role: 'admin' })));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'User not found.');
});

test('auditor token attaches the auditor scope and app client', async () => {
  const calls = stubModels({ auditor: activeAuditor });
  const { req, nextCalled } = await run(authenticate, bearer({ userId: 'AUD-9', role: 'auditor', client: 'auditor_app' }));
  assert.equal(nextCalled, true);
  assert.deepEqual(calls, [['auditor', 'AUD-9']]);
  assert.equal(req.user.role, 'auditor');
  assert.equal(req.user.client, 'auditor_app');
  assert.equal(req.user.assignedEntityCode, 'FAC-1');
  assert.equal(req.user.assignedOrgTreeId, 3);
  assert.equal(req.user.entityCode, 'CMP-1');
});

test('legacy entity_head role maps to organization_user', async () => {
  const calls = stubModels({ organizationUser: activeOrgUser });
  const { req, nextCalled } = await run(authenticate, bearer({ userId: 'OU-11', role: 'entity_head' }));
  assert.equal(nextCalled, true);
  assert.deepEqual(calls, [['organizationUser', 'OU-11']]);
  assert.equal(req.user.role, 'organization_user');
  // Without an assigned entity the scope falls back to the creating entity.
  assert.equal(req.user.entityCode, 'CMP-1');
});

test('a model failure is reported as a 500, not passed through', async () => {
  stubModels();
  AdminModel.findById = async () => { throw new Error('db down'); };
  const { res, nextCalled } = await run(authenticate, bearer({ userId: 'ADM-7', role: 'admin' }));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 500);
});

test('authorize requires an authenticated user', async () => {
  const { res, nextCalled } = await run(authorize('admin'), {}, undefined);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('authorize allows listed roles and refuses others', async () => {
  const allowed = await run(authorize('admin', 'auditor'), {}, { role: 'auditor' });
  assert.equal(allowed.nextCalled, true);

  const refused = await run(authorize('admin'), {}, { role: 'organization_user' });
  assert.equal(refused.nextCalled, false);
  assert.equal(refused.res.statusCode, 403);
  assert.equal(refused.res.body.message, 'Insufficient permissions.');
});
