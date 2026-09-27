const cors = require('cors');
const express = require('express');
const apiRoutes = require('./src/routes');
const {env} = require('./src/config/env');
const {apiLimiter} = require('./src/middleware/rateLimit');
const {notFound, errorHandler} = require('./src/middleware/errorHandler');

const app = express();
const clientUrl = env.clientUrl;

app.disable('x-powered-by');
app.use(cors({origin: clientUrl}));
app.use(express.json());
app.use(apiLimiter);

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
