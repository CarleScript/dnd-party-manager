import dotenv from 'dotenv';
dotenv.config();

const _config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    storageKey: process.env.USER_STATE_STORAGE_KEY || 'dnd_default_state_key',
    roomCapacity: process.env.ROOM_CAPACITY || 10,
    maxNameLength: process.env.MAX_NAME_LENGTH || 30,
    maxInitDigits: process.env.MAX_INIT_DIGITS || 2,
    maxHpDigits: process.env.MAX_HP_DIGITS || 3,
    socketDisconnectTimeout: process.env.SOCKET_DISCONNECT_TIMEOUT_MS || 600000
};

export const config = Object.freeze(_config);