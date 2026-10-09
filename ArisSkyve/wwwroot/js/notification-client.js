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

    // Lucide icon per notification type, shown on the avatar corner.
    const TYPE_ICON = {
        FriendRequest: "user-plus", FriendRequestAccepted: "user-check",
        PostComment: "message-circle", CommentReply: "reply",
        JobApplication: "file-text", ApplicationWithdrawn: "file-minus", ApplicationStatus: "briefcase",
        InterviewScheduled: "calendar", InterviewResponse: "calendar-check", InterviewReminder: "alarm-clock",
        EvaluationDue: "clipboard-check", OfferSent: "gift", OfferAccepted: "party-popper", OfferDeclined: "x-circle"
    };
    const MAX_ITEMS = 50;
    // The bell opens compact: 5 rows, then "Xem thêm" reveals 10 more at a time.
    const FIRST_PAGE = 5;
    const MORE_STEP = 10;

    function init({ bellBtn, badge, list }) {
        if (!bellBtn || !list) return;
        // The script is included by more than one partial; one bell = one instance.
        if (bellBtn.__arisNotif) return;
        bellBtn.__arisNotif = true;

        let notifications = [];
        let loaded = false;
        let loadedAt = 0;
        let unreadTotal = 0;
        let visible = FIRST_PAGE;

        function updateBadge() {
            if (!badge) return;
            const unreadCount = Math.max(unreadTotal, notifications.filter(n => !n.isRead).length);
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
                <div class="nf-head">
                    <b class="nf-head__title">Thông báo</b>
                    ${unreadCount ? `<span class="nf-head__count">${unreadCount > 99 ? "99+" : unreadCount} mới</span>` : ""}
                    <button class="a-btn a-btn--ghost a-btn--sm notif-markall-btn" type="button" ${unreadCount ? '' : 'disabled'}>
                        Đánh dấu đã đọc
                    </button>
                </div>`;

            const row = n => {
                const actor = n.prefixActor && n.actorName ? `<b>${escapeHtml(n.actorName)}</b> ` : "";
                const icon = TYPE_ICON[n.type] || "bell";
                return `
                <a class="a-row notif nf-row ${n.isRead ? '' : 'is-unread'}" href="${escapeHtml(n.link || '#')}" data-id="${n.id}">
                    <span class="notif__bar" aria-hidden="true"></span>
                    <span class="nf-row__avatar">
                        <img src="${escapeHtml(n.actorAvatar || '/img/default-avatar.svg')}" alt="" onerror="this.src='/img/default-avatar.svg';">
                        <span class="nf-row__type nf-type--${escapeHtml(n.type || 'other')}"><i data-lucide="${icon}"></i></span>
                    </span>
                    <span class="a-row__main nf-row__main">
                        <span class="nf-row__text">${actor}${escapeHtml(n.content)}</span>
                        <span class="nf-row__time">${formatTime(n.createdAt)}</span>
                    </span>
                    ${n.isRead ? "" : '<span class="nf-row__dot" aria-label="Chưa đọc"></span>'}
                </a>`;
            };
            // Unread first, then the rest; only the first `visible` rows are drawn.
            const ordered = notifications.filter(n => !n.isRead).concat(notifications.filter(n => n.isRead));
            const shown = ordered.slice(0, visible);
            const hiddenCount = ordered.length - shown.length;
            const fresh = shown.filter(n => !n.isRead);
            const seen = shown.filter(n => n.isRead);
            const section = (title, items) => items.length ? `<div class="nf-sec">${title}</div>${items.map(row).join("")}` : "";
            const moreHtml = hiddenCount > 0
                ? `<div class="nf-foot"><button class="nf-more" type="button" data-nf-more>Xem thêm<span class="nf-more__n a-num">${hiddenCount}</span><i data-lucide="chevron-down"></i></button></div>`
                : "";

            list.innerHTML = headerHtml + `<div class="a-list nf-scroll">${section("Mới", fresh)}${section("Trước đó", seen)}</div>` + moreHtml;
            if (window.renderIcons) window.renderIcons();
        }

        function showMore() {
            const before = list.querySelectorAll(".nf-row").length;
            const scroller = list.querySelector(".nf-scroll");
            const top = scroller ? scroller.scrollTop : 0;
            visible += MORE_STEP;
            renderList();
            const rows = list.querySelectorAll(".nf-row");
            const next = list.querySelector(".nf-scroll");
            if (next) next.scrollTop = top;
            // Ease the newly revealed rows in and bring the first of them into view.
            const added = Array.from(rows).slice(before);
            if (added.length) {
                if (M && M.stagger) M.stagger(added, { max: MORE_STEP });
                added[0].scrollIntoView({ block: "nearest", behavior: M && M.reduced && M.reduced() ? "auto" : "smooth" });
            }
            const btn = list.querySelector("[data-nf-more]");
            (btn || added[0] || list).focus({ preventScroll: true });
            keepInViewport();
        }

        // The popover was placed for its old height (above the mobile tab bar, or under the
        // bell); once it grows, slide it up so the new rows and the button stay on screen.
        function keepInViewport() {
            const pop = list.closest(".a-pop");
            if (!pop || pop.hidden) return;
            const r = pop.getBoundingClientRect();
            const overflow = r.bottom - (window.innerHeight - 8);
            if (overflow > 0) pop.style.top = Math.max(8, r.top - overflow) + "px";
        }

        // Every time the bell opens it starts compact again.
        function resetPage() {
            if (visible === FIRST_PAGE) return;
            visible = FIRST_PAGE;
            if (loaded) renderList();
        }

        async function load() {
            try {
                const res = await fetch("/Notifications/GetNotifications");
                if (!res.ok) return;
                const data = await res.json();
                notifications = (data.notifications || []).slice(0, MAX_ITEMS);
                unreadTotal = data.unreadCount || 0;
                loaded = true;
                loadedAt = Date.now();
                renderList();
                updateBadge();
            } catch (err) {
                console.error("Failed to load notifications:", err);
            }
        }

        list.addEventListener("click", async (e) => {
            if (e.target.closest("[data-nf-more]")) {
                e.preventDefault();
                e.stopPropagation(); // a Bootstrap dropdown bell would otherwise close on this click
                showMore();
                return;
            }

            const markAllBtn = e.target.closest(".notif-markall-btn");
            if (markAllBtn) {
                e.preventDefault();
                try {
                    await fetch("/Notifications/MarkAllAsRead", { method: "POST" });
                    notifications.forEach(n => n.isRead = true);
                    unreadTotal = 0;
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
                // keepalive: the link navigates away immediately.
                fetch(`/Notifications/MarkAsRead?id=${id}`, { method: "POST", keepalive: true }).catch(() => {});
                n.isRead = true;
                unreadTotal = Math.max(0, unreadTotal - 1);
                item.classList.remove("is-unread");
                updateBadge();
            }
        });

        bellBtn.addEventListener("click", () => {
            resetPage();
            if (!loaded || Date.now() - loadedAt > 60000) load();
        });
        // The mobile tab bar opens the same popover through its own button.
        document.addEventListener("click", (e) => {
            const opener = e.target.closest('[data-action="notifications"]');
            if (opener && opener !== bellBtn) resetPage();
        });

        if (window.ArisChat) {
            ArisChat.onNotification((n) => {
                // A repeat of an unread event replaces the older entry instead of stacking.
                const drop = new Set([n.id, ...(n.replaces || [])]);
                const dropUnread = notifications.filter(x => drop.has(x.id) && !x.isRead).length;
                notifications = [n, ...notifications.filter(x => !drop.has(x.id))].slice(0, MAX_ITEMS);
                unreadTotal = Math.max(0, unreadTotal - dropUnread) + 1;
                const motion = window.ArisMotion;
                if (motion && motion.pulse && badge) motion.pulse(badge);
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
