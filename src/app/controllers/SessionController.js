import jwt from 'jsonwebtoken';
import * as Yup from 'yup';
import AuthConfig from '../../config/Auth';
import User from '../models/User';
import File from '../models/files';

class SessionController {
  async store(req, res) {
    const schema = Yup.object().shape({
      email: Yup.string().email().required(),
      password: Yup.string().required(),
    });
    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validação falhou :c' });
    }
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: File,
          as: 'avatar',
          attributes: ['id', 'path', 'url'],
        },
      ],
    });
    console.log(` na variável user: ${user}`);
    if (!user) {
      return res.status(401).json({ error: 'usuário não encontrado.' });
    }

    if (!(await user.checkPassword(password))) {
      return res.status(401).json({ error: 'senha inválida.' });
    }

    const { name, id, avatar, provider } = user;

    return res.json({
      user: {
        id,
        name,
        email,
        provider,
        avatar,
      },
      token: jwt.sign({ id }, AuthConfig.secret, {
        expiresIn: AuthConfig.expiresIn,
      }),
    });
  }
}
export default new SessionController();
