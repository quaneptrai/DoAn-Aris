/* Xem thử cả buổi phỏng vấn liền mạch: phát lần lượt các video đã có trên trang theo đúng thứ tự
   ứng viên sẽ thấy (mở đầu → câu hỏi → lắng nghe → suy nghĩ → phản ứng → chuyển câu → kết thúc).
   Không cần trả lời, không gọi dịch vụ nào và không tốn credit. */
(() => {
    'use strict';
    const page = document.querySelector('.ivf-page'), modal = document.getElementById('previewModal');
    if (!page || !modal) return;
    const WAIT_SECONDS = { listening: 3, thinking: 2 };
    const $ = selector => modal.querySelector(selector);
    const video = $('[data-preview-video]'), caption = $('[data-preview-caption]'), stepStatus = $('[data-preview-step]'), list = $('[data-preview-steps]');
    let steps = [], index = -1, run = 0, timer = null, remainingMs = 0, armedAt = 0, opener = null;

    const slot = (kind, question = '') => page.querySelector(`[data-slot][data-kind="${kind}"][data-question="${question}"]`);
    const clipUrl = (kind, question) => slot(kind, question)?.querySelector('video')?.getAttribute('src') || null;
    // Lời thoại đã lưu trong phần Kịch bản (nếu có) để hiện phụ đề.
    function scriptLines() {
        const lines = new Map();
        page.querySelectorAll('.ivf-script__row').forEach(row => {
            const kind = row.querySelector('input[name$=".Kind"]')?.value, text = row.querySelector('textarea')?.value.trim();
            if (kind && text) lines.set(`${kind}:${row.querySelector('input[name$=".QuestionId"]')?.value || ''}`, text);
        });
        return lines;
    }

    function buildSteps() {
        const lines = scriptLines(), reaction = $('[data-preview-reaction]').value, skipWaits = $('[data-preview-skip-waits]').checked;
        const questions = [...page.querySelectorAll('[data-slot][data-kind="question"]')].map(s => ({ id: s.dataset.question, text: s.querySelector('.ivf-clip__hint')?.textContent.trim() || '' }));
        const result = [];
        const add = (kind, label, { question = '', text = '', seconds = null } = {}) =>
            result.push({ kind, label, url: clipUrl(kind, question), text: text || lines.get(`${kind}:${question}`) || '', seconds });
        add('intro', 'Mở đầu');
        questions.forEach((q, i) => {
            const no = `Câu ${i + 1}/${questions.length}`;
            add('question', no, { question: q.id, text: lines.get(`question:${q.id}`) || q.text });
            if (!skipWaits) {
                add('listening', `${no} · Ứng viên trả lời`, { seconds: WAIT_SECONDS.listening, text: '(Ứng viên đang trả lời)' });
                add('thinking', `${no} · Đang chấm`, { seconds: WAIT_SECONDS.thinking, text: '(Đang chấm câu trả lời)' });
            }
            const passed = reaction === 'pass' || (reaction === 'alternate' && i % 2 === 0);
            add(passed ? 'pass' : 'fail', `${no} · ${passed ? 'Phản ứng trả lời tốt' : 'Phản ứng cần cố gắng'}`);
            if (i < questions.length - 1) add('transition', 'Chuyển sang câu tiếp theo');
        });
        add('outro', 'Kết thúc');
        return result;
    }

    function renderList() {
        list.replaceChildren(...steps.map((step, i) => {
            const item = document.createElement('li'), button = document.createElement('button');
            button.type = 'button'; button.dataset.previewJump = i; button.disabled = !step.url;
            button.textContent = step.url ? step.label : `${step.label} (chưa có video)`;
            item.className = (i === index ? 'is-current' : '') + (step.url ? '' : ' is-missing');
            if (i === index) item.setAttribute('aria-current', 'step');
            item.append(button); return item;
        }));
    }

    // Đoạn lắng nghe/suy nghĩ phát lặp trong vài giây; đếm giờ dừng khi người xem bấm tạm dừng.
    function arm() { if (remainingMs > 0 && !timer) { armedAt = Date.now(); const current = run; timer = setTimeout(() => { if (current === run) go(index + 1); }, remainingMs); } }
    function disarm() { if (timer) { clearTimeout(timer); timer = null; remainingMs -= Date.now() - armedAt; } }

    function go(target) {
        run++; clearTimeout(timer); timer = null; remainingMs = 0;
        while (target < steps.length && !steps[target].url) target++;
        index = target;
        if (index >= steps.length) {
            video.pause(); video.loop = false;
            caption.textContent = ''; stepStatus.textContent = 'Đã phát hết buổi phỏng vấn.';
            renderList(); return;
        }
        const step = steps[index], available = steps.filter(s => s.url).length, position = steps.slice(0, index + 1).filter(s => s.url).length;
        stepStatus.textContent = `${position}/${available} · ${step.label}`;
        caption.textContent = step.text;
        video.loop = step.seconds != null; remainingMs = (step.seconds ?? 0) * 1000;
        video.src = step.url;
        video.play().catch(() => { stepStatus.textContent += ' · Bấm ▶ để phát'; });
        renderList();
    }

    function open(event) {
        opener = event.currentTarget;
        steps = buildSteps();
        const missing = steps.filter(s => !s.url).length;
        $('[data-preview-note]').textContent = !steps.some(s => s.url) ? 'Bộ này chưa có video nào để xem thử.'
            : missing ? `Còn ${missing} đoạn chưa có video, sẽ được bỏ qua.` : '';
        modal.hidden = false; $('[data-preview-close]').focus();
        go(0);
    }
    function close() {
        run++; clearTimeout(timer); timer = null;
        video.pause(); video.removeAttribute('src'); video.load();
        modal.hidden = true; opener?.focus();
    }

    page.querySelectorAll('[data-preview-open]').forEach(button => button.addEventListener('click', open));
    $('[data-preview-close]').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
    video.addEventListener('ended', () => { if (!video.loop) go(index + 1); });
    video.addEventListener('play', () => { if (video.loop) arm(); });
    video.addEventListener('pause', disarm);
    video.addEventListener('error', () => { if (!modal.hidden && index >= 0 && index < steps.length) go(index + 1); });
    $('[data-preview-prev]').addEventListener('click', () => { let target = index - 1; while (target > 0 && !steps[target].url) target--; go(Math.max(0, target)); });
    $('[data-preview-next]').addEventListener('click', () => go(index + 1));
    $('[data-preview-restart]').addEventListener('click', () => go(0));
    list.addEventListener('click', e => { const button = e.target.closest('[data-preview-jump]'); if (button) go(Number(button.dataset.previewJump)); });
    ['[data-preview-reaction]', '[data-preview-skip-waits]'].forEach(selector => $(selector).addEventListener('change', () => { steps = buildSteps(); go(0); }));
})();
