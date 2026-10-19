// Public levels: Department 1, Unit 2, Factory 3, Cluster 4, Company 5.
// Every new package includes the first three levels.
const MINIMUM_LEVELS_BY_ENTRY = Object.freeze({
  Department: 3,
  Unit: 3,
  Factory: 3,
  Cluster: 4,
  Company: 5,
});
// Workspace depth excludes Department, which has a separate quantity limit.
const COMPANY_LEVEL_RANK = Object.freeze({ Company: 4, Cluster: 3, Factory: 2, Unit: 1 });

function canRegisterPackageEntry(entityType, selectedLevels) {
  return Object.hasOwn(MINIMUM_LEVELS_BY_ENTRY, entityType)
    && Number.isSafeInteger(selectedLevels)
    && selectedLevels <= 5
    && selectedLevels >= MINIMUM_LEVELS_BY_ENTRY[entityType];
}

function packageHierarchyDepth(snapshot) {
  const levels = Number(snapshot.company_levels);
  return Number(snapshot.pricing_version) >= 3 ? levels - 1 : levels;
}

/** Workspace limits bought with a Company package; audits and users are governed by tokens. */
function packageLimits(snapshot) {
  return {
    company_level: packageHierarchyDepth(snapshot), department: Number(snapshot.departments),
    audits: 1000000, checklists: 1000000, auditors: 1000000,
    auditor_eval: true, company_to_company: true,
  };
}

/** Limits of a Customer or Audit Firm workspace registered from an Audito quote. */
function quotedAccountLimits(snapshot) {
  return {
    company_level: 5, department: Number(snapshot.departments),
    audits: 1000000, checklists: 1000000, auditors: 1000000,
    auditor_eval: true, company_to_company: true,
  };
}

function minimumLevelsForChild(rootType, childType) {
  const rootRank = COMPANY_LEVEL_RANK[rootType];
  const childRank = COMPANY_LEVEL_RANK[childType];
  return rootRank && childRank && childRank < rootRank ? rootRank - childRank + 1 : null;
}

module.exports = { MINIMUM_LEVELS_BY_ENTRY, canRegisterPackageEntry, minimumLevelsForChild, packageHierarchyDepth, packageLimits, quotedAccountLimits };
