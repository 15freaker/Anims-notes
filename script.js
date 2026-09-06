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
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
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
    renderNotes();
}

// Convert HTML content into clean Markdown (.md) string
function htmlToMarkdown(html, title, tags) {
    let md = `# ${title}\n\n`;
    if (tags && tags.length > 0) {
        md += `**Tags:** ${tags.join(' ')}\n\n---\n\n`;
    }

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Convert basic HTML formatting tags to Markdown syntax
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

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
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

    // Single Note Export Menu Elements
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
        document.execCommand('hiliteColor', false, '#facc15');
    });

    // Single Note Export Handlers
    exportNoteMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => exportMenu.classList.remove('show'));

    exportTxtBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim() || 'Untitled Note';
        let body = '';
        if (appState.currentMode === 'text') {
            body = noteTextEditor.innerText;
        } else {
            body = appState.currentChecklist.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n');
        }
        const textContent = `${title}\n${'='.repeat(title.length)}\nTags: ${noteTagsInput.value}\n\n${body}`;
        downloadFile(textContent, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`, 'text/plain');
    });

    exportMDBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim() || 'Untitled Note';
        const tags = noteTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
        let mdContent = '';

        if (appState.currentMode === 'text') {
            mdContent = htmlToMarkdown(noteTextEditor.innerHTML, title, tags);
        } else {
            mdContent = `# ${title}\n\n**Tags:** ${tags.join(' ')}\n\n---\n\n` +
                appState.currentChecklist.map(i => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n');
        }

        downloadFile(mdContent, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`, 'text/markdown');
    });

    exportPdfBtn.addEventListener('click', () => {
        const title = noteTitleInput.value.trim() || 'Untitled Note';
        const tags = noteTagsInput.value;

        // Create temporary container for PDF styling
        const container = document.createElement('div');
        container.style.padding = '20px';
        container.style.color = '#000000';
        container.style.fontFamily = 'Arial, sans-serif';

        let bodyHtml = appState.currentMode === 'text' 
            ? noteTextEditor.innerHTML 
            : `<ul>${appState.currentChecklist.map(i => `<li style="list-style:none;">${i.done ? '☑' : '☐'} ${i.text}</li>`).join('')}</ul>`;

        container.innerHTML = `
            <h1 style="margin-bottom:5px; color:#1e293b;">${title}</h1>
            <p style="color:#64748b; font-size:12px; margin-bottom:15px;">Tags: ${tags}</p>
            <hr style="border:0; border-top:1px solid #ccc; margin-bottom:15px;">
            <div style="font-size:14px; line-height:1.6;">${bodyHtml}</div>
        `;

        const opt = {
            margin:       0.5,
            filename:     `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        if (window.html2pdf) {
            html2pdf().set(opt).from(container).save();
        } else {
            alert('PDF generation library loading. Please try again in a moment.');
        }
    });

    // Quick Card Export Helper
    window.exportCardNote = function(id, format, e) {
        e.stopPropagation();
        const note = notes.find(n => n.id === id);
        if (!note) return;
        if (note.isProtected && !verifyProtectedAction()) return;

        const title = note.title || 'Untitled Note';
        const tags = note.tags || [];

        if (format === 'txt') {
            const body = note.type === 'text' 
                ? note.text.replace(/<[^>]*>/g, '') 
                : (note.items || []).map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n');
            downloadFile(`${title}\n\n${body}`, `${title.toLowerCase().replace(/\s+/g, '_')}.txt`, 'text/plain');
        } else if (format === 'md') {
            const md = note.type === 'text'
                ? htmlToMarkdown(note.text, title, tags)
                : `# ${title}\n\n` + (note.items || []).map(i => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n');
            downloadFile(md, `${title.toLowerCase().replace(/\s+/g, '_')}.md`, 'text/markdown');
        }
    };

    // Folders
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
            folders = folders.filter(f => f.id !== folderId && f.parentId !== folderId);
            notes.forEach(n => { if (n.folderId === folderId) n.folderId = null; });
            if (appState.currentView === folderId) appState.currentView = 'active';
            saveAndRender();
        }
    };

    function renderFolders() {
        foldersTree.innerHTML = '';
        folders.forEach(f => {
            const item = document.createElement('div');
            item.className = `folder-item ${appState.currentView === f.id ? 'active' : ''}`;
            item.innerHTML = `
                <div class="folder-name">📁 ${escapeHTML(f.name)}</div>
                <div class="folder-actions">
                    <button class="folder-btn" onclick="createSubfolder('${f.id}')">+</button>
                    <button class="folder-btn" onclick="deleteFolder('${f.id}')">×</button>
                </div>
            `;
            item.onclick = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                appState.currentView = f.id;
                viewHeading.textContent = `Folder: ${f.name}`;
                renderFolders();
                renderNotes();
            };
            foldersTree.appendChild(item);
        });
        updateFolderPickerOptions();
    }

    function updateFolderPickerOptions() {
        noteFolderSelect.innerHTML = '<option value="">(No Folder)</option>';
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            noteFolderSelect.appendChild(opt);
        });
    }

    // Modal Lifecycle & Note Creation
    createNewNoteBtn.addEventListener('click', () => typeModal.style.display = 'flex');
    closeTypeBtn.addEventListener('click', () => typeModal.style.display = 'none');

    selectTextNote.addEventListener('click', () => openEditor('text'));
    selectChecklistNote.addEventListener('click', () => openEditor('checklist'));

    function openEditor(mode, note = null) {
        typeModal.style.display = 'none';
        noteModal.style.display = 'flex';
        appState.currentMode = mode;
        appState.editingNoteId = note ? note.id : null;
        appState.currentAttachments = note && note.attachments ? [...note.attachments] : [];
        appState.currentChecklist = note && note.items ? [...note.items] : [];

        noteTitleInput.value = note ? note.title : '';
        noteTagsInput.value = note && note.tags ? note.tags.join(', ') : '';
        noteProtectedInput.checked = note ? note.isProtected : false;
        noteColorInput.value = note ? note.color : '#1e293b';
        noteFolderSelect.value = note ? note.folderId : (appState.currentView.startsWith('folder_') ? appState.currentView : '');

        if (mode === 'text') {
            textToolbar.style.display = 'flex';
            noteTextEditor.style.display = 'block';
            checklistEditor.style.display = 'none';
            noteTextEditor.innerHTML = note ? note.text : '';
        } else {
            textToolbar.style.display = 'none';
            noteTextEditor.style.display = 'none';
            checklistEditor.style.display = 'flex';
            renderChecklist();
        }

        renderAttachments();
        updateStats();
    }

    cancelBtn.addEventListener('click', () => noteModal.style.display = 'none');
    saveBtn.addEventListener('click', () => {
        performAutoSave();
        noteModal.style.display = 'none';
    });

    // Checklist Management
    addChecklistItemBtn.addEventListener('click', addChecklistItem);
    newChecklistItem.addEventListener('keypress', e => { if (e.key === 'Enter') addChecklistItem(); });

    function addChecklistItem() {
        const val = newChecklistItem.value.trim();
        if (val) {
            appState.currentChecklist.push({ text: val, done: false });
            newChecklistItem.value = '';
            renderChecklist();
            triggerAutoSave();
        }
    }

    function renderChecklist() {
        checklistItemsList.innerHTML = '';
        appState.currentChecklist.forEach((item, i) => {
            const li = document.createElement('li');
            li.className = item.done ? 'done' : '';
            li.innerHTML = `
                <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem(${i})">
                <span>${escapeHTML(item.text)}</span>
                <button onclick="removeChecklistItem(${i})" style="margin-left:auto;background:none;border:none;color:#ef4444;cursor:pointer;">×</button>
            `;
            checklistItemsList.appendChild(li);
        });
    }

    window.toggleChecklistItem = function(i) {
        appState.currentChecklist[i].done = !appState.currentChecklist[i].done;
        renderChecklist();
        triggerAutoSave();
    };

    window.removeChecklistItem = function(i) {
        appState.currentChecklist.splice(i, 1);
        renderChecklist();
        triggerAutoSave();
    };

    // Attachments Handling
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

    // Sketch Canvas
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
        const title = noteTitleInput.value.trim() || 'Untitled Note';
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
                isProtected: noteProtectedInput.checked
            });
        } else {
            const note = notes.find(n => n.id === appState.editingNoteId);
            if (note) {
                note.title = title;
                note.tags = tags;
                note.text = text;
                note.items = appState.currentMode === 'checklist' ? appState.currentChecklist : [];
                note.attachments = [...appState.currentAttachments];
                note.folderId = noteFolderSelect.value || null;
                note.color = noteColorInput.value;
                note.isProtected = noteProtectedInput.checked;
            }
        }
        saveAndRender();
    }

    function updateStats() {
        const text = noteTextEditor.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        modalStats.textContent = `${words} words | ${chars} chars`;
    }

    // Render Grid
    function renderNotes() {
        notesContainer.innerHTML = '';
        let filtered = notes.filter(n => {
            if (appState.currentView === 'active') return !n.archived && !n.deleted;
            if (appState.currentView === 'archive') return n.archived && !n.deleted;
            if (appState.currentView === 'bin') return n.deleted;
            if (appState.currentView.startsWith('folder_')) return n.folderId === appState.currentView && !n.deleted;
            return true;
        });

        const query = searchInput.value.toLowerCase();
        if (query) {
            filtered = filtered.filter(n =>
                n.title.toLowerCase().includes(query) ||
                n.text.toLowerCase().includes(query) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))
            );
        }

        if (typeFilter.value !== 'all') filtered = filtered.filter(n => n.type === typeFilter.value);
        if (colorFilter.value !== 'all') filtered = filtered.filter(n => n.color === colorFilter.value);

        if (sortFilter.value === 'newest') filtered.sort((a, b) => b.createdAt - a.createdAt);
        if (sortFilter.value === 'oldest') filtered.sort((a, b) => a.createdAt - b.createdAt);
        if (sortFilter.value === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));

        filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        filtered.forEach(note => {
            const card = document.createElement('div');
            card.className = `note-card ${note.pinned ? 'pinned' : ''} ${note.isProtected ? 'protected-note' : ''}`;
            card.style.backgroundColor = note.color || '#1e293b';

            let bodyContent = '';
            if (note.isProtected) {
                bodyContent = '<div class="note-body"><em>🔒 Protected content</em></div>';
            } else if (note.type === 'checklist') {
                bodyContent = `
                    <ul class="card-checklist-items">
                        ${note.items.slice(0, 3).map(i => `<li class="${i.done ? 'done' : ''}">${i.done ? '✓' : '☐'} ${escapeHTML(i.text)}</li>`).join('')}
                    </ul>`;
            } else {
                bodyContent = `<div class="note-body">${note.text}</div>`;
            }

            card.innerHTML = `
                ${note.pinned ? '<span class="pin-badge">Pinned</span>' : ''}
                ${note.isProtected ? '<span class="protected-badge">Locked</span>' : ''}
                <h3>${escapeHTML(note.title)}</h3>
                <div class="card-tags">${(note.tags || []).map(t => `<span class="tag-chip">${escapeHTML(t)}</span>`).join('')}</div>
                ${bodyContent}
                <div class="card-actions">
                    ${appState.currentView !== 'bin' ? `
                        <button class="card-btn" title="Quick Export .MD" onclick="exportCardNote('${note.id}', 'md', event)">.MD</button>
                        <button class="card-btn" title="Quick Export .TXT" onclick="exportCardNote('${note.id}', 'txt', event)">.TXT</button>
                        <button class="card-btn" onclick="togglePin('${note.id}', event)">${note.pinned ? 'Unpin' : 'Pin'}</button>
                        <button class="card-btn" onclick="toggleArchive('${note.id}', event)">${note.archived ? 'Unarchive' : 'Archive'}</button>
                        <button class="card-btn" onclick="moveToBin('${note.id}', event)">Delete</button>
                    ` : `
                        <button class="card-btn" onclick="restoreNote('${note.id}', event)">Restore</button>
                        <button class="card-btn" onclick="permanentlyDelete('${note.id}', event)">Purge</button>
                    `}
                </div>
            `;

            card.onclick = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                if (note.isProtected && !verifyProtectedAction()) return;
                openEditor(note.type, note);
            };

            notesContainer.appendChild(card);
        });
    }

    // Card Actions
    window.togglePin = function(id, e) {
        e.stopPropagation();
        const n = notes.find(n => n.id === id);
        if (n) { n.pinned = !n.pinned; saveAndRender(); }
    };

    window.toggleArchive = function(id, e) {
        e.stopPropagation();
        const n = notes.find(n => n.id === id);
        if (n) { n.archived = !n.archived; saveAndRender(); }
    };

    window.moveToBin = function(id, e) {
        e.stopPropagation();
        const n = notes.find(n => n.id === id);
        if (n) { n.deleted = true; saveAndRender(); }
    };

    window.restoreNote = function(id, e) {
        e.stopPropagation();
        const n = notes.find(n => n.id === id);
        if (n) { n.deleted = false; saveAndRender(); }
    };

    window.permanentlyDelete = function(id, e) {
        e.stopPropagation();
        if (confirm('Permanently delete this note?')) {
            notes = notes.filter(n => n.id !== id);
            saveAndRender();
        }
    };

    // Backup & Restore (Bulk JSON)
    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ notes, folders }));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `anims_notes_backup_${Date.now()}.json`);
        dl.click();
    });

    importBtnTrigger.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (parsed.notes) notes = parsed.notes;
                    if (parsed.folders) folders = parsed.folders;
                    saveAndRender();
                    alert('Backup imported successfully!');
                } catch (err) {
                    alert('Invalid JSON backup file.');
                }
            };
            reader.readAsText(file);
        }
    });

    // Initial Initialization
    renderFolders();
    renderNotes();
});