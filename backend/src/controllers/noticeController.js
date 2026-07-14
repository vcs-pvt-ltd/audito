const { successResponse, errorResponse } = require('../utils/helpers');
const AuditorModel = require('../models/AuditorModel');
const NoticeModel = require('../models/NoticeModel');
const NotificationModel = require('../models/NotificationModel');
const { getAccessibleEntityCodes, resolveEntityNames } = require('../utils/accessHelper');

exports.listAuditorsForNotices = async (req, res) => {
  try {
    const auditors = await AuditorModel.listByCreator(req.user.entityCode);
    return successResponse(res, { auditors });
  } catch (error) {
    console.error('Error listing auditors for notices:', error);
    return errorResponse(res, 'Failed to load auditors.', 500);
  }
};

exports.listNotices = async (req, res) => {
  try {
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    const notices = await NoticeModel.listByAdmin(accessibleCodes);
    const nameMap = await resolveEntityNames(accessibleCodes);
    for (const n of notices) {
      n.entity_name = n.created_by_entity_code !== req.user.entityCode ? (nameMap.get(n.created_by_entity_code)?.name || null) : null;
    }
    return successResponse(res, { notices });
  } catch (error) {
    console.error('Error listing notices:', error);
    return errorResponse(res, 'Failed to load notices.', 500);
  }
};

exports.createNotice = async (req, res) => {
  try {
    const { title, message, notice_date, assign_to_all, auditor_codes } = req.body;
    if (!title || !message || !notice_date) {
      return errorResponse(res, 'Title, message and notice date are required.', 400);
    }

    const noticeId = await NoticeModel.createNotice({
      title,
      message,
      notice_date,
      assign_to_all: !!assign_to_all,
      created_by_admin_id: req.user.userCode,
      created_by_entity_code: req.user.entityCode,
    });

    if (!assign_to_all && Array.isArray(auditor_codes) && auditor_codes.length > 0) {
      await NoticeModel.assignAuditors(noticeId, auditor_codes);
    }

    return successResponse(res, { notice_id: noticeId }, 'Notice created successfully.');
  } catch (error) {
    console.error('Error creating notice:', error);
    return errorResponse(res, 'Failed to create notice.', 500);
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const noticeId = req.params.id;
    const { title, message, notice_date, assign_to_all, auditor_codes } = req.body;

    if (!noticeId) {
      return errorResponse(res, 'Invalid notice id.', 400);
    }

    const notice = await NoticeModel.getNoticeById(noticeId);
    if (!notice) {
      return errorResponse(res, 'Notice not found.', 404);
    }

    await NoticeModel.updateNotice(noticeId, {
      title,
      message,
      notice_date,
      assign_to_all: !!assign_to_all,
    });

    if (!assign_to_all && Array.isArray(auditor_codes)) {
      await NoticeModel.assignAuditors(noticeId, auditor_codes);
    } else if (assign_to_all) {
      await NoticeModel.assignAuditors(noticeId, []);
    }

    return successResponse(res, { notice_id: noticeId }, 'Notice updated successfully.');
  } catch (error) {
    console.error('Error updating notice:', error);
    return errorResponse(res, 'Failed to update notice.', 500);
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const noticeId = req.params.id;
    if (!noticeId) {
      return errorResponse(res, 'Invalid notice id.', 400);
    }

    await NoticeModel.deactivateNotice(noticeId);
    return successResponse(res, null, 'Notice deleted successfully.');
  } catch (error) {
    console.error('Error deleting notice:', error);
    return errorResponse(res, 'Failed to delete notice.', 500);
  }
};

exports.getMyNotices = async (req, res) => {
  try {
    // Keep admin notices visible to auditors by materializing per-auditor rows.
    const manualNotices = await NoticeModel.getNoticesForAuditor(req.user.createdByEntityCode, req.user.userCode);
    for (const n of manualNotices || []) {
      await NotificationModel.createIfNotExists({
        auditor_id: req.user.userCode,
        created_by_entity_code: req.user.createdByEntityCode,
        type: 'notice',
        title: n.title || 'Notice',
        message: n.message || '',
        audit_id: null,
        notify_date: n.notice_date || null,
        notification_key: `notice:${n.notice_id}:${req.user.userCode}`,
      });
    }

    const notices = await NotificationModel.listForAuditor(req.user.createdByEntityCode, req.user.userCode);

    return successResponse(res, { notices });
  } catch (error) {
    console.error('Error fetching auditor notices:', error);
    return errorResponse(res, 'Failed to load notices.', 500);
  }
};

exports.markMyNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    await NotificationModel.markReadStateForAuditor(id, req.user.userCode, true);
    return successResponse(res, null, 'Marked as read.');
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return errorResponse(res, 'Failed to mark as read.', 500);
  }
};

exports.markMyNotificationUnread = async (req, res) => {
  try {
    const { id } = req.params;
    await NotificationModel.markReadStateForAuditor(id, req.user.userCode, false);
    return successResponse(res, null, 'Marked as unread.');
  } catch (error) {
    console.error('Error marking notification as unread:', error);
    return errorResponse(res, 'Failed to mark as unread.', 500);
  }
};

exports.deleteMyNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await NotificationModel.deleteForAuditor(id, req.user.userCode);
    return successResponse(res, null, 'Notification deleted.');
  } catch (error) {
    console.error('Error deleting notification:', error);
    return errorResponse(res, 'Failed to delete notification.', 500);
  }
};
