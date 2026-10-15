// Promo codes entered on the payment page. A code takes a percentage off the
// list price. It never combines with an automatic promotion campaign: the
// customer gets whichever price is lower.

const round2 = value => Math.round(Number(value) * 100) / 100;
// A checkout started at the bank keeps its amount for this long, so a change
// to the code cannot leave a running checkout with a different amount.
const CHECKOUT_LOCK_MS = 30 * 60 * 1000;

/** Amount due without a promo code: the list price less any campaign discount. */
function priceWithoutCode(payment) {
  const list = round2(payment.list_amount ?? payment.amount);
  return Math.max(0, round2(list - Number(payment.promotion_discount_amount || 0)));
}

/** Price after a code of `percentage` percent, and whether it beats the current offer. */
function quoteCode(payment, percentage) {
  const list = round2(payment.list_amount ?? payment.amount);
  const withoutCode = priceWithoutCode(payment);
  const amount = Math.max(0, round2(list * (1 - Number(percentage) / 100)));
  return { list, amount, discount: round2(list - amount), withoutCode, better: amount < withoutCode };
}

/** Why the code on this payment cannot be changed now, or '' when it can. */
function changeBlockedReason(payment, now = Date.now()) {
  if (payment.status === 'paid') return 'This payment is already complete.';
  if (!['pending', 'failed'].includes(payment.status)) return 'This payment is already being processed.';
  if (payment.manual_approval_status && payment.manual_approval_status !== 'not_requested') {
    return 'Payment approval was already requested for this amount. Contact Audito to change it.';
  }
  const started = payment.initiated_at ? new Date(payment.initiated_at).getTime() : 0;
  if (payment.status === 'pending' && payment.gateway_status === 'initiated' && started && now - started < CHECKOUT_LOCK_MS) {
    return 'A secure payment was started for this amount a moment ago. Finish or cancel it, then try again in 30 minutes.';
  }
  return '';
}

module.exports = { round2, priceWithoutCode, quoteCode, changeBlockedReason, CHECKOUT_LOCK_MS };
