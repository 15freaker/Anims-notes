function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';

    template.content.querySelectorAll(
        'script, iframe, object, embed, style, link'
    ).forEach(element => element.remove());

    template.content.querySelectorAll('*').forEach(element => {
        [...element.attributes].forEach(attribute => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.toLowerCase();

            if (
                name.startsWith('on') ||
                name === 'srcdoc' ||
                ((name === 'href' || name === 'src') &&
                    value.startsWith('javascript:'))
            ) {
                element.removeAttribute(attribute.name);
            }
        });
    });

    return template.innerHTML;
}

function verifyProtectedAction() {
    const pin = prompt('Enter PIN to open this protected note:');

    if (pin === '1234') {
        return true;
    }

    alert('Incorrect PIN.');
    return false;
}

function htmlToMarkdown(html) {
    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHTML(html || '');

    function convert(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const content = [...node.childNodes]
            .map(convert)
            .join('');

        switch (node.tagName.toLowerCase()) {
            case 'strong':
            case 'b':
                return `**${content}**`;

            case 'em':
            case 'i':
                return `*${content}*`;

            case 'u':
                return `<u>${content}</u>`;

            case 'h1':
                return `# ${content}\n\n`;

            case 'h2':
                return `## ${content}\n\n`;

            case 'h3':
                return `### ${content}\n\n`;

            case 'p':
                return `${content}\n\n`;

            case 'br':
                return '\n';

            case 'blockquote':
                return content
                    .split('\n')
                    .map(line => line ? `> ${line}` : '>')
                    .join('\n') + '\n\n';

            case 'ul':
                return [...node.children]
                    .map(li => `- ${convert(li).trim()}`)
                    .join('\n') + '\n\n';

            case 'ol':
                return [...node.children]
                    .map((li, index) => `${index + 1}. ${convert(li).trim()}`)
                    .join('\n') + '\n\n';

            case 'li':
                return content;

            case 'a':
                return `[${content}](${node.getAttribute('href') || ''})`;

            default:
                return content;
        }
    }

    return convert(temp).trim();
}

function downloadFile(filename, content, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}