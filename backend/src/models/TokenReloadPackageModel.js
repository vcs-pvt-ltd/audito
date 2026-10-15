const { db } = require('../config/db');
const { generateTokenReloadPackageId } = require('../utils/codeGenerator');

const SELECT_FIELDS = `
  id, token_reload_package_id, display_name,
  token_quantity, bonus_token_quantity, is_active,
  created_at, updated_at
`;

const TokenReloadPackageModel = {
  async listAll() {
    const [rows] = await db.query(
      `SELECT ${SELECT_FIELDS}
         FROM token_reload_packages
        ORDER BY token_quantity, bonus_token_quantity, display_name`
    );
    return rows;
  },

  async find(packageId) {
    const [rows] = await db.query(
      `SELECT ${SELECT_FIELDS}
         FROM token_reload_packages
        WHERE token_reload_package_id = ?
        LIMIT 1`,
      [packageId]
    );
    return rows[0] || null;
  },

  async create(data) {
    const packageId = await generateTokenReloadPackageId(db);
    await db.query(
      `INSERT INTO token_reload_packages
       (token_reload_package_id, display_name, token_quantity,
        bonus_token_quantity, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        packageId, data.display_name, data.token_quantity,
        data.bonus_token_quantity, data.is_active ? 1 : 0,
      ]
    );
    return this.find(packageId);
  },

  async update(packageId, data) {
    await db.query(
      `UPDATE token_reload_packages
          SET display_name = ?, token_quantity = ?,
              bonus_token_quantity = ?, is_active = ?
        WHERE token_reload_package_id = ?`,
      [
        data.display_name, data.token_quantity,
        data.bonus_token_quantity, data.is_active ? 1 : 0,
        packageId,
      ]
    );
    return this.find(packageId);
  },

  async remove(packageId) {
    const [result] = await db.query(
      `DELETE FROM token_reload_packages
        WHERE token_reload_package_id = ?`,
      [packageId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = TokenReloadPackageModel;
