(() => {
    'use strict';
    const root = document.querySelector('[data-admin-page]'); if (!root) return;
    root.querySelectorAll('[data-admin-confirm]').forEach(form => form.addEventListener('submit', event => { if (!window.confirm(form.dataset.adminConfirm)) event.preventDefault(); }));
    async function json(url) { const response = await fetch(url, {headers: {Accept: 'application/json'}}); if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Không tải được dữ liệu. Tải lại trang hoặc đăng nhập lại.'); return response.json(); }
    async function services() {
        const output = root.querySelector('#adminServices'); if (!output) return; output.textContent = 'Đang kiểm tra…';
        try {
            const data = await json('/Admin/Services'); if (!data.ok) throw new Error(data.error);
            const status = data.status, label = value => value === null ? 'Chưa cấu hình' : value ? 'Sẵn sàng' : 'Không phản hồi';
            output.textContent = `Tạo ảnh/video: ${status.paused ? 'Tạm dừng' : 'Đang mở'} · Soạn/chấm: ${label(status.llm)} · Dựng video: ${label(status.video)} · Giọng đọc: ${label(status.tts)} · Ghép media: ${label(status.ffmpeg)}`;
        } catch (error) { output.textContent = error.message; }
    }
    root.querySelector('[data-service-refresh]')?.addEventListener('click', services); services();
    root.querySelectorAll('[data-allowance]').forEach(button => button.addEventListener('click', async () => {
        const output = root.querySelector(`[data-allowance-result="${button.dataset.allowance}"]`); button.disabled = true; output.textContent = 'Đang tải…';
        try { const data = await json(`/Admin/Accounts/${button.dataset.allowance}/Allowance`); if (!data.ok) throw new Error(data.error); const a = data.allowance; output.textContent = !a ? 'Chưa cấu hình hạn mức' : a.limit === null ? `Không giới hạn · đã dùng ${a.used}` : `${a.remaining}/${a.limit} credit còn lại · đã dùng ${a.used}`; }
        catch (error) { output.textContent = error.message; } finally { button.disabled = false; }
    }));
})();
