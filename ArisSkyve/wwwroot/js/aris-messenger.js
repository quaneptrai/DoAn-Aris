(() => {
    const shell = document.querySelector('.messenger-shell');
    const thread = document.getElementById('threadActive');
    const back = document.getElementById('backToConversations');
    if (!shell || !thread || !back) return;
    // The existing controller opens a thread after its data arrives, including deep links.
    const observer = new MutationObserver(() => {
        if (thread.style.display !== 'none') shell.classList.add('is-thread-open');
    });
    observer.observe(thread, { attributes: true, attributeFilter: ['style'] });
    back.addEventListener('click', () => {
        shell.classList.remove('is-thread-open');
        document.getElementById('userSearchInput')?.focus();
    });
    for (const id of ['conversationList', 'friendsList', 'searchResults']) {
        document.getElementById(id)?.addEventListener('click', e => {
            if (e.target.closest('[data-user-id]') && thread.style.display !== 'none') {
                shell.classList.add('is-thread-open');
            }
        });
    }
})();
