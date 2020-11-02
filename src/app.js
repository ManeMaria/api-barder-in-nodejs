require('dotenv').config();

const express = require('express');
const path = require('path');
const Sentry = require('@sentry/node');
const cors = require('cors');
const Youch = require('youch');
require('express-async-errors');

const routes = './routes';
require('./database/index');
const SentryConfig = require('./config/SentryConfig');

class App {
  constructor() {
    this.server = express();

    Sentry.init(SentryConfig);

    this.middlewares();
    this.routes();
    this.exceptionHandler();
  }

  middlewares() {
    this.server.use(Sentry.Handlers.requestHandler());
    this.server.use(cors());
    this.server.use(express.json());
    this.server.use(
      '/files',
      express.static(path.resolve(__dirname, '..', 'tmp', 'uploads'))
    );
  }

  routes() {
    this.server.use(routes);
    this.server.use(Sentry.Handlers.errorHandler());
  }

  exceptionHandler() {
    this.server.use(async (err, req, res, next) => {
      if (process.env.NODE_ENV === 'development') {
        const errors = await new Youch(err, req).toJSON();

        return res.status(500).json(errors);
      }
      return res.status(500).json({ error: 'erro interno do servidor' });
    });
  }
}

module.exports = new App().server;
