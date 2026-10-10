// Employer interview kit page: question rows, script writing and clip generation with cost approval.
(() => {
    'use strict';
    const page = document.querySelector('.ivf-page');
    const kitId = page?.dataset.kit;
    const token = () => document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    const post = async (url, body) => {
        const response = await fetch(url, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', RequestVerificationToken: token() },
            body: JSON.stringify(body ?? {})
        });
        if (!response.ok) throw new Error('Yêu cầu không thành công (' + response.status + ').');
        return response.json();
    };
    const reloadAt = hash => { location.hash = hash; location.reload(); };

    // ----- question rows: field names carry the row index, so rows are renumbered after every change -----
    const list = document.getElementById('questionList');
    if (list) {
        const max = window.ArisInterviewKit?.maxQuestions || 200;
        const count = document.getElementById('questionCount');
        const add = document.getElementById('addQuestion');
        const renumber = () => {
            const rows = [...list.querySelectorAll('[data-question]')];
            const codes = new Set(rows.map(row => row.querySelector('[data-name="Code"]')?.value).filter(Boolean));
            rows.forEach((row, index) => {
                row.querySelector('[data-no]').textContent = 'Câu ' + (index + 1);
                row.querySelectorAll('[data-name]').forEach(field => { field.name = `Questions[${index}].${field.dataset.name}`; });
                const code = row.querySelector('[data-name="Code"]');
                if (code && !code.value.trim()) {
                    let number = index + 1; while (codes.has(`q${number}`)) number++;
                    code.value = `q${number}`; codes.add(code.value);
                }
                row.querySelector('[data-remove]').disabled = rows.length === 1;
            });
            count.textContent = rows.length + ' câu';
            add.disabled = rows.length >= max;
        };
        add.addEventListener('click', () => {
            list.append(document.getElementById('questionTemplate').content.cloneNode(true));
            window.lucide?.createIcons?.();
            renumber();
            list.lastElementChild.querySelector('textarea').focus();
        });
        list.addEventListener('click', event => {
            const button = event.target.closest('[data-remove]');
            if (!button) return;
            const row = button.closest('[data-question]');
            if (row.querySelector('[data-name="Id"]') && !confirm('Xóa câu này? Video của câu cũng bị xóa khi bạn bấm Lưu.')) return;
            row.remove();
            renumber();
        });
        list.addEventListener('questionschange', renumber);
        renumber();
    }

    document.querySelectorAll('form[data-confirm]').forEach(form => form.addEventListener('submit', event => {
        if (!confirm(form.dataset.confirm)) event.preventDefault();
    }));
    document.querySelectorAll('[data-autosubmit]').forEach(input => input.addEventListener('change', () => {
        if (input.files?.length) {
            input.closest('.ivf-clip')?.querySelector('[data-slot-status]')?.replaceChildren('Đang tải lên…');
            input.form.submit();
        }
    }));
    document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(document.querySelector(button.dataset.copy)?.textContent?.trim() || '');
            button.lastChild.textContent = ' Đã chép';
        } catch { /* clipboard blocked: the link stays visible to copy by hand */ }
    }));

    // ----- script -----
    document.querySelector('[data-write-script]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const status = document.querySelector('[data-script-status]');
        if (document.querySelector('.ivf-script') && !confirm('Viết lại sẽ thay toàn bộ lời thoại hiện tại và cần duyệt lại. Tiếp tục?')) return;
        button.disabled = true;
        status.textContent = 'Đang viết kịch bản…';
        try {
            const reply = await post(`/Employer/InterviewFlow/${kitId}/Script/Write`);
            if (!reply.ok) throw new Error(reply.error);
            reloadAt('#script');
        } catch (error) {
            status.textContent = error.message;
            button.disabled = false;
        }
    });

    // ----- clip generation: every approval (one clip or all) shows its credits on the approve button -----
    const modal = document.getElementById('renderModal');
    const ask = ({ text, approveLabel, items, title = 'Tạo video' }) => new Promise(resolve => {
        modal.querySelector('#renderTitle').textContent = title;
        const approve = modal.querySelector('[data-render-approve]');
        const cancel = modal.querySelector('[data-render-cancel]');
        const list = modal.querySelector('[data-render-items]');
        modal.querySelector('[data-render-body]').innerHTML = text;
        approve.textContent = approveLabel;
        list.replaceChildren(...(items || []).map(item => {
            const row = document.createElement('li');
            const name = document.createElement('span');
            const cost = document.createElement('span');
            name.textContent = item.label;
            cost.textContent = item.cost != null ? `${item.cost} credit` : '—';
            row.append(name, cost);
            return row;
        }));
        list.hidden = !items?.length;
        modal.hidden = false;
        const done = value => { modal.hidden = true; approve.onclick = cancel.onclick = null; resolve(value); };
        approve.onclick = () => done(true);
        cancel.onclick = () => done(false);
        approve.focus();
    });
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const credits = value => value != null ? `${value} credit` : 'chưa rõ credit';
    const stopButtons = [...document.querySelectorAll('[data-video-stop], [data-batch-stop]')];
    const videoStatus = document.querySelector('[data-video-status]');
    let generationStopped = false, stopPending = false, videoBusy = false, followingVideo = false;
    const setVideoBusy = busy => {
        videoBusy = busy;
        stopButtons.forEach(button => { button.disabled = !busy || stopPending; });
        document.querySelectorAll('[data-generate], [data-generate-all]').forEach(button => {
            button.disabled = busy || page.dataset.renderAllowed === 'false';
        });
    };
    const beginVideo = () => {
        generationStopped = stopPending = false;
        setVideoBusy(true);
        if (videoStatus) videoStatus.textContent = 'Đang chuẩn bị tạo video…';
    };
    const stopMessage = 'Đã yêu cầu dừng. Không tạo video tiếp theo; video đã gửi sang dịch vụ vẫn có thể hoàn tất và tính credit.';
    stopButtons.forEach(button => button.addEventListener('click', async () => {
        generationStopped = stopPending = true;
        stopButtons.forEach(b => { b.disabled = true; });
        modal?.querySelector('[data-render-cancel]')?.click();
        if (videoStatus) videoStatus.textContent = 'Đang gửi yêu cầu dừng…';
        try {
            const result = await post(`/Employer/InterviewFlow/${kitId}/Videos/Stop`);
            if (!result.ok) throw new Error(result.error || 'Không gửi được yêu cầu dừng.');
            if (videoStatus) videoStatus.textContent = result.busy ? stopMessage : 'Đã dừng. Không tạo thêm video.';
            if (!result.busy) setVideoBusy(false);
        } catch (error) {
            stopPending = false;
            stopButtons.forEach(b => { b.disabled = !videoBusy; });
            if (videoStatus) videoStatus.textContent = `Chưa dừng được: ${error.message} Bấm Dừng tạo video để thử lại.`;
        }
    }));
    async function followJob(jobId, status = videoStatus) {
        followingVideo = true;
        setVideoBusy(true);
        for (;;) {
            const response = await fetch(`/Employer/InterviewFlow/Jobs/${jobId}`, { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) throw new Error('Không theo dõi được tiến trình tạo video. Tải lại trang để kiểm tra.');
            const state = await response.json();
            if (state.state === 'succeeded' || state.state === 'stopped') {
                sessionStorage.setItem(`interview-video-status-${kitId}`, state.message || 'Đã lưu video.');
                reloadAt('#videos'); return;
            }
            if (state.state === 'failed') throw new Error(state.message || 'Tạo video thất bại.');
            if (state.stopRequested) { generationStopped = stopPending = true; setVideoBusy(true); }
            const message = state.stopRequested || stopPending ? stopMessage : 'Đang tạo video… (có thể mất vài phút)';
            if (status) status.textContent = message;
            if (videoStatus) videoStatus.textContent = message;
            await sleep(2000);
        }
    }

    // ----- avatars: choosing a free image is saved with the form; paid generation requires one approval -----
    const avatarUpload = document.querySelector('[data-avatar-upload]');
    const avatarDefault = document.querySelector('[data-avatar-default]');
    const removeAvatar = document.querySelector('[name="RemoveAvatar"]');
    let avatarPreviewUrl = null;
    const previewAvatar = url => {
        let image = document.querySelector('[data-avatar-preview]');
        if (!image) {
            image = document.createElement('img'); image.dataset.avatarPreview = '';
            image.alt = 'Ảnh nhân vật'; document.querySelector('.ivf-avatar')?.prepend(image);
        }
        image.src = url; image.hidden = false;
    };
    avatarUpload?.addEventListener('change', () => {
        const file = avatarUpload.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
            avatarUpload.setCustomValidity('Chọn ảnh JPEG, PNG hoặc WEBP tối đa 4 MB.');
            avatarUpload.reportValidity(); return;
        }
        avatarUpload.setCustomValidity('');
        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        avatarPreviewUrl = URL.createObjectURL(file); previewAvatar(avatarPreviewUrl);
        avatarDefault.checked = false; if (removeAvatar) removeAvatar.checked = false;
    });
    avatarDefault?.addEventListener('change', () => {
        if (!avatarDefault.checked) return;
        avatarUpload.value = ''; avatarUpload.setCustomValidity('');
        if (removeAvatar) removeAvatar.checked = false;
        previewAvatar('/images/interview/interviewer-avatar.webp');
    });
    removeAvatar?.addEventListener('change', () => {
        if (!removeAvatar.checked) return;
        avatarDefault.checked = false; avatarUpload.value = ''; avatarUpload.setCustomValidity('');
        const image = document.querySelector('[data-avatar-preview]'); if (image) image.hidden = true;
    });
    window.addEventListener('pagehide', () => { if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl); });

    const avatarStatus = document.querySelector('[data-avatar-status]');
    const avatarButton = document.querySelector('[data-avatar-generate]');
    const watchAvatar = async jobId => {
        if (avatarButton) avatarButton.disabled = true;
        avatarStatus.textContent = 'Đang tạo avatar… (có thể mất vài phút)';
        for (;;) {
            await sleep(3000);
            const response = await fetch(`/Employer/InterviewFlow/Jobs/${jobId}`, { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) throw new Error('Không theo dõi được tiến trình. Tải lại trang để kiểm tra avatar.');
            const state = await response.json();
            if (state.state === 'succeeded') { reloadAt('#params'); return; }
            if (state.state === 'failed') throw new Error(state.message || 'Tạo avatar thất bại.');
        }
    };
    avatarButton?.addEventListener('click', async () => {
        avatarButton.disabled = true;
        try {
            const prompt = document.querySelector('[data-avatar-prompt]').value.trim();
            if (!prompt) throw new Error('Nhập mô tả avatar cần tạo.');
            const body = new FormData(); body.append('Prompt', prompt);
            body.append('UseCurrentAvatar', document.querySelector('[data-avatar-use-current]').checked ? 'true' : 'false');
            const reference = document.querySelector('[data-avatar-reference]').files?.[0];
            if (reference) {
                if (!['image/png', 'image/jpeg', 'image/webp'].includes(reference.type) || reference.size > 4 * 1024 * 1024)
                    throw new Error('Ảnh tham chiếu phải là JPEG, PNG hoặc WEBP tối đa 4 MB.');
                body.append('reference', reference);
            }
            avatarStatus.textContent = 'Đang báo giá avatar…';
            const response = await fetch(`/Employer/InterviewFlow/${kitId}/Avatar/Quote`, { method: 'POST', credentials: 'same-origin', headers: { RequestVerificationToken: token() }, body });
            if (!response.ok) throw new Error('Không báo giá được avatar. Thử lại sau.');
            const quote = await response.json(); if (!quote.ok) throw new Error(quote.error);
            // The image service may not price an image in advance; then the dialog says so instead of showing a number.
            const price = quote.cost != null
                ? `Chi phí: <strong>${credits(quote.cost)}</strong>.`
                : 'Dịch vụ không báo trước giá tạo ảnh: <strong>chưa rõ số credit</strong>, số credit thật được trừ khi tạo.';
            const approved = await ask({ title: 'Tạo avatar', text: `Tạo avatar mới cho bộ này. ${price} Ảnh mới sẽ thay avatar đã lưu; kịch bản cần duyệt lại.`, approveLabel: quote.cost != null ? `Duyệt & tạo avatar (${credits(quote.cost)})` : 'Duyệt & tạo avatar (chưa rõ credit)' });
            if (!approved) { avatarStatus.textContent = ''; avatarButton.disabled = false; return; }
            const job = await post(`/Employer/InterviewFlow/${kitId}/Avatar/Render`, { quoteId: quote.quoteId });
            if (!job.ok) throw new Error(job.error);
            await watchAvatar(job.jobId);
        } catch (error) { avatarStatus.textContent = error.message; avatarButton.disabled = false; }
    });
    const runningAvatar = document.querySelector('[data-avatar-job]')?.dataset.avatarJob;
    if (runningAvatar) void watchAvatar(runningAvatar).catch(error => {
        avatarStatus.textContent = error.message; if (avatarButton) avatarButton.disabled = false;
    });

    document.querySelectorAll('[data-generate]').forEach(button => button.addEventListener('click', async () => {
        const slot = button.closest('[data-slot]');
        const status = slot.querySelector('[data-slot-status]');
        const label = slot.querySelector('strong')?.textContent || 'video';
        const request = { kind: slot.dataset.kind, questionId: slot.dataset.question ? Number(slot.dataset.question) : null };
        beginVideo();
        status.textContent = 'Đang báo giá…';
        try {
            const quote = await post(`/Employer/InterviewFlow/${kitId}/Videos/Quote`, request);
            if (!quote.ok) throw new Error(quote.error);
            if (generationStopped) { setVideoBusy(false); status.textContent = 'Đã dừng trước khi tạo video.'; return; }
            const approved = (page.dataset.autoApprove === 'true' && quote.cost != null && quote.cost <= Number(page.dataset.creditLimit) && quote.cost <= Number(page.dataset.totalCreditLimit)) || await ask({
                text: `Tạo video cho ô “${escapeHtml(label)}”. Chi phí ước tính: <strong>${credits(quote.cost)}</strong>. Video tạo xong sẽ thay video hiện có trong ô.`,
                approveLabel: `Duyệt & tạo (${credits(quote.cost)})`
            });
            if (!approved || generationStopped) {
                status.textContent = '';
                setVideoBusy(false);
                return;
            }
            const job = await post(`/Employer/InterviewFlow/${kitId}/Videos/Render`, { quoteId: quote.quoteId });
            if (!job.ok) throw new Error(job.error);
            status.textContent = 'Đang tạo video… (có thể mất vài phút)';
            await followJob(job.jobId, status);
        } catch (error) {
            status.textContent = error.message;
            if (videoStatus) videoStatus.textContent = error.message;
            followingVideo = false;
            setVideoBusy(false);
        }
    }));

    // ----- all clips: one quote for the batch, one approval, clips made one after another -----
    const batchBox = document.querySelector('[data-batch]');
    const batchStatus = document.querySelector('[data-batch-status]');
    const batchProgress = document.querySelector('[data-batch-progress]');
    const allButton = document.querySelector('[data-generate-all]');

    function showClip(clip) {
        const slot = document.querySelector(`[data-slot][data-kind="${clip.kind}"][data-question="${clip.questionId ?? ''}"]`);
        const media = slot?.querySelector('.ivf-clip__media');
        if (!media || media.querySelector(`video[src="${clip.url}"]`)) return;
        const video = document.createElement('video');
        Object.assign(video, { src: clip.url, controls: true, preload: 'metadata', playsInline: true });
        media.replaceChildren(video);
        slot.classList.remove('is-empty');
        const status = slot.querySelector('[data-slot-status]');
        if (status) status.textContent = 'Vừa tạo xong';
    }

    async function followBatch(batchId) {
        followingVideo = true;
        batchBox.hidden = false;
        setVideoBusy(true);
        for (;;) {
            const response = await fetch(`/Employer/InterviewFlow/Batches/${batchId}`, { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) throw new Error('Không theo dõi được tiến trình. Tải lại trang để xem và dừng.');
            const state = await response.json();
            batchProgress.style.width = `${Math.round(100 * state.done / Math.max(1, state.total))}%`;
            state.completed.forEach(showClip);
            if (state.state === 'running') {
                if (state.stopRequested) { generationStopped = stopPending = true; setVideoBusy(true); }
                batchStatus.textContent = state.stopRequested || stopPending ? stopMessage : `Đang tạo video ${Math.min(state.done + 1, state.total)}/${state.total}${state.current ? ': ' + state.current : ''}… (mỗi video có thể mất vài phút)`;
                if (videoStatus) videoStatus.textContent = batchStatus.textContent;
                await sleep(2000);
                continue;
            }
            // Finished, failed or stopped: reload so every slot shows its stored clip; the page reports the outcome.
            location.href = `/Employer/InterviewFlow/${kitId}?batch=${batchId}#videos`;
            return;
        }
    }

    allButton?.addEventListener('click', async () => {
        const quoteStatus = document.querySelector('[data-batch-quote]');
        beginVideo();
        quoteStatus.textContent = 'Đang tính tổng chi phí…';
        try {
            const quote = await post(`/Employer/InterviewFlow/${kitId}/Videos/QuoteAll`, { replaceExisting: allButton.dataset.replace === 'true' });
            if (!quote.ok) throw new Error(quote.error);
            if (generationStopped) { setVideoBusy(false); quoteStatus.textContent = 'Đã dừng trước khi tạo video.'; return; }
            quoteStatus.textContent = '';
            const costs = quote.items.map(item => item.cost);
            const perClip = costs.every(cost => cost != null && cost === costs[0]) ? `, ${costs[0]} credit/video` : '';
            const approved = (page.dataset.autoApprove === 'true' && quote.total != null && quote.total <= Number(page.dataset.totalCreditLimit) && costs.every(c => c != null && c <= Number(page.dataset.creditLimit))) || await ask({
                text: `Tạo <strong>${quote.count} video</strong>. Tổng chi phí ước tính: <strong>${credits(quote.total)}</strong>${perClip}. ` +
                    'Video được tạo lần lượt, mỗi video có thể mất vài phút; bạn có thể dừng giữa chừng và chỉ trả cho video đã tạo.',
                approveLabel: `Duyệt & tạo tất cả (${credits(quote.total)})`,
                items: quote.items
            });
            if (!approved || generationStopped) { setVideoBusy(false); return; }
            const started = await post(`/Employer/InterviewFlow/${kitId}/Videos/RenderAll`, { batchId: quote.batchId });
            if (!started.ok) throw new Error(started.error);
            await followBatch(started.batchId);
        } catch (error) {
            quoteStatus.textContent = error.message;
            if (videoStatus) videoStatus.textContent = error.message;
            followingVideo = false;
            setVideoBusy(false);
        }
    });

    // A batch already running when the page loads (another tab, or after a reload) keeps reporting here.
    const resumeError = error => { followingVideo = false; if (videoStatus) videoStatus.textContent = error.message; setVideoBusy(true); };
    const previousMessage = sessionStorage.getItem(`interview-video-status-${kitId}`);
    if (previousMessage && videoStatus) { videoStatus.textContent = previousMessage; sessionStorage.removeItem(`interview-video-status-${kitId}`); }
    if (batchBox?.dataset.batch) void followBatch(batchBox.dataset.batch).catch(resumeError);
    else if (page?.dataset.videoJob) void followJob(page.dataset.videoJob).catch(resumeError);
    // Resume work started in another tab and expose its stop control without starting anything.
    if (kitId) setInterval(async () => {
        if (followingVideo || videoBusy) return;
        try {
            const response = await fetch(`/Employer/InterviewFlow/${kitId}/Videos/Status`, { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) return;
            const state = await response.json();
            if (state.batchId) void followBatch(state.batchId).catch(resumeError);
            else if (state.jobId) void followJob(state.jobId).catch(resumeError);
        } catch { /* Polling can resume when the network recovers; no render is started. */ }
    }, 5000);
})();
