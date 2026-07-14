const { db } = require('../config/db');
const { generateContactMessageId } = require('../utils/codeGenerator');

const ContactMessageModel = {
  async create({ contact_message_id, name, email, company, phone, country, message }) {
    const id = contact_message_id || await generateContactMessageId();
    await db.query(
      `INSERT INTO contact_messages (contact_message_id, name, email, company, phone, country, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unread')`,
      [id, name, email, company || null, phone || null, country || null, message]
    );
    return id;
  },

  async list() {
    const [rows] = await db.query(
      `SELECT * FROM contact_messages ORDER BY created_at DESC`
    );
    return rows;
  },

  async findById(contact_message_id) {
    const [rows] = await db.query(
      `SELECT * FROM contact_messages WHERE contact_message_id = ?`,
      [contact_message_id]
    );
    return rows[0] || null;
  },

  async reply(contact_message_id, replyContent) {
    await db.query(
      `UPDATE contact_messages 
       SET reply_content = ?, status = 'replied', replied_at = CURRENT_TIMESTAMP 
       WHERE contact_message_id = ?`,
      [replyContent, contact_message_id]
    );
  }
};

module.exports = ContactMessageModel;
