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
        try { if (file.size > 2 * 1024 * 1024) throw new Error('File câu hỏi/đáp án tối đa 2 MB.'); const text = await file.text(); const data = answersOnly ? ArisInterviewData.merge(currentQuestions(), text, file.name) : ArisInterviewData.parse(text, file.name); if (!answersOnly && !confirm('Thay bộ câu hỏi đang nhập bằng file này? Video của các câu cũ sẽ bị xóa khi lưu.')) return; fill(data); status.textContent = `Đã ${answersOnly ? 'ghép đáp án' : 'nhập ' + data.length + ' câu'}. Kiểm tra rồi bấm Lưu tham số.`; }
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
    const narration = $('[data-narration-mode]');
    const catalogs = { tts: null, 'native-converted': null }, loads = {};
    let voiceMode = narration.value === 'native-converted' ? 'native-converted' : 'tts';
    const selectedVoices = { tts: voiceMode === 'tts' ? selectedVoice : '', 'native-converted': voiceMode === 'native-converted' ? selectedVoice : '' };
    let conversionReady = false;
    const isConverted = () => narration.value === 'native-converted';
    // Both narration modes that speak with the selected TTS voice.
    const usesTtsVoice = () => narration.value === 'tts' || narration.value === 'native-tts';
    const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    function updateNarrationStatus() {
        const status = $('[data-narration-status]');
        const name = voices.find(v => v.id === selectedVoice)?.name || selectedVoice;
        if (status) status.textContent = isConverted()
            ? !conversionReady ? 'Chế độ khớp môi với một giọng xuyên suốt chưa sẵn sàng. Vui lòng liên hệ quản trị viên.'
            : selectedVoice ? `Tạo lời nói cùng khẩu hình rồi đổi sang giọng ${name}, giữ nhịp nói. Nghe, suy nghĩ, hài lòng và khích lệ có video riêng. Lưu, duyệt lại kịch bản và tạo lại video sau khi duyệt chi phí; cần xem kết quả để kiểm tra khẩu hình và giọng.`
            : 'Chọn một giọng đã được chuẩn bị. Mỗi clip được tạo riêng với lời nói, khẩu hình và biểu cảm theo trạng thái.'
            : narration.value === 'native' ? 'Lời nói và khẩu hình được tạo cùng video. Mỗi trạng thái có biểu cảm riêng; giọng có thể khác giữa các clip.'
            : narration.value === 'native-tts' ? !ttsAvailable ? 'Hệ thống chưa bật giọng đọc riêng.'
            : selectedVoice ? `Video tạo lời nói cùng khẩu hình; giọng ${name} thay vào đúng những đoạn miệng cử động. Mọi clip cùng giọng, cách đọc thuật ngữ và âm lượng; thời lượng video giữ nguyên nên tiếng không lệch hình.`
            : 'Chọn một giọng đọc riêng rồi bấm Lưu tham số. Giọng này thay lời nói của video, khớp theo khẩu hình.'
            : !ttsAvailable ? 'Hệ thống chưa bật giọng đọc riêng.'
            : selectedVoice ? `Mọi clip có lời dùng giọng ${name}; khẩu hình chưa khớp từng từ. Lưu tham số và tạo lại video sau khi duyệt chi phí để áp dụng.`
            : 'Chọn một giọng đọc riêng rồi bấm Lưu tham số. Chế độ này chưa khớp môi từng từ.';
        const sample = $('[data-sample-voice]'); if (sample) sample.disabled = !usesTtsVoice() || !ttsAvailable || !selectedVoice;
    }
    function filterVoices() {
        const search = normalize($('[data-voice-search]').value), gender = $('[data-voice-gender]').value, region = $('[data-voice-region]').value;
        const options = voices.filter(v => (!gender || v.gender === gender) && (!region || v.region === region) && normalize(v.name + ' ' + v.id).includes(search));
        const selected = voices.find(v => v.id === selectedVoice);
        if (selectedVoice && !options.some(v => v.id === selectedVoice) && (voiceMode === 'tts' || selected)) options.unshift(selected || { id: selectedVoice, name: selectedVoice });
        if (voiceMode === 'native-converted' && !selected) selectedVoice = '';
        const select = $('[data-voice-select]'); select.replaceChildren(new Option('Chọn giọng…', ''), ...options.map(v => new Option(v.name, v.id))); select.value = selectedVoice;
    }
    // These GET requests only list voices and readiness; they never synthesize audio or generate video.
    function loadVoices(mode = voiceMode) {
        if (loads[mode]) return loads[mode];
        const converted = mode === 'native-converted', button = $('[data-load-voices]');
        if (voiceMode === mode) { if (button) button.disabled = true; voiceStatus.textContent = 'Đang tải giọng…'; }
        loads[mode] = (async () => {
            try {
                if (!converted && !ttsAvailable) throw new Error('Giọng đọc riêng chưa được bật trên hệ thống.');
                const data = await (await request(converted ? '/Employer/InterviewFlow/ConversionVoices' : '/Employer/InterviewFlow/Voices')).json();
                if (!data.ok) throw new Error(data.error);
                catalogs[mode] = Array.isArray(data.voices) ? data.voices : [];
                if (converted) conversionReady = catalogs[mode].length > 0;
                if (voiceMode === mode) { voices = catalogs[mode]; filterVoices(); voiceStatus.textContent = voices.length ? `Đã tải ${voices.length} giọng. Chọn giọng rồi bấm Lưu tham số.` : 'Chưa có giọng đã được chuẩn bị cho chế độ này.'; }
            } catch (error) {
                if (converted) { conversionReady = false; catalogs[mode] = []; }
                if (voiceMode === mode) { if (converted) { voices = []; filterVoices(); } voiceStatus.textContent = error.message; }
            } finally {
                if (converted) {
                    $('[data-conversion-option]').disabled = !conversionReady;
                    $('[data-conversion-status]').textContent = conversionReady ? 'Chế độ khớp môi với một giọng xuyên suốt đã sẵn sàng.' : 'Chế độ khớp môi với một giọng xuyên suốt chưa sẵn sàng. Vui lòng liên hệ quản trị viên.';
                }
                if (button) button.disabled = voiceMode === 'tts' && !ttsAvailable;
                delete loads[mode]; updateNarrationStatus();
            }
        })();
        return loads[mode];
    }
    const toggleVoices = () => {
        const converted = isConverted(), nextMode = converted ? 'native-converted' : 'tts';
        if (nextMode !== voiceMode) {
            selectedVoices[voiceMode] = selectedVoice;
            const previous = selectedVoice; voiceMode = nextMode; voices = catalogs[voiceMode] || [];
            selectedVoice = selectedVoices[voiceMode] || (voices.some(v => v.id === previous) ? previous : '');
            filterVoices();
        }
        $('[data-voice-controls]').hidden = narration.value === 'native';
        // Converted speech keeps the video's speed and pitch; fitted TTS takes its speed from the video.
        page.querySelectorAll('[data-tts-timing]').forEach(field => { const locked = converted || (narration.value === 'native-tts' && field.matches('[data-tts-speed]')); field.hidden = locked; const input = field.querySelector('input'); input.readOnly = locked; if (locked) input.value = '1'; });
        page.querySelectorAll('[data-tts-only]').forEach(field => { if (!field.matches('[data-voice-sample]')) field.hidden = converted; else if (converted) field.hidden = true; });
        $('[data-conversion-help]').hidden = !converted;
        $('[data-load-voices]').disabled = !converted && !ttsAvailable;
        updateNarrationStatus();
        if (narration.value !== 'native' && catalogs[voiceMode] == null && (converted || ttsAvailable)) void loadVoices();
    };
    $('[data-visual-mode]')?.addEventListener('change', () => { if ($('[data-visual-mode]').value !== 'independent') { if (isConverted()) $('[data-visual-mode]').value = 'independent'; else if (ttsAvailable) narration.value = 'tts'; } toggleVoices(); });
    narration?.addEventListener('change', () => { if (narration.value !== 'tts') $('[data-visual-mode]').value = 'independent'; toggleVoices(); });
    toggleVoices(); void loadVoices('native-converted');
    $('#kitForm')?.addEventListener('submit', e => { if (isConverted() && (!conversionReady || !voices.some(v => v.id === selectedVoice))) { e.preventDefault(); voiceStatus.textContent = 'Chọn một giọng đã sẵn sàng cho chế độ khớp môi trước khi lưu.'; $('[data-voice-select]').focus(); } });
    $('[data-voice-select]')?.addEventListener('change', e => { selectedVoice = e.target.value; selectedVoices[voiceMode] = selectedVoice; updateNarrationStatus(); });
    ['[data-voice-search]', '[data-voice-gender]', '[data-voice-region]'].forEach(selector => $(selector)?.addEventListener('input', filterVoices));
    $('[data-load-voices]')?.addEventListener('click', () => void loadVoices());
    $('[data-sample-voice]')?.addEventListener('click', async e => {
        e.target.disabled = true; voiceStatus.textContent = 'Đang tạo đoạn nghe thử…';
        try { if (!usesTtsVoice() || !ttsAvailable || !selectedVoice) throw new Error('Chọn một giọng đọc riêng đã được bật trước khi nghe thử.'); const text = $('[data-voice-sample-text]')?.value.trim() || 'Xin chào, chúc bạn có một buổi phỏng vấn thật tự tin.'; const response = await request('/Employer/InterviewFlow/Voices/Sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voiceId: selectedVoice, text, pronunciationOverrides: $('[name="Production.PronunciationOverrides"]')?.value || '', speed: Number($('[name="Production.Speed"]').value), pitch: Number($('[name="Production.Pitch"]').value) }) }); const audio = await response.blob(); if (!usesTtsVoice()) return; if (sampleUrl) URL.revokeObjectURL(sampleUrl); sampleUrl = URL.createObjectURL(audio); const player = $('[data-voice-sample]'); player.src = sampleUrl; player.hidden = false; await player.play(); voiceStatus.textContent = 'Đang phát giọng đã chọn với cách đọc thuật ngữ hiện tại. Video đã có không bị thay đổi.'; }
        catch (error) { voiceStatus.textContent = error.message; } finally { updateNarrationStatus(); }
    });
    $('[data-clone-voice]')?.addEventListener('click', async e => {
        e.target.disabled = true;
        try { if (!usesTtsVoice() || !ttsAvailable) throw new Error('Chọn chế độ giọng đọc riêng để tạo giọng từ mẫu.'); const audio = $('[data-clone-file]').files?.[0], name = $('[data-clone-name]').value.trim(); if (!audio || !name) throw new Error('Nhập tên và chọn âm thanh mẫu.'); if (audio.size > 10 * 1024 * 1024) throw new Error('Âm thanh mẫu tối đa 10 MB.'); const body = new FormData(); body.append('name', name); body.append('audio', audio); body.append('refText', $('[data-clone-text]').value); voiceStatus.textContent = 'Đang tạo giọng…'; const data = await (await request('/Employer/InterviewFlow/Voices/Clone', { method: 'POST', body })).json(); if (!data.ok) throw new Error(data.error); catalogs.tts = [...(catalogs.tts || []), data.voice]; selectedVoices.tts = data.voice.id; if (voiceMode === 'tts') { voices = catalogs.tts; selectedVoice = data.voice.id; filterVoices(); updateNarrationStatus(); voiceStatus.textContent = 'Đã tạo và chọn giọng. Lưu tham số để dùng trong video.'; } }
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
