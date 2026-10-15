/**
 * Token funding rules for linked companies.
 *
 * Every accepted directed organization link adds the requester's wallet to
 * the approving target workspace's token pool. The target sees and spends the
 * combined balance, while token lots remain attributed to their original
 * wallets for auditability.
 */

const LinkModel = require('../models/LinkModel');
const { getOrgName } = require('./orgLookup');

async function getTokenPoolMembers(targetWorkspaceCode) {
  const sponsors = await LinkModel.getAcceptedTokenSponsors(targetWorkspaceCode);
  const requesterNames = await Promise.all(
    sponsors.map((link) => getOrgName(link.requester_type, link.requester_code))
  );
  return [
    {
      root_entity_code: targetWorkspaceCode,
      source: 'workspace',
      display_name: null,
      link_code: null,
    },
    ...sponsors.map((link, index) => ({
      root_entity_code: link.requester_code,
      source: 'linked_requester',
      link_code: link.link_code,
      display_name: requesterNames[index] || null,
      entity_type: link.requester_type,
    })),
  ];
}

async function getTokenPoolCodes(targetWorkspaceCode) {
  const members = await getTokenPoolMembers(targetWorkspaceCode);
  return [...new Set(members.map((member) => member.root_entity_code))];
}

module.exports = {
  getTokenPoolMembers,
  getTokenPoolCodes,
};
