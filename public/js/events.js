import { DOM } from './dom.js';
import { state, initSession, clearSession, getSession } from './state.js';
import { toggleViews, renderPlayerList, renderSheet } from './ui.js';
import { userJoin, userLeave, addNpc, removeNpc, updateStat } from './socket.js';
import { saveSheet, loadSheet, removeSheet } from './api.js';

export const toggleSheet = () => {
    const { id, username, role, view } = getSession();
    const altView = id ? 'room' : 'login'
    const newView = !view || view === altView ? 'sheet' : altView;

    toggleViews(newView);
    initSession({ id, username, role, view: newView });
    state.session.view = newView;
};

export const addPlayer = (name, role, savedUUID = null, isAutoRejoin = false) => {
    userJoin(name, role, savedUUID, (response) => {
        if (response.status === 'ok') {
            if (!savedUUID) {
                const userState = { id: response.userId, username: name, role: role, view: 'room' };
                initSession(userState);
            }
            toggleViews(state.session.view || 'room');
            if (!isAutoRejoin) DOM.usernameInput.value = '';
            state.players = response.partyData;
            renderPlayerList();
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

export const handleJoin = () => {
    if (!state.config) {
        console.warn('System initialization in progress. Please wait.');
        alert(`The adventure isn't ready yet. Please try again in a moment.`);
        return;
    }

    const username = DOM.usernameInput.value.trim();
    if (!username) {
        alert('Enter a valid name, you fucking moron!')
        DOM.usernameInput.focus();
        return;
    }
    if (username.length > state.config.maxNameLength) {
        alert('Your name is too long, motherfucking narcissist!');
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

export const handleClick = (e) => {
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

export const handleMousedown = (e) => {
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

export const handleFocus = (target) => {
    setTimeout(() => moveCursorToEnd(target), 0);
};

export const checkInput = (e) => {
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

export const preventInput = (e) => {
    const { target } = e;
    const maxLength = parseInt(target.dataset?.maxlength, 10) || 2;
    const dynamicRegex = new RegExp(`^[0-9]{1,${maxLength}}$`);
    if (!dynamicRegex.test(target.textContent)) target.textContent = '0';
    moveCursorToEnd(target);
};

export const updateInput = (e, inputName) => {
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

export const openNpcModal = () => {
    DOM.npcForm.reset();
    DOM.npcModal.returnValue = '';
    DOM.npcModal.showModal();
};

export const handleLeave = () => {
    if (state.session.id) {
        userLeave(state.session.id);
        clearSession();
    }
    toggleViews('login');
}

export const closeNpcModal = () => {
    if (DOM.npcModal.returnValue !== 'confirm') return;

    if (!state.config) {
        console.warn('System initialization in progress. Please wait.');
        alert(`The adventure isn't ready yet. Please try again in a moment.`);
        return;
    }

    const formData = new FormData(DOM.npcForm);
    const {
        name: rawName = '',
        init: rawInit = '0',
        currentHp: rawCurrentHp = '0',
        maxHp: rawMaxHp = '0'
    } = Object.fromEntries(formData);

    const name = rawName.trim();
    const init = parseInt(rawInit, 10);
    const currentHp = parseInt(rawCurrentHp, 10);
    const maxHp = parseInt(rawMaxHp, 10);

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

export const handleNpcNumberFocus = (e) => {
    if (e.target.value === '0') e.target.value = '';
};

export const handleNpcNumberBlur = (e) => {
    if (e.target.value === '') e.target.value = '0';
};

export const handleSheetUpload = async (e) => {
    if (!state.config) {
        console.warn('System initialization in progress. Please wait.');
        alert(`The adventure isn't ready yet. Please try again in a moment.`);
        return;
    }

    const sheet = e.target?.files?.[0];
    if (!sheet) return;

    if (sheet.type !== state.config.allowedFileMimeType) {
        DOM.sheetUploadInput.value = '';
        console.warn('File type not allowed');
        alert('How about picking the fucking right file type?');
        return;
    }

    const maxFileSizeBytes = state.config.maxFileSizeMb * 1024 * 1024;
    if (sheet.size > maxFileSizeBytes) {
        DOM.sheetUploadInput.value = '';
        console.warn('File size exceeds the permitted limit');
        alert('This file is way too huge. If you want to waste memory, host your own damn server!');
        return;
    }

    try {
        await saveSheet(sheet);
        renderSheet(sheet);
    } catch (e) {
        DOM.sheetUploadInput.value = '';
        console.error('Error uploading the file: ' + e);
        alert('What kind of shitty file did you just try to upload?!');
    }
};

export const tryLoadSheet = async () => {
    try {
        const sheet = await loadSheet();
        if (!sheet) return;
        if (!(sheet instanceof Blob)) {
            await removeSheet();
            throw new Error('Data corruption detected: stored file is not a Blob instance.');
        }
        renderSheet(sheet);
    } catch (e) {
        console.error('Error loading the file: ' + e);
        alert('This file is complete garbage. What the fuck did you just upload?');
    }
};

export const handleSheetRemove = async (e) => {
    try {
        await removeSheet();
        renderSheet(null);
    } catch (e) {
        console.error('Error deleting the file: ' + e);
        alert(`You are so useless that you can't even delete a file you uploaded...`);
    }
}