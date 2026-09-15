const mongoose = require('mongoose');
const {env} = require('./env');

const READY_STATES = Object.freeze({
  0: 'DISCONNECTED',
  1: 'CONNECTED',
  2: 'CONNECTING',
  3: 'DISCONNECTING',
});

let listenersRegistered = false;

function registerConnectionListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('error', error => {
    console.error(`[MongoDB] Connection error: ${error?.name || 'UnknownError'}`);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected');
  });
}

function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState;
  return {
    readyState,
    state: READY_STATES[readyState] || 'UNKNOWN',
    database: readyState === 1 ? mongoose.connection.name : null,
  };
}

async function connectDatabase(mongodbUri = env.mongodbUri) {
  if (!mongodbUri) throw new Error('MONGODB_URI is not configured');
  if (mongoose.connection.readyState === 1) return getDatabaseStatus();

  registerConnectionListeners();
  try {
    await mongoose.connect(mongodbUri);
    const status = getDatabaseStatus();
    console.log('[MongoDB] Connected');
    console.log(`[MongoDB] Database: ${status.database}`);
    return status;
  } catch (error) {
    console.error(`[MongoDB] Connection failed: ${error?.name || 'UnknownError'}`);
    throw new Error('MongoDB connection failed');
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

module.exports = {connectDatabase, disconnectDatabase, getDatabaseStatus};
