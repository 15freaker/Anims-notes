document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');

    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

    const navItems = document.querySelectorAll('.nav-item');

    const viewHeading = document.getElementById('viewHeading');

    const actionCard = document.getElementById('actionCard');

    const searchInput = document.getElementById('searchInput');

    const createNewNoteBtn = document.getElementById('createNewNoteBtn');

    const notesContainer = document.getElementById('notesContainer');

    const typeModal = document.getElementById('typeModal');

    const selectTextNote = document.getElementById('selectTextNote');

    const selectChecklistNote = document.getElementById('selectChecklistNote');

    const closeTypeBtn = document.getElementById('closeTypeBtn');

    const noteModal = document.getElementById('noteModal');

    const modalTitle = document.getElementById('modalTitle');

    const noteTitleInput = document.getElementById('noteTitleInput');

    const noteTextEditor = document.getElementById('noteTextEditor');

    const textToolbar = document.getElementById('textToolbar');

    const checklistEditor = document.getElementById('checklistEditor');

    const newChecklistItem = document.getElementById('newChecklistItem');

    const addChecklistItemBtn = document.getElementById('addChecklistItemBtn');

    const checklistItemsList = document.getElementById('checklistItemsList');

    const noteColorInput = document.getElementById('noteColorInput');

    const modalStats = document.getElementById('modalStats');

    const saveBtn = document.getElementById('saveBtn');

    const cancelBtn = document.getElementById('cancelBtn');

    const exportBtn = document.getElementById('exportBtn');

    const importBtnTrigger = document.getElementById('importBtnTrigger');

    const importInput = document.getElementById('importInput');
    
    let notes = JSON.parse(localStorage.getItem('anims_notes')) || [];
    let currentView = 'active';
    let currentMode = 'text';
    let currentChecklist = [];

    const PROTECTED_ID = 'protected-permanent-note';

    function initProtectedNote() {
        const exists = notes.some(n => n.id === PROTECTED_ID);
        if (!exists) {
            notes.unshift({
                id: PROTECTED_ID,
                type: 'text',
                title: 'Pinned Note (Protected)',
                text: 'This is your permanent note. To delete or archive it, you must type its exact title when prompted.',
                archived: false,
                deleted: false,
                pinned: true,
                color: '#1e293b',
                isProtected: true
            });
            saveAndRender();
        }
    }

    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (!item.dataset.view) return;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            currentView = item.dataset.view;

            if (currentView === 'active') viewHeading.textContent = 'Anims-Notes';
            if (currentView === 'archive') viewHeading.textContent = 'Archive';
            if (currentView === 'bin') viewHeading.textContent = 'Recycle Bin';

            actionCard.style.display = currentView === 'active' ? 'flex' : 'none';
            renderNotes();
        });
    });

    searchInput.addEventListener('input', renderNotes);

    noteTextEditor.addEventListener('input', updateStats);
    function updateStats() {
        const text = noteTextEditor.innerText.trim();
        const words = text ? text.split(/\s+/).length : 0;
        const chars = text.length;
        modalStats.textContent = `${words} words | ${chars} chars`;
    }

    document.getElementById('btnBold').addEventListener('click', () => document.execCommand('bold', false, null));
    document.getElementById('btnItalic').addEventListener('click', () => document.execCommand('italic', false, null));
    document.getElementById('btnUnderline').addEventListener('click', () => document.execCommand('underline', false, null));
    document.getElementById('btnHighlight').addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        document.execCommand('hiliteColor', false, '#facc15');
    });

    function saveAndRender() {
        localStorage.setItem('anims_notes', JSON.stringify(notes));
        renderNotes();
    }

    function renderNotes() {
        notesContainer.innerHTML = '';
        const query = searchInput.value.toLowerCase();

        let filteredNotes = notes.filter(note => {
            const matchesSearch = (note.title || '').toLowerCase().includes(query) || (note.text || '').toLowerCase().includes(query);
            if (!matchesSearch) return false;

            if (currentView === 'active') return !note.archived && !note.deleted;
            if (currentView === 'archive') return note.archived && !note.deleted;
            if (currentView === 'bin') return note.deleted;
        });

        filteredNotes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        filteredNotes.forEach(note => {
            const card = document.createElement('div');
            card.classList.add('note-card');
            if (note.pinned) card.classList.add('pinned');
            if (note.isProtected) card.classList.add('protected-note');
            if (note.color) card.style.backgroundColor = note.color;

            let badgeHtml = '';
            if (note.isProtected) {
                badgeHtml = `<span class="protected-badge">LOCKED</span>`;
            } else if (note.pinned) {
                badgeHtml = `<span class="pin-badge">PINNED</span>`;
            }

            let bodyContent = '';
            if (note.type === 'checklist' && Array.isArray(note.items)) {
                const listItems = note.items.slice(0, 4).map(item => 
                    `<li class="${item.done ? 'done' : ''}">${item.done ? '✓' : '○'} ${escapeHTML(item.text)}</li>`
                ).join('');
                bodyContent = `<ul class="card-checklist-items">${listItems}</ul>`;
            } else {
                bodyContent = `<div class="note-body">${note.text}</div>`;
            }

            let actionButtons = '';
            if (currentView === 'active') {
                actionButtons = `
                    ${!note.isProtected ? `<button class="card-btn" onclick="togglePinNote('${note.id}')">${note.pinned ? 'Unpin' : 'Pin'}</button>` : ''}
                    <button class="card-btn" onclick="archiveNote('${note.id}')">Archive</button>
                    <button class="card-btn" onclick="moveToBin('${note.id}')">Delete</button>
                `;
            } else if (currentView === 'archive') {
                actionButtons = `
                    <button class="card-btn" onclick="unarchiveNote('${note.id}')">Unarchive</button>
                    <button class="card-btn" onclick="moveToBin('${note.id}')">Delete</button>
                `;
            } else if (currentView === 'bin') {
                actionButtons = `
                    <button class="card-btn" onclick="restoreNote('${note.id}')">Restore</button>
                    <button class="card-btn" onclick="permanentlyDeleteNote('${note.id}')">Remove</button>
                `;
            }

            card.innerHTML = `
                ${badgeHtml}
                <div>
                    <h3>${escapeHTML(note.title || 'Untitled')}</h3>
                    ${bodyContent}
                </div>
                <div class="card-actions">
                    ${actionButtons}
                </div>
            `;

            notesContainer.appendChild(card);
        });
    }

    createNewNoteBtn.addEventListener('click', () => {
        typeModal.style.display = 'flex';
    });

    closeTypeBtn.addEventListener('click', () => {
        typeModal.style.display = 'none';
    });

    selectTextNote.addEventListener('click', () => {
        typeModal.style.display = 'none';
        openModal('text');
    });

    selectChecklistNote.addEventListener('click', () => {
        typeModal.style.display = 'none';
        openModal('checklist');
    });

    function openModal(mode) {
        currentMode = mode;
        modalTitle.textContent = mode === 'checklist' ? 'New Checklist' : 'New Standard Note';
        noteTitleInput.value = '';
        noteTextEditor.innerHTML = '';
        currentChecklist = [];
        renderChecklistItems();

        if (mode === 'checklist') {
            textToolbar.style.display = 'none';
            noteTextEditor.style.display = 'none';
            checklistEditor.style.display = 'flex';
        } else {
            textToolbar.style.display = 'flex';
            noteTextEditor.style.display = 'block';
            checklistEditor.style.display = 'none';
        }

        noteColorInput.value = '#1e293b';
        updateStats();
        noteModal.style.display = 'flex';
    }

    function closeModal() {
        noteModal.style.display = 'none';
    }

    addChecklistItemBtn.addEventListener('click', () => {
        const text = newChecklistItem.value.trim();
        if (text) {
            currentChecklist.push({ text, done: false });
            newChecklistItem.value = '';
            renderChecklistItems();
        }
    });

    function renderChecklistItems() {
        checklistItemsList.innerHTML = '';
        currentChecklist.forEach((item, index) => {
            const li = document.createElement('li');
            if (item.done) li.classList.add('done');
            li.innerHTML = `
                <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem(${index})">
                <span>${escapeHTML(item.text)}</span>
            `;
            checklistItemsList.appendChild(li);
        });
    }

    window.toggleChecklistItem = function(index) {
        currentChecklist[index].done = !currentChecklist[index].done;
        renderChecklistItems();
    };

    saveBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim();
        let text = '';
        
        if (currentMode === 'text') {
            text = noteTextEditor.innerHTML;
        } else {
            text = currentChecklist.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n');
        }

        if (title || text || currentChecklist.length > 0) {
            notes.unshift({
                id: Date.now().toString(),
                type: currentMode,
                title,
                text,
                items: currentMode === 'checklist' ? currentChecklist : [],
                archived: false,
                deleted: false,
                pinned: false,
                color: noteColorInput.value
            });
            saveAndRender();
            closeModal();
        }
    });

    cancelBtn.addEventListener('click', closeModal);

    function verifyProtectedAction(note) {
        if (!note.isProtected) return true;
        const confirmName = prompt(`This note is locked! Type "${note.title}" to confirm:`);
        return confirmName === note.title;
    }

    window.togglePinNote = function(id) {
        const note = notes.find(n => n.id === id);
        if (note) note.pinned = !note.pinned;
        saveAndRender();
    };

    window.archiveNote = function(id) {
        const note = notes.find(n => n.id === id);
        if (note && verifyProtectedAction(note)) {
            note.archived = true;
            saveAndRender();
        }
    };

    window.unarchiveNote = function(id) {
        const note = notes.find(n => n.id === id);
        if (note) {
            note.archived = false;
            saveAndRender();
        }
    };

    window.moveToBin = function(id) {
        const note = notes.find(n => n.id === id);
        if (note && verifyProtectedAction(note)) {
            note.deleted = true;
            saveAndRender();
        }
    };

    window.restoreNote = function(id) {
        const note = notes.find(n => n.id === id);
        if (note) {
            note.deleted = false;
            note.archived = false;
            saveAndRender();
        }
    };

    window.permanentlyDeleteNote = function(id) {
        const note = notes.find(n => n.id === id);
        if (note && verifyProtectedAction(note)) {
            notes = notes.filter(n => n.id !== id);
            saveAndRender();
        }
    };

    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "anims_notes_backup.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    importBtnTrigger.addEventListener('click', () => importInput.click());

    importInput.addEventListener('change', (e) => {
        const fileReader = new FileReader();
        fileReader.onload = (event) => {
            try {
                const importedNotes = JSON.parse(event.target.result);
                if (Array.isArray(importedNotes)) {
                    notes = importedNotes;
                    initProtectedNote();
                    saveAndRender();
                    alert('Notes imported successfully!');
                }
            } catch (err) {
                alert('Invalid JSON file format.');
            }
        };
        if (e.target.files[0]) fileReader.readAsText(e.target.files[0]);
    });

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    initProtectedNote();
});