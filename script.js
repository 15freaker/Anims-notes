import { 
    notes, folders, setNotes, setFolders, appState, 
    saveAndRender, escapeHTML, sanitizeHTML, verifyProtectedAction 
} from './main.js';

let autoSaveTimer = null;
let isDrawing = false;

document.addEventListener('DOMContentLoaded', () => {
    // Selectors
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
    const autoSaveIndicator = document.getElementById('autoSaveIndicator');
    const noteTitleInput = document.getElementById('noteTitleInput');
    const noteTagsInput = document.getElementById('noteTagsInput');
    const noteProtectedInput = document.getElementById('noteProtectedInput');
    const noteFolderSelect = document.getElementById('noteFolderSelect');
    const noteColorInput = document.getElementById('noteColorInput');
    const versionSelect = document.getElementById('versionSelect');
    const noteTextEditor = document.getElementById('noteTextEditor');
    const attachmentsPreview = document.getElementById('attachmentsPreview');
    const textToolbar = document.getElementById('textToolbar');
    const checklistEditor = document.getElementById('checklistEditor');
    const newChecklistItem = document.getElementById('newChecklistItem');
    const addChecklistItemBtn = document.getElementById('addChecklistItemBtn');
    const checklistItemsList = document.getElementById('checklistItemsList');
    const fileAttachmentInput = document.getElementById('fileAttachmentInput');
    const modalStats = document.getElementById('modalStats');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    const exportBtn = document.getElementById('exportBtn');
    const importBtnTrigger = document.getElementById('importBtnTrigger');
    const importInput = document.getElementById('importInput');

    const drawingModal = document.getElementById('drawingModal');
    const openDrawingBtn = document.getElementById('openDrawingBtn');
    const sketchCanvas = document.getElementById('sketchCanvas');
    const brushColor = document.getElementById('brushColor');
    const brushSize = document.getElementById('brushSize');
    const clearCanvasBtn = document.getElementById('clearCanvasBtn');
    const cancelDrawingBtn = document.getElementById('cancelDrawingBtn');
    const saveDrawingBtn = document.getElementById('saveDrawingBtn');
    const ctx = sketchCanvas.getContext('2d');

    toggleSidebarBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    // Navigation Switcher
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (!item.dataset.view) return;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            appState.currentView = item.dataset.view;

            if (appState.currentView === 'active') viewHeading.textContent = 'All Notes';
            if (appState.currentView === 'archive') viewHeading.textContent = 'Archive';
            if (appState.currentView === 'bin') viewHeading.textContent = 'Recycle Bin';

            renderFolders();
            actionCard.style.display = appState.currentView === 'bin' ? 'none' : 'flex';
            renderNotes();
        });
    });

    [searchInput, typeFilter, colorFilter, sortFilter].forEach(el => {
        el.addEventListener('input', renderNotes);
        el.addEventListener('change', renderNotes);
    });

    // Formatting Toolbar
    document.getElementById('btnBold').addEventListener('click', () => document.execCommand('bold', false, null));
    document.getElementById('btnItalic').addEventListener('click', () => document.execCommand('italic', false, null));
    document.getElementById('btnUnderline').addEventListener('click', () => document.execCommand('underline', false, null));
    document.getElementById('btnHighlight').addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        document.execCommand('hiliteColor', false, '#facc15');
    });

    // Folders Setup
    addFolderBtn.addEventListener('click', () => {
        const name = prompt('Enter Folder Name:');
        if (name && name.trim()) {
            folders.push({ id: 'folder_' + Date.now(), name: name.trim(), parentId: null });
            saveAndRender();
        }
    });

    window.createSubfolder = function(parentId) {
        const name = prompt('Enter Subfolder Name:');
        if (name && name.trim()) {
            folders.push({ id: 'folder_' + Date.now(), name: name.trim(), parentId: parentId });
            saveAndRender();
        }
    };

    window.deleteFolder = function(folderId) {
        if (confirm('Delete folder? Notes inside will move to root.')) {
            setFolders(folders.filter(f => f.id !== folderId && f.parentId !== folderId));
            notes.forEach(n => { if (n.folderId === folderId) n.folderId = null; });
            if (appState.currentView === folderId) appState.currentView = 'active';
            saveAndRender();
        }
    };

    // Attachments & Drag-and-Drop
    fileAttachmentInput.addEventListener('change', e => handleFiles(e.target.files));

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            if (file.type.startsWith('image/')) {
                reader.onload = event => {
                    const imgHtml = `<img src="${event.target.result}" alt="${escapeHTML(file.name)}">`;
                    document.execCommand('insertHTML', false, imgHtml);
                    triggerAutoSave();
                };
                reader.readAsDataURL(file);
            } else {
                reader.onload = event => {
                    appState.currentAttachments.push({ name: file.name, data: event.target.result, type: file.type });
                    renderAttachments();
                    triggerAutoSave();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function renderAttachments() {
        attachmentsPreview.innerHTML = '';
        appState.currentAttachments.forEach((att, idx) => {
            const chip = document.createElement('div');
            chip.classList.add('attachment-chip');
            chip.innerHTML = `📎 ${escapeHTML(att.name)} <button onclick="removeAttachment(${idx})">×</button>`;
            attachmentsPreview.appendChild(chip);
        });
    }

    window.removeAttachment = function(idx) {
        appState.currentAttachments.splice(idx, 1);
        renderAttachments();
        triggerAutoSave();
    };

    // Canvas Sketch Pad
    openDrawingBtn.addEventListener('click', () => {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
        drawingModal.style.display = 'flex';
    });

    sketchCanvas.addEventListener('mousedown', e => {
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
    });
    sketchCanvas.addEventListener('mousemove', e => {
        if (!isDrawing) return;
        ctx.strokeStyle = brushColor.value;
        ctx.lineWidth = brushSize.value;
        ctx.lineCap = 'round';
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
    });
    sketchCanvas.addEventListener('mouseup', () => isDrawing = false);
    sketchCanvas.addEventListener('mouseleave', () => isDrawing = false);

    clearCanvasBtn.addEventListener('click', () => {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    });
    cancelDrawingBtn.addEventListener('click', () => drawingModal.style.display = 'none');
    
    saveDrawingBtn.addEventListener('click', () => {
        const dataUrl = sketchCanvas.toDataURL('image/png');
        const imgHtml = `<img src="${dataUrl}" alt="Canvas Sketch">`;
        document.execCommand('insertHTML', false, imgHtml);
        drawingModal.style.display = 'none';
        triggerAutoSave();
    });

    // Auto-Save Management
    [noteTitleInput, noteTagsInput, noteTextEditor, noteColorInput, noteFolderSelect, noteProtectedInput].forEach(el => {
        el.addEventListener('input', triggerAutoSave);
        el.addEventListener('change', triggerAutoSave);
    });

    function triggerAutoSave() {
        updateStats();
        autoSaveIndicator.textContent = 'Saving...';
        autoSaveIndicator.style.background = '#78350f';
        
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            performAutoSave();
            autoSaveIndicator.textContent = 'Saved';
            autoSaveIndicator.style.background = '#064e3b';
        }, 800);
    }

    function performAutoSave() {
        const title = noteTitleInput.value.trim();
        const tagsRaw = noteTagsInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const tags = tagsRaw.map(t => t.startsWith('#') ? t : `#${t}`);
        const text = appState.currentMode === 'text' ? sanitizeHTML(noteTextEditor.innerHTML) : appState.currentChecklist.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n');

        if (!appState.editingNoteId) {
            appState.editingNoteId = Date.now().toString();
            notes.unshift({
                id: appState.editingNoteId,
                createdAt: Date.now(),
                type: appState.currentMode,
                title, tags, text,
                items: appState.currentMode === 'checklist' ? appState.currentChecklist : [],
                attachments: [...appState.currentAttachments],
                folderId: noteFolderSelect.value || null,
                archived: false, deleted: false, pinned: false,
                color: noteColorInput.value,
                isProtected: noteProtectedInput.checked,
                history: []
            });
        } else {
            const note = notes.find(n => n.id === appState.editingNoteId);
            if (note) {
                if (note.text !== text && note.text) {
                    if (!note.history) note.history = [];
                    note.history.unshift({ timestamp: Date.now(), title: note.title, text: note.text });
                    if (note.history.length > 5) note.history.pop();
                }
                note.title = title;
                note.tags = tags;
                note.text = text;
                note.items = appState.currentMode === 'checklist' ? appState.currentChecklist : [];
                note.attachments = [...appState.currentAttachments];
                note.color = noteColorInput.value;
                note.folderId = noteFolderSelect.value || null;
                note.isProtected = noteProtectedInput.checked;
            }
        }
        populateVersionHistory();
        saveAndRender();
    }

    function populateVersionHistory() {
        versionSelect.innerHTML = '<option value="">Current Draft</option>';
        if (!appState.editingNoteId) return;
        const note = notes.find(n => n.id === appState.editingNoteId);
        if (note && note.history) {
            note.history.forEach((ver, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = new Date(ver.timestamp).toLocaleTimeString() + ' revision';
                versionSelect.appendChild(opt);
            });
        }
    }

    versionSelect.addEventListener('change', () => {
        if (versionSelect.value === '') return;
        const note = notes.find(n => n.id === appState.editingNoteId);
        if (note && note.history && note.history[versionSelect.value]) {
            const ver = note.history[versionSelect.value];
            noteTextEditor.innerHTML = sanitizeHTML(ver.text);
            noteTitleInput.value = ver.title;
            triggerAutoSave();
        }
    });

    function updateStats() {
        const text = noteTextEditor.innerText.trim();
        const words = text ? text.split(/\s+/).length : 0;
        modalStats.textContent = `${words} words | ${text.length} chars`;
    }

    // Modal Operations
    createNewNoteBtn.addEventListener('click', () => { typeModal.style.display = 'flex'; });
    closeTypeBtn.addEventListener('click', () => { typeModal.style.display = 'none'; });
    selectTextNote.addEventListener('click', () => { typeModal.style.display = 'none'; openModal('text'); });
    selectChecklistNote.addEventListener('click', () => { typeModal.style.display = 'none'; openModal('checklist'); });

    function openModal(mode, noteToEdit = null) {
        appState.currentMode = mode;
        appState.editingNoteId = noteToEdit ? noteToEdit.id : null;

        modalTitle.textContent = noteToEdit ? 'Edit Note' : (mode === 'checklist' ? 'New Checklist' : 'New Standard Note');
        noteTitleInput.value = noteToEdit ? noteToEdit.title : '';
        noteTagsInput.value = noteToEdit && noteToEdit.tags ? noteToEdit.tags.join(', ') : '';
        noteProtectedInput.checked = noteToEdit ? !!noteToEdit.isProtected : false;
        noteFolderSelect.value = noteToEdit ? noteToEdit.folderId || '' : (appState.currentView.startsWith('folder_') ? appState.currentView : '');

        appState.currentAttachments = noteToEdit && noteToEdit.attachments ? [...noteToEdit.attachments] : [];
        renderAttachments();

        if (mode === 'checklist') {
            textToolbar.style.display = 'none';
            noteTextEditor.style.display = 'none';
            checklistEditor.style.display = 'flex';
            appState.currentChecklist = noteToEdit && noteToEdit.items ? [...noteToEdit.items] : [];
            renderChecklistItems();
        } else {
            textToolbar.style.display = 'flex';
            noteTextEditor.style.display = 'block';
            checklistEditor.style.display = 'none';
            noteTextEditor.innerHTML = noteToEdit ? sanitizeHTML(noteToEdit.text) : '';
        }

        noteColorInput.value = noteToEdit ? noteToEdit.color || '#1e293b' : '#1e293b';
        populateVersionHistory();
        updateStats();
        noteModal.style.display = 'flex';
    }

    function editNote(id) {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        openModal(note.type || 'text', note);
    }

    saveBtn.addEventListener('click', () => {
        performAutoSave();
        noteModal.style.display = 'none';
    });
    cancelBtn.addEventListener('click', () => { noteModal.style.display = 'none'; });

    // Checklist Management
    addChecklistItemBtn.addEventListener('click', () => {
        const text = newChecklistItem.value.trim();
        if (text) {
            appState.currentChecklist.push({ text, done: false });
            newChecklistItem.value = '';
            renderChecklistItems();
            triggerAutoSave();
        }
    });

    function renderChecklistItems() {
        checklistItemsList.innerHTML = '';
        appState.currentChecklist.forEach((item, index) => {
            const li = document.createElement('li');
            if (item.done) li.classList.add('done');
            li.innerHTML = `<input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem(${index})"><span>${escapeHTML(item.text)}</span>`;
            checklistItemsList.appendChild(li);
        });
    }

    window.toggleChecklistItem = function(index) {
        appState.currentChecklist[index].done = !appState.currentChecklist[index].done;
        renderChecklistItems();
        triggerAutoSave();
    };

    window.toggleCardChecklist = function(noteId, itemIdx) {
        const note = notes.find(n => n.id === noteId);
        if (note && note.items && note.items[itemIdx]) {
            note.items[itemIdx].done = !note.items[itemIdx].done;
            saveAndRender();
        }
    };

    // Global Note Action Listeners
    window.togglePinNote = id => { const n = notes.find(x => x.id === id); if (n) n.pinned = !n.pinned; saveAndRender(); };
    window.archiveNote = id => { const n = notes.find(x => x.id === id); if (n) { n.archived = true; saveAndRender(); } };
    window.unarchiveNote = id => { const n = notes.find(x => x.id === id); if (n) { n.archived = false; saveAndRender(); } };
    
    // Deleting operations explicitly checked using verifyProtectedAction
    window.moveToBin = id => { const n = notes.find(x => x.id === id); if (n && verifyProtectedAction(n)) { n.deleted = true; saveAndRender(); } };
    window.restoreNote = id => { const n = notes.find(x => x.id === id); if (n) { n.deleted = false; n.archived = false; saveAndRender(); } };
    window.permanentlyDeleteNote = id => { const n = notes.find(x => x.id === id); if (n && verifyProtectedAction(n)) { setNotes(notes.filter(x => x.id !== id)); saveAndRender(); } };

    // Export and Import Data Handlers
    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ notes, folders }, null, 2));
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
                if (Array.isArray(importedData)) setNotes(importedData);
                else if (importedData.notes) {
                    setNotes(importedData.notes || []);
                    setFolders(importedData.folders || []);
                }
                saveAndRender();
                alert('Imported successfully!');
            } catch (err) { alert('Invalid JSON file format.'); }
        };
        if (e.target.files[0]) fileReader.readAsText(e.target.files[0]);
    });

    saveAndRender();
});

// Render Functions (Exported)
export function renderFolders() {
    const foldersTree = document.getElementById('foldersTree');
    if (!foldersTree) return;
    foldersTree.innerHTML = '';
    folders.filter(f => !f.parentId).forEach(folder => {
        foldersTree.appendChild(createFolderDOM(folder, 0));
    });
}

function createFolderDOM(folder, depth) {
    const container = document.createElement('div');
    const item = document.createElement('div');
    item.classList.add('folder-item');
    if (appState.currentView === folder.id) item.classList.add('active');
    item.style.paddingLeft = `${0.85 + depth * 0.75}rem`;

    item.innerHTML = `
        <span class="folder-name">📁 ${escapeHTML(folder.name)}</span>
        <div class="folder-actions">
            <button class="folder-btn" onclick="event.stopPropagation(); createSubfolder('${folder.id}')">+</button>
            <button class="folder-btn" onclick="event.stopPropagation(); deleteFolder('${folder.id}')">×</button>
        </div>
    `;

    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        appState.currentView = folder.id;
        document.getElementById('viewHeading').textContent = `Folder: ${folder.name}`;
        renderFolders();
        document.getElementById('actionCard').style.display = 'flex';
        renderNotes();
    });

    container.appendChild(item);
    folders.filter(f => f.parentId === folder.id).forEach(sub => container.appendChild(createFolderDOM(sub, depth + 1)));
    return container;
}

export function updateFolderSelectOptions() {
    const noteFolderSelect = document.getElementById('noteFolderSelect');
    if (!noteFolderSelect) return;
    noteFolderSelect.innerHTML = '<option value="">(No Folder)</option>';
    folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `${f.parentId ? '  └ ' : ''}${f.name}`;
        noteFolderSelect.appendChild(opt);
    });
}

export function renderNotes() {
    const notesContainer = document.getElementById('notesContainer');
    if (!notesContainer) return;
    notesContainer.innerHTML = '';

    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const selectedType = document.getElementById('typeFilter').value;
    const selectedColor = document.getElementById('colorFilter').value;
    const selectedSort = document.getElementById('sortFilter').value;

    let filtered = notes.filter(note => {
        if (appState.currentView === 'active') { if (note.archived || note.deleted) return false; }
        else if (appState.currentView === 'archive') { if (!note.archived || note.deleted) return false; }
        else if (appState.currentView === 'bin') { if (!note.deleted) return false; }
        else { if (note.folderId !== appState.currentView || note.deleted) return false; }

        if (query) {
            const titleMatch = (note.title || '').toLowerCase().includes(query);
            const textMatch = (note.text || '').toLowerCase().includes(query);
            const tagsMatch = (note.tags || []).some(t => t.toLowerCase().includes(query));
            if (!titleMatch && !textMatch && !tagsMatch) return false;
        }

        if (selectedType !== 'all' && note.type !== selectedType) return false;
        if (selectedColor !== 'all' && (note.color || '#1e293b') !== selectedColor) return false;

        return true;
    });

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
            const listItems = note.items.slice(0, 3).map((item, idx) => 
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
        if (appState.currentView !== 'archive' && appState.currentView !== 'bin') {
            actionButtons = `
                <button class="card-btn" onclick="event.stopPropagation(); togglePinNote('${note.id}')">${note.pinned ? 'Unpin' : 'Pin'}</button>
                <button class="card-btn" onclick="event.stopPropagation(); archiveNote('${note.id}')">Archive</button>
                <button class="card-btn" onclick="event.stopPropagation(); moveToBin('${note.id}')">Delete</button>
            `;
        } else if (appState.currentView === 'archive') {
            actionButtons = `
                <button class="card-btn" onclick="event.stopPropagation(); unarchiveNote('${note.id}')">Unarchive</button>
                <button class="card-btn" onclick="event.stopPropagation(); moveToBin('${note.id}')">Delete</button>
            `;
        } else if (appState.currentView === 'bin') {
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

        card.addEventListener('click', () => {
            const n = notes.find(x => x.id === note.id);
            if (n) {
                document.getElementById('noteTitleInput').value = n.title || '';
                document.getElementById('noteTagsInput').value = n.tags ? n.tags.join(', ') : '';
                document.getElementById('noteProtectedInput').checked = !!n.isProtected;
                document.getElementById('noteFolderSelect').value = n.folderId || '';
                document.getElementById('noteTextEditor').innerHTML = sanitizeHTML(n.text || '');
                document.getElementById('noteColorInput').value = n.color || '#1e293b';
                appState.editingNoteId = n.id;
                document.getElementById('noteModal').style.display = 'flex';
            }
        });
        notesContainer.appendChild(card);
    });
}