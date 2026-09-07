// State Management
let notes = JSON.parse(localStorage.getItem('anims_notes') || '[]');
let folders = JSON.parse(localStorage.getItem('anims_folders') || '[]');

const appState = {
    currentView: 'active',
    editingNoteId: null,
    currentMode: 'text',
    currentChecklist: [],
    currentAttachments: []
};

let autoSaveTimer = null;
let isDrawing = false;

// Utility Helpers
function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

function sanitizeHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('script, style, iframe, object, embed').forEach(e => e.remove());
    return temp.innerHTML;
}

function verifyProtectedAction() {
    const pin = prompt('Enter 4-digit PIN for protected note:');
    return pin === '1234';
}

function saveAndRender() {
    localStorage.setItem('anims_notes', JSON.stringify(notes));
    localStorage.setItem('anims_folders', JSON.stringify(folders));
    renderFolders();
    renderQuickAccess();
    renderNotes();
}

// Favorites & Quick Access
function renderQuickAccess() {
    const container = document.getElementById('quickAccessItems');
    if (!container) return;

    container.innerHTML = '';

    const favoriteNotes = notes
        .filter(note => note.favorite && !note.inBin && !note.archived)
        .slice(0, 10);

    const pinnedFolders = folders
        .filter(folder => folder.pinned)
        .slice(0, 10);

    if (favoriteNotes.length === 0 && pinnedFolders.length === 0) {
        container.innerHTML =
            '<span class="quick-access-empty">Star notes or pin folders to see them here.</span>';
        return;
    }

    favoriteNotes.forEach(note => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'qa-chip';
        chip.title = 'Open favorite note';
        chip.innerHTML = `★ ${escapeHTML(note.title || 'Untitled Note')}`;

        chip.addEventListener('click', () => {
            openEditModal(note.id);
        });

        container.appendChild(chip);
    });

    pinnedFolders.forEach(folder => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'qa-chip folder-chip';
        chip.title = 'Open pinned folder';
        chip.innerHTML = `📁 ${escapeHTML(folder.name)}`;

        chip.addEventListener('click', () => {
            appState.currentView = folder.id;

            document
                .querySelectorAll('.nav-item, .folder-item')
                .forEach(el => el.classList.remove('active'));

            const folderElement = Array.from(
                document.querySelectorAll('.folder-item')
            ).find(el => el.dataset.folderId === folder.id);

            if (folderElement) {
                folderElement.classList.add('active');
            }

            const heading = document.getElementById('viewHeading');

            if (heading) {
                heading.textContent = folder.name;
            }

            const actionCard = document.getElementById('actionCard');

            if (actionCard) {
                actionCard.style.display = 'flex';
            }

            renderFolders();
            renderNotes();
        });

        container.appendChild(chip);
    });
}

function toggleNoteFavorite(noteId) {
    const note = notes.find(n => n.id === noteId);

    if (!note) return;

    note.favorite = !note.favorite;

    saveAndRender();
}

function toggleFolderPin(folderId) {
    const folder = folders.find(f => f.id === folderId);

    if (!folder) return;

    folder.pinned = !folder.pinned;

    saveAndRender();
}

// Convert HTML content into clean Markdown
function htmlToMarkdown(html, title, tags) {
    let md = `# ${title}\n\n`;

    if (tags && tags.length > 0) {
        md += `**Tags:** ${tags.join(' ')}\n\n---\n\n`;
    }

    const temp = document.createElement('div');
    temp.innerHTML = html;

    let text = temp.innerHTML
        .replace(/<b>(.*?)<\/b>|<strong>(.*?)<\/strong>/gi, '**$1$2**')
        .replace(/<i>(.*?)<\/i>|<em>(.*?)<\/em>/gi, '*$1$2*')
        .replace(/<u>(.*?)<\/u>/gi, '_$1_')
        .replace(/<mark>(.*?)<\/mark>/gi, '==$1==')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>|<\/div>/gi, '\n\n')
        .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![Image]($1)\n');

    temp.innerHTML = text;

    return md + temp.textContent.trim();
}

// Download File Blob helper
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

// Render Folder Tree Sidebar & Modal Dropdowns
function renderFolders() {
    const foldersTree = document.getElementById('foldersTree');
    const noteFolderSelect = document.getElementById('noteFolderSelect');

    if (foldersTree) {
        foldersTree.innerHTML = '';

        folders.forEach(folder => {
            const folderEl = document.createElement('div');

            folderEl.className =
                `folder-item ${appState.currentView === folder.id ? 'active' : ''}`;

            folderEl.dataset.folderId = folder.id;

            folderEl.innerHTML = `
                <span class="folder-name">
                    📁 ${escapeHTML(folder.name)}
                </span>

                <div class="folder-actions">
                    <button
                        class="folder-btn folder-pin-btn ${folder.pinned ? 'pinned' : ''}"
                        title="${folder.pinned ? 'Unpin Folder' : 'Pin Folder'}"
                    >
                        ${folder.pinned ? '★' : '☆'}
                    </button>

                    <button
                        class="folder-btn delete-folder-btn"
                        title="Delete Folder"
                    >
                        ✕
                    </button>
                </div>
            `;

            folderEl.addEventListener('click', (e) => {

                if (e.target.classList.contains('folder-pin-btn')) {
                    e.stopPropagation();

                    toggleFolderPin(folder.id);

                    return;
                }

                if (e.target.classList.contains('delete-folder-btn')) {
                    e.stopPropagation();

                    if (
                        confirm(
                            `Delete folder "${folder.name}"? Notes inside will be unassigned.`
                        )
                    ) {
                        folders = folders.filter(f => f.id !== folder.id);

                        notes.forEach(n => {
                            if (n.folderId === folder.id) {
                                n.folderId = null;
                            }
                        });

                        saveAndRender();
                    }

                    return;
                }

                document
                    .querySelectorAll('.nav-item, .folder-item')
                    .forEach(el => el.classList.remove('active'));

                folderEl.classList.add('active');

                appState.currentView = folder.id;

                const heading = document.getElementById('viewHeading');

                if (heading) {
                    heading.textContent = folder.name;
                }

                const actionCard = document.getElementById('actionCard');

                if (actionCard) {
                    actionCard.style.display = 'flex';
                }

                renderNotes();
            });

            foldersTree.appendChild(folderEl);
        });
    }

    if (noteFolderSelect) {
        noteFolderSelect.innerHTML =
            '<option value="">None (Root)</option>';

        folders.forEach(folder => {
            const opt = document.createElement('option');

            opt.value = folder.id;
            opt.textContent = folder.name;

            noteFolderSelect.appendChild(opt);
        });
    }
}

// Filter and Render Notes Grid
function renderNotes() {
    const notesContainer =
        document.getElementById('notesContainer');

    if (!notesContainer) return;

    const query =
        document.getElementById('searchInput')?.value.toLowerCase() || '';

    const typeVal =
        document.getElementById('typeFilter')?.value || 'all';

    const colorVal =
        document.getElementById('colorFilter')?.value || 'all';

    const sortVal =
        document.getElementById('sortFilter')?.value || 'newest';

    let filtered = notes.filter(note => {

        // View Filtering
        if (appState.currentView === 'active') {

            if (note.archived || note.inBin) {
                return false;
            }

        } else if (appState.currentView === 'favorites') {

            if (!note.favorite || note.inBin || note.archived) {
                return false;
            }

        } else if (appState.currentView === 'archive') {

            if (!note.archived || note.inBin) {
                return false;
            }

        } else if (appState.currentView === 'bin') {

            if (!note.inBin) {
                return false;
            }

        } else {

            // Folder view
            if (
                note.inBin ||
                note.folderId !== appState.currentView
            ) {
                return false;
            }
        }

        // Type filter
        if (typeVal !== 'all' && note.type !== typeVal) {
            return false;
        }

        // Color filter
        if (colorVal !== 'all' && note.color !== colorVal) {
            return false;
        }

        // Search
        if (query) {
            const inTitle =
                (note.title || '').toLowerCase().includes(query);

            const inContent =
                (note.content || '').toLowerCase().includes(query);

            const inTags =
                (note.tags || []).some(t =>
                    t.toLowerCase().includes(query)
                );

            if (!inTitle && !inContent && !inTags) {
                return false;
            }
        }

        return true;
    });

    // Sorting
    filtered.sort((a, b) => {

        if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1;
        }

        if (sortVal === 'newest') {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        }

        if (sortVal === 'oldest') {
            return (a.updatedAt || 0) - (b.updatedAt || 0);
        }

        if (sortVal === 'title') {
            return (a.title || '').localeCompare(
                b.title || ''
            );
        }

        return 0;
    });

    notesContainer.innerHTML = '';

    if (filtered.length === 0) {
        notesContainer.innerHTML = `
            <div
                style="
                    grid-column: 1/-1;
                    text-align: center;
                    color: #64748b;
                    padding: 2rem;
                "
            >
                No notes found.
            </div>
        `;

        return;
    }

    filtered.forEach(note => {

        const card = document.createElement('div');

        card.className =
            `note-card ${note.pinned ? 'pinned' : ''} ${
                note.protected ? 'protected-note' : ''
            }`;

        card.style.backgroundColor =
            note.color || '#1e293b';

        let badgeHtml = '';

        if (note.pinned) {
            badgeHtml +=
                `<span class="pin-badge">Pinned</span>`;
        }

        if (note.protected) {
            badgeHtml +=
                `<span class="protected-badge">Protected</span>`;
        }

        let tagsHtml =
            (note.tags || [])
                .map(
                    t =>
                        `<span class="tag-chip">${escapeHTML(t)}</span>`
                )
                .join('');

        let contentPreview = '';

        if (note.protected) {

            contentPreview = `
                <div class="note-body">
                    <em>🔒 Content protected by PIN.</em>
                </div>
            `;

        } else if (note.type === 'checklist') {

            const listItems =
                (note.checklist || [])
                    .slice(0, 3)
                    .map(
                        item =>
                            `<li class="${item.done ? 'done' : ''}">
                                ${item.done ? '☑' : '☐'}
                                ${escapeHTML(item.text)}
                            </li>`
                    )
                    .join('');

            contentPreview = `
                <ul class="card-checklist-items">
                    ${listItems}
                </ul>
            `;

        } else {

            contentPreview = `
                <div class="note-body">
                    ${sanitizeHTML(note.content || '')}
                </div>
            `;
        }

        // Action Buttons
        let actionsHtml = '';

        if (appState.currentView === 'bin') {

            actionsHtml = `
                <button class="card-btn restore-btn">
                    Restore
                </button>

                <button class="card-btn delete-perm-btn">
                    Delete Permanently
                </button>
            `;

        } else {

            actionsHtml = `
                <button class="card-btn pin-btn">
                    ${note.pinned ? 'Unpin' : 'Pin'}
                </button>

                <button class="card-btn archive-btn">
                    ${note.archived ? 'Unarchive' : 'Archive'}
                </button>

                <button class="card-btn delete-btn">
                    Trash
                </button>
            `;
        }

        card.innerHTML = `
            <button
                class="favorite-card-btn ${note.favorite ? 'active' : ''}"
                title="${
                    note.favorite
                        ? 'Remove from Favorites'
                        : 'Add to Favorites'
                }"
            >
                ${note.favorite ? '★' : '☆'}
            </button>

            ${badgeHtml}

            <div>
                <h3>
                    ${escapeHTML(note.title || 'Untitled Note')}
                </h3>

                <div class="card-tags">
                    ${tagsHtml}
                </div>

                ${contentPreview}
            </div>

            <div class="card-actions">
                ${actionsHtml}
            </div>
        `;

        // Open Note
        card.addEventListener('click', (e) => {

            if (e.target.tagName === 'BUTTON') {
                return;
            }

            openEditModal(note.id);
        });

        // Favorite
        const favoriteBtn =
            card.querySelector('.favorite-card-btn');

        if (favoriteBtn) {

            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                toggleNoteFavorite(note.id);
            });
        }

        // Pin
        const pinBtn =
            card.querySelector('.pin-btn');

        if (pinBtn) {

            pinBtn.addEventListener('click', () => {

                note.pinned = !note.pinned;

                saveAndRender();
            });
        }

        // Archive
        const archiveBtn =
            card.querySelector('.archive-btn');

        if (archiveBtn) {

            archiveBtn.addEventListener('click', () => {

                note.archived = !note.archived;

                saveAndRender();
            });
        }

        // Trash
        const deleteBtn =
            card.querySelector('.delete-btn');

        if (deleteBtn) {

            deleteBtn.addEventListener('click', () => {

                note.inBin = true;

                saveAndRender();
            });
        }

        // Restore
        const restoreBtn =
            card.querySelector('.restore-btn');

        if (restoreBtn) {

            restoreBtn.addEventListener('click', () => {

                note.inBin = false;

                saveAndRender();
            });
        }

        // Permanently Delete
        const deletePermBtn =
            card.querySelector('.delete-perm-btn');

        if (deletePermBtn) {

            deletePermBtn.addEventListener('click', () => {

                if (confirm('Permanently delete this note?')) {

                    notes = notes.filter(
                        n => n.id !== note.id
                    );

                    saveAndRender();
                }
            });
        }

        notesContainer.appendChild(card);
    });
}

// Open Edit Modal
function openEditModal(noteId) {

    const note = notes.find(n => n.id === noteId);

    if (!note) return;

    if (note.protected && !verifyProtectedAction()) {
        alert('Incorrect PIN!');
        return;
    }

    appState.editingNoteId = note.id;

    appState.currentMode =
        note.type || 'text';

    appState.currentChecklist =
        note.checklist
            ? JSON.parse(JSON.stringify(note.checklist))
            : [];

    appState.currentAttachments =
        note.attachments
            ? [...note.attachments]
            : [];

    document.getElementById('modalTitle').textContent =
        'Edit Note';

    document.getElementById('noteTitleInput').value =
        note.title || '';

    document.getElementById('noteTagsInput').value =
        (note.tags || []).join(', ');

    document.getElementById('noteProtectedInput').checked =
        !!note.protected;

    document.getElementById('noteFolderSelect').value =
        note.folderId || '';

    document.getElementById('noteColorInput').value =
        note.color || '#1e293b';

    const toggleFavoriteModalBtn =
        document.getElementById(
            'toggleFavoriteModalBtn'
        );

    if (toggleFavoriteModalBtn) {

        toggleFavoriteModalBtn.textContent =
            note.favorite ? '★' : '☆';

        toggleFavoriteModalBtn.classList.toggle(
            'active',
            !!note.favorite
        );

        toggleFavoriteModalBtn.title =
            note.favorite
                ? 'Remove from Favorites'
                : 'Add to Favorites';
    }

    const textEditor =
        document.getElementById('noteTextEditor');

    const textToolbar =
        document.getElementById('textToolbar');

    const checklistEditor =
        document.getElementById('checklistEditor');

    if (appState.currentMode === 'checklist') {

        textEditor.style.display = 'none';

        textToolbar.style.display = 'none';

        checklistEditor.style.display = 'flex';

        renderChecklistBuilder();

    } else {

        textEditor.style.display = 'block';

        textToolbar.style.display = 'flex';

        checklistEditor.style.display = 'none';

        textEditor.innerHTML =
            note.content || '';
    }

    renderAttachmentsPreview();

    updateEditorStats();

    document.getElementById('noteModal').style.display =
        'flex';
}

// Checklist Builder
function renderChecklistBuilder() {

    const listContainer =
        document.getElementById(
            'checklistItemsList'
        );

    if (!listContainer) return;

    listContainer.innerHTML = '';

    appState.currentChecklist.forEach(
        (item, index) => {

            const li =
                document.createElement('li');

            li.className =
                item.done ? 'done' : '';

            li.innerHTML = `
                <input
                    type="checkbox"
                    ${item.done ? 'checked' : ''}
                >

                <span style="flex: 1;">
                    ${escapeHTML(item.text)}
                </span>

                <button
                    type="button"
                    style="
                        background:none;
                        border:none;
                        color:#ef4444;
                        cursor:pointer;
                        font-weight:bold;
                    "
                >
                    ✕
                </button>
            `;

            li.querySelector('input')
                .addEventListener('change', (e) => {

                    appState.currentChecklist[index].done =
                        e.target.checked;

                    renderChecklistBuilder();

                    triggerAutoSave();
                });

            li.querySelector('button')
                .addEventListener('click', () => {

                    appState.currentChecklist.splice(
                        index,
                        1
                    );

                    renderChecklistBuilder();

                    triggerAutoSave();
                });

            listContainer.appendChild(li);
        }
    );
}

// Attachments Preview
function renderAttachmentsPreview() {

    const preview =
        document.getElementById(
            'attachmentsPreview'
        );

    if (!preview) return;

    preview.innerHTML = '';

    appState.currentAttachments.forEach(
        (att, idx) => {

            const chip =
                document.createElement('div');

            chip.className =
                'attachment-chip';

            chip.innerHTML = `
                <span>
                    📎 ${escapeHTML(att.name)}
                </span>

                <button type="button">
                    ✕
                </button>
            `;

            chip.querySelector('button')
                .addEventListener('click', () => {

                    appState.currentAttachments.splice(
                        idx,
                        1
                    );

                    renderAttachmentsPreview();

                    triggerAutoSave();
                });

            preview.appendChild(chip);
        }
    );
}

// Editor Statistics
function updateEditorStats() {

    const textEditor =
        document.getElementById(
            'noteTextEditor'
        );

    const modalStats =
        document.getElementById(
            'modalStats'
        );

    if (!modalStats) return;

    let text = '';

    if (appState.currentMode === 'text') {

        text =
            textEditor.innerText || '';

    } else {

        text =
            appState.currentChecklist
                .map(c => c.text)
                .join(' ');
    }

    const chars =
        text.length;

    const words =
        text.trim()
            ? text.trim().split(/\s+/).length
            : 0;

    modalStats.textContent =
        `${words} words | ${chars} chars`;
}

// Save Current Note
function saveCurrentNote() {

    if (!appState.editingNoteId) return;

    const note =
        notes.find(
            n => n.id === appState.editingNoteId
        );

    if (!note) return;

    note.title =
        document
            .getElementById('noteTitleInput')
            .value
            .trim();

    const tagsVal =
        document.getElementById(
            'noteTagsInput'
        ).value;

    note.tags =
        tagsVal
            ? tagsVal
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)
            : [];

    note.protected =
        document.getElementById(
            'noteProtectedInput'
        ).checked;

    note.folderId =
        document.getElementById(
            'noteFolderSelect'
        ).value || null;

    note.color =
        document.getElementById(
            'noteColorInput'
        ).value;

    note.updatedAt =
        Date.now();

    note.attachments =
        [...appState.currentAttachments];

    if (appState.currentMode === 'checklist') {

        note.checklist =
            [...appState.currentChecklist];

    } else {

        note.content =
            sanitizeHTML(
                document.getElementById(
                    'noteTextEditor'
                ).innerHTML
            );
    }

    saveAndRender();

    const indicator =
        document.getElementById(
            'autoSaveIndicator'
        );

    if (indicator) {

        indicator.textContent =
            'Saved';

        indicator.style.background =
            '#064e3b';
    }
}

// Auto Save
function triggerAutoSave() {

    const indicator =
        document.getElementById(
            'autoSaveIndicator'
        );

    if (indicator) {

        indicator.textContent =
            'Saving...';

        indicator.style.background =
            '#78350f';
    }

    clearTimeout(autoSaveTimer);

    autoSaveTimer =
        setTimeout(() => {

            saveCurrentNote();

        }, 1000);
}

// DOM Initialization
document.addEventListener(
    'DOMContentLoaded',
    () => {

        // DOM Elements
        const sidebar =
            document.getElementById(
                'sidebar'
            );

        const toggleSidebarBtn =
            document.getElementById(
                'toggleSidebarBtn'
            );

        const navItems =
            document.querySelectorAll(
                '.nav-item'
            );

        const viewHeading =
            document.getElementById(
                'viewHeading'
            );

        const actionCard =
            document.getElementById(
                'actionCard'
            );

        const createNewNoteBtn =
            document.getElementById(
                'createNewNoteBtn'
            );

        const addFolderBtn =
            document.getElementById(
                'addFolderBtn'
            );

        const searchInput =
            document.getElementById(
                'searchInput'
            );

        const typeFilter =
            document.getElementById(
                'typeFilter'
            );

        const colorFilter =
            document.getElementById(
                'colorFilter'
            );

        const sortFilter =
            document.getElementById(
                'sortFilter'
            );

        const typeModal =
            document.getElementById(
                'typeModal'
            );

        const selectTextNote =
            document.getElementById(
                'selectTextNote'
            );

        const selectChecklistNote =
            document.getElementById(
                'selectChecklistNote'
            );

        const closeTypeBtn =
            document.getElementById(
                'closeTypeBtn'
            );

        const noteModal =
            document.getElementById(
                'noteModal'
            );

        const noteTitleInput =
            document.getElementById(
                'noteTitleInput'
            );

        const noteTagsInput =
            document.getElementById(
                'noteTagsInput'
            );

        const noteTextEditor =
            document.getElementById(
                'noteTextEditor'
            );

        const addChecklistItemBtn =
            document.getElementById(
                'addChecklistItemBtn'
            );

        const newChecklistItem =
            document.getElementById(
                'newChecklistItem'
            );

        const fileAttachmentInput =
            document.getElementById(
                'fileAttachmentInput'
            );

        const saveBtn =
            document.getElementById(
                'saveBtn'
            );

        const cancelBtn =
            document.getElementById(
                'cancelBtn'
            );

        const exportNoteMenuBtn =
            document.getElementById(
                'exportNoteMenuBtn'
            );

        const exportMenu =
            document.getElementById(
                'exportMenu'
            );

        const exportPdfBtn =
            document.getElementById(
                'exportPdfBtn'
            );

        const exportMDBtn =
            document.getElementById(
                'exportMDBtn'
            );

        const exportTxtBtn =
            document.getElementById(
                'exportTxtBtn'
            );

        const exportBtn =
            document.getElementById(
                'exportBtn'
            );

        const importBtnTrigger =
            document.getElementById(
                'importBtnTrigger'
            );

        const importInput =
            document.getElementById(
                'importInput'
            );

        const drawingModal =
            document.getElementById(
                'drawingModal'
            );

        const openDrawingBtn =
            document.getElementById(
                'openDrawingBtn'
            );

        const sketchCanvas =
            document.getElementById(
                'sketchCanvas'
            );

        const brushColor =
            document.getElementById(
                'brushColor'
            );

        const brushSize =
            document.getElementById(
                'brushSize'
            );

        const clearCanvasBtn =
            document.getElementById(
                'clearCanvasBtn'
            );

        const cancelDrawingBtn =
            document.getElementById(
                'cancelDrawingBtn'
            );

        const saveDrawingBtn =
            document.getElementById(
                'saveDrawingBtn'
            );

        const ctx =
            sketchCanvas.getContext('2d');

        // Sidebar
        toggleSidebarBtn.addEventListener(
            'click',
            () => {
                sidebar.classList.toggle(
                    'collapsed'
                );
            }
        );

        // Navigation
        navItems.forEach(item => {

            item.addEventListener(
                'click',
                () => {

                    if (!item.dataset.view) {
                        return;
                    }

                    navItems.forEach(
                        nav =>
                            nav.classList.remove(
                                'active'
                            )
                    );

                    document
                        .querySelectorAll(
                            '.folder-item'
                        )
                        .forEach(
                            f =>
                                f.classList.remove(
                                    'active'
                                )
                        );

                    item.classList.add(
                        'active'
                    );

                    appState.currentView =
                        item.dataset.view;

                    if (
                        appState.currentView ===
                        'active'
                    ) {
                        viewHeading.textContent =
                            'All Notes';
                    }

                    if (
                        appState.currentView ===
                        'favorites'
                    ) {
                        viewHeading.textContent =
                            'Favorites';
                    }

                    if (
                        appState.currentView ===
                        'archive'
                    ) {
                        viewHeading.textContent =
                            'Archive';
                    }

                    if (
                        appState.currentView ===
                        'bin'
                    ) {
                        viewHeading.textContent =
                            'Recycle Bin';
                    }

                    actionCard.style.display =
                        appState.currentView ===
                        'bin'
                            ? 'none'
                            : 'flex';

                    renderNotes();
                }
            );
        });

        // Filters
        [
            searchInput,
            typeFilter,
            colorFilter,
            sortFilter
        ].forEach(el => {

            if (el) {

                el.addEventListener(
                    'input',
                    renderNotes
                );

                el.addEventListener(
                    'change',
                    renderNotes
                );
            }
        });

        // Formatting Toolbar
        document
            .getElementById('btnBold')
            .addEventListener(
                'click',
                () => {

                    document.execCommand(
                        'bold',
                        false,
                        null
                    );

                    triggerAutoSave();
                }
            );

        document
            .getElementById('btnItalic')
            .addEventListener(
                'click',
                () => {

                    document.execCommand(
                        'italic',
                        false,
                        null
                    );

                    triggerAutoSave();
                }
            );

        document
            .getElementById('btnUnderline')
            .addEventListener(
                'click',
                () => {

                    document.execCommand(
                        'underline',
                        false,
                        null
                    );

                    triggerAutoSave();
                }
            );

        document
            .getElementById('btnHighlight')
            .addEventListener(
                'click',
                () => {

                    document.execCommand(
                        'hiliteColor',
                        false,
                        '#facc15'
                    );

                    triggerAutoSave();
                }
            );

        // Auto Save Inputs
        noteTitleInput.addEventListener(
            'input',
            () => {

                updateEditorStats();

                triggerAutoSave();
            }
        );

        noteTagsInput.addEventListener(
            'input',
            triggerAutoSave
        );

        noteTextEditor.addEventListener(
            'input',
            () => {

                updateEditorStats();

                triggerAutoSave();
            }
        );

        // Checklist
        addChecklistItemBtn.addEventListener(
            'click',
            () => {

                const text =
                    newChecklistItem.value.trim();

                if (text) {

                    appState.currentChecklist.push({
                        text: text,
                        done: false
                    });

                    newChecklistItem.value = '';

                    renderChecklistBuilder();

                    triggerAutoSave();
                }
            }
        );

        // File Attachment
        fileAttachmentInput.addEventListener(
            'change',
            (e) => {

                const files =
                    Array.from(e.target.files);

                files.forEach(file => {

                    const reader =
                        new FileReader();

                    reader.onload =
                        (event) => {

                            appState.currentAttachments.push({
                                name: file.name,
                                type: file.type,
                                data: event.target.result
                            });

                            renderAttachmentsPreview();

                            triggerAutoSave();
                        };

                    reader.readAsDataURL(file);
                });
            }
        );

        // Folder Creation
        addFolderBtn.addEventListener(
            'click',
            () => {

                const folderName =
                    prompt('Enter Folder Name:');

                if (
                    folderName &&
                    folderName.trim()
                ) {

                    folders.push({
                        id:
                            'folder_' +
                            Date.now(),

                        name:
                            folderName.trim(),

                        pinned:
                            false
                    });

                    saveAndRender();
                }
            }
        );

        // New Note
        createNewNoteBtn.addEventListener(
            'click',
            () => {

                typeModal.style.display =
                    'flex';
            }
        );

        closeTypeBtn.addEventListener(
            'click',
            () => {

                typeModal.style.display =
                    'none';
            }
        );

        selectTextNote.addEventListener(
            'click',
            () => {

                typeModal.style.display =
                    'none';

                createNewNote('text');
            }
        );

        selectChecklistNote.addEventListener(
            'click',
            () => {

                typeModal.style.display =
                    'none';

                createNewNote('checklist');
            }
        );

        function createNewNote(type) {

            const newNote = {

                id:
                    'note_' +
                    Date.now(),

                title:
                    '',

                content:
                    '',

                type:
                    type,

                checklist:
                    [],

                tags:
                    [],

                color:
                    '#1e293b',

                folderId:
                    appState.currentView.startsWith(
                        'folder_'
                    )
                        ? appState.currentView
                        : null,

                pinned:
                    false,

                favorite:
                    false,

                archived:
                    false,

                inBin:
                    false,

                protected:
                    false,

                attachments:
                    [],

                updatedAt:
                    Date.now()
            };

            notes.unshift(newNote);

            saveAndRender();

            openEditModal(newNote.id);
        }

        // Save Note
        saveBtn.addEventListener(
            'click',
            () => {

                saveCurrentNote();

                noteModal.style.display =
                    'none';
            }
        );

        // Cancel / Close Note
        cancelBtn.addEventListener(
            'click',
            () => {

                saveCurrentNote();

                noteModal.style.display =
                    'none';
            }
        );

        // Favorite Button in Modal
        const toggleFavoriteModalBtn =
            document.getElementById(
                'toggleFavoriteModalBtn'
            );

        if (toggleFavoriteModalBtn) {

            toggleFavoriteModalBtn.addEventListener(
                'click',
                () => {

                    if (
                        !appState.editingNoteId
                    ) {
                        return;
                    }

                    const note =
                        notes.find(
                            n =>
                                n.id ===
                                appState.editingNoteId
                        );

                    if (!note) {
                        return;
                    }

                    note.favorite =
                        !note.favorite;

                    toggleFavoriteModalBtn.textContent =
                        note.favorite
                            ? '★'
                            : '☆';

                    toggleFavoriteModalBtn.classList.toggle(
                        'active',
                        note.favorite
                    );

                    toggleFavoriteModalBtn.title =
                        note.favorite
                            ? 'Remove from Favorites'
                            : 'Add to Favorites';

                    saveAndRender();
                }
            );
        }

        // Backup Export
        exportBtn.addEventListener(
            'click',
            () => {

                const backupData =
                    JSON.stringify(
                        {
                            notes,
                            folders
                        },
                        null,
                        2
                    );

                downloadFile(
                    backupData,
                    `anims_notes_backup_${Date.now()}.json`,
                    'application/json'
                );
            }
        );

        // Backup Import
        importBtnTrigger.addEventListener(
            'click',
            () => {
                importInput.click();
            }
        );

        importInput.addEventListener(
            'change',
            (e) => {

                const file =
                    e.target.files[0];

                if (!file) return;

                const reader =
                    new FileReader();

                reader.onload =
                    (event) => {

                        try {

                            const imported =
                                JSON.parse(
                                    event.target.result
                                );

                            if (
                                imported.notes &&
                                Array.isArray(
                                    imported.notes
                                )
                            ) {

                                notes =
                                    imported.notes;

                                folders =
                                    imported.folders ||
                                    [];

                                saveAndRender();

                                alert(
                                    'Backup restored successfully!'
                                );

                            } else {

                                alert(
                                    'Invalid backup file structure.'
                                );
                            }

                        } catch (err) {

                            alert(
                                'Error parsing backup file.'
                            );
                        }
                    };

                reader.readAsText(file);
            }
        );

        // Single Note Export Menu
        exportNoteMenuBtn.addEventListener(
            'click',
            (e) => {

                e.stopPropagation();

                exportMenu.classList.toggle(
                    'show'
                );
            }
        );

        document.addEventListener(
            'click',
            () => {

                exportMenu.classList.remove(
                    'show'
                );
            }
        );

        // TXT Export
        exportTxtBtn.addEventListener(
            'click',
            () => {

                const title =
                    noteTitleInput.value.trim() ||
                    'Untitled Note';

                let body =
                    appState.currentMode ===
                    'text'
                        ? noteTextEditor.innerText
                        : appState.currentChecklist
                            .map(
                                i =>
                                    `${i.done ? '[x]' : '[ ]'} ${i.text}`
                            )
                            .join('\n');

                const textContent =
                    `${title}\n` +
                    `${'='.repeat(title.length)}\n` +
                    `Tags: ${noteTagsInput.value}\n\n` +
                    body;

                downloadFile(
                    textContent,
                    `${title
                        .replace(/[^a-z0-9]/gi, '_')
                        .toLowerCase()}.txt`,
                    'text/plain'
                );
            }
        );

        // Markdown Export
        exportMDBtn.addEventListener(
            'click',
            () => {

                const title =
                    noteTitleInput.value.trim() ||
                    'Untitled Note';

                const tags =
                    noteTagsInput.value
                        .split(',')
                        .map(t => t.trim())
                        .filter(Boolean);

                let mdContent;

                if (
                    appState.currentMode ===
                    'text'
                ) {

                    mdContent =
                        htmlToMarkdown(
                            noteTextEditor.innerHTML,
                            title,
                            tags
                        );

                } else {

                    mdContent =
                        `# ${title}\n\n` +
                        `**Tags:** ${tags.join(' ')}\n\n` +
                        `---\n\n` +
                        appState.currentChecklist
                            .map(
                                i =>
                                    `- [${i.done ? 'x' : ' '}] ${i.text}`
                            )
                            .join('\n');
                }

                downloadFile(
                    mdContent,
                    `${title
                        .replace(/[^a-z0-9]/gi, '_')
                        .toLowerCase()}.md`,
                    'text/markdown'
                );
            }
        );

        // PDF Export
        exportPdfBtn.addEventListener(
            'click',
            () => {

                const title =
                    noteTitleInput.value.trim() ||
                    'Untitled Note';

                const tags =
                    noteTagsInput.value;

                const container =
                    document.createElement('div');

                container.style.padding =
                    '20px';

                container.style.color =
                    '#000000';

                container.style.fontFamily =
                    'Arial, sans-serif';

                let bodyHtml;

                if (
                    appState.currentMode ===
                    'text'
                ) {

                    bodyHtml =
                        noteTextEditor.innerHTML;

                } else {

                    bodyHtml =
                        `<ul>${
                            appState.currentChecklist
                                .map(
                                    i =>
                                        `<li style="list-style:none;">
                                            ${
                                                i.done
                                                    ? '☑'
                                                    : '☐'
                                            }
                                            ${escapeHTML(i.text)}
                                        </li>`
                                )
                                .join('')
                        }</ul>`;
                }

                container.innerHTML = `
                    <h1
                        style="
                            margin-bottom:5px;
                            color:#1e293b;
                        "
                    >
                        ${escapeHTML(title)}
                    </h1>

                    <p
                        style="
                            color:#64748b;
                            font-size:12px;
                            margin-bottom:15px;
                        "
                    >
                        Tags: ${escapeHTML(tags)}
                    </p>

                    <hr
                        style="
                            border:0;
                            border-top:1px solid #ccc;
                            margin-bottom:15px;
                        "
                    >

                    <div
                        style="
                            font-size:14px;
                            line-height:1.6;
                        "
                    >
                        ${bodyHtml}
                    </div>
                `;

                const opt = {

                    margin:
                        0.5,

                    filename:
                        `${title
                            .replace(/[^a-z0-9]/gi, '_')
                            .toLowerCase()}.pdf`,

                    image: {
                        type:
                            'jpeg',

                        quality:
                            0.98
                    },

                    html2canvas: {
                        scale:
                            2
                    },

                    jsPDF: {
                        unit:
                            'in',

                        format:
                            'letter',

                        orientation:
                            'portrait'
                    }
                };

                if (window.html2pdf) {

                    html2pdf()
                        .set(opt)
                        .from(container)
                        .save()
                        .then(() => {

                            console.log(
                                'PDF exported successfully'
                            );
                        });

                } else {

                    alert(
                        'PDF generator library is not ready.'
                    );
                }
            }
        );

        // Drawing / Sketch Pad
        openDrawingBtn.addEventListener(
            'click',
            () => {

                drawingModal.style.display =
                    'flex';

                ctx.fillStyle =
                    '#0f172a';

                ctx.fillRect(
                    0,
                    0,
                    sketchCanvas.width,
                    sketchCanvas.height
                );
            }
        );

        cancelDrawingBtn.addEventListener(
            'click',
            () => {

                drawingModal.style.display =
                    'none';
            }
        );

        clearCanvasBtn.addEventListener(
            'click',
            () => {

                ctx.fillStyle =
                    '#0f172a';

                ctx.fillRect(
                    0,
                    0,
                    sketchCanvas.width,
                    sketchCanvas.height
                );
            }
        );

        sketchCanvas.addEventListener(
            'mousedown',
            (e) => {

                isDrawing = true;

                ctx.beginPath();

                ctx.moveTo(
                    e.offsetX,
                    e.offsetY
                );
            }
        );

        sketchCanvas.addEventListener(
            'mousemove',
            (e) => {

                if (!isDrawing) {
                    return;
                }

                ctx.strokeStyle =
                    brushColor.value;

                ctx.lineWidth =
                    brushSize.value;

                ctx.lineCap =
                    'round';

                ctx.lineTo(
                    e.offsetX,
                    e.offsetY
                );

                ctx.stroke();
            }
        );

        sketchCanvas.addEventListener(
            'mouseup',
            () => {
                isDrawing = false;
            }
        );

        sketchCanvas.addEventListener(
            'mouseleave',
            () => {
                isDrawing = false;
            }
        );

        // Save Drawing
        saveDrawingBtn.addEventListener(
            'click',
            () => {

                const dataUrl =
                    sketchCanvas.toDataURL(
                        'image/png'
                    );

                const img =
                    document.createElement(
                        'img'
                    );

                img.src =
                    dataUrl;

                img.alt =
                    'Sketch';

                if (
                    appState.currentMode ===
                    'text'
                ) {

                    noteTextEditor.appendChild(
                        img
                    );

                    triggerAutoSave();
                }

                drawingModal.style.display =
                    'none';
            }
        );

        // Normalize Existing Notes
        notes.forEach(note => {

            if (
                typeof note.favorite !==
                'boolean'
            ) {
                note.favorite =
                    false;
            }

            if (
                typeof note.pinned !==
                'boolean'
            ) {
                note.pinned =
                    false;
            }
        });

        // Normalize Existing Folders
        folders.forEach(folder => {

            if (
                typeof folder.pinned !==
                'boolean'
            ) {
                folder.pinned =
                    false;
            }
        });

        // Initial Render
        renderFolders();

        renderQuickAccess();

        renderNotes();
    }
);