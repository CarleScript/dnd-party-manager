import { config } from './../config/env.js';
import { sendError, sendSuccess } from '../utils/socketResponses.js';

const broadcastPartyUpdate = (io, partyManager) => {
    Object.values(partyManager.members).forEach(user => {
        if (!user.online || !user.socketId) return;
        const viewData = partyManager.getPartyData(user.id);
        io.to(user.socketId).emit('party update', viewData);
    });
};

const setupPlayerListSocket = (io, partyManager) => {
    io.on('connection', (socket) => {
        broadcastPartyUpdate(io, partyManager);

        socket.on('disconnect', () => {
            const user = partyManager.disconnectMember(socket.id);
            if (user) {
                user.cleanupTimer = setTimeout(() => {
                    if (!user.online) {
                        partyManager.removeMember(user.id);
                        broadcastPartyUpdate(io, partyManager);
                    }
                }, config.socketDisconnectTimeout);

                broadcastPartyUpdate(io, partyManager);
            }
        });

        socket.on('user leave', (userId) => {
            partyManager.removeMember(userId);
            broadcastPartyUpdate(io, partyManager);
        });

        socket.on('user join', (rawUsername, role, savedUUID, callback) => {
            if (typeof callback !== 'function') return;

            if (savedUUID) {
                const result = partyManager.reconnectMember(savedUUID, { socketId: socket.id });
                if (result.error) return sendError(callback, result.error);

                broadcastPartyUpdate(io, partyManager);
                return sendSuccess(callback, { userId: savedUUID });
            }

            const result = partyManager.addMember({ rawUsername, role, socketId: socket.id });
            if (result.error) return sendError(callback, result.error);

            broadcastPartyUpdate(io, partyManager);
            return sendSuccess(callback, { userId: result.userId });
        });

        socket.on('remove npc', (savedUUID, rawName, callback) => {
            if (typeof callback !== 'function') return;

            const result = partyManager.removeNpc(savedUUID, { rawName });
            if (result.error) return sendError(callback, result.error);

            broadcastPartyUpdate(io, partyManager);
            return sendSuccess(callback);
        });

        socket.on('add npc', (userId, rawName, init, currentHp, maxHp, callback) => {
            if (typeof callback !== 'function') return;

            const result = partyManager.addNpc(userId, { rawName, init, currentHp, maxHp });
            if (result.error) return sendError(callback, result.error);

            broadcastPartyUpdate(io, partyManager);
            return sendSuccess(callback);
        });

        socket.on('stat update', (savedUUID, rawUsername, statName, statValue, callback) => {
            if (typeof callback !== 'function') return;

            const result = partyManager.updateStat(savedUUID, { rawUsername, statName, statValue });
            if (result.error) return sendError(callback, result.error);

            broadcastPartyUpdate(io, partyManager);
            return sendSuccess(callback);
        });
    });
}

export default setupPlayerListSocket;