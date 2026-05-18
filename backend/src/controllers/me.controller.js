import * as MeService from '../services/me.service.js';

/**
 * PUT /api/me/password
 * Body: { current_password, new_password }
 */
export const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    await MeService.changePassword(req.user.id, current_password, new_password);
    return res.status(200).json({
      success: true,
      data: null,
      message: 'Đổi mật khẩu thành công'
    });
  } catch (err) {
    next(err);
  }
};
