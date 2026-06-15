const DashboardModel = require('../models/DashboardModel');
const { successResponse, errorResponse } = require('../utils/helpers');

const getDashboardOverview = async (req, res) => {
  try {
    const overview = await DashboardModel.getOverview(req.user, req.query || {});
    return successResponse(res, overview);
  } catch (err) {
    console.error('getDashboardOverview error:', err);
    return errorResponse(res, 'Failed to load dashboard overview.', 500);
  }
};

module.exports = { getDashboardOverview };
