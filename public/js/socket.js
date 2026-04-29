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

export const updateStat = (username, statName, statValue) => {
    socket.emit('stat update', username, statName, statValue);
};