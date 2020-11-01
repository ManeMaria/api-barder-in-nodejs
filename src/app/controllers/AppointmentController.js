import * as Yup from 'yup';
import { parseISO, startOfHour, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/files';
import Notification from '../Schemas/Notifications';
import Mail from '../../lib/mail';

import Appointment from '../models/Appointment';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 10,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validação falhou :c' });
    }

    const { provider_id, date } = req.body;
    /**
     * Checar se quem está logando realmente é um provedor.
     */
    const checkProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!checkProvider) {
      return res.status(401).json({
        error: 'você só pode criar um compromisso com um provedor.',
      });
    }
    /*
     * checar as datas anteriores
     */
    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res
        .status(400)
        .json({ error: 'data ateriores não são permitidas' });
    }

    /*
     * checar as validações das datas
     */

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(401).json({
        error: 'a data de agendamento não está disponível',
      });
    }
    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id: req.body.provider_id,
      date,
    });

    if (req.userId === provider_id) {
      return res.status(401).json({
        error: 'não é possível autoagendamentos.',
      });
    }

    /**
     * Notificar prestador de serviço.
     */
    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart,
      " 'No dia ' dd,' no mês de ' MMMM ' às ' H:mm ' vai rolar uma putaria.'",
      {
        locale: pt,
      }
    );
    await Notification.create({
      content: `Uma mensagem qualquer como id ${user.name} teste para ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });
    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        error: 'você não ter permissão para cancelar o agendamento.',
      });
    }
    const dateWithSub = subHours(appointment.date, 2);
    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error:
          'você só pode cancelar os agendamentos com mais de 2 horas de antecedência.',
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'agendamento cancelado',
      template: 'cancelletion',
      context: {
        provider_id: appointment.provider.name,
        user: appointment.user.name,
        date: format(
          appointment.date,
          " 'No dia ' dd,' no mês de ' MMMM ' às ' H:mm ' vai rolar uma putaria.'",
          {
            locale: pt,
          }
        ),
      },
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
