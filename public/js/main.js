import { userJoin, onPartyUpdate, userLeave, onConnect, disconnectSocket, connectSocket } from "./socket.js";

const state = {
    players: [],
    config: null
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
    } catch (err) {
        console.error('Failed to retrieve server configuration: ', err);
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

const el = (tag, options = {}, children = []) => {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    children.forEach(child => {
        if (child) element.appendChild(child);
    });
    return element;
};

const renderPlayerList = () => {
    DOM.playerList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.players
        .filter(p => p.role !== 'master')
        .forEach(player => {
            const playerCard = el('div', { className: `player-card ${!player.online ? 'offline' : ''}` }, [
                el('div', { className: 'player-info' }, [
                    el('h3', { text: player.username }),
                    el('p', { className: 'stat', text: 'HP: 6/9' })
                ]),
                el('div', { className: 'player-initiative' }, [
                    el('span', { className: 'init-label', text: 'Init' }),
                    el('span', { className: 'init-value', text: String(player.initiative) })
                ])
            ]);

            fragment.appendChild(playerCard);
        });


    DOM.playerList.appendChild(fragment);
};

onPartyUpdate((partyMembers) => {
    state.players = partyMembers;
    renderPlayerList();
});

const addPlayer = (name, role, savedUUID = null, isAutoRejoin = false) => {
    userJoin(name, role, savedUUID, (response) => {
        if (response.status === 'ok') {
            const userState = { id: response.userId, username: name, view: 'room', role: role };
            localStorage.setItem(state.config.storageKey, JSON.stringify(userState));
            toggleViews('room');
            if (!isAutoRejoin) DOM.usernameInput.value = '';
        } else {
            console.warn('Join request rejected by server: ', response.message);

            if (isAutoRejoin && response.message === 'session expired') {
                localStorage.removeItem(state.config.storageKey);
                toggleViews('login');
                return;
            }

            switch (response.message) {
                case 'session expired':
                    alert('You failed your Saving Throw against Disconnection. Please sign in again.');
                    localStorage.removeItem(state.config.storageKey);
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
    const savedSession = localStorage.getItem(state.config?.storageKey);
    if (savedSession) {
        const { username, role, id } = JSON.parse(savedSession);
        addPlayer(username, role, id, true);
    }
});

document.addEventListener('visibilitychange', () => {
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
    const savedSession = localStorage.getItem(state.config.storageKey);
    if (savedSession) {
        const { id } = JSON.parse(savedSession);
        userLeave(id);
        localStorage.removeItem(state.config.storageKey);;
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

    const savedSession = localStorage.getItem(state.config.storageKey);
    if (!savedSession) {
        toggleViews('login');
    }
};

init();