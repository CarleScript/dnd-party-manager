import { get, set, del } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

export const saveSheet = async (id, data) => {
    await set(id, data);
};

export const loadSheet = async (id) => {
    return await get(id);
};

export const removeSheet = async (id) => {
    await del(id);
};