import User from '../models/User';
import Notification from '../Schemas/Notifications';

class NotificationController {
  async index(req, res) {
    const checkProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!checkProvider) {
      return res.status(401).json({
        error: 'Só está habilitado para provedores.',
      });
    }
    const notification = await Notification.find({
      user: req.userId,
    })
      .sort({ createdAt: 'desc' })
      .limit(20);

    return res.json(notification);
  }

  async update(req, res) {
    const notifications = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: false },
      { new: true }
    );

    return res.json(notifications);
  }
}
export default new NotificationController();
