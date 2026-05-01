import { userJoin, onPartyUpdate, userLeave, onConnect, disconnectSocket, connectSocket, updateStat } from "./socket.js";

const state = {
    players: [],
    config: null,
    session: {
        id: null,
        username: null,
        role: null,
        view: null
    }
};

const DOM = {
    loginView: document.getElementById('login-view'),
    roomView: document.getElementById('room-view'),
    usernameInput: document.getElementById('username'),
    roleInputs: document.getElementsByName('userRole'),
    joinBtn: document.getElementById('btn-join'),
    leaveBtn: document.getElementById('btn-leave'),
    playerList: document.getElementById('player-list')
};

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        state.config = await res.json();
    } catch (e) {
        console.error('Failed to retrieve server configuration: ', e);
        alert('You rolled a Natural 1 while reaching the server. Please refresh and try again.');
    }
}

const toggleViews = (view) => {
    const views = [[DOM.loginView, 'login'], [DOM.roomView, 'room']];
    views.forEach(([element, name]) => {
        if (name === view) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    });
    if (view === 'login') DOM.usernameInput.focus();
};

const initSession = (userState) => {
    localStorage.setItem(state.config.storageKey, JSON.stringify(userState));
    state.session = { ...userState };
};

const clearSession = () => {
    localStorage.removeItem(state.config.storageKey);
    state.session = {
        id: null,
        username: null,
        role: null,
        view: null
    }
};

const getSession = () => {
    if (!state.session.id) {
        const savedSession = localStorage.getItem(state.config?.storageKey);
        if (savedSession) {
            try {
                state.session = JSON.parse(savedSession);
            } catch (e) {
                console.error('LocalStorage session parse error: ', e);
                clearSession();
                toggleViews('login');
            }
        }
    }
    return state.session;
};

const moveCursorToEnd = (el) => {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
};

const handleFocus = (target) => {
    setTimeout(() => moveCursorToEnd(target), 0);
};

const checkInput = (e) => {
    const { key, ctrlKey, altKey, metaKey, target } = e;

    if (ctrlKey || altKey || metaKey || key.startsWith('F')) return;

    if (key === 'Escape') {
        target.textContent = target.dataset.oldValue;
        target.blur();
        return;
    }

    if (key === 'Enter') {
        e.preventDefault();
        target.blur();
        return;
    }

    const isNumber = /^[0-9]$/.test(key);
    const isControl = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape'].includes(key);

    if (!isNumber && !isControl) return e.preventDefault();

    if (isNumber) {
        const currentText = target.textContent;
        const hasSelection = window.getSelection().toString().length > 0;

        if (currentText === '0' && !hasSelection) {
            e.preventDefault();
            target.textContent = key;
            moveCursorToEnd(target);
            return;
        }

        const maxLength = parseInt(target.dataset?.maxlength, 10) || 2;

        if (currentText.length >= maxLength && !hasSelection) {
            e.preventDefault();
        }
    }
};

const preventInput = (e) => {
    const { target } = e;
    const maxLength = parseInt(target.dataset?.maxlength, 10) || 2;
    const dynamicRegex = new RegExp(`^[0-9]{1,${maxLength}}$`);
    if (!dynamicRegex.test(target.textContent)) target.textContent = '0';
    moveCursorToEnd(target);
};

const updateInput = (e, inputName) => {
    const { target } = e;
    const currentText = target.textContent.trim();

    if (currentText === '') {
        target.textContent = '0';
    }

    const inputValue = parseInt(target.textContent, 10);

    if (isNaN(inputValue)) {
        target.textContent = '0';
        return;
    }

    const playerCard = target.closest('.player-card');
    const playerName = playerCard.dataset.id;

    updateStat(playerName, inputName, inputValue)
};

const el = (tag, options = {}, children = []) => {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    if (options.editable) element.contentEditable = options.editable;

    if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, val]) => element.setAttribute(key, val));
    }

    if (options.dataset) {
        Object.entries(options.dataset).forEach(([key, val]) => element.dataset[key] = val);
    }

    children.forEach(child => {
        if (child) element.appendChild(child);
    });

    return element;
};

const renderPlayerList = () => {
    const activeEl = document.activeElement;
    const isEditing = activeEl && activeEl.isContentEditable && DOM.playerList.contains(activeEl);

    if (isEditing) {
        console.warn('Socket updates paused: User is currently editing a field to prevent focus loss.');
        return;
    }

    DOM.playerList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const { username, role } = state.session;

    state.players
        .filter(p => p.role !== 'master')
        .sort((a, b) => b.initiative - a.initiative)
        .forEach(player => {
            const editable = (username === player.username || role === 'master');
            const playerName = player.username;

            const playerCard = el('div', {
                className: `player-card ${!player.online ? 'offline' : ''}`,
                dataset: { id: playerName }
            }, [
                el('div', { className: 'player-info' }, [
                    el('h3', { text: player.username }),
                    el('p', { className: 'stat player-hp' }, [
                        el('span', { className: 'hp-group' }, [
                            el('span', { text: 'HP: ' }),
                            el('span', {
                                className: 'current-hp-value',
                                text: String(player.currentHp),
                                ...(editable && {
                                    editable: 'true',
                                    attrs: { inputmode: 'numeric' },
                                    dataset: { field: 'currentHp', maxlength: 3 }
                                })
                            })
                        ]),
                        el('span', { className: 'hp-group' }, [
                            el('span', { text: '/' }),
                            el('span', {
                                className: 'max-hp-value',
                                text: String(player.maxHp),
                                ...(editable && {
                                    editable: 'true',
                                    attrs: { inputmode: 'numeric' },
                                    dataset: { field: 'maxHp', maxlength: 3 }
                                })
                            })
                        ])
                    ])
                ]),
                el('div', { className: 'player-initiative' }, [
                    el('span', { className: 'init-label', text: 'Init' }),
                    el('span', {
                        className: 'init-value',
                        text: String(player.initiative),
                        ...(editable && {
                            editable: 'true',
                            attrs: { inputmode: 'numeric' },
                            dataset: { field: 'init', maxlength: 2 }
                        })
                    })
                ])
            ]);

            fragment.appendChild(playerCard);
        });

    DOM.playerList.appendChild(fragment);
};

DOM.playerList.addEventListener('mousedown', (e) => {
    const container = e.target.closest('.player-initiative, .hp-group');
    if (container) {
        const editableSpan = container.querySelector('[contenteditable="true"]');
        if (editableSpan && e.target !== editableSpan) {
            e.preventDefault();
            editableSpan.focus();
        }
    }
});

const EDITABLE_FIELDS = ['init', 'currentHp', 'maxHp'];

DOM.playerList.addEventListener('focusin', (e) => {
    if (EDITABLE_FIELDS.includes(e.target.dataset?.field)) {
        e.target.dataset.oldValue = e.target.textContent;
        handleFocus(e.target);
    }
});

DOM.playerList.addEventListener('keydown', (e) => {
    if (EDITABLE_FIELDS.includes(e.target.dataset?.field)) checkInput(e);
});

DOM.playerList.addEventListener('input', (e) => {
    if (EDITABLE_FIELDS.includes(e.target.dataset?.field)) preventInput(e);
});

DOM.playerList.addEventListener('focusout', (e) => {
    if (EDITABLE_FIELDS.includes(e.target.dataset?.field)) updateInput(e, e.target.dataset?.field);
});

onPartyUpdate((partyMembers) => {
    state.players = partyMembers;
    renderPlayerList();
});

const addPlayer = (name, role, savedUUID = null, isAutoRejoin = false) => {
    userJoin(name, role, savedUUID, (response) => {
        if (response.status === 'ok') {
            const userState = { id: response.userId, username: name, role: role, view: 'room' };
            initSession(userState);
            toggleViews('room');
            if (!isAutoRejoin) DOM.usernameInput.value = '';
        } else {
            console.warn('Join request rejected by server: ', response.message);

            if (isAutoRejoin && response.message === 'session expired') {
                clearSession();
                toggleViews('login');
                return;
            }

            switch (response.message) {
                case 'session expired':
                    alert('You failed your Saving Throw against Disconnection. Please sign in again.');
                    clearSession();
                    toggleViews('login');
                    break;
                case 'username already taken':
                    alert('This name has already been claimed. Be original and choose a new alias.');
                    break;
                case 'master role already taken':
                    alert(`The Master's throne is already occupied. You must join as a player.`);
                    break;
                case 'room full':
                    alert('The party is already at its limit. Wait for an adventurer to leave before attempting to join.');
                    break;
                default:
                    alert('The party is currently inaccessible. Please try again.');
                    location.reload();
                    break;
            }
        }
    });
};

onConnect(() => {
    const { username, role, id } = getSession();
    if (id) addPlayer(username, role, id, true);
});

document.addEventListener('visibilitychange', () => {
    window.focus();
    if (document.visibilityState === 'hidden') {
        disconnectSocket();
    } else {
        connectSocket();
    }
});

const handleJoin = () => {
    if (!state.config) {
        console.warn("System initialization in progress. Please wait.");
        alert(`The adventure isn't ready yet. Please try again in a moment.`);
        return;
    }

    const username = DOM.usernameInput.value.trim();
    if (!username) {
        alert('Enter a valid name, you fucking moron')
        DOM.usernameInput.focus();
        return;
    }
    if (username.length > state.config.maxNameLength) {
        alert('Your name is too long, motherfucking narcissist');
        DOM.usernameInput.value = 'Douchebag';
        return;
    }

    const role = Array.from(DOM.roleInputs).find(input => input.checked)?.value;
    if (!role || !['player', 'master'].includes(role)) {
        alert('DO NOT MODIFY MY HTML, YOU FILTHY BITCH!');
        location.reload();
        return;
    }

    addPlayer(username, role);
};

const handleLeave = () => {
    if (state.session.id) {
        userLeave(state.session.id);
        clearSession();
    }
    toggleViews('login');
}

const init = async () => {
    await loadConfig();

    DOM.joinBtn.addEventListener('click', handleJoin);
    DOM.leaveBtn.addEventListener('click', handleLeave);
    DOM.usernameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleJoin();
    });

    const { id } = getSession();
    if (!id) toggleViews('login');
};

init();