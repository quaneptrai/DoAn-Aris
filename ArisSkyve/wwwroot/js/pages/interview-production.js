(() => {
    'use strict';
    const page = document.querySelector('.ivf-page'); if (!page) return;
    const $ = selector => page.querySelector(selector); const token = () => $('input[name="__RequestVerificationToken"]').value;
    const kitId = page.dataset.kit;
    async function request(url, init = {}) { const response = await fetch(url, { credentials: 'same-origin', ...init, headers: { RequestVerificationToken: token(), ...init.headers } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Yêu cầu không thành công.'); } return response; }
    const jsonPost = (url, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const download = (blob, name) => { const link = document.createElement('a'), url = URL.createObjectURL(blob); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    // ----- credit accounts -----
    const creditMode = $('[data-credit-mode]'), creditAccount = $('[data-credit-account]');
    const toggleCreditAccount = () => { if (creditMode) $('[data-credit-account-field]').hidden = creditMode.value !== 'single'; };
    creditMode?.addEventListener('change', toggleCreditAccount);
    async function loadCredits() {
        const button = $('[data-load-credits]'), status = $('[data-credit-status]'); if (!button) return;
        button.disabled = true; status.textContent = 'Đang tải số dư…';
        try {
            const data = await (await request('/Employer/InterviewFlow/Credits')).json(); if (!data.ok) throw new Error(data.error);
            const selected = creditAccount.value;
            creditAccount.replaceChildren(new Option('Chọn tài khoản…', ''), ...data.accounts.map(a => new Option(`${a.label} · ${a.credits.toLocaleString('vi-VN')} credit`, a.id)));
            creditAccount.value = selected;
            status.textContent = `Tổng ${data.total.toLocaleString('vi-VN')} credit trên ${data.accounts.length} tài khoản video.`;
            if (data.allowance) status.textContent += data.allowance.limit == null ? ' Hạn mức của bạn: không giới hạn.' : ` Bạn còn ${data.allowance.remaining.toLocaleString('vi-VN')}/${data.allowance.limit.toLocaleString('vi-VN')} credit hôm nay (đặt lại lúc 00:00 giờ Việt Nam).`;
        } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
    }
    $('[data-load-credits]')?.addEventListener('click', loadCredits);
    if (creditMode) void loadCredits();
    // ----- import, answer matching and bulk timing -----
    const list = $('#questionList');
    const currentQuestions = () => [...list.querySelectorAll('[data-question]')].map(row => Object.fromEntries([...row.querySelectorAll('[data-name]')].map(field => [field.dataset.name, field.value])));
    function fill(questions, replace = true) {
        const rows = [];
        questions.forEach(q => { const fragment = document.getElementById('questionTemplate').content.cloneNode(true), row = fragment.querySelector('[data-question]'); row.querySelectorAll('[data-name]').forEach(input => { if (q[input.dataset.name] != null) input.value = q[input.dataset.name]; }); if (q.Id) { const id = document.createElement('input'); id.type = 'hidden'; id.dataset.name = 'Id'; id.value = q.Id; row.append(id); } rows.push(row); });
        if (replace) list.replaceChildren(...rows); else list.append(...rows);
        list.dispatchEvent(new Event('questionschange')); window.lucide?.createIcons?.();
    }
    async function importFile(input, answersOnly) {
        const file = input.files?.[0]; if (!file) return; const status = $('[data-import-status]');
        try { if (file.size > 2 * 1024 * 1024) throw new Error('File câu hỏi/đáp án tối đa 2 MB.'); const text = await file.text(); const data = answersOnly ? ArisInterviewData.merge(currentQuestions(), text, file.name) : ArisInterviewData.parse(text, file.name); if (!answersOnly && !confirm('Thay bộ câu hỏi đang nhập bằng file này? Các video câu cũ bị xóa sau khi lưu.')) return; fill(data); status.textContent = `Đã ${answersOnly ? 'ghép đáp án' : 'nhập ' + data.length + ' câu'}. Kiểm tra rồi bấm Lưu tham số.`; }
        catch (error) { status.textContent = error.message; } finally { input.value = ''; }
    }
    $('[data-import-questions]')?.addEventListener('change', e => void importFile(e.target, false));
    $('[data-import-answers]')?.addEventListener('change', e => void importFile(e.target, true));
    $('[data-question-sample]')?.addEventListener('click', () => { if (confirm('Thay câu hỏi hiện tại bằng bộ mẫu?')) { fill(ArisInterviewData.parse(JSON.stringify(ArisInterviewData.sample), 'sample.json')); $('[data-import-status]').textContent = 'Đã nạp bộ mẫu. Bấm Lưu tham số để áp dụng.'; } });
    $('[data-download-questions]')?.addEventListener('click', () => download(new Blob([JSON.stringify(ArisInterviewData.sample, null, 2)], { type: 'application/json' }), 'interview-questions-sample.json'));
    $('[data-bulk-timing]')?.addEventListener('click', () => {
        for (const [selector, name] of [['[data-bulk-prep]', 'PrepSeconds'], ['[data-bulk-answer]', 'AnswerSeconds'], ['[data-bulk-retakes]', 'Retakes']]) { const input = $(selector); if (!input.reportValidity()) return; list.querySelectorAll(`[data-name="${name}"]`).forEach(field => { field.value = input.value; }); }
        $('[data-import-status]').textContent = 'Đã đặt thời gian/làm lại cho mọi câu. Bấm Lưu tham số để áp dụng.';
    });
    // ----- voice catalog -----
    let voices = [], selectedVoice = $('[data-voice-select]')?.value || '', sampleUrl;
    const voiceStatus = $('[data-voice-status]');
    const ttsAvailable = $('.ivf-production')?.dataset.ttsAvailable !== 'false';
    const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    function updateNarrationStatus() {
        const status = $('[data-narration-status]');
        if (status) status.textContent = $('[data-narration-mode]').value === 'native'
            ? 'Giọng hiện tại do model video tạo riêng cho từng clip, nên có thể đổi giữa các video. Chọn một giọng TTS dùng chung để dùng cùng voice ID, tốc độ và cao độ cho toàn bộ câu.'
            : !ttsAvailable ? 'TTS chưa được cấu hình trên hệ thống. Chưa thể giữ một giọng TTS xuyên suốt cho đến khi dịch vụ được bật.'
            : selectedVoice ? `Các clip nói sẽ dùng chung voice ID ${selectedVoice}, tốc độ và cao độ đã lưu. Lưu lựa chọn để áp dụng khi ghép TTS; âm thanh trong video đã có giữ nguyên.`
            : 'Chọn một giọng TTS rồi lưu tham số. Toàn bộ clip nói sau đó sẽ dùng chung voice ID, tốc độ và cao độ này.';
        const sample = $('[data-sample-voice]'); if (sample) sample.disabled = !ttsAvailable || !selectedVoice;
    }
    function filterVoices() {
        const search = normalize($('[data-voice-search]').value), gender = $('[data-voice-gender]').value, region = $('[data-voice-region]').value;
        const options = voices.filter(v => (!gender || v.gender === gender) && (!region || v.region === region) && normalize(v.name + ' ' + v.id).includes(search));
        const selected = voices.find(v => v.id === selectedVoice);
        if (selectedVoice && !options.some(v => v.id === selectedVoice)) options.unshift(selected || { id: selectedVoice, name: selectedVoice });
        const select = $('[data-voice-select]'); select.replaceChildren(new Option('Chọn giọng…', ''), ...options.map(v => new Option(v.name, v.id))); select.value = selectedVoice;
    }
    const toggleVoices = () => { $('[data-voice-controls]').hidden = $('[data-narration-mode]').value !== 'tts'; updateNarrationStatus(); };
    $('[data-visual-mode]')?.addEventListener('change', () => { if ($('[data-visual-mode]').value !== 'independent' && ttsAvailable) $('[data-narration-mode]').value = 'tts'; toggleVoices(); });
    $('[data-narration-mode]')?.addEventListener('change', () => { if ($('[data-narration-mode]').value === 'native') $('[data-visual-mode]').value = 'independent'; toggleVoices(); }); toggleVoices();
    $('[data-voice-select]')?.addEventListener('change', e => { selectedVoice = e.target.value; updateNarrationStatus(); });
    ['[data-voice-search]', '[data-voice-gender]', '[data-voice-region]'].forEach(selector => $(selector)?.addEventListener('input', filterVoices));
    $('[data-load-voices]')?.addEventListener('click', async e => {
        e.target.disabled = true; voiceStatus.textContent = 'Đang tải giọng…';
        try { if (!ttsAvailable) throw new Error('TTS chưa được cấu hình trên hệ thống.'); const data = await (await request('/Employer/InterviewFlow/Voices')).json(); if (!data.ok) throw new Error(data.error); voices = data.voices; filterVoices(); updateNarrationStatus(); voiceStatus.textContent = `Đã tải ${voices.length} giọng. Giọng đã chọn được giữ nguyên; bấm Lưu tham số để dùng cho mọi clip nói.`; }
        catch (error) { voiceStatus.textContent = error.message; } finally { e.target.disabled = !ttsAvailable; }
    });
    $('[data-sample-voice]')?.addEventListener('click', async e => {
        e.target.disabled = true; voiceStatus.textContent = 'Đang tạo đoạn nghe thử…';
        try { if (!ttsAvailable || !selectedVoice) throw new Error('Chọn một giọng TTS đã được bật trước khi nghe thử.'); const text = $('[data-voice-sample-text]')?.value.trim() || 'Xin chào, chúc bạn có một buổi phỏng vấn thật tự tin.'; const response = await request('/Employer/InterviewFlow/Voices/Sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voiceId: selectedVoice, text, pronunciationOverrides: $('[name="Production.PronunciationOverrides"]')?.value || '', speed: Number($('[name="Production.Speed"]').value), pitch: Number($('[name="Production.Pitch"]').value) }) }); if (sampleUrl) URL.revokeObjectURL(sampleUrl); sampleUrl = URL.createObjectURL(await response.blob()); const player = $('[data-voice-sample]'); player.src = sampleUrl; player.hidden = false; await player.play(); voiceStatus.textContent = 'Đang nghe giọng đã chọn với cách đọc thuật ngữ hiện tại. Chưa thay âm thanh trong các video đã có.'; }
        catch (error) { voiceStatus.textContent = error.message; } finally { e.target.disabled = !ttsAvailable || !selectedVoice; }
    });
    $('[data-clone-voice]')?.addEventListener('click', async e => {
        e.target.disabled = true;
        try { if (!ttsAvailable) throw new Error('TTS chưa được cấu hình trên hệ thống.'); const audio = $('[data-clone-file]').files?.[0], name = $('[data-clone-name]').value.trim(); if (!audio || !name) throw new Error('Nhập tên và chọn âm thanh mẫu.'); if (audio.size > 10 * 1024 * 1024) throw new Error('Âm thanh mẫu tối đa 10 MB.'); const body = new FormData(); body.append('name', name); body.append('audio', audio); body.append('refText', $('[data-clone-text]').value); voiceStatus.textContent = 'Đang tạo giọng…'; const data = await (await request('/Employer/InterviewFlow/Voices/Clone', { method: 'POST', body })).json(); if (!data.ok) throw new Error(data.error); voices.push(data.voice); selectedVoice = data.voice.id; filterVoices(); updateNarrationStatus(); voiceStatus.textContent = 'Đã tạo và chọn giọng. Lưu tham số để dùng trong video.'; }
        catch (error) { voiceStatus.textContent = error.message; } finally { e.target.disabled = !ttsAvailable; }
    });
    window.addEventListener('pagehide', () => { if (sampleUrl) URL.revokeObjectURL(sampleUrl); });
    // ----- result tools and demo -----
    page.querySelectorAll('[data-regrade]').forEach(button => button.addEventListener('click', async () => {
        const status = button.parentElement.querySelector('[data-regrade-status]'); button.disabled = true; status.textContent = 'Đang chấm lại…';
        try { const data = await jsonPost(`/Employer/InterviewFlow/${kitId}/Results/Regrade`, { sessionId: Number(button.dataset.session), questionId: Number(button.dataset.questionId) }); if (!data.ok) throw new Error(data.error); location.hash = '#candidates'; location.reload(); }
        catch (error) { status.textContent = error.message; button.disabled = false; }
    }));
    $('[data-export-demo]')?.addEventListener('click', async e => {
        const status = $('[data-demo-status]'); e.target.disabled = true; status.textContent = 'Đang ghép demo…';
        try { const response = await request(`/Employer/InterviewFlow/${kitId}/Videos/Demo`, { method: 'POST' }); download(await response.blob(), `interview-${kitId}-demo.mp4`); status.textContent = 'Đã xuất video demo.'; }
        catch (error) { status.textContent = error.message; } finally { e.target.disabled = false; }
    });
})();
