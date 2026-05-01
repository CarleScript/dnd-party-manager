import { config } from './../config/env.js';
import { v4 as uuidv4 } from 'uuid';

const partyMembers = {};

const getPartyData = () => {
    return Object.values(partyMembers).map(user => ({
        username: user.username,
        role: user.role,
        initiative: user.initiative,
        currentHp: user.currentHp,
        maxHp: user.maxHp,
        online: user.online
    }));
};

const removePlayer = (io, userId) => {
    if (partyMembers[userId]) {
        console.log(`${new Date().toLocaleTimeString()}: user ${partyMembers[userId].username} removed`);
        delete partyMembers[userId];
        io.emit('party update', getPartyData());
    }
};

const setupPlayerListSocket = (io) => {
    io.on('connection', (socket) => {
        socket.emit('party update', getPartyData());

        socket.on('user join', (rawUsername, role, savedUUID, callback) => {
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
                    io.emit('party update', getPartyData());
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

            const currentPlayers = Object.keys(partyMembers).length;
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
            io.emit('party update', getPartyData());
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

                io.emit('party update', getPartyData());
            }
        });

        socket.on('stat update', (rawUsername, statName, statValue) => {
            const username = rawUsername?.trim();
            const userId = Object.keys(partyMembers).find(id => partyMembers[id].username === username);
            if (userId) {
                if (statName === 'init') {
                    partyMembers[userId].initiative = statValue;
                } else if (statName === 'currentHp') {
                    partyMembers[userId].currentHp = statValue;
                }  else if (statName === 'maxHp') {
                    partyMembers[userId].maxHp = statValue;
                }
            }
            io.emit('party update', getPartyData());
        });
    });
}

export default setupPlayerListSocket;