// Video interview player: intro → (question → prepare → answer while "listening" loops → "thinking" while graded
// → reaction → transition) × N → outro. Answers are spoken (browser speech recognition) or typed.
(() => {
    'use strict';
    const root = document.getElementById('interviewPlayer');
    if (!root) return;
    const endpoint = root.dataset.endpoint;
    const isTest = root.dataset.test === 'true';
    const $ = selector => root.querySelector(selector);
    const video = $('[data-video]');
    const fallback = $('[data-fallback]');
    const timer = $('[data-timer]');
    const transcript = $('[data-transcript]');
    const interim = $('[data-interim]');
    const micButton = $('[data-mic]');
    // A running older server may still serve its compiled view until the approved restart.
    const hasRecordingControls = !!$('[data-microphone]');
    const token = () => root.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const post = async (path, body) => {
        const response = await fetch(endpoint + path, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', RequestVerificationToken: token() },
            body: JSON.stringify(body ?? {})
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Không kết nối được máy chủ. Thử lại.');
        return data;
    };
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const screen = name => root.querySelectorAll('[data-screen]').forEach(el => { el.hidden = el.dataset.screen !== name; });
    const phase = text => { $('[data-phase]').textContent = text; };

    // ----- video -----
    /** Plays a clip once (resolves when it ends) or starts a loop (resolves at once). A missing clip shows text instead. */
    function play(url, { loop = false, text = '' } = {}) {
        return new Promise(resolve => {
            video.onended = null;
            video.onerror = null;
            if (!url) {
                video.removeAttribute('src');
                video.load();
                fallback.textContent = text;
                fallback.hidden = !text;
                setTimeout(resolve, loop ? 0 : text ? 2500 : 0);
                return;
            }
            fallback.hidden = true;
            video.loop = loop;
            video.muted = false;
            video.src = url;
            video.onended = () => resolve();
            video.onerror = () => resolve();
            video.play().then(() => { if (loop) resolve(); }).catch(() => {
                // Autoplay with sound refused: retry muted so the interview can continue.
                video.muted = true;
                video.play().catch(() => resolve()).then(() => { if (loop) resolve(); });
            });
        });
    }

    // ----- countdown with an early finish -----
    function countdown(seconds, onTick) {
        let finish;
        const done = new Promise(resolve => { finish = resolve; });
        let left = seconds;
        const show = () => { timer.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''; onTick?.(left); };
        show();
        const handle = setInterval(() => { left--; show(); if (left <= 0) finish(); }, 1000);
        done.then(() => { clearInterval(handle); timer.textContent = ''; });
        return { done, finish: () => finish() };
    }

    // ----- speech recognition (optional; typing always works) -----
    let recognizer = null;
    let listening = false;
    function startListening() {
        if (!Recognition) return false;
        recognizer = new Recognition();
        recognizer.lang = 'vi-VN';
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.onresult = event => {
            let pending = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) transcript.value = (transcript.value.trim() + ' ' + result[0].transcript.trim()).trim();
                else pending += result[0].transcript;
            }
            interim.textContent = pending;
        };
        recognizer.onerror = event => {
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                listening = false;
                interim.textContent = 'Không dùng được micro. Bạn hãy gõ câu trả lời.';
                micButton.hidden = true;
            }
        };
        // Chrome ends a session after a pause; keep listening until the answer is done.
        recognizer.onend = () => { if (listening) { try { recognizer.start(); } catch { /* already started */ } } };
        listening = true;
        try { recognizer.start(); } catch { listening = false; }
        return listening;
    }
    function stopListening() {
        listening = false;
        interim.textContent = '';
        try { recognizer?.stop(); } catch { /* not started */ }
        recognizer = null;
    }
    micButton.addEventListener('click', () => {
        if (listening || recorder?.state === 'recording') { stopListening(); if (recorder?.state === 'recording') recorder.pause(); micButton.querySelector('span').textContent = 'Bật micro'; }
        else { startListening(); if (recorder?.state === 'paused') recorder.resume(); else void startRecording(); micButton.querySelector('span').textContent = 'Tắt micro'; }
    });

    // Recorded audio follows the selected device and stays private on the server.
    let stream, audioContext, recorder, meterFrame, chunks = [], recordedBlob, recordingUrl, recordingId, currentPlan, currentQuestion, captureRequest = 0;
    async function devices() {
        if (!hasRecordingControls || !navigator.mediaDevices?.enumerateDevices) return;
        const select = $('[data-microphone]'), current = select.value;
        const items = await navigator.mediaDevices.enumerateDevices();
        select.replaceChildren(new Option('Micro mặc định', ''), ...items.filter(d => d.kind === 'audioinput').map((d, i) => new Option(d.label || `Micro ${i + 1}`, d.deviceId))); select.value = current;
    }
    function previewAudio(blob) { if (recordingUrl) URL.revokeObjectURL(recordingUrl); recordingUrl = URL.createObjectURL(blob); const player = $('[data-answer-audio]'); player.src = recordingUrl; player.hidden = false; }
    async function openMic() {
        if (!hasRecordingControls) return false;
        if (stream) return true; if (!navigator.mediaDevices?.getUserMedia) return false;
        try {
            const id = $('[data-microphone]').value;
            stream = await navigator.mediaDevices.getUserMedia({ audio: id ? { deviceId: { exact: id }, echoCancellation: true } : { echoCancellation: true } });
            await devices(); const Context = window.AudioContext || window.webkitAudioContext;
            if (Context) { audioContext = new Context(); await audioContext.resume(); const source = audioContext.createMediaStreamSource(stream), analyser = audioContext.createAnalyser(); source.connect(analyser); analyser.fftSize = 256; const samples = new Uint8Array(256); const tick = () => { analyser.getByteTimeDomainData(samples); const level = Math.min(100, Math.round(Math.sqrt(samples.reduce((s, x) => s + ((x - 128) / 128) ** 2, 0) / samples.length) * 300)); root.querySelectorAll('[data-meter]').forEach(el => { el.setAttribute('aria-valuenow', level); el.firstElementChild.style.width = level + '%'; }); meterFrame = requestAnimationFrame(tick); }; tick(); }
            $('[data-mic-status]').textContent = 'Micro đã sẵn sàng.'; return true;
        } catch { $('[data-mic-status]').textContent = 'Chưa mở được micro. Bạn có thể gõ hoặc tải file âm thanh.'; return false; }
    }
    async function startRecording() {
        const request = ++captureRequest;
        if (!await openMic() || request !== captureRequest || !window.MediaRecorder || recorder?.state === 'recording') return;
        chunks = []; const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start(1000);
    }
    async function stopRecording() {
        captureRequest++;
        if (recorder && recorder.state !== 'inactive') { const active = recorder; await new Promise(resolve => { active.onstop = () => { recordedBlob = new Blob(chunks, { type: active.mimeType }); if (recordedBlob.size) previewAudio(recordedBlob); resolve(); }; active.stop(); }); }
        recorder = null;
    }
    async function closeMic() { await stopRecording(); if (meterFrame) cancelAnimationFrame(meterFrame); meterFrame = null; stream?.getTracks().forEach(t => t.stop()); stream = null; if (audioContext) { await audioContext.close().catch(() => {}); audioContext = null; } }
    function clearAudio() { recordedBlob = null; recordingId = null; chunks = []; if (hasRecordingControls) { $('[data-answer-file]').value = ''; $('[data-answer-audio]').hidden = true; $('[data-recording-status]').textContent = ''; } if (recordingUrl) URL.revokeObjectURL(recordingUrl); recordingUrl = null; }
    async function uploadAudio(transcribe) {
        stopListening(); await stopRecording(); if (!recordedBlob?.size) throw new Error('Hãy ghi âm hoặc chọn file âm thanh trước.');
        const body = new FormData(); body.append('sessionId', currentPlan.sessionId); body.append('questionId', currentQuestion.id); body.append('transcribe', transcribe); body.append('audio', recordedBlob, 'answer.audio');
        const response = await fetch(endpoint + '/Recording', { method: 'POST', credentials: 'same-origin', headers: { RequestVerificationToken: token() }, body });
        const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || 'Không lưu được âm thanh.');
        recordingId = data.recordingId; if (transcribe && data.transcript) transcript.value = data.transcript;
        $('[data-recording-status]').textContent = data.transcriptionError || 'Đã lưu âm thanh. Kiểm tra lời chép trước khi gửi.';
        return data;
    }
    $('[data-check-mic]')?.addEventListener('click', () => void openMic());
    $('[data-microphone]')?.addEventListener('change', async () => { await closeMic(); await openMic(); });
    $('[data-answer-file]')?.addEventListener('change', async e => { const file = e.target.files?.[0]; if (!file) return; stopListening(); await stopRecording(); if (file.size > 10 * 1024 * 1024) { e.target.value = ''; $('[data-recording-status]').textContent = 'Âm thanh tối đa 10 MB.'; return; } recordedBlob = file; recordingId = null; previewAudio(file); });
    $('[data-transcribe]')?.addEventListener('click', async e => { e.target.disabled = true; try { await uploadAudio(true); } catch (error) { $('[data-recording-status]').textContent = error.message; } finally { e.target.disabled = false; } });
    $('[data-replay-question]')?.addEventListener('click', async e => { if (!currentQuestion || $('[data-answer]').hidden) return; e.target.disabled = true; stopListening(); if (recorder?.state === 'recording') recorder.pause(); await play(currentQuestion.clip, { text: currentQuestion.text }); if (!$('[data-answer]').hidden) { void play(currentPlan.clips.listening, { loop: true }); startListening(); if (recorder?.state === 'paused') recorder.resume(); else await startRecording(); e.target.disabled = false; } });
    void devices().catch(() => {});
    window.addEventListener('pagehide', () => { listening = false; recognizer?.abort(); stream?.getTracks().forEach(t => t.stop()); if (meterFrame) cancelAnimationFrame(meterFrame); audioContext?.close(); if (recordingUrl) URL.revokeObjectURL(recordingUrl); });

    // ----- one question -----
    async function askQuestion(plan, question, index, supplement = false) {
        currentPlan = plan; currentQuestion = question;
        screen('question');
        $('[data-qno]').textContent = `Câu ${index + 1}/${plan.questions.length}`;
        $('[data-question]').textContent = question.text;
        $('[data-answer]').hidden = true;
        if (hasRecordingControls) $('[data-replay-question]').disabled = true;
        $('[data-prep]').hidden = true;
        phase('Người phỏng vấn đang hỏi');
        if (!supplement) await play(question.clip, { text: question.text });

        if (!supplement && question.prepSeconds > 0) {
            phase('Chuẩn bị');
            $('[data-prep]').hidden = false;
            const prep = countdown(question.prepSeconds);
            $('[data-skip-prep]').onclick = () => prep.finish();
            await prep.done;
            $('[data-prep]').hidden = true;
        }

        let retakesLeft = question.retakes;
        transcript.value = '';
        clearAudio();
        $('[data-answer]').hidden = false;
        if (hasRecordingControls) $('[data-replay-question]').disabled = false;
        $('[data-done]').textContent = 'Trả lời xong';
        micButton.hidden = !Recognition && !navigator.mediaDevices?.getUserMedia;
        micButton.querySelector('span').textContent = 'Tắt micro';
        phase('Đang trả lời');
        void play(plan.clips.listening, { loop: true });
        startListening();
        await startRecording();
        transcript.focus({ preventScroll: true });
        // Short screens: bring the answer controls into view under the video.
        $('[data-done]').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        let answer = countdown(question.answerSeconds);
        const retake = $('[data-retake]');
        const refreshRetake = () => { retake.hidden = retakesLeft <= 0; retake.textContent = `Làm lại (${retakesLeft})`; };
        refreshRetake();
        retake.onclick = () => {
            if (retakesLeft <= 0) return;
            retakesLeft--;
            refreshRetake();
            transcript.value = '';
            void stopRecording().then(() => { clearAudio(); void startRecording(); });
            answer.finish('retake');
        };
        $('[data-done]').onclick = () => answer.finish();
        // A retake restarts the clock; any other finish submits.
        for (;;) {
            const before = retakesLeft;
            await answer.done;
            if (retakesLeft !== before) { answer = countdown(question.answerSeconds); continue; }
            break;
        }
        stopListening();
        if (hasRecordingControls) $('[data-replay-question]').disabled = true;
        retake.disabled = true;
        await stopRecording();
        if (recordedBlob?.size) {
            for (;;) {
                $('[data-done]').disabled = true;
                try { await uploadAudio(!transcript.value.trim()); break; }
                catch (error) {
                    $('[data-recording-status]').textContent = error.message + ' Âm thanh vẫn được giữ trên trang. Bấm để thử lưu lại.';
                    $('[data-done]').textContent = 'Thử lưu lại'; $('[data-done]').disabled = false;
                    await new Promise(resolve => { $('[data-done]').onclick = resolve; });
                }
            }
        }
        retake.disabled = false; $('[data-done]').disabled = false;
        await closeMic();
        $('[data-answer]').hidden = true;

        phase('Người phỏng vấn đang xem câu trả lời');
        void play(plan.clips.thinking, { loop: true });
        const result = await post('/Answer', { sessionId: plan.sessionId, questionId: question.id, transcript: transcript.value.trim(), recordingId, supplement });
        if (isTest) { const old = results.findIndex(r => r.questionId === question.id); const item = { question: question.text, questionId: question.id, ...result }; if (old >= 0) results[old] = item; else results.push(item); }
        if (index < plan.questions.length - 1 || !hasRecordingControls) await play(result.passed ? plan.clips.pass : plan.clips.fail);
        if (!hasRecordingControls) { if (index < plan.questions.length - 1) await play(plan.clips.transition); return false; }
        $('[data-decision]').hidden = false;
        $('[data-supplement]').hidden = result.action !== 'supplement';
        $('[data-decision-note]').textContent = result.action === 'supplement' ? 'Bạn có thể bổ sung thêm trước khi chuyển câu.' : 'Đã ghi nhận câu trả lời.';
        $('[data-next]').textContent = index === plan.questions.length - 1 ? 'Hoàn thành' : 'Chuyển câu';
        const decision = await new Promise(resolve => { $('[data-supplement]').onclick = () => resolve('supplement'); $('[data-next]').onclick = () => resolve('next'); $('[data-finish-early]').onclick = () => resolve('finish'); });
        $('[data-decision]').hidden = true;
        if (decision === 'supplement') return askQuestion(plan, question, index, true);
        if (decision === 'finish') return true;
        if (index < plan.questions.length - 1) await play(plan.clips.transition);
        return false;
    }

    const results = [];
    $('[data-start]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        $('[data-start-status]').textContent = 'Đang chuẩn bị…';
        try {
            const plan = await post('/Start');
            screen('question');
            $('[data-qno]').textContent = '';
            $('[data-question]').textContent = '';
            phase('Giới thiệu');
            await play(plan.clips.intro, { text: `Chào mừng bạn đến buổi phỏng vấn của ${plan.company}.` });
            for (let index = 0; index < plan.questions.length; index++) if (await askQuestion(plan, plan.questions[index], index)) break;
            phase('Kết thúc');
            screen('end');
            const final = await post('/Finish', { sessionId: plan.sessionId });
            if (isTest) renderSummary();
            if (hasRecordingControls) await play(final.passed ? plan.clips.pass : plan.clips.fail);
            await play(plan.clips.outro);
            phase('Đã xong');
        } catch (error) {
            stopListening();
            await closeMic();
            screen('start');
            button.disabled = false;
            $('[data-start-status]').textContent = error.message;
            phase('');
        }
    });

    function renderSummary() {
        $('[data-end-note]').textContent = 'Phỏng vấn thử: điểm từng câu (ứng viên không thấy phần này).';
        const box = $('[data-summary]');
        box.replaceChildren(...results.map((item, index) => {
            const block = document.createElement('div');
            block.className = 'ivf-answer';
            const head = document.createElement('div');
            head.className = 'ivf-answer__head';
            const title = document.createElement('strong');
            title.textContent = `Câu ${index + 1}: ${item.question}`;
            const score = document.createElement('span');
            score.className = 'ivf-score ' + (item.passed ? 'is-pass' : 'is-fail');
            score.textContent = `${item.score}/100`;
            head.append(title, score);
            const feedback = document.createElement('p');
            feedback.className = 'ivf-muted';
            feedback.textContent = item.feedback || '';
            block.append(head, feedback);
            return block;
        }));
    }
})();
