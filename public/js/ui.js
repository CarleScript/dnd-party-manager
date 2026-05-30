import { DOM } from './dom.js';
import { state } from './state.js';

export const toggleViews = (view) => {
    const views = [[DOM.loginView, 'login'], [DOM.roomView, 'room'], [DOM.sheetView, 'sheet']];
    views.forEach(([element, name]) => { element.classList.toggle('hidden', name !== view) });

    if (view === 'room') {
        const isMaster = state.session.role === 'master';
        DOM.addNpcBtn.classList.toggle('hidden', !isMaster);
    }

    if (view === 'login') DOM.usernameInput.focus();
};

export const el = (tag, options = {}, children = []) => {
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

export const renderPlayerList = () => {
    if (!state.config) {
        console.warn('System initialization in progress. Please wait.');
        alert(`The adventure isn't ready yet. Please try again in a moment.`);
        return;
    }

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
                                    dataset: { field: 'currentHp', maxlength: state.config.maxHpDigits }
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
                                    dataset: { field: 'maxHp', maxlength: state.config.maxHpDigits }
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
                            dataset: { field: 'init', maxlength: state.config.maxInitDigits }
                        })
                    })
                ]),
                showDeleteNpcBtn ? el('button', {
                    className: 'btn-secondary btn-delete-npc',
                    text: 'SLAY'
                }) : null
            ]);

            fragment.appendChild(playerCard);
        });

    DOM.playerList.appendChild(fragment);
};

export const renderSheet = (file = null) => {
    const hasFile = !!file;

    DOM.sheetUploadInput.classList.toggle('hidden', hasFile);
    DOM.sheetDocument.classList.toggle('hidden', !hasFile);
    DOM.sheetRemoveBtn.classList.toggle('hidden', !hasFile);

    if (hasFile) {
        DOM.sheetDocument.src = URL.createObjectURL(file);
    } else {
        if (DOM.sheetDocument.src && DOM.sheetDocument.src.startsWith('blob:')) {
            URL.revokeObjectURL(DOM.sheetDocument.src);
        }
        DOM.sheetUploadInput.value = '';
        DOM.sheetDocument.src = '';
    }
};