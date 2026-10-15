const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const AdminModel = require('../models/AdminModel');

const PUBLIC_ROOT = path.resolve(__dirname, '../public');
const ALLOWED_MEDIA_ROOTS = [
  path.resolve(PUBLIC_ROOT, 'uploads/evidence'),
  path.resolve(PUBLIC_ROOT, 'uploads/cap-evidence'),
];

async function verifyAdminPassword(user, password) {
  if (user?.role !== 'admin') {
    return { ok: false, status: 403, message: 'Only an organization administrator can permanently delete this record.' };
  }

  if (typeof password !== 'string' || !password.trim()) {
    return { ok: false, status: 400, message: 'Enter your admin password to continue.' };
  }

  const admin = await AdminModel.findById(user.userCode);
  if (!admin?.password || !await bcrypt.compare(password, admin.password)) {
    return { ok: false, status: 403, message: 'The admin password is incorrect.' };
  }

  return { ok: true, admin };
}

function resolveStoredMediaPath(storedPath) {
  if (typeof storedPath !== 'string' || !storedPath.trim()) return null;

  const relativePath = storedPath
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const absolutePath = path.resolve(PUBLIC_ROOT, relativePath);
  const isAllowed = ALLOWED_MEDIA_ROOTS.some((root) => (
    absolutePath === root || absolutePath.startsWith(`${root}${path.sep}`)
  ));

  return isAllowed ? absolutePath : null;
}

async function removeStoredMedia(storedPaths) {
  const uniquePaths = [...new Set((storedPaths || []).filter(Boolean))];
  let removed = 0;
  const failures = [];

  for (const storedPath of uniquePaths) {
    const absolutePath = resolveStoredMediaPath(storedPath);
    if (!absolutePath) {
      failures.push({ path: storedPath, reason: 'Path is outside the allowed evidence directories.' });
      continue;
    }

    try {
      await fs.promises.unlink(absolutePath);
      removed += 1;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      failures.push({ path: storedPath, reason: error?.message || 'Unable to remove file.' });
    }
  }

  if (failures.length) {
    console.error('Critical deletion completed with media cleanup failures:', failures);
  }

  return { removed, failed: failures.length };
}

module.exports = {
  verifyAdminPassword,
  removeStoredMedia,
};
