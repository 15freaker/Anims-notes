function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    if (note.protected && !verifyProtectedAction()) return;

    appState.editingNoteId = id;
    appState.currentMode = note.type || 'text';
    appState.currentChecklist = JSON.parse(
        JSON.stringify(note.checklist || [])
    );
    appState.currentAttachments = JSON.parse(
        JSON.stringify(note.attachments || [])
    );

    const modal = document.getElementById('noteModal');
    const titleInput = document.getElementById('noteTitleInput');
    const tagsInput = document.getElementById('noteTagsInput');
    const colorInput = document.getElementById('noteColorInput');
    const protectedInput = document.getElementById('noteProtectedInput');
    const folderSelect = document.getElementById('noteFolderSelect');
    const editor = document.getElementById('noteTextEditor');

    if (modal) modal.style.display = 'flex';
    if (titleInput) titleInput.value = note.title || '';
    if (tagsInput) tagsInput.value = (note.tags || []).join(', ');
    if (colorInput) colorInput.value = note.color || '#1e293b';
    if (protectedInput) protectedInput.checked = !!note.protected;

    if (folderSelect) {
        folderSelect.innerHTML = `
            <option value="">No Folder</option>
            ${folders.map(folder => `
                <option value="${escapeHTML(folder.id)}">
                    ${escapeHTML(folder.name || 'Untitled')}
                </option>
            `).join('')}
        `;

        folderSelect.value = note.folderId || '';
    }

    if (editor) {
        editor.innerHTML = sanitizeHTML(note.content || '');
    }

    const checklistEditor = document.getElementById('checklistEditor');
    const textToolbar = document.getElementById('textToolbar');

    if (appState.currentMode === 'checklist') {
        if (checklistEditor) checklistEditor.style.display = 'block';
        if (textToolbar) textToolbar.style.display = 'none';
        if (editor) editor.style.display = 'none';
        renderChecklistBuilder();
    } else {
        if (checklistEditor) checklistEditor.style.display = 'none';
        if (textToolbar) textToolbar.style.display = 'flex';
        if (editor) editor.style.display = 'block';
    }

    renderAttachmentsPreview();
    updateEditorStats();

    const favoriteButton = document.getElementById('toggleFavoriteModalBtn');
    if (favoriteButton) {
        favoriteButton.textContent = note.favorite
            ? '⭐ Favorited'
            : '☆ Favorite';
    }

    const historyButton = document.getElementById('noteHistoryBtn');
    if (historyButton) {
        historyButton.onclick = () => {
            const historyModal = document.getElementById('historyModal');
            if (!historyModal) return;

            renderHistory(note);
            historyModal.style.display = 'flex';
        };
    }
}

function renderChecklistBuilder() {
    const list = document.getElementById('checklistItemsList');
    if (!list) return;

    list.innerHTML = appState.currentChecklist.map((item, index) => `
        <div class="checklist-builder-item">
            <input
                type="checkbox"
                class="checklist-check"
                data-index="${index}"
                ${item.completed ? 'checked' : ''}
            >

            <input
                type="text"
                class="checklist-text"
                data-index="${index}"
                value="${escapeHTML(item.text || '')}"
            >

            <button
                type="button"
                class="remove-checklist-item"
                data-index="${index}"
            >
                ×
            </button>
        </div>
    `).join('');

    list.querySelectorAll('.checklist-check').forEach(input => {
        input.addEventListener('change', () => {
            const index = Number(input.dataset.index);
            if (appState.currentChecklist[index]) {
                appState.currentChecklist[index].completed = input.checked;
                triggerAutoSave();
            }
        });
    });

    list.querySelectorAll('.checklist-text').forEach(input => {
        input.addEventListener('input', () => {
            const index = Number(input.dataset.index);
            if (appState.currentChecklist[index]) {
                appState.currentChecklist[index].text = input.value;
                triggerAutoSave();
            }
        });
    });

    list.querySelectorAll('.remove-checklist-item').forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.index);
            appState.currentChecklist.splice(index, 1);
            renderChecklistBuilder();
            triggerAutoSave();
        });
    });
}

function renderAttachmentsPreview() {
    const container = document.getElementById('attachmentsPreview');
    if (!container) return;

    if (!appState.currentAttachments.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = appState.currentAttachments.map((file, index) => `
        <div class="attachment-item">
            <span>📎 ${escapeHTML(file.name || 'Attachment')}</span>

            <button
                type="button"
                class="remove-attachment"
                data-index="${index}"
            >
                ×
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.remove-attachment').forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.index);
            appState.currentAttachments.splice(index, 1);
            renderAttachmentsPreview();
            triggerAutoSave();
        });
    });
}

function updateEditorStats() {
    const stats = document.getElementById('modalStats');
    if (!stats) return;

    const title = document.getElementById('noteTitleInput')?.value || '';
    const editor = document.getElementById('noteTextEditor');

    let content = '';

    if (appState.currentMode === 'checklist') {
        content = appState.currentChecklist
            .map(item => item.text || '')
            .join(' ');
    } else if (editor) {
        content = editor.innerText || '';
    }

    const words = content.trim()
        ? content.trim().split(/\s+/).length
        : 0;

    const characters = content.length;

    stats.textContent =
        `${words} words · ${characters} characters`;
}

function saveCurrentNote() {
    const note = notes.find(n => n.id === appState.editingNoteId);
    if (!note) return;

    const titleInput = document.getElementById('noteTitleInput');
    const tagsInput = document.getElementById('noteTagsInput');
    const colorInput = document.getElementById('noteColorInput');
    const protectedInput = document.getElementById('noteProtectedInput');
    const folderSelect = document.getElementById('noteFolderSelect');
    const editor = document.getElementById('noteTextEditor');

    const newTitle = titleInput?.value.trim() || '';

    const newContent = appState.currentMode === 'text'
        ? sanitizeHTML(editor?.innerHTML || '')
        : '';

    const newTags = tagsInput?.value
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean) || [];

    const snapshot = makeNoteSnapshot(note);

    note.title = newTitle;
    note.content = newContent;
    note.type = appState.currentMode;
    note.checklist = JSON.parse(
        JSON.stringify(appState.currentChecklist)
    );
    note.tags = newTags;
    note.color = colorInput?.value || '#1e293b';
    note.folderId = folderSelect?.value || null;
    note.protected = !!protectedInput?.checked;
    note.attachments = JSON.parse(
        JSON.stringify(appState.currentAttachments)
    );
    note.updatedAt = Date.now();

    if (snapshotsDiffer(note, snapshot)) {
        if (!note.history) note.history = [];
        note.history.unshift(snapshot);
        note.history = note.history.slice(0, 20);
    }

    localStorage.setItem('anims_notes', JSON.stringify(notes));
    localStorage.setItem('anims_folders', JSON.stringify(folders));

    renderNotes();
    renderFolders();
    renderQuickAccess();
    updateEditorStats();

    const indicator = document.getElementById('autoSaveIndicator');
    if (indicator) {
        indicator.textContent = 'Saved';
        indicator.classList.add('saved');

        setTimeout(() => {
            indicator.classList.remove('saved');
        }, 1000);
    }
}

function triggerAutoSave() {
    updateEditorStats();

    clearTimeout(autoSaveTimer);

    const indicator = document.getElementById('autoSaveIndicator');

    if (indicator) {
        indicator.textContent = 'Saving...';
    }

    autoSaveTimer = setTimeout(() => {
        saveCurrentNote();
    }, 700);
}