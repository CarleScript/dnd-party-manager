import { userJoin, onPartyUpdate, userLeave, onConnect, disconnectSocket, connectSocket, updateStat, addNpc, removeNpc } from "./socket.js";

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
    playerList: document.getElementById('player-list'),
    addNpcBtn: document.getElementById('btn-add-npc'),
    leaveBtn: document.getElementById('btn-leave'),
    npcModal: document.getElementById('modal-npc'),
    closeModalBtn: document.getElementById('btn-close-modal'),
    npcForm: document.getElementById('form-npc')
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
    views.forEach(([element, name]) => { element.classList.toggle('hidden', name !== view) });

    if (view === 'room') {
        const isMaster = state.session.role === 'master';
        DOM.addNpcBtn.classList.toggle('hidden', !isMaster);
    }

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

const handleClick = (e) => {
    const deleteBtn = e.target.closest('.btn-delete-npc');
    if (deleteBtn) {
        const playerCard = deleteBtn.closest('.player-card');
        if (playerCard) {
            e.preventDefault();
            e.target.blur();
            const npcName = playerCard.dataset.id;
            removeNpc(state.session.id, npcName, (response) => {
                if (response.status === 'ok') {
                    return;
                }
                console.warn('NPC remove rejected by server: ', response.message);
                alert('Fight the monster without cheats, you cowardly piece of shit!');
                location.reload();
            });
        }
    }
};

const handleMousedown = (e) => {
    const container = e.target.closest('.player-initiative, .hp-group');
    if (container) {
        const editableSpan = container.querySelector('[contenteditable="true"]');
        if (editableSpan && e.target !== editableSpan) {
            e.preventDefault();
            editableSpan.focus();
        }
    }
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

    updateStat(state.session.id, playerName, inputName, inputValue, (response) => {
        if (response.status === 'ok') {
            return;
        }
        console.warn('Stat modification rejected by server: ', response.message);
        alert("Don't tempt my patience, you miserable cheat. Stick to the rules or fuck off.");
        location.reload();
    });
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
    const isEditing = activeEl && DOM.playerList.contains(activeEl);

    if (isEditing) {
        console.warn('Socket updates paused: User is currently editing a field to prevent focus loss.');
        return;
    }

    DOM.playerList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const { username, role } = state.session;

    (state.players || [])
        .filter(p => p.role !== 'master')
        .sort((a, b) => b.initiative - a.initiative)
        .forEach(player => {
            const editable = (username === player.username || role === 'master');
            const playerName = player.username;
            const showDeleteNpcBtn = role === 'master' && player.role === 'npc';
            const cardClasses = ['player-card'];
            if (!player.online) cardClasses.push('offline');
            else if (player.role === 'npc') cardClasses.push('npc');
            if (username === player.username) cardClasses.push('self');

            const playerCard = el('div', {
                className: cardClasses.join(' '),
                dataset: { id: playerName }
            }, [
                el('div', { className: 'player-info' }, [
                    el('h3', { text: player.username }),
                    el('p', { className: 'stat player-hp' }, [
                        el('span', { className: 'hp-group' }, [
                            el('span', { text: 'HP: ' }),
                            el('span', {
                                className: 'current-hp-value',
                                text: (role !== 'master' && player.role === 'npc') ? '?' : String(player.currentHp),
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
                                text: (role !== 'master' && player.role === 'npc') ? '?' : String(player.maxHp),
                                ...(editable && {
                                    editable: 'true',
                                    attrs: { inputmode: 'numeric' },
                                    dataset: { field: 'maxHp', maxlength: 3 }
                                })
                            })
                        ])
                    ])
                ]),
                showDeleteNpcBtn ? el('button', {
                    className: 'btn-secondary btn-delete-npc',
                    text: 'SLAY'
                }) : null,
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

DOM.playerList.addEventListener('click', handleClick);
DOM.playerList.addEventListener('mousedown', handleMousedown);

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
    if (document.visibilityState === 'hidden') {
        document.activeElement?.blur();
        disconnectSocket();
    } else {
        connectSocket();
    }
});

const handleJoin = () => {
    if (!state.config) {
        console.warn('System initialization in progress. Please wait.');
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
        alert('DO NOT MODIFY MY HTML, YOU FILTHY SCUM!');
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

const openNpcModal = () => {
    DOM.npcForm.reset();
    DOM.npcModal.returnValue = '';
    DOM.npcModal.showModal();
};

const closeNpcModal = () => {
    if (DOM.npcModal.returnValue !== 'confirm') return;

    if (!state.config) {
        console.warn('System initialization in progress. Please wait.');
        alert(`The adventure isn't ready yet. Please try again in a moment.`);
        return;
    }

    const formData = new FormData(DOM.npcForm);
    let { name, init, currentHp, maxHp } = Object.fromEntries(formData);

    name = name.trim();
    init = parseInt(init, 10);
    currentHp = parseInt(currentHp, 10);
    maxHp = parseInt(maxHp, 10);

    if (!name) {
        alert(`What kind of Master can't think of a motherfucking name?!`);
        return;
    }
    if (name.length > state.config.maxNameLength) {
        alert('Nobody is impressed by your novel-length title. Keep it short!');
        return;
    }

    const isInitNotOk = (!isNaN(init) && String(init).length > state.config.maxInitDigits);
    const isCurrentHpNotOk = (!isNaN(currentHp) && String(currentHp).length > state.config.maxHpDigits);
    const isMaxHpNotOk = (!isNaN(maxHp) && String(maxHp).length > state.config.maxHpDigits);

    if (isInitNotOk || isCurrentHpNotOk || isMaxHpNotOk) {
        const stat = isInitNotOk ? 'initiative' : isCurrentHpNotOk ? 'current hp' : 'max hp';
        alert(`How the fuck did you manage to send a wrong ${stat} value?`);
        return;
    }

    addNpc(state.session.id, name, init, currentHp, maxHp, (response) => {
        if (response.status === 'ok') {
            return;
        }
        console.warn('NPC add rejected by server: ', response.message);
        switch (response.message) {
            case 'forbidden':
                alert(`You're not the Master. Stay back, you filthy rogue!`);
                break;
            case 'name already taken':
                alert('This name has already taken. Add a number at the end or something...');
                break;
            default:
                alert('The NPC failed to materialize. Try again, loser.');
                location.reload();
                break;
        }
    });
}

const init = async () => {
    await loadConfig();

    DOM.joinBtn.addEventListener('click', handleJoin);
    DOM.leaveBtn.addEventListener('click', handleLeave);
    DOM.addNpcBtn.addEventListener('click', openNpcModal);
    DOM.closeModalBtn.addEventListener('click', () => DOM.npcModal.close(''));

    DOM.npcModal.addEventListener('click', (e) => {
        if (e.target === DOM.npcModal) DOM.npcModal.close('');
    });
    DOM.npcModal.addEventListener('close', closeNpcModal);

    DOM.usernameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleJoin();
    });

    const { id } = getSession();
    if (!id) toggleViews('login');
};

init();