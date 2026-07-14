const { db } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateAuditorExperienceId, generateAuditorQualificationId, generateAuditorTrainingId, generateAuditorProfileId } = require('../utils/codeGenerator');
// File upload setup
const uploadDir = path.join(__dirname, '../public/uploads/auditor-profiles');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const profileUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// ── GET Profile ──────────────────────────
const getProfile = async (req, res) => {
  try {
    const userCode = req.user.userCode;

        const [profiles] = await db.query('SELECT * FROM auditor_profiles WHERE auditor_id = ? LIMIT 1', [userCode]);
    const profile = profiles[0] || { auditor_id: userCode };

    const [experiences] = await db.query('SELECT * FROM auditor_experiences WHERE auditor_id = ?', [userCode]);
    const [qualifications] = await db.query('SELECT * FROM auditor_qualifications WHERE auditor_id = ?', [userCode]);
    const [trainings] = await db.query('SELECT * FROM auditor_trainings WHERE auditor_id = ?', [userCode]);

    return successResponse(res, { profile, experiences, qualifications, trainings });
  } catch (err) {
    console.error('getProfile error:', err);
    return errorResponse(res, 'Failed to fetch profile.', 500);
  }
};

// ── UPDATE Profile ───────────────────────
const updateProfile = async (req, res) => {
  try {
    const userCode = req.user.userCode;
    const data = { ...req.body };

    if (req.files) {
      if (req.files.profile_picture?.[0]) data.profile_picture = `/uploads/auditor-profiles/${req.files.profile_picture[0].filename}`;
      if (req.files.signature_path?.[0]) data.signature_path = `/uploads/auditor-profiles/${req.files.signature_path[0].filename}`;
      if (req.files.cv_path?.[0]) data.cv_path = `/uploads/auditor-profiles/${req.files.cv_path[0].filename}`;
    }

    const fields = [
      'name_with_initials', 'designation', 'gender', 'date_of_birth', 'civil_status',
      'address_line_1', 'address_line_2', 'address_line_3', 'district', 'city',
      'latitude', 'longitude', 'mobile_number', 'whatsapp_number', 'home_number',
      'specialized_network', 'working_status', 'current_sector', 'current_organization',
      'join_as'
    ];

    const allowedUpdates = {};
    for (const f of fields) {
      if (data[f] !== undefined) allowedUpdates[f] = data[f];
    }
    if (data.profile_picture) allowedUpdates.profile_picture = data.profile_picture;
    if (data.signature_path) allowedUpdates.signature_path = data.signature_path;
    if (data.cv_path) allowedUpdates.cv_path = data.cv_path;

    const [existing] = await db.query('SELECT id FROM auditor_profiles WHERE auditor_id = ?', [userCode]);

    if (existing.length > 0) {
      if (Object.keys(allowedUpdates).length > 0) {
        const setClause = Object.keys(allowedUpdates).map(k => `${k} = ?`).join(', ');
        const values = Object.values(allowedUpdates);
        await db.query(`UPDATE auditor_profiles SET ${setClause} WHERE auditor_id = ?`, [...values, userCode]);
      }
    } else {
allowedUpdates.auditor_id = userCode;
  allowedUpdates.auditor_profile_id = await generateAuditorProfileId();     
   const keys = Object.keys(allowedUpdates);
      const marks = keys.map(() => '?').join(', ');
      const values = Object.values(allowedUpdates);
      await db.query(`INSERT INTO auditor_profiles (${keys.join(', ')}) VALUES (${marks})`, values);
    }

    // Refresh and send updated profile
    const [updated] = await db.query('SELECT * FROM auditor_profiles WHERE auditor_id = ? LIMIT 1', [userCode]);
    return successResponse(res, { profile: updated[0] }, 'Profile updated successfully.');
  } catch (err) {
    console.error('updateProfile error:', err);
    return errorResponse(res, 'Failed to update profile.', 500);
  }
};

// ── EXPERIENCES ──────────────────────────
const addExperience = async (req, res) => {
  try {
    const userCode = req.user.userCode;
    const { industry_sector, experience_type, company_name, years } = req.body;
    const auditor_experience_id = await generateAuditorExperienceId();
    await db.query(
      `INSERT INTO auditor_experiences (auditor_experience_id, auditor_id, industry_sector, experience_type, company_name, years) VALUES (?, ?, ?, ?, ?, ?)`,
      [auditor_experience_id, userCode, industry_sector, experience_type, company_name, years || 0]
    );
    return successResponse(res, { id: auditor_experience_id }, 'Experience added.');
  } catch (err) {
    console.error('addExperience error:', err);
    return errorResponse(res, 'Failed to add experience.', 500);
  }
};

const updateExperience = async (req, res) => {
  try {
    const { id } = req.params;
    const { industry_sector, experience_type, company_name, years } = req.body;
    await db.query(
      `UPDATE auditor_experiences SET industry_sector = ?, experience_type = ?, company_name = ?, years = ? WHERE auditor_experience_id = ? AND auditor_id = ?`,
      [industry_sector, experience_type, company_name, years || 0, id, req.user.userCode]
    );
    return successResponse(res, null, 'Experience updated.');
  } catch (err) {
    console.error('updateExperience error:', err);
    return errorResponse(res, 'Failed to update experience.', 500);
  }
};

const deleteExperience = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM auditor_experiences WHERE auditor_experience_id = ? AND auditor_id = ?`, [id, req.user.userCode]);
    return successResponse(res, null, 'Experience deleted.');
  } catch (err) {
    console.error('deleteExperience error:', err);
    return errorResponse(res, 'Failed to delete experience.', 500);
  }
};

// ── QUALIFICATIONS ───────────────────────
const addQualification = async (req, res) => {
  try {
    const userCode = req.user.userCode;
    const { qualification_name, university_name, degree, year } = req.body;
    let certificate_path = null;
    if (req.file) certificate_path = `/uploads/auditor-profiles/${req.file.filename}`;

    const auditor_qualification_id = await generateAuditorQualificationId();
    await db.query(
      `INSERT INTO auditor_qualifications (auditor_qualification_id, auditor_id, qualification_name, university_name, degree, year, certificate_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [auditor_qualification_id, userCode, qualification_name, university_name, degree, year, certificate_path]
    );
    return successResponse(res, { id: auditor_qualification_id }, 'Qualification added.');
  } catch (err) {
    console.error('addQualification error:', err);
    return errorResponse(res, 'Failed to add qualification.', 500);
  }
};

const updateQualification = async (req, res) => {
  try {
    const { id } = req.params;
    const { qualification_name, university_name, degree, year } = req.body;
    const updates = { qualification_name, university_name, degree, year };
    if (req.file) updates.certificate_path = `/uploads/auditor-profiles/${req.file.filename}`;

    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id, req.user.userCode];

    await db.query(`UPDATE auditor_qualifications SET ${setClause} WHERE auditor_qualification_id = ? AND auditor_id = ?`, values);
    return successResponse(res, null, 'Qualification updated.');
  } catch (err) {
    console.error('updateQualification error:', err);
    return errorResponse(res, 'Failed to update qualification.', 500);
  }
};

const deleteQualification = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM auditor_qualifications WHERE auditor_qualification_id = ? AND auditor_id = ?`, [id, req.user.userCode]);
    return successResponse(res, null, 'Qualification deleted.');
  } catch (err) {
    console.error('deleteQualification error:', err);
    return errorResponse(res, 'Failed to delete qualification.', 500);
  }
};

// ── TRAININGS ────────────────────────────
const addTraining = async (req, res) => {
  try {
    const userCode = req.user.userCode;
    const { training_type, course_name, organization, duration, year } = req.body;
    let certificate_path = null;
    if (req.file) certificate_path = `/uploads/auditor-profiles/${req.file.filename}`;

    const auditor_training_id = await generateAuditorTrainingId();
    await db.query(
      `INSERT INTO auditor_trainings (auditor_training_id, auditor_id, training_type, course_name, organization, duration, year, certificate_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [auditor_training_id, userCode, training_type, course_name, organization, duration, year, certificate_path]
    );
    return successResponse(res, { id: auditor_training_id }, 'Training added.');
  } catch (err) {
    console.error('addTraining error:', err);
    return errorResponse(res, 'Failed to add training.', 500);
  }
};

const updateTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const { training_type, course_name, organization, duration, year } = req.body;
    const updates = { training_type, course_name, organization, duration, year };
    if (req.file) updates.certificate_path = `/uploads/auditor-profiles/${req.file.filename}`;

    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id, req.user.userCode];

    await db.query(`UPDATE auditor_trainings SET ${setClause} WHERE auditor_training_id = ? AND auditor_id = ?`, values);
    return successResponse(res, null, 'Training updated.');
  } catch (err) {
    console.error('updateTraining error:', err);
    return errorResponse(res, 'Failed to update training.', 500);
  }
};

const deleteTraining = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM auditor_trainings WHERE auditor_training_id = ? AND auditor_id = ?`, [id, req.user.userCode]);
    return successResponse(res, null, 'Training deleted.');
  } catch (err) {
    console.error('deleteTraining error:', err);
    return errorResponse(res, 'Failed to delete training.', 500);
  }
};

module.exports = {
  profileUpload,
  getProfile,
  updateProfile,
  addExperience,
  updateExperience,
  deleteExperience,
  addQualification,
  updateQualification,
  deleteQualification,
  addTraining,
  updateTraining,
  deleteTraining
};
