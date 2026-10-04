/* =============================================================================
   ARIS LINE — Notification Client (V7)
   Hiển thị thông báo theo token Aris Line, kết nối API và SignalR ArisChat
   ============================================================================= */
window.ArisNotifications = (function () {
    const M = window.ArisMotion;

    function formatTime(iso) {
        if (!iso) return "Vừa xong";
        const date = new Date(iso);
        const now = new Date();
        const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
        if (diffSec < 60) return "Vừa xong";
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} phút`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours} giờ`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return "Hôm qua";
        if (diffDays < 7) return `${diffDays} ngày`;
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        if (date.getFullYear() === now.getFullYear()) {
            return `${d}/${m}`;
        }
        return `${d}/${m}/${date.getFullYear()}`;
    }

    function escapeHtml(str) {
        if (str == null) return "";
        const div = document.createElement("div");
        div.innerText = str;
        return div.innerHTML;
    }

    function init({ bellBtn, badge, list }) {
        if (!bellBtn || !list) return;

        let notifications = [];
        let loaded = false;

        function updateBadge() {
            if (!badge) return;
            const unreadCount = notifications.filter(n => !n.isRead).length;
            if (unreadCount > 0) {
                badge.style.display = "";
                badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
                badge.classList.add("a-badge--accent");
            } else {
                badge.style.display = "none";
                badge.textContent = "";
            }
        }

        function renderList() {
            const unreadCount = notifications.filter(n => !n.isRead).length;

            if (notifications.length === 0) {
                list.innerHTML = `
                    <div class="a-empty" style="padding: 32px 16px; text-align: center;">
                        <i data-lucide="bell" style="width: 24px; height: 24px; color: var(--text-4); margin-bottom: 8px;"></i>
                        <div class="a-empty__title" style="font-weight: 600; font-size: 14px; color: var(--text);">Chưa có thông báo nào</div>
                        <div class="a-empty__text" style="font-size: 12px; color: var(--text-3); margin-top: 4px; line-height: 1.4;">
                            Lời mời phỏng vấn, kết bạn và trạng thái đơn ứng tuyển sẽ hiện ở đây.
                        </div>
                    </div>`;
                if (window.renderIcons) window.renderIcons();
                return;
            }

            const headerHtml = `
                <div style="display: flex; align-items: center; padding: 12px 14px 8px 16px; border-bottom: 1px solid var(--line-soft);">
                    <b style="flex: 1; font-size: 15px; color: var(--text);">Thông báo</b>
                    <button class="a-btn a-btn--ghost a-btn--sm notif-markall-btn" type="button" ${unreadCount ? '' : 'disabled'}>
                        Đánh dấu đã đọc
                    </button>
                </div>`;

            const rowsHtml = notifications.map(n => `
                <a class="a-row notif ${n.isRead ? '' : 'is-unread'}" href="${n.link || '#'}" data-id="${n.id}" style="align-items: flex-start; min-height: 0; padding: 10px 14px; text-decoration: none;">
                    <span class="notif__bar" aria-hidden="true"></span>
                    <span class="a-avatar a-avatar--36" style="flex-shrink: 0; margin-right: 10px;">
                        <img src="${n.actorAvatar || '/img/default-avatar.svg'}" alt="" onerror="this.src='/img/default-avatar.svg';" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    </span>
                    <span class="a-row__main" style="font-size: 13px; line-height: 1.45; color: var(--text-2);">
                        ${escapeHtml(n.content)}
                        <br>
                        <span class="a-row__meta" style="font-size: 11px; color: var(--text-3); margin-top: 2px; display: inline-block;">
                            ${formatTime(n.createdAt)}
                        </span>
                    </span>
                </a>`).join("");

            list.innerHTML = headerHtml + `<div class="a-list" style="padding: 4px 0; gap: 0;">${rowsHtml}</div>`;
            if (window.renderIcons) window.renderIcons();
        }

        async function load() {
            try {
                const res = await fetch("/Notifications/GetNotifications");
                if (!res.ok) return;
                const data = await res.json();
                notifications = data.notifications || [];
                loaded = true;
                renderList();
                updateBadge();
            } catch (err) {
                console.error("Failed to load notifications:", err);
            }
        }

        list.addEventListener("click", async (e) => {
            const markAllBtn = e.target.closest(".notif-markall-btn");
            if (markAllBtn) {
                e.preventDefault();
                try {
                    await fetch("/Notifications/MarkAllAsRead", { method: "POST" });
                    notifications.forEach(n => n.isRead = true);
                    renderList();
                    updateBadge();
                } catch (err) {
                    console.error("MarkAllAsRead failed:", err);
                }
                return;
            }

            const item = e.target.closest(".a-row.notif");
            if (!item) return;
            const id = parseInt(item.dataset.id, 10);
            const n = notifications.find(x => x.id === id);
            if (n && !n.isRead) {
                fetch(`/Notifications/MarkAsRead?id=${id}`, { method: "POST" }).catch(() => {});
                n.isRead = true;
                item.classList.remove("is-unread");
                updateBadge();
            }
        });

        bellBtn.addEventListener("click", () => {
            if (!loaded) load();
        });

        if (window.ArisChat) {
            ArisChat.onNotification((n) => {
                notifications.unshift(n);
                if (M && M.pulse && badge) M.pulse(badge);
                renderList();
                updateBadge();
            });
            ArisChat.start().then(load);
        } else {
            load();
        }
    }

    return { init };
})();
