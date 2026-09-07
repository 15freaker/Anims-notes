function applyTheme(theme, accent) {
    document.body.dataset.theme = theme || 'dark';

    if (accent) {
        document.body.style.setProperty('--accent', accent);
    }

    localStorage.setItem('anims_theme', theme || 'dark');

    if (accent) {
        localStorage.setItem('anims_accent', accent);
    }
}

function loadTheme() {
    const theme = localStorage.getItem('anims_theme') || 'dark';
    const accent = localStorage.getItem('anims_accent') || '#2563eb';

    applyTheme(theme, accent);
}