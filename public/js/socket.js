const socket = io();

export const userJoin = (username, role, savedUUID, callback) => {
    socket.emit('user join', username, role, savedUUID, (response) => {
        callback(response);
    });
};

export const onPartyUpdate = (callback) => {
    socket.on('party update', (partyMembers) => {
        callback(partyMembers);
    });
};

export const userLeave = (userId) => {
    socket.emit('user leave', userId);
};

export const onConnect = (callback) => {
    socket.on('connect', callback);
};

export const disconnectSocket = () => {
    socket.disconnect();
};

export const connectSocket = () => {
    socket.connect();
};

export const updateStat = (userId, username, statName, statValue, callback) => {
    socket.emit('stat update', userId, username, statName, statValue, (response) => {
        callback(response);
    });
};

export const addNpc = (userId, name, init, currentHp, maxHp, callback) => {
    socket.emit('add npc', userId, name, init, currentHp, maxHp, (response) => {
        callback(response);
    });
};

export const removeNpc = (userId, name, callback) => {
    socket.emit('remove npc', userId, name, (response) => {
        callback(response);
    });
};