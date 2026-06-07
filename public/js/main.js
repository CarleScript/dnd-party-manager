import { DOM } from './dom.js';
import { state, getSession } from './state.js';
import { toggleViews, toast, renderPlayerList } from './ui.js';
import { connectSocket, disconnectSocket, onConnect, onPartyUpdate } from './socket.js';
import {
    toggleSheet,
    addPlayer,
    handleJoin,
    handleClick,
    handleMousedown,
    handleFocus,
    checkInput,
    preventInput,
    updateInput,
    openNpcModal,
    handleLeave,
    closeNpcModal,
    handleNpcNumberFocus,
    handleNpcNumberBlur,
    handleSheetUpload,
    tryLoadSheet,
    handleSheetRemove
} from './events.js';

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        state.config = await res.json();
    } catch (e) {
        console.error('Failed to retrieve server configuration: ', e);
        toast('You rolled a Natural 1 while reaching the server. Please refresh and try again.');
    } finally {
        if (state.config) {
            DOM.npcInitInput.max = Math.pow(10, state.config.maxInitDigits) - 1;
            DOM.npcCurrentHpInput.max = Math.pow(10, state.config.maxHpDigits) - 1;
            DOM.npcMaxHpInput.max = Math.pow(10, state.config.maxHpDigits) - 1;
        }
    }
}

onPartyUpdate((partyMembers) => {
    state.players = partyMembers;
    renderPlayerList();
});

onConnect(() => {
    const { username, role, id, view } = getSession();
    if (id) {
        addPlayer(username, role, id, true);
    } else {
        toggleViews(view || 'login');
    }
});

const EDITABLE_FIELDS = ['init', 'currentHp', 'maxHp'];

const init = async () => {
    await loadConfig();
    await tryLoadSheet();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            document.activeElement?.blur();
            disconnectSocket();
        } else {
            connectSocket();
        }
    });

    DOM.toggleSheetBtn.addEventListener('click', toggleSheet);

    DOM.usernameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleJoin();
    });

    DOM.joinBtn.addEventListener('click', handleJoin);

    DOM.playerList.addEventListener('click', handleClick);
    DOM.playerList.addEventListener('mousedown', handleMousedown);

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

    DOM.addNpcBtn.addEventListener('click', openNpcModal);
    DOM.leaveBtn.addEventListener('click', handleLeave);

    DOM.npcModal.addEventListener('click', (e) => {
        if (e.target === DOM.npcModal) DOM.npcModal.close('');
    });
    DOM.npcModal.addEventListener('close', closeNpcModal);

    DOM.closeModalBtn.addEventListener('click', () => DOM.npcModal.close(''));

    [DOM.npcInitInput, DOM.npcCurrentHpInput, DOM.npcMaxHpInput].forEach(input => {
        input.addEventListener('focus', handleNpcNumberFocus);
        input.addEventListener('blur', handleNpcNumberBlur);
    });

    DOM.sheetUploadInput.addEventListener('change', handleSheetUpload);
    DOM.sheetRemoveBtn.addEventListener('click', handleSheetRemove);

    DOM.sheetUploadInput.addEventListener('dragenter', () => {
        DOM.uploadContainer.classList.add('drag-over');
    });
    DOM.sheetUploadInput.addEventListener('dragleave', () => {
        DOM.uploadContainer.classList.remove('drag-over');
    });
    DOM.sheetUploadInput.addEventListener('drop', () => {
        DOM.uploadContainer.classList.remove('drag-over');
    });

    const { id, view } = getSession();
    if (!id) toggleViews(view || 'login');
};

init();