import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';

class PartyManager {
    constructor() {
        this.members = {};
    }

    getPartyData(userId) {
        const isMaster = this.members[userId]?.role === 'master';
        return Object.values(this.members).map(member => ({
            username: member.username,
            role: member.role,
            initiative: member.initiative,
            currentHp: (!isMaster && member.role === 'npc') ? '?' : member.currentHp,
            maxHp: (!isMaster && member.role === 'npc') ? '?' : member.maxHp,
            online: member.online
        }));
    }

    getMemberBySocketId(socketId) {
        return Object.values(this.members).find(m => m.socketId === socketId);
    }

    _getMemberIdByName(username) {
        if (!username) return null;
        return Object.keys(this.members).find(id =>
            this.members[id].username.toLowerCase() === username.toLowerCase()
        );
    }

    _checkIfNameTaken(username) {
        if (!username) return false;
        return Object.values(this.members).some(m => m.username.toLowerCase() === username.toLowerCase());
    }

    disconnectMember(socketId) {
        const member = this.getMemberBySocketId(socketId);
        if (!member) return null;

        member.online = false;
        member.socketId = null;

        console.log(`${new Date().toLocaleTimeString()}: ${member.role} ${member.username} disconnected`);
        return member;
    }

    removeMember(userId) {
        const member = this.members[userId];
        if (!member) return null;

        console.log(`${new Date().toLocaleTimeString()}: ${member.role} ${member.username} removed`);
        delete this.members[userId];
        return member;
    }

    reconnectMember(userId, { socketId }) {
        const member = this.members[userId];
        if (!member) return { error: 'session expired' };

        if (member.cleanupTimer) {
            clearTimeout(member.cleanupTimer);
            member.cleanupTimer = null;
        }

        member.online = true;
        member.socketId = socketId;

        console.log(`${new Date().toLocaleTimeString()}: ${member.role} ${member.username} reconnected`);
        return { success: true };
    }

    addMember({ rawUsername, role, socketId }) {
        const username = rawUsername?.trim();

        if (!username || username.length > config.maxNameLength) {
            return { error: 'invalid username' };
        }

        if (this._checkIfNameTaken(username)) {
            return { error: 'username already taken' };
        }

        if (!['player', 'master'].includes(role)) {
            return { error: 'invalid role' };
        }

        if (role === 'master') {
            const masterTaken = Object.values(this.members).some(m => m.role === 'master');
            if (masterTaken) return { error: 'master role already taken' };
        }

        const currentPlayers = Object.values(this.members).filter((m) => m.role !== 'npc').length;
        if (currentPlayers >= config.roomCapacity) return { error: 'room full' };

        const userId = uuidv4();
        this.members[userId] = {
            id: userId,
            username,
            role,
            initiative: 0,
            currentHp: 0,
            maxHp: 0,
            online: true,
            socketId
        };

        console.log(`${new Date().toLocaleTimeString()}: ${role} ${username} connected`);
        return { success: true, userId };
    }

    removeNpc(userId, { rawName }) {
        const name = rawName?.trim();

        if (!this.members[userId] || this.members[userId].role !== 'master') {
            return { error: 'forbidden' };
        }

        const npcId = this._getMemberIdByName(name);
        if (!npcId) return { error: 'invalid name' };

        console.log(`${new Date().toLocaleTimeString()}: NPC ${name} deleted by master ${this.members[userId].username}`);
        delete this.members[npcId];
        return { success: true };
    }

    addNpc(userId, { rawName, init, currentHp, maxHp }) {
        const name = rawName?.trim();

        const parsedInit = parseInt(init, 10);
        const parsedCurrentHp = parseInt(currentHp, 10);
        const parsedMaxHp = parseInt(maxHp, 10);

        if (!this.members[userId] || this.members[userId].role !== 'master') {
            return { error: 'forbidden' };
        }

        if (!name || name.length > config.maxNameLength) {
            return { error: 'invalid name' };
        }

        if (this._checkIfNameTaken(name)) {
            return { error: 'name already taken' };
        }

        const isInitInvalid = (isNaN(parsedInit) || String(parsedInit).length > config.maxInitDigits);
        const isCurrentHpInvalid = (isNaN(parsedCurrentHp) || String(parsedCurrentHp).length > config.maxHpDigits);
        const isMaxHpInvalid = (isNaN(parsedMaxHp) || String(parsedMaxHp).length > config.maxHpDigits);

        if (isInitInvalid || isCurrentHpInvalid || isMaxHpInvalid) {
            const stat = isInitInvalid ? 'initiative' : isCurrentHpInvalid ? 'current hp' : 'max hp';
            return { error: `invalid ${stat} value` };
        }

        const npcId = uuidv4();
        this.members[npcId] = {
            id: npcId,
            username: name,
            role: 'npc',
            initiative: parsedInit,
            currentHp: parsedCurrentHp,
            maxHp: parsedMaxHp,
            online: true,
        };

        console.log(`${new Date().toLocaleTimeString()}: NPC ${name} added by master ${this.members[userId].username}`);
        return { success: true };
    }

    updateStat(userId, { rawUsername, statName, statValue }) {
        const username = rawUsername?.trim();
        const parsedStatValue = parseInt(statValue, 10);

        const targetUserId = this._getMemberIdByName(username);
        if (!targetUserId) return { error: 'invalid username' };

        if (!this.members[userId] || (userId !== targetUserId && this.members[userId].role !== 'master')) {
            return { error: 'forbidden' };
        }

        if (isNaN(parsedStatValue)) return { error: `invalid ${statName} value` };

        const maxStatDigit = statName === 'init' ? config.maxInitDigits : config.maxHpDigits;
        if (String(parsedStatValue).length > maxStatDigit) return { error: `${statName} value is too long` };

        const statMap = { init: 'initiative', currentHp: 'currentHp', maxHp: 'maxHp' };
        const internalStatName = statMap[statName];
        if (!internalStatName) return { error: 'invalid stat name' };
        this.members[targetUserId][internalStatName] = parsedStatValue;

        return { success: true };
    }
}

export const partyManager = new PartyManager();