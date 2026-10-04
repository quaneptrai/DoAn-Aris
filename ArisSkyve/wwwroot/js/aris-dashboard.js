(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const card = document.querySelector('.feed-composer-card');
        const input = document.getElementById('postInput');
        const details = document.getElementById('composerDetails');
        const form = document.getElementById('postForm');
        const wordCount = document.getElementById('composerWordCount');

        if (!card || !input || !details) return;

        function expand(options = {}) {
            card.classList.add('is-expanded');
            details.inert = false;
            input.setAttribute('aria-expanded', 'true');
            input.style.height = `${Math.min(320, Math.max(100, input.scrollHeight))}px`;

            if (options.focus) {
                input.focus({ preventScroll: Boolean(options.preventScroll) });
            }
        }

        function collapse() {
            // Collapsing only changes presentation; drafts and attachments remain intact.
            card.classList.remove('is-expanded');
            details.inert = true;
            input.setAttribute('aria-expanded', 'false');
            input.style.height = '46px';
        }

        function updateSignal() {
            const content = input.value.trim();
            const words = content ? content.split(/\s+/u).filter(Boolean).length : 0;
            const level = content.length === 0 ? 0 : content.length < 35 ? 1 : content.length < 90 ? 2 : content.length < 180 ? 3 : 4;

            card.dataset.signalLevel = String(level);
            if (wordCount) wordCount.textContent = `${words} từ`;
        }

        input.setAttribute('aria-controls', 'composerDetails');
        input.setAttribute('aria-expanded', 'false');
        card.dataset.signalLevel = '0';

        input.addEventListener('focus', () => expand());
        input.addEventListener('click', () => expand());
        input.addEventListener('input', () => {
            expand();
            input.style.height = '100px';
            input.style.height = `${Math.min(320, Math.max(100, input.scrollHeight))}px`;
            updateSignal();
        });

        document.querySelectorAll('[data-focus-composer]').forEach((trigger) => {
            trigger.addEventListener('click', () => {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                window.setTimeout(() => expand({ focus: true, preventScroll: true }), 360);
            });
        });

        document.querySelectorAll('[data-composer-prompt]').forEach((prompt) => {
            prompt.addEventListener('click', () => {
                expand({ focus: true, preventScroll: true });
                if (!input.value.trim()) {
                    input.value = prompt.dataset.composerPrompt || '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.setSelectionRange(input.value.length, input.value.length);
                }
            });
        });

        document.getElementById('collapseComposer')?.addEventListener('click', () => {
            collapse();
        });

        card.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                collapse();
                input.blur();
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                if (input.value.trim()) form?.requestSubmit();
            }
        });

        form?.addEventListener('reset', () => window.setTimeout(updateSignal));
        updateSignal();
    });
})();
