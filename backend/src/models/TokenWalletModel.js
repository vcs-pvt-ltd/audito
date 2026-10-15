const { db } = require('../config/db');
const {
  generateTokenLotId,
  generateTokenWalletId,
  generateTokenReservationId,
  generateTokenLedgerEntryId,
  generateTokenReservationAllocationIds,
  generateAuditQuestionInstanceIds,
} = require('../utils/codeGenerator');
const { getTokenPoolCodes, getTokenPoolMembers } = require('../utils/tokenFunding');

function tokenError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeTreeId(value) {
  return value === undefined || value === null || value === '' ? null : String(value);
}

function localDateKey(timeZone = 'UTC', date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function buildQuestionInstances(questions, entities) {
  const instances = [];
  const seenEntities = new Set();

  for (const entity of entities || []) {
    const entityCode = String(entity.entity_code);
    const entityType = String(entity.entity_type);
    const orgTreeId = normalizeTreeId(entity.org_tree_id);
    const entityKey = `${entityCode}|${entityType}|${orgTreeId ?? 'null'}`;
    if (seenEntities.has(entityKey)) continue;
    seenEntities.add(entityKey);

    const seenQuestions = new Set();
    for (const question of questions || []) {
      if (String(question.entity_code) !== entityCode) continue;
      const questionTreeId = normalizeTreeId(question.org_tree_id);
      if (questionTreeId !== null && questionTreeId !== orgTreeId) continue;
      const questionId = String(question.checklist_question_id);
      if (seenQuestions.has(questionId)) continue;
      seenQuestions.add(questionId);
      instances.push({
        source_checklist_question_id: questionId,
        org_tree_id: orgTreeId,
        entity_code: entityCode,
        entity_type: entityType,
        question_text: question.question_text,
        answer_type: question.answer_type,
        total_marks: Number(question.total_marks || 0),
        order_index: Number(question.order_index || 0),
        options_snapshot: Array.isArray(question.options) ? question.options : null,
      });
    }
  }

  return instances;
}

async function insertLedger(executor, {
  rootEntityCode,
  lotId = null,
  reservationId = null,
  type,
  availableDelta = 0,
  heldDelta = 0,
  burnedDelta = 0,
  idempotencyKey,
  description = null,
  metadata = null,
}) {
  const ledgerEntryId = await generateTokenLedgerEntryId(executor);
  await executor.query(
    `INSERT INTO token_ledger_entries
      (token_ledger_entry_id, root_entity_code, token_lot_id, token_reservation_id,
       entry_type, available_delta, held_delta, burned_delta, idempotency_key,
       description, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ledgerEntryId, rootEntityCode, lotId, reservationId, type,
      availableDelta, heldDelta, burnedDelta, idempotencyKey,
      description, metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

function poolPlaceholders(codes) {
  return codes.map(() => '?').join(',');
}

function eligibleDailyConditions(poolCodes, dailyGrants, startDate) {
  const conditions = [];
  const params = [];
  for (const code of poolCodes) {
    const grant = dailyGrants.get(code);
    if (!grant || String(startDate || '').slice(0, 10) !== grant.today) continue;
    conditions.push('(root_entity_code = ? AND source_reference = ?)');
    params.push(code, grant.today);
  }
  return { conditions, params };
}

const TokenWalletModel = {
  buildQuestionInstances,

  async ensureWallet(executor, rootEntityCode) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [existing] = await executor.query(
        'SELECT token_wallet_id FROM token_wallets WHERE root_entity_code = ? LIMIT 1',
        [rootEntityCode]
      );
      if (existing.length) return existing[0].token_wallet_id;
      const walletId = await generateTokenWalletId(executor);
      const [result] = await executor.query(
        'INSERT IGNORE INTO token_wallets (token_wallet_id, root_entity_code) VALUES (?, ?)',
        [walletId, rootEntityCode]
      );
      if (result.affectedRows === 1) return walletId;
    }
    throw tokenError('TOKEN_WALLET_CREATE_FAILED', 'Could not create the workspace token wallet.');
  },

  /** Token billing for a workspace: the global token price, no free allowances. */
  async getWorkspacePolicy(executor, rootEntityCode) {
    const [packages] = await executor.query(
      `SELECT plan_name
         FROM payment_transactions
        WHERE root_entity_code = ? AND purpose = 'registration' AND status = 'paid'
        ORDER BY paid_at DESC, id DESC LIMIT 1`,
      [rootEntityCode]
    );
    const PackagePricingModel = require('./PackagePricingModel');
    return {
      plan_name: packages[0]?.plan_name || 'Package', activation_price: 0,
      token_unit_price: (await PackagePricingModel.get(executor)).token_unit_price, included_tokens: 0,
      signup_tokens: 0, daily_free_tokens: 0, token_billing_enabled: true,
    };
  },

  async getWorkspaceTimezone(executor, rootEntityCode) {
    const entityStorage = {
      Customer: ['customers', 'cust_code'], 'Buying Office': ['customer_buying_offices', 'cbo_code'],
      Supplier: ['customer_suppliers', 'csup_code'], Company: ['companies', 'comp_code'],
      Cluster: ['company_clusters', 'comp_clus_code'], Factory: ['company_factories', 'comp_fact_code'],
      Unit: ['company_units', 'comp_unit_code'], Department: ['company_departments', 'comp_dept_code'],
      Section: ['company_sections', 'comp_section_code'],
      'Audit Firm Company': ['audit_firm_companies', 'afc_code'],
      Branch: ['audit_firm_company_branches', 'afc_branch_code'],
      'Audit Firm Department': ['audit_firm_company_departments', 'afc_dept_code'],
    };
    try {
      const [admins] = await executor.query(
        `SELECT entity_type FROM admins
          WHERE entity_code = ? AND role = 'admin'
          ORDER BY id LIMIT 1`,
        [rootEntityCode]
      );
      const storage = entityStorage[admins[0]?.entity_type];
      if (!storage) return 'UTC';
      const [table, field] = storage;
      const [rows] = await executor.query(
        `SELECT timezone FROM \`${table}\` WHERE \`${field}\` = ? LIMIT 1`,
        [rootEntityCode]
      );
      return rows[0]?.timezone || 'UTC';
    } catch {
      // Legacy schemas may not have timezone on every historical entity table.
      return 'UTC';
    }
  },

  async grantTokens(executor, {
    rootEntityCode,
    sourceType,
    sourceReference,
    quantity,
    unitPrice = null,
    paymentTransactionId = null,
    expiresAt = null,
    description = null,
  }) {
    const tokens = Number(quantity || 0);
    if (!Number.isSafeInteger(tokens) || tokens <= 0) return null;
    await this.ensureWallet(executor, rootEntityCode);

    const lotId = await generateTokenLotId(executor);
    const [result] = await executor.query(
      `INSERT IGNORE INTO token_lots
        (token_lot_id, root_entity_code, source_type, source_reference,
         granted_tokens, available_tokens, held_tokens, token_unit_price,
         payment_transaction_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [lotId, rootEntityCode, sourceType, sourceReference, tokens, tokens, unitPrice, paymentTransactionId, expiresAt]
    );
    if (result.affectedRows !== 1) return null;

    await executor.query(
      'UPDATE token_wallets SET available_tokens = available_tokens + ? WHERE root_entity_code = ?',
      [tokens, rootEntityCode]
    );
    await insertLedger(executor, {
      rootEntityCode,
      lotId,
      type: 'grant',
      availableDelta: tokens,
      idempotencyKey: `grant:${rootEntityCode}:${sourceType}:${sourceReference}`,
      description: description || `Granted ${tokens} tokens`,
      metadata: { source_type: sourceType, payment_transaction_id: paymentTransactionId },
    });
    return lotId;
  },

  async expireOldDailyLots(executor, rootEntityCode, currentLocalDate) {
    const [lots] = await executor.query(
      `SELECT token_lot_id, available_tokens
         FROM token_lots
        WHERE root_entity_code = ? AND source_type = 'daily'
          AND source_reference <> ? AND available_tokens > 0
        FOR UPDATE`,
      [rootEntityCode, currentLocalDate]
    );
    for (const lot of lots) {
      const quantity = Number(lot.available_tokens);
      await executor.query('UPDATE token_lots SET available_tokens = 0 WHERE token_lot_id = ?', [lot.token_lot_id]);
      await executor.query(
        'UPDATE token_wallets SET available_tokens = available_tokens - ? WHERE root_entity_code = ?',
        [quantity, rootEntityCode]
      );
      await insertLedger(executor, {
        rootEntityCode,
        lotId: lot.token_lot_id,
        type: 'expire',
        availableDelta: -quantity,
        idempotencyKey: `expire:${lot.token_lot_id}`,
        description: 'Unused daily tokens expired',
      });
    }
  },

  async ensureDailyGrant(executor, rootEntityCode, eligibleStartDate = null) {
    const policy = await this.getWorkspacePolicy(executor, rootEntityCode);
    const timeZone = await this.getWorkspaceTimezone(executor, rootEntityCode);
    const today = localDateKey(timeZone);
    await this.expireOldDailyLots(executor, rootEntityCode, today);
    const isEligible = !eligibleStartDate || String(eligibleStartDate).slice(0, 10) === today;
    if (!isEligible || policy.daily_free_tokens <= 0) return { policy, today, granted: false };
    const lotId = await this.grantTokens(executor, {
      rootEntityCode,
      sourceType: 'daily',
      sourceReference: today,
      quantity: policy.daily_free_tokens,
      unitPrice: 0,
      description: `${today} daily free token grant`,
    });
    return { policy, today, granted: !!lotId };
  },

  async writeQuestionSnapshots(executor, auditId, instances) {
    await executor.query('DELETE FROM audit_question_instances WHERE audit_id = ?', [auditId]);
    const instanceIds = await generateAuditQuestionInstanceIds(instances.length, executor);
    instances.forEach((instance, index) => { instance.audit_question_instance_id = instanceIds[index]; });
    const batchSize = 200;
    for (let start = 0; start < instances.length; start += batchSize) {
      const batch = instances.slice(start, start + batchSize);
      await executor.query(
        `INSERT INTO audit_question_instances
          (audit_question_instance_id, audit_id, source_checklist_question_id,
           org_tree_id, entity_code, entity_type, question_text, answer_type,
           total_marks, order_index, options_snapshot)
         VALUES ?`,
        [batch.map((item) => [
          item.audit_question_instance_id, auditId, item.source_checklist_question_id,
          item.org_tree_id, item.entity_code, item.entity_type, item.question_text,
          item.answer_type, item.total_marks, item.order_index,
          item.options_snapshot ? JSON.stringify(item.options_snapshot) : null,
        ])]
      );
    }
  },

  async prepareTokenPool(executor, rootEntityCode, startDate = null) {
    const poolMembers = await getTokenPoolMembers(rootEntityCode);
    const poolCodes = [...new Set(poolMembers.map((member) => member.root_entity_code))].sort();
    const dailyGrants = new Map();
    for (const code of poolCodes) {
      await this.ensureWallet(executor, code);
      dailyGrants.set(code, await this.ensureDailyGrant(executor, code, startDate));
    }
    return {
      poolCodes,
      poolMembers,
      dailyGrants,
      policy: await this.getWorkspacePolicy(executor, rootEntityCode),
    };
  },

  async allocateReservation(executor, { reservationId, auditId, rootEntityCode, requiredTokens, poolCodes, dailyGrants, startDate }) {
    const [walletRows] = await executor.query(
      `SELECT root_entity_code, available_tokens, held_tokens
         FROM token_wallets
        WHERE root_entity_code IN (${poolPlaceholders(poolCodes)})
        ORDER BY root_entity_code
        FOR UPDATE`,
      poolCodes
    );
    const available = walletRows.reduce((total, wallet) => total + Number(wallet.available_tokens || 0), 0);
    if (available < requiredTokens) {
      throw tokenError(
        'INSUFFICIENT_TOKENS',
        `This audit needs ${requiredTokens} tokens, but only ${available} are available in the linked token pool.`,
        { required_tokens: requiredTokens, available_tokens: available, shortage_tokens: requiredTokens - available }
      );
    }

    const daily = eligibleDailyConditions(poolCodes, dailyGrants, startDate);
    const dailySql = daily.conditions.length ? ` OR (${daily.conditions.join(' OR ')})` : '';
    const [lots] = await executor.query(
      `SELECT token_lot_id, root_entity_code, source_type, source_reference, available_tokens, expires_at
         FROM token_lots
        WHERE root_entity_code IN (${poolPlaceholders(poolCodes)})
          AND available_tokens > 0
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (source_type <> 'daily'${dailySql})
        ORDER BY (source_type = 'daily') DESC, (expires_at IS NULL), expires_at ASC, created_at ASC, root_entity_code ASC
        FOR UPDATE`,
      [...poolCodes, ...daily.params]
    );

    let remaining = requiredTokens;
    const allocations = [];
    for (const lot of lots) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, Number(lot.available_tokens));
      if (quantity <= 0) continue;
      allocations.push({ lotId: lot.token_lot_id, rootEntityCode: lot.root_entity_code, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) {
      const eligible = requiredTokens - remaining;
      throw tokenError(
        'INSUFFICIENT_ELIGIBLE_TOKENS',
        `This audit needs ${requiredTokens} tokens, but only ${eligible} tokens are eligible for its start date.`,
        { required_tokens: requiredTokens, available_tokens: eligible, shortage_tokens: remaining }
      );
    }

    const allocationIds = await generateTokenReservationAllocationIds(allocations.length, executor);
    for (const [allocationIndex, allocation] of allocations.entries()) {
      const allocationId = allocationIds[allocationIndex];
      await executor.query(
        `UPDATE token_lots
            SET available_tokens = available_tokens - ?, held_tokens = held_tokens + ?
          WHERE token_lot_id = ?`,
        [allocation.quantity, allocation.quantity, allocation.lotId]
      );
      await executor.query(
        `INSERT INTO token_reservation_allocations
          (token_reservation_allocation_id, token_reservation_id, token_lot_id, allocated_tokens, status)
         VALUES (?, ?, ?, ?, 'held')`,
        [allocationId, reservationId, allocation.lotId, allocation.quantity]
      );
      await insertLedger(executor, {
        rootEntityCode: allocation.rootEntityCode,
        lotId: allocation.lotId,
        reservationId,
        type: 'reserve',
        availableDelta: -allocation.quantity,
        heldDelta: allocation.quantity,
        idempotencyKey: `reserve:${allocationId}`,
        description: `Reserved for audit ${auditId}`,
        metadata: allocation.rootEntityCode === rootEntityCode ? null : { pooled_for_workspace: rootEntityCode },
      });
    }
    const changes = new Map();
    for (const allocation of allocations) {
      changes.set(allocation.rootEntityCode, (changes.get(allocation.rootEntityCode) || 0) + allocation.quantity);
    }
    for (const [walletCode, quantity] of changes) {
      await executor.query(
        `UPDATE token_wallets
            SET available_tokens = available_tokens - ?, held_tokens = held_tokens + ?
          WHERE root_entity_code = ?`,
        [quantity, quantity, walletCode]
      );
    }
  },

  async reserveForAudit(executor, { rootEntityCode, auditId, questions, entities, startDate }) {
    const instances = buildQuestionInstances(questions, entities);
    if (!instances.length) throw tokenError('EMPTY_AUDIT', 'The selected audit scope does not contain any questions.');
    const { policy, poolCodes, dailyGrants } = await this.prepareTokenPool(executor, rootEntityCode, startDate);
    await this.writeQuestionSnapshots(executor, auditId, instances);

    const reservationId = await generateTokenReservationId(executor);
    if (!policy.token_billing_enabled) {
      await executor.query(
        `INSERT INTO token_reservations
          (token_reservation_id, audit_id, root_entity_code, required_tokens, status)
         VALUES (?, ?, ?, ?, 'legacy_exempt')`,
        [reservationId, auditId, rootEntityCode, instances.length]
      );
      return { required_tokens: instances.length, status: 'legacy_exempt' };
    }

    await executor.query(
      `INSERT INTO token_reservations
        (token_reservation_id, audit_id, root_entity_code, required_tokens, status, held_at)
       VALUES (?, ?, ?, ?, 'held', NOW())`,
      [reservationId, auditId, rootEntityCode, instances.length]
    );
    await this.allocateReservation(executor, {
      reservationId,
      auditId,
      rootEntityCode,
      requiredTokens: instances.length,
      poolCodes,
      dailyGrants,
      startDate,
    });
    return { required_tokens: instances.length, status: 'held' };
  },

  async quoteAudit({ rootEntityCode, questions, entities, startDate }) {
    const instances = buildQuestionInstances(questions, entities);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const { poolCodes, dailyGrants } = await this.prepareTokenPool(connection, rootEntityCode, startDate);
      const daily = eligibleDailyConditions(poolCodes, dailyGrants, startDate);
      const dailySql = daily.conditions.length ? ` OR (${daily.conditions.join(' OR ')})` : '';
      const [rows] = await connection.query(
        `SELECT COALESCE(SUM(available_tokens), 0) AS eligible_tokens
           FROM token_lots
          WHERE root_entity_code IN (${poolPlaceholders(poolCodes)}) AND available_tokens > 0
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (source_type <> 'daily'${dailySql})`,
        [...poolCodes, ...daily.params]
      );
      await connection.commit();
      const available = Number(rows[0]?.eligible_tokens || 0);
      return {
        required_tokens: instances.length,
        available_tokens: available,
        shortage_tokens: Math.max(0, instances.length - available),
        can_assign: instances.length > 0 && available >= instances.length,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async releaseReservation(executor, auditId, reason = 'audit_cancelled') {
    const [rows] = await executor.query(
      'SELECT * FROM token_reservations WHERE audit_id = ? FOR UPDATE',
      [auditId]
    );
    const reservation = rows[0];
    if (!reservation || reservation.status === 'released' || reservation.status === 'burned') return reservation || null;
    if (reservation.status === 'legacy_exempt') return reservation;

    const [allocations] = await executor.query(
      `SELECT allocation.*, lot.root_entity_code, lot.expires_at, lot.source_type, lot.source_reference
         FROM token_reservation_allocations allocation
         JOIN token_lots lot ON lot.token_lot_id = allocation.token_lot_id
        WHERE allocation.token_reservation_id = ? AND allocation.status = 'held'
        FOR UPDATE`,
      [reservation.token_reservation_id]
    );
    let restored = 0;
    let expired = 0;
    const walletChanges = new Map();
    const todayByWallet = new Map();
    for (const allocation of allocations) {
      const quantity = Number(allocation.allocated_tokens);
      if (!todayByWallet.has(allocation.root_entity_code)) {
        const timeZone = await this.getWorkspaceTimezone(executor, allocation.root_entity_code);
        todayByWallet.set(allocation.root_entity_code, localDateKey(timeZone));
      }
      const isExpiredDaily = allocation.source_type === 'daily'
        && allocation.source_reference !== todayByWallet.get(allocation.root_entity_code);
      const change = walletChanges.get(allocation.root_entity_code) || { restored: 0, expired: 0 };
      if (isExpiredDaily) {
        expired += quantity;
        change.expired += quantity;
        await executor.query(
          'UPDATE token_lots SET held_tokens = held_tokens - ? WHERE token_lot_id = ?',
          [quantity, allocation.token_lot_id]
        );
        await executor.query(
          "UPDATE token_reservation_allocations SET status = 'expired' WHERE token_reservation_allocation_id = ?",
          [allocation.token_reservation_allocation_id]
        );
        await insertLedger(executor, {
          rootEntityCode: allocation.root_entity_code,
          lotId: allocation.token_lot_id,
          reservationId: reservation.token_reservation_id,
          type: 'expire',
          heldDelta: -quantity,
          idempotencyKey: `release-expired:${allocation.token_reservation_allocation_id}`,
          description: `Expired daily reservation released from audit ${auditId}`,
        });
      } else {
        restored += quantity;
        change.restored += quantity;
        await executor.query(
          `UPDATE token_lots
              SET held_tokens = held_tokens - ?, available_tokens = available_tokens + ?
            WHERE token_lot_id = ?`,
          [quantity, quantity, allocation.token_lot_id]
        );
        await executor.query(
          "UPDATE token_reservation_allocations SET status = 'released' WHERE token_reservation_allocation_id = ?",
          [allocation.token_reservation_allocation_id]
        );
        await insertLedger(executor, {
          rootEntityCode: allocation.root_entity_code,
          lotId: allocation.token_lot_id,
          reservationId: reservation.token_reservation_id,
          type: 'release',
          availableDelta: quantity,
          heldDelta: -quantity,
          idempotencyKey: `release:${allocation.token_reservation_allocation_id}`,
          description: `Released from audit ${auditId}`,
        });
      }
      walletChanges.set(allocation.root_entity_code, change);
    }
    for (const [walletCode, change] of walletChanges) {
      await executor.query(
        `UPDATE token_wallets
            SET available_tokens = available_tokens + ?, held_tokens = held_tokens - ?
          WHERE root_entity_code = ?`,
        [change.restored, change.restored + change.expired, walletCode]
      );
    }
    await executor.query(
      `UPDATE token_reservations
          SET status = 'released', release_reason = ?, released_at = NOW()
        WHERE token_reservation_id = ?`,
      [reason, reservation.token_reservation_id]
    );
    return { ...reservation, status: 'released', restored_tokens: restored, expired_tokens: expired };
  },

  async fundExistingReservation(executor, { auditId, rootEntityCode, questions, entities, startDate, convertLegacy = false }) {
    const [rows] = await executor.query(
      'SELECT * FROM token_reservations WHERE audit_id = ? FOR UPDATE',
      [auditId]
    );
    const reservation = rows[0];
    if (!reservation) return this.reserveForAudit(executor, { rootEntityCode, auditId, questions, entities, startDate });
    if (reservation.status === 'held') {
      await this.releaseReservation(executor, auditId, 'audit_repriced');
    } else if (reservation.status === 'burned') {
      throw tokenError('AUDIT_ALREADY_BURNED', 'Tokens for this audit have already been burned.');
    } else if (reservation.status === 'legacy_exempt' && !convertLegacy) {
      return { required_tokens: Number(reservation.required_tokens || 0), status: 'legacy_exempt' };
    }

    const instances = buildQuestionInstances(questions, entities);
    if (!instances.length) throw tokenError('EMPTY_AUDIT', 'The selected audit scope does not contain any questions.');
    const { policy, poolCodes, dailyGrants } = await this.prepareTokenPool(executor, rootEntityCode, startDate);
    await this.writeQuestionSnapshots(executor, auditId, instances);
    if (!policy.token_billing_enabled) return { required_tokens: instances.length, status: 'legacy_exempt' };

    await executor.query('DELETE FROM token_reservation_allocations WHERE token_reservation_id = ?', [reservation.token_reservation_id]);
    await executor.query(
      `UPDATE token_reservations
          SET root_entity_code = ?, required_tokens = ?, status = 'held', release_reason = NULL,
              held_at = NOW(), released_at = NULL
        WHERE token_reservation_id = ?`,
      [rootEntityCode, instances.length, reservation.token_reservation_id]
    );
    await this.allocateReservation(executor, {
      reservationId: reservation.token_reservation_id,
      auditId,
      rootEntityCode,
      requiredTokens: instances.length,
      poolCodes,
      dailyGrants,
      startDate,
    });
    return { required_tokens: instances.length, status: 'held' };
  },

  async burnReservation(executor, auditId) {
    const [rows] = await executor.query(
      'SELECT * FROM token_reservations WHERE audit_id = ? FOR UPDATE',
      [auditId]
    );
    const reservation = rows[0];
    if (!reservation) throw tokenError('TOKEN_RESERVATION_MISSING', 'This audit does not have a token reservation.');
    if (reservation.status === 'legacy_exempt' || reservation.status === 'burned') return reservation;
    if (reservation.status !== 'held') throw tokenError('TOKEN_RESERVATION_RELEASED', 'This audit must be funded again before it can start.');

    const [allocations] = await executor.query(
      `SELECT allocation.*, lot.root_entity_code, lot.source_type, lot.source_reference
         FROM token_reservation_allocations allocation
         JOIN token_lots lot ON lot.token_lot_id = allocation.token_lot_id
        WHERE allocation.token_reservation_id = ? AND allocation.status = 'held'
        FOR UPDATE`,
      [reservation.token_reservation_id]
    );
    const todayByWallet = new Map();
    for (const allocation of allocations) {
      if (allocation.source_type !== 'daily') continue;
      if (!todayByWallet.has(allocation.root_entity_code)) {
        const timeZone = await this.getWorkspaceTimezone(executor, allocation.root_entity_code);
        todayByWallet.set(allocation.root_entity_code, localDateKey(timeZone));
      }
      if (allocation.source_reference !== todayByWallet.get(allocation.root_entity_code)) {
        throw tokenError('DAILY_TOKEN_RESERVATION_EXPIRED', 'Daily tokens on hold for this audit have expired. Cancel and restore the audit to reserve valid tokens.');
      }
    }

    let burned = 0;
    const walletBurns = new Map();
    for (const allocation of allocations) {
      const quantity = Number(allocation.allocated_tokens);
      burned += quantity;
      walletBurns.set(allocation.root_entity_code, (walletBurns.get(allocation.root_entity_code) || 0) + quantity);
      await executor.query(
        'UPDATE token_lots SET held_tokens = held_tokens - ? WHERE token_lot_id = ?',
        [quantity, allocation.token_lot_id]
      );
      await executor.query(
        "UPDATE token_reservation_allocations SET status = 'burned' WHERE token_reservation_allocation_id = ?",
        [allocation.token_reservation_allocation_id]
      );
      await insertLedger(executor, {
        rootEntityCode: allocation.root_entity_code,
        lotId: allocation.token_lot_id,
        reservationId: reservation.token_reservation_id,
        type: 'burn',
        heldDelta: -quantity,
        burnedDelta: quantity,
        idempotencyKey: `burn:${allocation.token_reservation_allocation_id}`,
        description: `Burned when audit ${auditId} started`,
      });
    }
    for (const [walletCode, quantity] of walletBurns) {
      await executor.query(
        `UPDATE token_wallets
            SET held_tokens = held_tokens - ?, lifetime_burned_tokens = lifetime_burned_tokens + ?
          WHERE root_entity_code = ?`,
        [quantity, quantity, walletCode]
      );
    }
    await executor.query(
      "UPDATE token_reservations SET status = 'burned', burned_at = NOW() WHERE token_reservation_id = ?",
      [reservation.token_reservation_id]
    );
    return { ...reservation, status: 'burned', burned_tokens: burned };
  },

  async getWallet(rootEntityCode) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const { poolCodes, poolMembers } = await this.prepareTokenPool(connection, rootEntityCode);
      const [wallets] = await connection.query(
        `SELECT * FROM token_wallets
          WHERE root_entity_code IN (${poolPlaceholders(poolCodes)})
          ORDER BY root_entity_code FOR UPDATE`,
        poolCodes
      );
      const policy = await this.getWorkspacePolicy(connection, rootEntityCode);
      await connection.commit();
      return {
        root_entity_code: rootEntityCode,
        available_tokens: wallets.reduce((total, wallet) => total + Number(wallet.available_tokens || 0), 0),
        held_tokens: wallets.reduce((total, wallet) => total + Number(wallet.held_tokens || 0), 0),
        lifetime_burned_tokens: wallets.reduce((total, wallet) => total + Number(wallet.lifetime_burned_tokens || 0), 0),
        wallet_members: wallets.map((wallet) => {
          const member = poolMembers.find((item) => item.root_entity_code === wallet.root_entity_code);
          return {
            root_entity_code: wallet.root_entity_code,
            source: member?.source || 'workspace',
            link_code: member?.link_code || null,
            display_name: member?.display_name || null,
            entity_type: member?.entity_type || null,
            available_tokens: Number(wallet.available_tokens || 0),
            held_tokens: Number(wallet.held_tokens || 0),
            lifetime_burned_tokens: Number(wallet.lifetime_burned_tokens || 0),
          };
        }),
        plan: policy,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async listLedger(rootEntityCode, limit = 100) {
    const safeLimit = Math.max(1, Math.min(250, Number(limit) || 100));
    const poolCodes = await getTokenPoolCodes(rootEntityCode);
    const [rows] = await db.query(
      `SELECT ledger.token_ledger_entry_id, ledger.root_entity_code, ledger.entry_type,
              ledger.available_delta, ledger.held_delta, ledger.burned_delta,
              ledger.description, ledger.metadata, ledger.created_at,
              audit.title AS audit_title,
              NULLIF(TRIM(CONCAT_WS(' ', auditor.first_name, auditor.last_name)), '') AS auditor_name
         FROM token_ledger_entries ledger
         LEFT JOIN token_reservations reservation
           ON reservation.token_reservation_id = ledger.token_reservation_id
         LEFT JOIN audit_assignments audit ON audit.audit_id = reservation.audit_id
         LEFT JOIN auditors auditor ON auditor.auditor_id = audit.assigned_auditor_id
        WHERE ledger.root_entity_code IN (${poolPlaceholders(poolCodes)})
        ORDER BY ledger.created_at DESC, ledger.token_ledger_entry_id DESC
        LIMIT ?`,
      [...poolCodes, safeLimit]
    );
    return rows;
  },
};

module.exports = TokenWalletModel;
