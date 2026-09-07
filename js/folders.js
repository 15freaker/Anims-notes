function renderFolders() {
    const foldersTree = document.getElementById('foldersTree');
    const noteFolderSelect = document.getElementById('noteFolderSelect');

    if (foldersTree) {
        foldersTree.innerHTML = '';

        folders.forEach(folder => {
            const folderNotes = notes.filter(note =>
                note.folderId === folder.id &&
                !note.inBin
            ).length;

            const folderEl = document.createElement('div');

            folderEl.className =
                `folder-item ${appState.currentView === folder.id ? 'active' : ''}`;

            folderEl.dataset.folderId = folder.id;

            folderEl.innerHTML = `
                <div class="folder-main">
                    <div class="folder-icon">📁</div>

                    <div class="folder-info">
                        <div class="folder-title">
                            ${escapeHTML(folder.name)}
                        </div>

                        <div class="folder-count">
                            ${folderNotes} ${folderNotes === 1 ? 'note' : 'notes'}
                        </div>
                    </div>
                </div>

                <div class="folder-actions">
                    <button
                        class="folder-btn folder-pin-btn ${folder.pinned ? 'pinned' : ''}"
                        title="${folder.pinned ? 'Unpin Folder' : 'Pin Folder'}"
                    >
                        ${folder.pinned ? '📌' : '📍'}
                    </button>

                    <button
                        class="folder-btn delete-folder-btn"
                        title="Delete Folder"
                    >
                        ×
                    </button>
                </div>
            `;

            folderEl.addEventListener('click', event => {
                if (event.target.closest('.folder-pin-btn')) {
                    event.stopPropagation();
                    toggleFolderPin(folder.id);
                    return;
                }

                if (event.target.closest('.delete-folder-btn')) {
                    event.stopPropagation();

                    if (confirm(`Delete folder "${folder.name}"? Notes inside will be unassigned.`)) {
                        folders = folders.filter(f => f.id !== folder.id);

                        notes.forEach(note => {
                            if (note.folderId === folder.id) {
                                note.folderId = null;
                            }
                        });

                        if (appState.currentView === folder.id) {
                            appState.currentView = 'active';

                            document.querySelectorAll('.nav-item, .folder-item')
                                .forEach(el => el.classList.remove('active'));

                            const activeNav = document.querySelector(
                                '.nav-item[data-view="active"]'
                            );

                            if (activeNav) {
                                activeNav.classList.add('active');
                            }

                            const heading = document.getElementById('viewHeading');

                            if (heading) {
                                heading.textContent = 'Anims-Notes';
                            }
                        }

                        saveAndRender();
                    }

                    return;
                }

                document.querySelectorAll('.nav-item, .folder-item')
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
        noteFolderSelect.innerHTML = '<option value="">None (Root)</option>';

        folders.forEach(folder => {
            const option = document.createElement('option');

            option.value = folder.id;
            option.textContent = folder.name;

            noteFolderSelect.appendChild(option);
        });
    }
}