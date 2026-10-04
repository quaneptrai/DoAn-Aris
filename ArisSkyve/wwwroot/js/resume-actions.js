/* =============================================================================
   ARIS LINE — Xử lý CV của tôi (V7)
   File: wwwroot/js/resume-actions.js
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        toast: (msg, opts) => { if (window.showToast) window.showToast(msg, opts?.tone); else alert(msg); },
        removeFrom: (parent, el) => { if (el) el.remove(); return Promise.resolve(); }
    };

    function renderIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Đổi tên CV tại chỗ
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.rename-resume-btn');
        if (!btn) return;

        const id = btn.dataset.id;
        const card = document.querySelector(`.cv-card[data-resume-id="${id}"]`);
        if (!card) return;

        const labelEl = card.querySelector('.resume-label');
        if (!labelEl || card.classList.contains('is-renaming')) return;

        card.classList.add('is-renaming');
        const currentLabel = labelEl.textContent.trim();

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'a-input';
        input.style.height = '32px';
        input.style.fontSize = 'var(--fs-14)';
        input.value = currentLabel;

        const saveRename = async () => {
            const newLabel = input.value.trim();
            if (!newLabel || newLabel === currentLabel) {
                exitRename();
                return;
            }

            labelEl.textContent = newLabel;
            exitRename();

            try {
                const formData = new URLSearchParams();
                formData.append('resumeId', id);
                formData.append('label', newLabel);

                const res = await fetch('/Resume/RenameResume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const data = await res.json();
                if (data.success) {
                    M.toast('Đã cập nhật tên CV.', { tone: 'success' });
                } else {
                    labelEl.textContent = currentLabel;
                    M.toast(data.message || 'Không thể đổi tên CV.', { tone: 'danger' });
                }
            } catch (err) {
                labelEl.textContent = currentLabel;
                M.toast('Lỗi kết nối khi đổi tên CV.', { tone: 'danger' });
            }
        };

        const exitRename = () => {
            input.remove();
            labelEl.style.display = '';
            btn.style.display = '';
            card.classList.remove('is-renaming');
        };

        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); saveRename(); }
            if (ev.key === 'Escape') { ev.preventDefault(); exitRename(); }
        });
        input.addEventListener('blur', saveRename);

        labelEl.style.display = 'none';
        btn.style.display = 'none';
        labelEl.parentElement.insertBefore(input, labelEl);
        input.focus();
        input.setSelectionRange(0, input.value.length);
    });

    // Xoá CV kèm mẫu Hoàn tác 6 giây
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-resume-btn');
        if (!btn) return;

        const id = btn.dataset.id;
        const card = document.querySelector(`.cv-card[data-resume-id="${id}"]`);
        if (!card) return;

        card.style.display = 'none';
        let undone = false;

        M.toast('Đã xoá CV.', {
            duration: 6000,
            action: {
                label: 'Hoàn tác',
                onClick: () => {
                    undone = true;
                    card.style.display = '';
                }
            }
        });

        setTimeout(() => {
            if (!undone) {
                const formData = new URLSearchParams();
                formData.append('resumeId', id);

                fetch('/Resume/DeleteResume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                })
                .then((r) => r.json())
                .then((res) => {
                    if (res.success) {
                        card.remove();
                    } else {
                        card.style.display = '';
                        M.toast(res.message || 'Không thể xoá CV.', { tone: 'danger' });
                    }
                })
                .catch(() => {
                    card.style.display = '';
                    M.toast('Lỗi kết nối khi xoá CV.', { tone: 'danger' });
                });
            }
        }, 6500);
    });

    // ---------------------------------------------------------------------
    // Tải CV có sẵn (PDF/Word) — /Resume/AnalyzeCv. Nút "Tải CV có sẵn" tạo một CV mới;
    // nút tải lên trên từng thẻ thay file của đúng CV đó. Kéo thả file vào trang = tạo CV mới.
    // ---------------------------------------------------------------------
    const ALLOWED = ['pdf', 'doc', 'docx'];
    const MAX_MB = 10; // AiCore MAX_FILE_SIZE
    let uploadTarget = null; // null = CV mới, số = thay file CV đó
    let uploading = false;

    function setStatus(state, title, sub) {
        const box = document.getElementById('cvUploadStatus');
        if (!box) return;
        box.hidden = false;
        box.dataset.state = state;
        const icon = document.getElementById('cvUploadIcon');
        if (icon) {
            icon.innerHTML = state === 'busy' ? '<span class="spinner-border spinner-border-sm"></span>'
                : `<i data-lucide="${state === 'ok' ? 'check-circle' : 'alert-circle'}"></i>`;
        }
        const t = document.getElementById('cvUploadTitle');
        const s = document.getElementById('cvUploadSub');
        if (t) t.textContent = title;
        if (s) s.textContent = sub || '';
        renderIcons();
    }

    function pickFile(target) {
        if (uploading) return;
        uploadTarget = target;
        const input = document.getElementById('cvUploadInput');
        if (!input) return;
        input.value = '';
        input.click();
    }

    async function uploadFile(file) {
        if (!file || uploading) return;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED.includes(ext)) {
            M.toast('Chỉ nhận file PDF hoặc Word (.doc, .docx).', { tone: 'danger' });
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            M.toast(`File quá lớn (tối đa ${MAX_MB} MB).`, { tone: 'danger' });
            return;
        }

        uploading = true;
        document.querySelectorAll('[data-cv-upload], [data-cv-replace]').forEach(b => { b.disabled = true; });
        const replacing = uploadTarget != null;
        setStatus('busy', replacing ? `Đang thay file cho CV…` : `Đang tải "${file.name}" lên…`,
            'AI đọc CV, nhận diện kỹ năng và kinh nghiệm — thường mất 30–90 giây. Đừng đóng trang.');

        const form = new FormData();
        form.append('file', file);
        if (replacing) form.append('resumeId', uploadTarget);
        else form.append('newResume', 'true');

        try {
            const res = await fetch('/Resume/AnalyzeCv', { method: 'POST', body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = typeof data.detail === 'string' ? data.detail
                    : res.status === 400 ? 'Không đọc được nội dung file — nếu là bản scan, thử file PDF có chữ.'
                    : `Không xử lý được CV (HTTP ${res.status}).`;
                throw new Error(msg);
            }
            setStatus('ok', replacing ? 'Đã cập nhật CV.' : 'Đã thêm CV mới.',
                `AI nhận diện nhóm nghề: ${data.category || 'Khác'}. Gợi ý việc làm sẽ cập nhật sau ít phút.`);
            M.toast(replacing ? 'Đã thay file CV.' : 'Đã thêm CV từ file của bạn.', { tone: 'success' });
            setTimeout(() => window.location.reload(), 1400);
        } catch (err) {
            setStatus('error', 'Tải CV thất bại', err.message || 'Lỗi kết nối máy chủ.');
            M.toast(err.message || 'Lỗi kết nối máy chủ.', { tone: 'danger' });
            uploading = false;
            document.querySelectorAll('[data-cv-upload], [data-cv-replace]').forEach(b => { b.disabled = false; });
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-cv-upload]')) { e.preventDefault(); pickFile(null); return; }
        const replace = e.target.closest('[data-cv-replace]');
        if (replace) { e.preventDefault(); pickFile(parseInt(replace.dataset.cvReplace, 10)); }
    });

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'cvUploadInput') uploadFile(e.target.files && e.target.files[0]);
    });

    // Kéo thả file vào trang
    let dragDepth = 0;
    const page = () => document.querySelector('.cv-page');
    document.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        dragDepth++;
        page()?.classList.add('is-dropping');
    });
    document.addEventListener('dragleave', () => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (!dragDepth) page()?.classList.remove('is-dropping');
    });
    document.addEventListener('dragover', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        e.preventDefault();
        dragDepth = 0;
        page()?.classList.remove('is-dropping');
        uploadTarget = null;
        uploadFile(e.dataTransfer.files[0]);
    });

    // ---------------------------------------------------------------------
    // Chia sẻ CV thành trang web (/portfolio/{id}) — công khai + chép link một chạm.
    // CV tải lên chưa mở trong Studio sẽ chuyển người dùng đến lựa chọn giữ bố cục hoặc đổi mẫu.
    // ---------------------------------------------------------------------
    async function copyLink(url) {
        try { await navigator.clipboard.writeText(url); return true; } catch { return false; }
    }

    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-cv-share]');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        const id = btn.dataset.cvShare;
        const url = `${window.location.origin}/portfolio/${id}`;
        if (btn.dataset.published === '1') {
            const ok = await copyLink(url);
            M.toast(ok ? `Đã chép link: ${url}` : `Link trang CV: ${url}`, { tone: 'success' });
            return;
        }
        btn.disabled = true;
        const label = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang tạo trang…';
        try {
            const session = await fetch('/api/resume-engine/session', { credentials: 'same-origin' }).then(r => r.json());
            const res = await fetch(`/api/resume-engine/document/${encodeURIComponent(id)}/publish`, {
                method: 'POST', credentials: 'same-origin', headers: { RequestVerificationToken: session.token || '' }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok && data.code === 'resume_studio_choice_required') {
                window.location.assign(data.studioUrl || `/Resume/Studio?resumeId=${encodeURIComponent(id)}`);
                return;
            }
            if (!res.ok) throw new Error(data.error || `Không công khai được CV (HTTP ${res.status}).`);
            const ok = await copyLink(url);
            btn.dataset.published = '1';
            btn.innerHTML = '<i data-lucide="link"></i> Sao chép link';
            const tags = btn.closest('.cv-card')?.querySelector('.cv-card__tags');
            if (tags && !tags.querySelector('.cv-tag-live')) {
                tags.insertAdjacentHTML('beforeend', `<a class="a-tag a-tag--sm cv-tag-live" href="/portfolio/${encodeURIComponent(id)}" target="_blank" rel="noopener"><i data-lucide="globe"></i> Đang công khai</a>`);
            }
            renderIcons();
            M.toast(ok ? 'Đã tạo trang web cho CV và chép link — dán vào LinkedIn, Facebook hay email.' : `Trang CV: ${url}`, { tone: 'success' });
            window.open(url, '_blank', 'noopener');
        } catch (err) {
            btn.innerHTML = label;
            renderIcons();
            M.toast(err.message || 'Lỗi kết nối máy chủ.', { tone: 'danger' });
        } finally {
            btn.disabled = false;
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        renderIcons();
    });
})();
