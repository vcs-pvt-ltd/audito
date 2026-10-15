-- Removes tables left over from plan-based pricing (Basic / Pro / Elite / Custom
-- plans). Workspaces are now sold as Company packages or quoted accounts. A
-- workspace's package is its paid registration payment in
-- `payment_transactions`, whose pricing snapshot holds the purchased limits, so
-- `subscriptions` is no longer read or written. Token pricing lives in
-- `package_pricing_settings` and `token_reload_packages`.
--
-- Run as the table owner. Back up first if the plan history must be kept.

BEGIN;

DROP TABLE IF EXISTS plan_settings;
DROP TABLE IF EXISTS plan_entry_prices;
DROP TABLE IF EXISTS custom_solution_requests;
-- Applications reference credits, so drop them first.
DROP TABLE IF EXISTS link_credit_applications;
DROP TABLE IF EXISTS link_billing_credits;
DROP TABLE IF EXISTS subscriptions;

COMMIT;
