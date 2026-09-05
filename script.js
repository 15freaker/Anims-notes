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
    const noteProtectedInput = document.getElementById('noteProtectedInput');
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
    let editingNoteId = null;

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

    function sanitizeHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        const scripts = temp.getElementsByTagName('script');
        while (scripts.length > 0) scripts[0].parentNode.removeChild(scripts[0]);
        
        const elements = temp.getElementsByTagName('*');
        for (let el of elements) {
            for (let attr of Array.from(el.attributes)) {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            }
        }
        return temp.innerHTML;
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
                const listItems = note.items.slice(0, 4).map((item, idx) => 
                    `<li class="${item.done ? 'done' : ''}">
                        <input type="checkbox" ${item.done ? 'checked' : ''} onclick="event.stopPropagation(); toggleCardChecklist('${note.id}', ${idx})">
                        <span>${escapeHTML(item.text)}</span>
                    </li>`
                ).join('');
                bodyContent = `<ul class="card-checklist-items">${listItems}</ul>`;
            } else {
                bodyContent = `<div class="note-body">${sanitizeHTML(note.text || '')}</div>`;
            }

            let actionButtons = '';
            if (currentView === 'active') {
                actionButtons = `
                    <button class="card-btn" onclick="event.stopPropagation(); togglePinNote('${note.id}')">${note.pinned ? 'Unpin' : 'Pin'}</button>
                    <button class="card-btn" onclick="event.stopPropagation(); archiveNote('${note.id}')">Archive</button>
                    <button class="card-btn" onclick="event.stopPropagation(); moveToBin('${note.id}')">Delete</button>
                `;
            } else if (currentView === 'archive') {
                actionButtons = `
                    <button class="card-btn" onclick="event.stopPropagation(); unarchiveNote('${note.id}')">Unarchive</button>
                    <button class="card-btn" onclick="event.stopPropagation(); moveToBin('${note.id}')">Delete</button>
                `;
            } else if (currentView === 'bin') {
                actionButtons = `
                    <button class="card-btn" onclick="event.stopPropagation(); restoreNote('${note.id}')">Restore</button>
                    <button class="card-btn" onclick="event.stopPropagation(); permanentlyDeleteNote('${note.id}')">Remove</button>
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

            card.addEventListener('click', () => editNote(note.id));
            notesContainer.appendChild(card);
        });
    }

    window.toggleCardChecklist = function(noteId, itemIdx) {
        const note = notes.find(n => n.id === noteId);
        if (note && note.items && note.items[itemIdx]) {
            note.items[itemIdx].done = !note.items[itemIdx].done;
            saveAndRender();
        }
    };

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

    function openModal(mode, noteToEdit = null) {
        currentMode = mode;
        editingNoteId = noteToEdit ? noteToEdit.id : null;

        modalTitle.textContent = noteToEdit ? 'Edit Note' : (mode === 'checklist' ? 'New Checklist' : 'New Standard Note');
        noteTitleInput.value = noteToEdit ? noteToEdit.title : '';
        noteProtectedInput.checked = noteToEdit ? !!noteToEdit.isProtected : false;

        if (mode === 'checklist') {
            textToolbar.style.display = 'none';
            noteTextEditor.style.display = 'none';
            checklistEditor.style.display = 'flex';
            currentChecklist = noteToEdit && noteToEdit.items ? [...noteToEdit.items] : [];
            renderChecklistItems();
        } else {
            textToolbar.style.display = 'flex';
            noteTextEditor.style.display = 'block';
            checklistEditor.style.display = 'none';
            noteTextEditor.innerHTML = noteToEdit ? sanitizeHTML(noteToEdit.text) : '';
        }

        noteColorInput.value = noteToEdit ? noteToEdit.color || '#1e293b' : '#1e293b';
        updateStats();
        noteModal.style.display = 'flex';
    }

    function editNote(id) {
        const note = notes.find(n => n.id === id);
        if (!note) return;

        if (note.isProtected && !verifyProtectedAction(note)) return;

        openModal(note.type || 'text', note);
    }

    function closeModal() {
        noteModal.style.display = 'none';
        editingNoteId = null;
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
            text = sanitizeHTML(noteTextEditor.innerHTML);
        } else {
            text = currentChecklist.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n');
        }

        if (title || text || currentChecklist.length > 0) {
            if (editingNoteId) {
                const note = notes.find(n => n.id === editingNoteId);
                if (note) {
                    note.title = title;
                    note.text = text;
                    note.items = currentMode === 'checklist' ? currentChecklist : [];
                    note.color = noteColorInput.value;
                    note.isProtected = noteProtectedInput.checked;
                }
            } else {
                notes.unshift({
                    id: Date.now().toString(),
                    type: currentMode,
                    title,
                    text,
                    items: currentMode === 'checklist' ? currentChecklist : [],
                    archived: false,
                    deleted: false,
                    pinned: false,
                    color: noteColorInput.value,
                    isProtected: noteProtectedInput.checked
                });
            }
            saveAndRender();
            closeModal();
        }
    });

    cancelBtn.addEventListener('click', closeModal);

    function verifyProtectedAction(note) {
        if (!note.isProtected) return true;
        const confirmName = prompt(`This note is locked! Type "${note.title || 'Untitled'}" to confirm:`);
        return confirmName === (note.title || 'Untitled');
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
        return (str || '').replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    renderNotes();
});