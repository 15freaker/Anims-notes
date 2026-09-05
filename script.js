document.addEventListener('DOMContentLoaded', () => {
    // DOM Selectors
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const viewHeading = document.getElementById('viewHeading');
    const actionCard = document.getElementById('actionCard');
    const createNewNoteBtn = document.getElementById('createNewNoteBtn');
    const notesContainer = document.getElementById('notesContainer');

    const foldersTree = document.getElementById('foldersTree');
    const addFolderBtn = document.getElementById('addFolderBtn');

    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const colorFilter = document.getElementById('colorFilter');
    const sortFilter = document.getElementById('sortFilter');

    const typeModal = document.getElementById('typeModal');
    const selectTextNote = document.getElementById('selectTextNote');
    const selectChecklistNote = document.getElementById('selectChecklistNote');
    const closeTypeBtn = document.getElementById('closeTypeBtn');

    const noteModal = document.getElementById('noteModal');
    const modalTitle = document.getElementById('modalTitle');
    const noteTitleInput = document.getElementById('noteTitleInput');
    const noteTagsInput = document.getElementById('noteTagsInput');
    const noteProtectedInput = document.getElementById('noteProtectedInput');
    const noteFolderSelect = document.getElementById('noteFolderSelect');
    const noteColorInput = document.getElementById('noteColorInput');
    const noteTextEditor = document.getElementById('noteTextEditor');
    const textToolbar = document.getElementById('textToolbar');
    const checklistEditor = document.getElementById('checklistEditor');
    const newChecklistItem = document.getElementById('newChecklistItem');
    const addChecklistItemBtn = document.getElementById('addChecklistItemBtn');
    const checklistItemsList = document.getElementById('checklistItemsList');
    const modalStats = document.getElementById('modalStats');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    const exportBtn = document.getElementById('exportBtn');
    const importBtnTrigger = document.getElementById('importBtnTrigger');
    const importInput = document.getElementById('importInput');

    // Application State
    let notes = JSON.parse(localStorage.getItem('anims_notes')) || [];
    let folders = JSON.parse(localStorage.getItem('anims_folders')) || [];
    let currentView = 'active'; // 'active', 'archive', 'bin', or folder ID
    let currentMode = 'text';
    let currentChecklist = [];
    let editingNoteId = null;

    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // View Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (!item.dataset.view) return;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            currentView = item.dataset.view;

            if (currentView === 'active') viewHeading.textContent = 'All Notes';
            if (currentView === 'archive') viewHeading.textContent = 'Archive';
            if (currentView === 'bin') viewHeading.textContent = 'Recycle Bin';

            renderFolders();
            actionCard.style.display = currentView === 'bin' ? 'none' : 'flex';
            renderNotes();
        });
    });

    // Event Listeners for Filters
    [searchInput, typeFilter, colorFilter, sortFilter].forEach(el => {
        el.addEventListener('input', renderNotes);
        el.addEventListener('change', renderNotes);
    });

    noteTextEditor.addEventListener('input', updateStats);
    function updateStats() {
        const text = noteTextEditor.innerText.trim();
        const words = text ? text.split(/\s+/).length : 0;
        const chars = text.length;
        modalStats.textContent = `${words} words | ${chars} chars`;
    }

    // Formatting Toolbar Buttons
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
        localStorage.setItem('anims_folders', JSON.stringify(folders));
        renderFolders();
        renderNotes();
    }

    // --- Folder Tree Management ---
    addFolderBtn.addEventListener('click', () => {
        const name = prompt('Enter Folder Name:');
        if (name && name.trim()) {
            folders.push({
                id: 'folder_' + Date.now(),
                name: name.trim(),
                parentId: null
            });
            saveAndRender();
        }
    });

    window.createSubfolder = function(parentId) {
        const name = prompt('Enter Subfolder Name:');
        if (name && name.trim()) {
            folders.push({
                id: 'folder_' + Date.now(),
                name: name.trim(),
                parentId: parentId
            });
            saveAndRender();
        }
    };

    window.deleteFolder = function(folderId) {
        if (confirm('Delete this folder? Notes inside will be moved to root.')) {
            folders = folders.filter(f => f.id !== folderId && f.parentId !== folderId);
            notes.forEach(n => {
                if (n.folderId === folderId) n.folderId = null;
            });
            if (currentView === folderId) currentView = 'active';
            saveAndRender();
        }
    };

    function renderFolders() {
        foldersTree.innerHTML = '';
        const rootFolders = folders.filter(f => !f.parentId);
        rootFolders.forEach(folder => {
            foldersTree.appendChild(createFolderDOM(folder, 0));
        });
        updateFolderSelectOptions();
    }

    function createFolderDOM(folder, depth) {
        const container = document.createElement('div');
        
        const item = document.createElement('div');
        item.classList.add('folder-item');
        if (currentView === folder.id) item.classList.add('active');
        item.style.paddingLeft = `${0.85 + depth * 0.75}rem`;

        item.innerHTML = `
            <span class="folder-name">📁 ${escapeHTML(folder.name)}</span>
            <div class="folder-actions">
                <button class="folder-btn" onclick="event.stopPropagation(); createSubfolder('${folder.id}')" title="Add Subfolder">+</button>
                <button class="folder-btn" onclick="event.stopPropagation(); deleteFolder('${folder.id}')" title="Delete Folder">×</button>
            </div>
        `;

        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            currentView = folder.id;
            viewHeading.textContent = `Folder: ${folder.name}`;
            renderFolders();
            actionCard.style.display = 'flex';
            renderNotes();
        });

        container.appendChild(item);

        // Render Subfolders
        const subfolders = folders.filter(f => f.parentId === folder.id);
        subfolders.forEach(sub => {
            container.appendChild(createFolderDOM(sub, depth + 1));
        });

        return container;
    }

    function updateFolderSelectOptions() {
        noteFolderSelect.innerHTML = '<option value="">(No Folder)</option>';
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `${f.parentId ? '  └ ' : ''}${f.name}`;
            noteFolderSelect.appendChild(opt);
        });
    }

    // --- Search & Note Rendering ---
    function sanitizeHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const scripts = temp.getElementsByTagName('script');
        while (scripts.length > 0) scripts[0].parentNode.removeChild(scripts[0]);
        const elements = temp.getElementsByTagName('*');
        for (let el of elements) {
            for (let attr of Array.from(el.attributes)) {
                if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
            }
        }
        return temp.innerHTML;
    }

    function renderNotes() {
        notesContainer.innerHTML = '';
        const query = searchInput.value.toLowerCase().trim();
        const selectedType = typeFilter.value;
        const selectedColor = colorFilter.value;
        const selectedSort = sortFilter.value;

        let filtered = notes.filter(note => {
            // Navigation View / Folder Filter
            if (currentView === 'active') {
                if (note.archived || note.deleted) return false;
            } else if (currentView === 'archive') {
                if (!note.archived || note.deleted) return false;
            } else if (currentView === 'bin') {
                if (!note.deleted) return false;
            } else { // Folder View
                if (note.folderId !== currentView || note.deleted) return false;
            }

            // Global Query Search (Title, Body, or Tags)
            if (query) {
                const titleMatch = (note.title || '').toLowerCase().includes(query);
                const textMatch = (note.text || '').toLowerCase().includes(query);
                const tagsMatch = (note.tags || []).some(t => t.toLowerCase().includes(query));
                if (!titleMatch && !textMatch && !tagsMatch) return false;
            }

            // Dropdown Filters
            if (selectedType !== 'all' && note.type !== selectedType) return false;
            if (selectedColor !== 'all' && (note.color || '#1e293b') !== selectedColor) return false;

            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
            if (selectedSort === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
            if (selectedSort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
            if (selectedSort === 'title') return (a.title || '').localeCompare(b.title || '');
            return 0;
        });

        filtered.forEach(note => {
            const card = document.createElement('div');
            card.classList.add('note-card');
            if (note.pinned) card.classList.add('pinned');
            if (note.isProtected) card.classList.add('protected-note');
            if (note.color) card.style.backgroundColor = note.color;

            let badgeHtml = '';
            if (note.isProtected) badgeHtml = `<span class="protected-badge">LOCKED</span>`;
            else if (note.pinned) badgeHtml = `<span class="pin-badge">PINNED</span>`;

            const tagsHtml = (note.tags || []).map(t => `<span class="tag-chip">${escapeHTML(t)}</span>`).join('');

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
            if (currentView !== 'archive' && currentView !== 'bin') {
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
                    <div class="card-tags">${tagsHtml}</div>
                    ${bodyContent}
                </div>
                <div class="card-actions">${actionButtons}</div>
            `;

            card.addEventListener('click', () => editNote(note.id));
            notesContainer.appendChild(card);
        });
    }

    // Modal Operations
    createNewNoteBtn.addEventListener('click', () => { typeModal.style.display = 'flex'; });
    closeTypeBtn.addEventListener('click', () => { typeModal.style.display = 'none'; });
    selectTextNote.addEventListener('click', () => { typeModal.style.display = 'none'; openModal('text'); });
    selectChecklistNote.addEventListener('click', () => { typeModal.style.display = 'none'; openModal('checklist'); });

    function openModal(mode, noteToEdit = null) {
        currentMode = mode;
        editingNoteId = noteToEdit ? noteToEdit.id : null;

        modalTitle.textContent = noteToEdit ? 'Edit Note' : (mode === 'checklist' ? 'New Checklist' : 'New Standard Note');
        noteTitleInput.value = noteToEdit ? noteToEdit.title : '';
        noteTagsInput.value = noteToEdit && noteToEdit.tags ? noteToEdit.tags.join(', ') : '';
        noteProtectedInput.checked = noteToEdit ? !!noteToEdit.isProtected : false;
        noteFolderSelect.value = noteToEdit ? noteToEdit.folderId || '' : (currentView.startsWith('folder_') ? currentView : '');

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

    saveBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim();
        const tagsRaw = noteTagsInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const tags = tagsRaw.map(t => t.startsWith('#') ? t : `#${t}`);
        
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
                    note.tags = tags;
                    note.text = text;
                    note.items = currentMode === 'checklist' ? currentChecklist : [];
                    note.color = noteColorInput.value;
                    note.folderId = noteFolderSelect.value || null;
                    note.isProtected = noteProtectedInput.checked;
                }
            } else {
                notes.unshift({
                    id: Date.now().toString(),
                    createdAt: Date.now(),
                    type: currentMode,
                    title,
                    tags,
                    text,
                    items: currentMode === 'checklist' ? currentChecklist : [],
                    folderId: noteFolderSelect.value || null,
                    archived: false,
                    deleted: false,
                    pinned: false,
                    color: noteColorInput.value,
                    isProtected: noteProtectedInput.checked
                });
            }
            saveAndRender();
            noteModal.style.display = 'none';
        }
    });

    cancelBtn.addEventListener('click', () => { noteModal.style.display = 'none'; });

    // Checklist Builders
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

    window.toggleCardChecklist = function(noteId, itemIdx) {
        const note = notes.find(n => n.id === noteId);
        if (note && note.items && note.items[itemIdx]) {
            note.items[itemIdx].done = !note.items[itemIdx].done;
            saveAndRender();
        }
    };

    function verifyProtectedAction(note) {
        if (!note.isProtected) return true;
        const confirmName = prompt(`Note is locked! Type "${note.title || 'Untitled'}" to confirm:`);
        return confirmName === (note.title || 'Untitled');
    }

    // Note Action Handlers
    window.togglePinNote = id => { const n = notes.find(x => x.id === id); if (n) n.pinned = !n.pinned; saveAndRender(); };
    window.archiveNote = id => { const n = notes.find(x => x.id === id); if (n && verifyProtectedAction(n)) { n.archived = true; saveAndRender(); } };
    window.unarchiveNote = id => { const n = notes.find(x => x.id === id); if (n) { n.archived = false; saveAndRender(); } };
    window.moveToBin = id => { const n = notes.find(x => x.id === id); if (n && verifyProtectedAction(n)) { n.deleted = true; saveAndRender(); } };
    window.restoreNote = id => { const n = notes.find(x => x.id === id); if (n) { n.deleted = false; n.archived = false; saveAndRender(); } };
    window.permanentlyDeleteNote = id => { const n = notes.find(x => x.id === id); if (n && verifyProtectedAction(n)) { notes = notes.filter(x => x.id !== id); saveAndRender(); } };

    // Export/Import System
    exportBtn.addEventListener('click', () => {
        const data = { notes, folders };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
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
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    notes = importedData;
                } else if (importedData.notes) {
                    notes = importedData.notes || [];
                    folders = importedData.folders || [];
                }
                saveAndRender();
                alert('Notes and folders imported successfully!');
            } catch (err) {
                alert('Invalid JSON file format.');
            }
        };
        if (e.target.files[0]) fileReader.readAsText(e.target.files[0]);
    });

    function escapeHTML(str) {
        return (str || '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }

    renderFolders();
    renderNotes();
});