import { config } from './../config/env.js';
import { v4 as uuidv4 } from 'uuid';

const partyMembers = {};

const getPartyData = (userId) => {
    const isMaster = partyMembers[userId]?.role === 'master';
    return Object.values(partyMembers).map(user => ({
        username: user.username,
        role: user.role,
        initiative: user.initiative,
        currentHp: (!isMaster && user.role === 'npc') ? '?' : user.currentHp,
        maxHp: (!isMaster && user.role === 'npc') ? '?' : user.maxHp,
        online: user.online
    }));
};

const broadcastPartyUpdate = (io) => {
    io.emit('party update', getPartyData(null));

    Object.keys(partyMembers).forEach(id => {
        const user = partyMembers[id];
        if (user.role === 'master' && user.online && user.socketId) {
            io.to(user.socketId).emit('party update', getPartyData(id));
        }
    });
};

const removePlayer = (io, userId) => {
    if (partyMembers[userId]) {
        console.log(`${new Date().toLocaleTimeString()}: user ${partyMembers[userId].username} removed`);
        delete partyMembers[userId];
        broadcastPartyUpdate(io);
    }
};

const setupPlayerListSocket = (io) => {
    io.on('connection', (socket) => {
        const recipientId = Object.keys(partyMembers).find((id) => partyMembers[id]?.socketId === socket.id);
        broadcastPartyUpdate(io);

        socket.on('user join', (rawUsername, role, savedUUID, callback) => {
            if (typeof callback !== 'function') return;

            const username = rawUsername?.trim();

            if (savedUUID) {
                if (partyMembers[savedUUID]) {
                    const userId = savedUUID;

                    if (partyMembers[savedUUID].cleanupTimer) {
                        clearTimeout(partyMembers[savedUUID].cleanupTimer);
                        partyMembers[userId].cleanupTimer = null;
                    }

                    partyMembers[userId].username = username;
                    partyMembers[userId].role = role;
                    partyMembers[userId].online = true;
                    partyMembers[userId].socketId = socket.id;

                    callback({ status: 'ok', userId: savedUUID });
                    console.log(`${new Date().toLocaleTimeString()}: user ${partyMembers[userId].username} reconnected`);
                    broadcastPartyUpdate(io);
                    return;
                } else {
                    return callback({
                        status: 'error',
                        message: 'session expired'
                    });
                }
            }

            if (!username || username.length > config.maxNameLength) {
                return callback({
                    status: 'error',
                    message: 'invalid username'
                });
            }

            const nameTaken = Object.values(partyMembers).some(p => p.username === username);
            if (nameTaken) {
                return callback({
                    status: 'error',
                    message: 'username already taken'
                });
            }

            if (!['player', 'master'].includes(role)) {
                return callback({
                    status: 'error',
                    message: 'invalid role'
                });
            }

            if (role === 'master') {
                const masterTaken = Object.values(partyMembers).some(p => p.role === 'master');
                if (masterTaken) {
                    return callback({
                        status: 'error',
                        message: 'master role already taken'
                    });
                }
            }

            const currentPlayers = Object.values(partyMembers).filter((p) => p.role !== 'npc').length;
            if (currentPlayers >= config.roomCapacity) {
                return callback({
                    status: 'error',
                    message: 'room full'
                });
            }

            const userId = uuidv4();
            partyMembers[userId] = {
                username: username,
                role: role,
                initiative: 0,
                currentHp: 0,
                maxHp: 0,
                online: true,
                socketId: socket.id
            };

            callback({ status: 'ok', userId: userId });
            console.log(`${new Date().toLocaleTimeString()}: user ${partyMembers[userId].username} connected`);
            broadcastPartyUpdate(io);
        });

        socket.on('user leave', (userId) => {
            removePlayer(io, userId);
        });

        socket.on('disconnect', () => {
            const userId = Object.keys(partyMembers).find(id => partyMembers[id].socketId === socket.id);
            if (userId) {
                const user = partyMembers[userId];
                console.log(`${new Date().toLocaleTimeString()}: user ${partyMembers[userId].username} disconnected`);
                user.online = false;
                user.socketId = null;

                user.cleanupTimer = setTimeout(() => {
                    removePlayer(io, userId);
                }, config.socketDisconnectTimeout);

                broadcastPartyUpdate(io);
            }
        });

        socket.on('stat update', (savedUUID, rawUsername, statName, statValue, callback) => {
            if (typeof callback !== 'function') return;

            const username = rawUsername?.trim();
            const userId = Object.keys(partyMembers).find(id => partyMembers[id].username === username);

            if (!partyMembers[savedUUID] || (savedUUID !== userId && partyMembers[savedUUID].role !== 'master')) {
                return callback({
                    status: 'error',
                    message: 'forbidden'
                });
            }

            if (!userId) {
                return callback({
                    status: 'error',
                    message: 'invalid username'
                });
            }

            const nStatValue = parseInt(statValue, 10);
            if (isNaN(nStatValue)) {
                return callback({
                    status: 'error',
                    message: `invalid ${statName} value`
                });
            }

            const maxStatDigit = statName === 'init' ? config.maxInitDigits : config.maxHpDigits;
            if (String(nStatValue).length > maxStatDigit) {
                return callback({
                    status: 'error',
                    message: `${statName} value is too long`
                });
            }

            if (statName === 'init') {
                partyMembers[userId].initiative = nStatValue;
            } else if (statName === 'currentHp') {
                partyMembers[userId].currentHp = nStatValue;
            } else if (statName === 'maxHp') {
                partyMembers[userId].maxHp = nStatValue;
            }

            callback({ status: 'ok' });
            broadcastPartyUpdate(io);
        });


        socket.on('add npc', (userId, rawName, init, currentHp, maxHp, callback) => {
            if (typeof callback !== 'function') return;

            if (!partyMembers[userId] || partyMembers[userId].role !== 'master') {
                return callback({
                    status: 'error',
                    message: 'forbidden'
                });
            }

            const name = rawName?.trim();
            if (!name || name.length > config.maxNameLength) {
                return callback({
                    status: 'error',
                    message: 'invalid name'
                });
            }

            const nameTaken = Object.values(partyMembers).some((p) => p.username === name);
            if (nameTaken) {
                return callback({
                    status: 'error',
                    message: 'name already taken'
                });
            }

            const nInit = parseInt(init, 10);
            const nCurrentHp = parseInt(currentHp, 10);
            const nMaxHp = parseInt(maxHp, 10);

            const isInitNotOk = (isNaN(nInit) || String(nInit).length > config.maxInitDigits);
            const isCurrentHpNotOk = (isNaN(nCurrentHp) || String(nCurrentHp).length > config.maxHpDigits);
            const isMaxHpNotOk = (isNaN(nMaxHp) || String(nMaxHp).length > config.maxHpDigits);

            if (isInitNotOk || isCurrentHpNotOk || isMaxHpNotOk) {
                const stat = isInitNotOk ? 'initiative' : isCurrentHpNotOk ? 'current hp' : 'max hp';
                return callback({
                    status: 'error',
                    message: `invalid ${stat} value`
                });
            }

            partyMembers[name] = {
                username: name,
                role: 'npc',
                initiative: init,
                currentHp: currentHp,
                maxHp: maxHp,
                online: true,
            };

            callback({ status: 'ok' });
            console.log(`${new Date().toLocaleTimeString()}: NPC ${name} added by master ${partyMembers[userId].username}`);
            broadcastPartyUpdate(io);
        });

        socket.on('remove npc', (savedUUID, rawName, callback) => {
            if (typeof callback !== 'function') return;

            if (!partyMembers[savedUUID] || partyMembers[savedUUID].role !== 'master') {
                return callback({
                    status: 'error',
                    message: 'forbidden'
                });
            }
            const name = rawName?.trim();
            const userId = Object.keys(partyMembers).find(id => partyMembers[id].username === name);

            if (!userId) {
                return callback({
                    status: 'error',
                    message: 'invalid name'
                });
            }

            delete partyMembers[userId];

            callback({ status: 'ok' });
            console.log(`${new Date().toLocaleTimeString()}: NPC ${name} deleted by master ${partyMembers[savedUUID].username}`);
            broadcastPartyUpdate(io);
        });
    });
}

export default setupPlayerListSocket;