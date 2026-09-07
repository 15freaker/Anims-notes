function makeNoteSnapshot(note) {
    return {
        title: note.title || '',
        content: note.content || '',
        type: note.type || 'text',
        checklist: JSON.parse(JSON.stringify(note.checklist || [])),
        tags: [...(note.tags || [])],
        color: note.color || '#1e293b',
        folderId: note.folderId || null,
        protected: !!note.protected,
        attachments: JSON.parse(JSON.stringify(note.attachments || [])),
        savedAt: Date.now()
    };
}

function snapshotsDiffer(note, snapshot) {
    return JSON.stringify({
        title: note.title || '',
        content: note.content || '',
        type: note.type || 'text',
        checklist: note.checklist || [],
        tags: note.tags || [],
        color: note.color || '#1e293b',
        folderId: note.folderId || null,
        protected: !!note.protected,
        attachments: note.attachments || []
    }) !== JSON.stringify({
        title: snapshot.title || '',
        content: snapshot.content || '',
        type: snapshot.type || 'text',
        checklist: snapshot.checklist || [],
        tags: snapshot.tags || [],
        color: snapshot.color || '#1e293b',
        folderId: snapshot.folderId || null,
        protected: !!snapshot.protected,
        attachments: snapshot.attachments || []
    });
}

function saveVersionToHistory(note) {
    if (!note.history) note.history = [];

    note.history.unshift(makeNoteSnapshot(note));
    note.history = note.history.slice(0, 20);
}

function renderHistory(note) {
    const historyList = document.getElementById('historyList');
    const historyPreview = document.getElementById('historyPreview');
    const restoreBtn = document.getElementById('restoreHistoryBtn');

    if (!historyList || !historyPreview) return;

    selectedHistoryIndex = null;

    if (!note.history || !note.history.length) {
        historyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🕘</div>
                <h3>No history yet</h3>
                <p>Older versions of this note will appear here.</p>
            </div>
        `;

        historyPreview.innerHTML = '<p>Select a version to preview it.</p>';

        if (restoreBtn) {
            restoreBtn.disabled = true;
        }

        return;
    }

    historyList.innerHTML = note.history.map((version, index) => `
        <button class="history-item" data-index="${index}">
            <strong>Version ${note.history.length - index}</strong>
            <span>${new Date(version.savedAt || Date.now()).toLocaleString()}</span>
        </button>
    `).join('');

    historyList.querySelectorAll('.history-item').forEach(button => {
        button.addEventListener('click', () => {
            selectedHistoryIndex = Number(button.dataset.index);

            historyList.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
            });

            button.classList.add('active');

            const version = note.history[selectedHistoryIndex];

            historyPreview.innerHTML = `
                <h3>${escapeHTML(version.title || 'Untitled Note')}</h3>
                <div class="history-meta">
                    ${new Date(version.savedAt || Date.now()).toLocaleString()}
                </div>
                <div class="history-content">
                    ${sanitizeHTML(version.content || '<em>No content</em>')}
                </div>
            `;

            if (restoreBtn) {
                restoreBtn.disabled = false;
            }
        });
    });

    historyPreview.innerHTML = '<p>Select a version to preview it.</p>';

    if (restoreBtn) {
        restoreBtn.disabled = true;
    }
}

function restoreHistoryVersion(note, index) {
    if (!note || !note.history || !note.history[index]) return;

    const version = note.history[index];

    saveVersionToHistory(note);

    note.title = version.title || '';
    note.content = version.content || '';
    note.type = version.type || 'text';
    note.checklist = JSON.parse(JSON.stringify(version.checklist || []));
    note.tags = [...(version.tags || [])];
    note.color = version.color || '#1e293b';
    note.folderId = version.folderId || null;
    note.protected = !!version.protected;
    note.attachments = JSON.parse(
        JSON.stringify(version.attachments || [])
    );
    note.updatedAt = Date.now();

    localStorage.setItem('anims_notes', JSON.stringify(notes));

    renderNotes();
    renderFolders();
    renderQuickAccess();

    selectedHistoryIndex = null;
}