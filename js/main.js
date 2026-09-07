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
let selectedHistoryIndex = null;

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const viewHeading = document.getElementById('viewHeading');
    const actionCard = document.getElementById('actionCard');
    const createNewNoteBtn = document.getElementById('createNewNoteBtn');
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
    const noteTitleInput = document.getElementById('noteTitleInput');
    const noteTagsInput = document.getElementById('noteTagsInput');
    const noteTextEditor = document.getElementById('noteTextEditor');
    const addChecklistItemBtn = document.getElementById('addChecklistItemBtn');
    const newChecklistItem = document.getElementById('newChecklistItem');
    const fileAttachmentInput = document.getElementById('fileAttachmentInput');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    const noteHistoryBtn = document.getElementById('noteHistoryBtn');
    const historyModal = document.getElementById('historyModal');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const restoreHistoryBtn = document.getElementById('restoreHistoryBtn');

    const themeSettingsBtn = document.getElementById('themeSettingsBtn');
    const themeModal = document.getElementById('themeModal');
    const closeThemeBtn = document.getElementById('closeThemeBtn');
    const accentColorInput = document.getElementById('accentColorInput');
    const accentColorValue = document.getElementById('accentColorValue');
    const resetAccentBtn = document.getElementById('resetAccentBtn');

    const exportNoteMenuBtn = document.getElementById('exportNoteMenuBtn');
    const exportMenu = document.getElementById('exportMenu');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const exportMDBtn = document.getElementById('exportMDBtn');
    const exportTxtBtn = document.getElementById('exportTxtBtn');

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

    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (!item.dataset.view) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));

            item.classList.add('active');
            appState.currentView = item.dataset.view;

            if (appState.currentView === 'active') viewHeading.textContent = 'All Notes';
            if (appState.currentView === 'favorites') viewHeading.textContent = 'Favorites';
            if (appState.currentView === 'archive') viewHeading.textContent = 'Archive';
            if (appState.currentView === 'bin') viewHeading.textContent = 'Recycle Bin';

            actionCard.style.display = appState.currentView === 'bin' ? 'none' : 'flex';

            renderNotes();
        });
    });

    [searchInput, typeFilter, colorFilter, sortFilter].forEach(el => {
        if (el) {
            el.addEventListener('input', renderNotes);
            el.addEventListener('change', renderNotes);
        }
    });

    document.getElementById('btnBold').addEventListener('click', () => {
        document.execCommand('bold', false, null);
        triggerAutoSave();
    });

    document.getElementById('btnItalic').addEventListener('click', () => {
        document.execCommand('italic', false, null);
        triggerAutoSave();
    });

    document.getElementById('btnUnderline').addEventListener('click', () => {
        document.execCommand('underline', false, null);
        triggerAutoSave();
    });

    document.getElementById('btnHighlight').addEventListener('click', () => {
        document.execCommand('hiliteColor', false, '#facc15');
        triggerAutoSave();
    });

    noteTitleInput.addEventListener('input', () => {
        updateEditorStats();
        triggerAutoSave();
    });

    noteTagsInput.addEventListener('input', triggerAutoSave);

    noteTextEditor.addEventListener('input', () => {
        updateEditorStats();
        triggerAutoSave();
    });

    addChecklistItemBtn.addEventListener('click', () => {
        const text = newChecklistItem.value.trim();

        if (text) {
            appState.currentChecklist.push({
                text,
                done: false
            });

            newChecklistItem.value = '';
            renderChecklistBuilder();
            triggerAutoSave();
        }
    });

    fileAttachmentInput.addEventListener('change', e => {
        const files = Array.from(e.target.files);

        files.forEach(file => {
            const reader = new FileReader();

            reader.onload = event => {
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
    });

    addFolderBtn.addEventListener('click', () => {
        const folderName = prompt('Enter Folder Name:');

        if (folderName && folderName.trim()) {
            folders.push({
                id: 'folder_' + Date.now(),
                name: folderName.trim()
            });

            saveAndRender();
        }
    });

    createNewNoteBtn.addEventListener('click', () => {
        typeModal.style.display = 'flex';
    });

    closeTypeBtn.addEventListener('click', () => {
        typeModal.style.display = 'none';
    });

    selectTextNote.addEventListener('click', () => {
        typeModal.style.display = 'none';
        createNewNote('text');
    });

    selectChecklistNote.addEventListener('click', () => {
        typeModal.style.display = 'none';
        createNewNote('checklist');
    });

    saveBtn.addEventListener('click', () => {
        saveCurrentNote();
        noteModal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        saveCurrentNote();
        noteModal.style.display = 'none';
    });

    const toggleFavoriteModalBtn = document.getElementById('toggleFavoriteModalBtn');

    if (toggleFavoriteModalBtn) {
        toggleFavoriteModalBtn.addEventListener('click', () => {
            if (!appState.editingNoteId) return;

            const note = notes.find(n => n.id === appState.editingNoteId);
            if (!note) return;

            note.favorite = !note.favorite;

            toggleFavoriteModalBtn.textContent = note.favorite ? '★' : '☆';
            toggleFavoriteModalBtn.classList.toggle('active', note.favorite);
            toggleFavoriteModalBtn.title = note.favorite
                ? 'Remove from Favorites'
                : 'Add to Favorites';

            saveAndRender();
        });
    }

    if (noteHistoryBtn) {
        noteHistoryBtn.addEventListener('click', () => {
            renderHistory();
            historyModal.style.display = 'flex';
        });
    }

    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            historyModal.style.display = 'none';
        });
    }

    if (restoreHistoryBtn) {
        restoreHistoryBtn.addEventListener('click', restoreHistoryVersion);
    }

    if (themeSettingsBtn) {
        themeSettingsBtn.addEventListener('click', () => {
            const theme = localStorage.getItem('anims_theme') || 'dark';
            const accent = localStorage.getItem('anims_accent') || '#2563eb';

            document.querySelectorAll('.theme-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === theme);
            });

            accentColorInput.value = accent;
            accentColorValue.textContent = accent.toUpperCase();
            themeModal.style.display = 'flex';
        });
    }

    if (closeThemeBtn) {
        closeThemeBtn.addEventListener('click', () => {
            themeModal.style.display = 'none';
        });
    }

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(
                btn.dataset.theme,
                localStorage.getItem('anims_accent') || '#2563eb'
            );

            document.querySelectorAll('.theme-option').forEach(el => {
                el.classList.toggle('active', el === btn);
            });
        });
    });

    if (accentColorInput) {
        accentColorInput.addEventListener('input', () => {
            const accent = accentColorInput.value;

            document.body.style.setProperty('--accent', accent);
            localStorage.setItem('anims_accent', accent);
            accentColorValue.textContent = accent.toUpperCase();
        });
    }

    if (resetAccentBtn) {
        resetAccentBtn.addEventListener('click', () => {
            const accent = '#2563eb';

            accentColorInput.value = accent;
            document.body.style.setProperty('--accent', accent);
            localStorage.setItem('anims_accent', accent);
            accentColorValue.textContent = accent;
        });
    }

    exportBtn.addEventListener('click', () => {
        const backupData = JSON.stringify({
            notes,
            folders
        }, null, 2);

        downloadFile(
            backupData,
            `anims_notes_backup_${Date.now()}.json`,
            'application/json'
        );
    });

    importBtnTrigger.addEventListener('click', () => {
        importInput.click();
    });

    importInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = event => {
            try {
                const imported = JSON.parse(event.target.result);

                if (imported.notes && Array.isArray(imported.notes)) {
                    notes = imported.notes;
                    folders = imported.folders || [];

                    saveAndRender();
                    alert('Backup restored successfully!');
                } else {
                    alert('Invalid backup file structure.');
                }
            } catch (err) {
                alert('Error parsing backup file.');
            }
        };

        reader.readAsText(file);
    });

    exportNoteMenuBtn.addEventListener('click', e => {
        e.stopPropagation();
        exportMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        exportMenu.classList.remove('show');
    });

    exportTxtBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim() || 'Untitled Note';

        const body = appState.currentMode === 'text'
            ? noteTextEditor.innerText
            : appState.currentChecklist
                .map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`)
                .join('\n');

        const textContent =
            `${title}\n${'='.repeat(title.length)}\nTags: ${noteTagsInput.value}\n\n${body}`;

        downloadFile(
            textContent,
            `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`,
            'text/plain'
        );
    });

    exportMDBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim() || 'Untitled Note';

        const tags = noteTagsInput.value
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);

        const mdContent = appState.currentMode === 'text'
            ? htmlToMarkdown(noteTextEditor.innerHTML, title, tags)
            : `# ${title}\n\n**Tags:** ${tags.join(' ')}\n\n---\n\n` +
              appState.currentChecklist
                  .map(i => `- [${i.done ? 'x' : ' '}] ${i.text}`)
                  .join('\n');

        downloadFile(
            mdContent,
            `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`,
            'text/markdown'
        );
    });

    exportPdfBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim() || 'Untitled Note';
        const tags = noteTagsInput.value;

        const container = document.createElement('div');

        container.style.padding = '20px';
        container.style.color = '#000000';
        container.style.fontFamily = 'Arial, sans-serif';

        const bodyHtml = appState.currentMode === 'text'
            ? noteTextEditor.innerHTML
            : `<ul>${appState.currentChecklist
                .map(i => `<li style="list-style:none;">${i.done ? '☑' : '☐'} ${i.text}</li>`)
                .join('')}</ul>`;

        container.innerHTML = `
            <h1 style="margin-bottom:5px; color:#1e293b;">${escapeHTML(title)}</h1>
            <p style="color:#64748b; font-size:12px; margin-bottom:15px;">Tags: ${escapeHTML(tags)}</p>
            <hr style="border:0; border-top:1px solid #ccc; margin-bottom:15px;">
            <div style="font-size:14px; line-height:1.6;">${bodyHtml}</div>
        `;

        const opt = {
            margin: 0.5,
            filename: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
            image: {
                type: 'jpeg',
                quality: 0.98
            },
            html2canvas: {
                scale: 2
            },
            jsPDF: {
                unit: 'in',
                format: 'letter',
                orientation: 'portrait'
            }
        };

        if (window.html2pdf) {
            html2pdf()
                .set(opt)
                .from(container)
                .save()
                .then(() => {
                    console.log('PDF exported successfully');
                });
        } else {
            alert('PDF generator library is not ready.');
        }
    });

    openDrawingBtn.addEventListener('click', () => {
        drawingModal.style.display = 'flex';
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    });

    cancelDrawingBtn.addEventListener('click', () => {
        drawingModal.style.display = 'none';
    });

    clearCanvasBtn.addEventListener('click', () => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
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

    sketchCanvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });

    sketchCanvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });

    saveDrawingBtn.addEventListener('click', () => {
        const dataUrl = sketchCanvas.toDataURL('image/png');
        const img = document.createElement('img');

        img.src = dataUrl;
        img.alt = 'Sketch';

        if (appState.currentMode === 'text') {
            noteTextEditor.appendChild(img);
            triggerAutoSave();
        }

        drawingModal.style.display = 'none';
    });

    loadTheme();

    notes.forEach(note => {
        if (!Array.isArray(note.history)) note.history = [];
        if (typeof note.favorite !== 'boolean') note.favorite = false;
        if (typeof note.pinned !== 'boolean') note.pinned = false;
    });

    folders.forEach(folder => {
        if (typeof folder.pinned !== 'boolean') folder.pinned = false;
    });

    renderFolders();
    renderQuickAccess();
    renderNotes();
});