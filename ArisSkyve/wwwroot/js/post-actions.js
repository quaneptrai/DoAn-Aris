/* =============================================================================
   ARIS LINE — Quản lý bài viết của tôi trên Hồ sơ (V7)
   File: wwwroot/js/post-actions.js
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

    // Xoá bài viết kèm mẫu Hoàn tác 6 giây
    $(document).on('click', '.delete-post-btn', function () {
        const id = $(this).data('id');
        const card = $(`[data-post-id="${id}"]`);
        if (!card.length) return;

        card.hide();
        let undone = false;

        M.toast('Đã xoá bài viết.', {
            duration: 6000,
            action: {
                label: 'Hoàn tác',
                onClick: () => {
                    undone = true;
                    card.show();
                }
            }
        });

        setTimeout(() => {
            if (!undone) {
                $.ajax({ url: `/Dashboard/DeletePost?id=${id}`, method: 'DELETE' })
                    .done(function (res) {
                        if (res.success) {
                            card.remove();
                        } else {
                            card.show();
                            M.toast(res.message || 'Không thể xoá bài viết.', { tone: 'danger' });
                        }
                    })
                    .fail(function () {
                        card.show();
                        M.toast('Lỗi kết nối khi xoá bài viết.', { tone: 'danger' });
                    });
            }
        }, 6500);
    });

    // Sửa bài viết tại chỗ
    $(document).on('click', '.edit-post-btn', function () {
        const id = $(this).data('id');
        const card = $(`[data-post-id="${id}"]`);
        if (!card.length || card.hasClass('editing')) return;
        card.addClass('editing');

        const textEl = card.find('.post-content-text');
        const original = textEl.text().trim();

        const editWrap = $(`
            <div class="post-edit-wrap d-flex flex-column gap-2 my-2">
                <textarea class="a-textarea" rows="3" aria-label="Sửa nội dung bài viết">${original}</textarea>
                <div class="d-flex align-items-center justify-content-end gap-2">
                    <span class="a-help me-auto">Esc để huỷ · Ctrl + Enter để lưu</span>
                    <button type="button" class="a-btn a-btn--ghost a-btn--sm cancel-edit-post-btn">Huỷ</button>
                    <button type="button" class="a-btn a-btn--primary a-btn--sm save-edit-post-btn">Lưu</button>
                </div>
            </div>
        `);

        textEl.hide().after(editWrap);
        const ta = editWrap.find('textarea');
        ta.focus();
        ta[0].setSelectionRange(ta.val().length, ta.val().length);

        function exitEdit() {
            editWrap.remove();
            textEl.show();
            card.removeClass('editing');
        }

        editWrap.find('.cancel-edit-post-btn').on('click', exitEdit);

        function savePost() {
            const newContent = ta.val().trim();
            if (!newContent) {
                M.toast('Nội dung bài viết không được để trống.', { tone: 'danger' });
                return;
            }

            $.post('/Dashboard/EditPost', { id: id, content: newContent })
                .done(function (res) {
                    if (res.success) {
                        textEl.text(res.content);
                        exitEdit();
                        M.toast('Đã cập nhật bài viết.', { tone: 'success' });
                    } else {
                        M.toast(res.message || 'Không thể lưu bài viết.', { tone: 'danger' });
                    }
                })
                .fail(function () {
                    M.toast('Lỗi kết nối máy chủ.', { tone: 'danger' });
                });
        }

        editWrap.find('.save-edit-post-btn').on('click', savePost);
        ta.on('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); exitEdit(); }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); savePost(); }
        });
    });

    document.addEventListener('DOMContentLoaded', () => {
        renderIcons();
    });
})();
