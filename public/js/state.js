export const state = {
    players: [],
    config: null,
    session: {
        id: null,
        username: null,
        role: null,
        view: null
    }
};

export const initSession = (userState) => {
    localStorage.setItem(state.config.storageKey, JSON.stringify(userState));
    state.session = { ...userState };
};

export const clearSession = () => {
    localStorage.removeItem(state.config.storageKey);
    state.session = {
        id: null,
        username: null,
        role: null,
        view: null
    }
};

export const getSession = () => {
    if (!state.session.id) {
        const savedSession = localStorage.getItem(state.config?.storageKey);
        if (savedSession) {
            try {
                state.session = JSON.parse(savedSession);
            } catch (e) {
                console.error('LocalStorage session parse error: ', e);
                clearSession();
                return {};
            }
        }
    }
    return state.session;
};