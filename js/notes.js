function saveAndRender() {
    localStorage.setItem('anims_notes', JSON.stringify(notes));
    localStorage.setItem('anims_folders', JSON.stringify(folders));
    renderFolders();
    renderQuickAccess();
    renderNotes();
}

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
        container.innerHTML = '<span class="quick-access-empty">Star notes or pin folders to see them here.</span>';
        return;
    }

    favoriteNotes.forEach(note => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'qa-chip';
        chip.title = 'Open favorite note';
        chip.innerHTML = `★ ${escapeHTML(note.title || 'Untitled Note')}`;

        chip.addEventListener('click', () => openEditModal(note.id));
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

            document.querySelectorAll('.nav-item, .folder-item')
                .forEach(el => el.classList.remove('active'));

            const folderElement = Array.from(
                document.querySelectorAll('.folder-item')
            ).find(el => el.dataset.folderId === folder.id);

            if (folderElement) {
                folderElement.classList.add('active');
            }

            const heading = document.getElementById('viewHeading');
            if (heading) heading.textContent = folder.name;

            const actionCard = document.getElementById('actionCard');
            if (actionCard) actionCard.style.display = 'flex';

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

function renderNotes() {
    const notesContainer = document.getElementById('notesContainer');
    if (!notesContainer) return;

    const query = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const typeVal = document.getElementById('typeFilter')?.value || 'all';
    const colorVal = document.getElementById('colorFilter')?.value || 'all';
    const sortVal = document.getElementById('sortFilter')?.value || 'newest';

    let filtered = notes.filter(note => {
        if (appState.currentView === 'active') {
            if (note.archived || note.inBin) return false;
        } else if (appState.currentView === 'archive') {
            if (!note.archived || note.inBin) return false;
        } else if (appState.currentView === 'bin') {
            if (!note.inBin) return false;
        } else if (appState.currentView === 'favorites') {
            if (!note.favorite || note.inBin || note.archived) return false;
        } else {
            if (note.inBin || note.folderId !== appState.currentView) return false;
        }

        if (typeVal !== 'all' && note.type !== typeVal) return false;

        if (colorVal !== 'all' && note.color !== colorVal) return false;

        if (query) {
            const inTitle = (note.title || '').toLowerCase().includes(query);
            const inContent = (note.content || '').toLowerCase().includes(query);
            const inTags = (note.tags || []).some(tag =>
                tag.toLowerCase().includes(query)
            );

            if (!inTitle && !inContent && !inTags) return false;
        }

        return true;
    });

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
            return (a.title || '').localeCompare(b.title || '');
        }

        return 0;
    });

    notesContainer.innerHTML = '';

    if (filtered.length === 0) {
        notesContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#64748b;padding:2rem;">
                No notes found.
            </div>
        `;
        return;
    }

    filtered.forEach(note => {
        const card = document.createElement('div');

        card.className =
            `note-card ${note.pinned ? 'pinned' : ''} ${note.protected ? 'protected-note' : ''}`;

        card.style.backgroundColor = note.color || '#1e293b';

        let badgeHtml = '';

        if (note.pinned) {
            badgeHtml += '<span class="pin-badge">Pinned</span>';
        }

        if (note.protected) {
            badgeHtml += '<span class="protected-badge">Protected</span>';
        }

        const tagsHtml = (note.tags || [])
            .map(tag => `<span class="tag-chip">${escapeHTML(tag)}</span>`)
            .join('');

        let contentPreview = '';

        if (note.protected) {
            contentPreview = `
                <div class="note-body">
                    <em>🔒 Content protected by PIN.</em>
                </div>
            `;
        } else if (note.type === 'checklist') {
            const listItems = (note.checklist || [])
                .slice(0, 3)
                .map(item => `
                    <li class="${item.done ? 'done' : ''}">
                        ${item.done ? '☑' : '☐'} ${escapeHTML(item.text)}
                    </li>
                `)
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

        let actionsHtml = '';

        if (appState.currentView === 'bin') {
            actionsHtml = `
                <button class="card-btn restore-btn">Restore</button>
                <button class="card-btn delete-perm-btn">Delete Permanently</button>
            `;
        } else {
            actionsHtml = `
                <button class="card-btn pin-btn">
                    ${note.pinned ? 'Unpin' : 'Pin'}
                </button>

                <button class="card-btn archive-btn">
                    ${note.archived ? 'Unarchive' : 'Archive'}
                </button>

                <button class="card-btn delete-btn">Trash</button>
            `;
        }

        card.innerHTML = `
            ${badgeHtml}

            <button
                class="favorite-card-btn ${note.favorite ? 'active' : ''}"
                title="${note.favorite ? 'Remove from Favorites' : 'Add to Favorites'}"
            >
                ${note.favorite ? '★' : '☆'}
            </button>

            <div>
                <h3>${escapeHTML(note.title || 'Untitled Note')}</h3>
                <div class="card-tags">${tagsHtml}</div>
                ${contentPreview}
            </div>

            <div class="card-actions">
                ${actionsHtml}
            </div>
        `;

        card.addEventListener('click', event => {
            if (event.target.tagName === 'BUTTON') return;
            openEditModal(note.id);
        });

        const favoriteBtn = card.querySelector('.favorite-card-btn');

        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', event => {
                event.stopPropagation();
                toggleNoteFavorite(note.id);
            });
        }

        const pinBtn = card.querySelector('.pin-btn');

        if (pinBtn) {
            pinBtn.addEventListener('click', event => {
                event.stopPropagation();
                note.pinned = !note.pinned;
                note.updatedAt = Date.now();
                saveAndRender();
            });
        }

        const archiveBtn = card.querySelector('.archive-btn');

        if (archiveBtn) {
            archiveBtn.addEventListener('click', event => {
                event.stopPropagation();
                note.archived = !note.archived;
                note.updatedAt = Date.now();
                saveAndRender();
            });
        }

        const deleteBtn = card.querySelector('.delete-btn');

        if (deleteBtn) {
            deleteBtn.addEventListener('click', event => {
                event.stopPropagation();
                note.inBin = true;
                note.updatedAt = Date.now();
                saveAndRender();
            });
        }

        const restoreBtn = card.querySelector('.restore-btn');

        if (restoreBtn) {
            restoreBtn.addEventListener('click', event => {
                event.stopPropagation();
                note.inBin = false;
                note.updatedAt = Date.now();
                saveAndRender();
            });
        }

        const deletePermBtn = card.querySelector('.delete-perm-btn');

        if (deletePermBtn) {
            deletePermBtn.addEventListener('click', event => {
                event.stopPropagation();

                if (confirm('Permanently delete this note?')) {
                    notes = notes.filter(n => n.id !== note.id);
                    saveAndRender();
                }
            });
        }

        notesContainer.appendChild(card);
    });
}

function createNewNote(type) {
    const newNote = {
        id: 'note_' + Date.now(),
        title: '',
        content: '',
        type: type,
        checklist: [],
        tags: [],
        color: '#1e293b',
        folderId: folders.some(folder => folder.id === appState.currentView)
            ? appState.currentView
            : null,
        pinned: false,
        favorite: false,
        archived: false,
        inBin: false,
        protected: false,
        attachments: [],
        history: [],
        updatedAt: Date.now()
    };

    notes.unshift(newNote);
    saveAndRender();
    openEditModal(newNote.id);
}