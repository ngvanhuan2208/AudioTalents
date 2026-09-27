const path = require('path');
require('dotenv').config({path: path.join(__dirname, '.env'), quiet: true});

const app = require('./app');
const {env} = require('./src/config/env');
const {connectDatabase, disconnectDatabase} = require('./src/config/database');

const defaultPort = env.port;
let httpServer;
let isShuttingDown = false;

async function startServer({databaseUri = env.mongodbUri, port = defaultPort} = {}) {
  await connectDatabase(databaseUri);
  httpServer = app.listen(port, () => {
    console.log(`AudioTalents API listening on port ${port}`);
  });
  return httpServer;
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] ${signal} received, shutting down`);

  try {
    if (httpServer) await new Promise((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error(`[Server] Shutdown failed: ${error?.name || 'UnknownError'}`);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer().catch(async error => {
    console.error(`[Server] Startup failed: ${error.message}`);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
}

module.exports = {startServer, shutdown};
