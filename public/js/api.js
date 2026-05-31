import { get, set, del } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

const sheetId = 'sheet';

export const saveSheet = async (data) => {
    try {
        await set(sheetId, data);
    } catch (e) {
        throw new Error('IndexedDB write error: ' + e);
    }
};

export const loadSheet = async () => {
    try {
        return await get(sheetId);
    } catch (e) {
        throw new Error('IndexedDB read error: ' + e);
    }
};

export const removeSheet = async () => {
    try {
        await del(sheetId);
    } catch (e) {
        throw new Error('IndexedDB deletion error: ' + e);
    }
};