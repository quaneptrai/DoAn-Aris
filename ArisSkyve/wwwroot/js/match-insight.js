/* =============================================================================
   ARIS LINE — Phân tích CV ↔ tin (dùng chung)
   - Nhà tuyển dụng: tab "Phân tích AI" trong ngăn ứng viên (employer.js gọi render()).
   - Ứng viên: ngăn "Vì sao?" của gợi ý việc làm và đơn ứng tuyển (openForRecommendation /
     openForApplication) — kèm gợi ý sửa CV và "Nên học gì tiếp" từ AiCore.
   Mọi câu chữ ở đây dựng từ dữ liệu chấm thật; AiCore không trả giải thích thì nói thẳng là không có.
   File: wwwroot/js/match-insight.js
   ============================================================================= */
(function () {
    'use strict';

    function esc(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function icons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }
    function tierOf(score) {
        if (score == null || isNaN(score)) return { key: 'none', label: 'Chưa chấm' };
        if (score >= 75) return { key: 'high', label: 'Rất phù hợp' };
        if (score >= 60) return { key: 'good', label: 'Phù hợp' };
        if (score >= 45) return { key: 'mid', label: 'Cần cân nhắc' };
        return { key: 'low', label: 'Ít phù hợp' };
    }
    const lower = (s) => String(s || '').toLowerCase().trim();

    // ---------------------------------------------------------------------
    // Khối phân tích. audience: 'employer' | 'candidate'
    // ---------------------------------------------------------------------
    function render(match, opts) {
        opts = opts || {};
        const who = opts.audience || 'candidate';
        if (!match) {
            return `<div class="ai-empty"><i data-lucide="sparkles"></i><div>${esc(opts.emptyText || 'AI chưa chấm hồ sơ này.')}</div></div>`;
        }
        const score = typeof match.score === 'number' ? Math.round(match.score) : null;
        const tier = match.tier ? { key: match.tier, label: match.tierLabel || tierOf(score).label } : tierOf(score);
        const matched = Array.isArray(match.matched) ? match.matched : [];
        const missing = Array.isArray(match.missing) ? match.missing : [];
        const evidence = (Array.isArray(match.evidence) ? match.evidence : []).filter(e => e && (e.cv || e.job || e.cvQuote || e.jobQuote));
        let html = '';

        html += `
          <div class="ai-meter">
            <div class="ai-meter__row">
              <span class="ai-meter__score">${score == null ? '—' : score}<small>/100</small></span>
              <span class="ai-meter__tier" data-tier="${esc(tier.key)}">${esc(tier.label)}</span>
            </div>
            <div class="ai-meter__bar" data-tier="${esc(tier.key)}"><span data-w="${score == null ? 0 : Math.max(2, Math.min(100, score))}"></span></div>
            <div class="ai-meter__note">Điểm dùng để xếp hạng hồ sơ cho cùng một tin, không phải xác suất trúng tuyển.</div>
          </div>`;

        if (match.summary) html += `<p class="ai-prose">${esc(match.summary)}</p>`;

        if (matched.length) {
            html += `<div class="ai-sec"><h6 class="ai-sec__h"><i data-lucide="check-circle"></i> Điểm khớp với tin</h6>
                <div class="ai-chips">${matched.map(s => `<span class="ai-chip ai-chip--ok"><i data-lucide="check"></i>${esc(s)}</span>`).join('')}</div></div>`;
        }

        if (evidence.length) {
            html += `<div class="ai-sec"><h6 class="ai-sec__h"><i data-lucide="message-square-quote"></i> Đối chiếu nguyên văn</h6>
                ${evidence.slice(0, 3).map(e => `
                  <div class="ai-quote">
                    <div><b>${who === 'candidate' ? 'CV của bạn' : 'CV ghi'}</b>${esc(e.cv || e.cvQuote || '—')}</div>
                    <div><b>Tin yêu cầu</b>${esc(e.job || e.jobQuote || '—')}</div>
                  </div>`).join('')}</div>`;
        }

        if (missing.length) {
            html += `<div class="ai-sec"><h6 class="ai-sec__h"><i data-lucide="help-circle"></i> CV chưa nhắc tới</h6>
                <p class="ai-sec__sub">${who === 'candidate'
                    ? 'AI chưa thấy các kỹ năng này trong CV đã lưu — không có nghĩa là bạn không biết.'
                    : 'Chưa thấy trong CV — nên hỏi trực tiếp khi phỏng vấn.'}</p>
                <div class="ai-chips">${missing.map(s => `<span class="ai-chip ai-chip--miss">${esc(s)}</span>`).join('')}</div></div>`;
        }

        if (who === 'employer' && Array.isArray(match.probes) && match.probes.length) {
            html += `<div class="ai-sec"><h6 class="ai-sec__h"><i data-lucide="list-checks"></i> Câu hỏi gợi ý khi phỏng vấn</h6>
                <ol class="ai-list">${match.probes.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>`;
        }

        if (who === 'candidate') {
            const tips = Array.isArray(match.cvSuggestions) ? match.cvSuggestions : [];
            if (tips.length || match.advice) {
                html += `<div class="ai-sec"><h6 class="ai-sec__h"><i data-lucide="file-text"></i> Nên sửa CV thế nào</h6>
                    ${tips.length ? `<ol class="ai-list">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
                    ${match.advice ? `<p class="ai-prose"><b>Gợi ý của AI:</b> ${esc(match.advice)}</p>` : ''}
                    ${opts.cvLink ? `<div><a class="a-btn a-btn--secondary a-btn--sm" href="${esc(opts.cvLink)}"><i data-lucide="square-pen"></i> Mở CV để sửa</a></div>` : ''}
                </div>`;
            }
        }

        if (match.reason) {
            html += `<div class="ai-sec"><h6 class="ai-sec__h"><i data-lucide="sparkles"></i> Nhận định của AI</h6>
                <p class="ai-prose">${esc(match.reason)}</p></div>`;
        } else if (match.explanationStatus === 'unavailable') {
            html += `<p class="ai-meter__note">AI không đưa ra nhận định bằng lời cho cặp này vì không trích được câu nào khớp giữa CV và tin — điểm chỉ dựa trên độ tương đồng nội dung.</p>`;
        }

        if (who === 'candidate' && opts.learning !== false) {
            html += `<div class="ai-sec" data-learning><h6 class="ai-sec__h"><i data-lucide="graduation-cap"></i> Nên học gì tiếp</h6>
                <div class="ai-skel" style="width:80%"></div><div class="ai-skel" style="width:60%"></div></div>`;
        }
        return html;
    }

    // Lý do từ chối (nhóm có cấu trúc + lời nhắn của nhà tuyển dụng) — đầu ngăn "Vì sao?".
    function renderRejection(rej) {
        if (!rej) return '';
        return `
          <div class="mi-reject">
            <div class="mi-reject__eyebrow">Phản hồi từ nhà tuyển dụng</div>
            <div class="mi-reject__label"><i data-lucide="message-square-warning"></i>${esc(rej.label || 'Hồ sơ chưa phù hợp lần này')}</div>
            ${rej.note ? `<p>${esc(rej.note)}</p>` : ''}
          </div>`;
    }

    // ---------------------------------------------------------------------
    // Lộ trình cho đúng tin này — /JobApplications/GetMyApplicationGapPlan
    // (AiCore /api/v2/skills/gap-plan). Lỗi → quay về "Nên học gì tiếp" chung.
    // ---------------------------------------------------------------------
    const STAGE_HINT = {
        1: 'Gần với kỹ năng bạn đã có — học nhanh nhất',
        2: 'Học sau khi xong chặng 1',
        3: 'Kỹ năng mới so với hồ sơ hiện tại'
    };

    function renderGapPlan(p, opts) {
        opts = opts || {};
        const steps = Array.isArray(p.steps) ? p.steps : [];
        const byStage = { 1: [], 2: [], 3: [] };
        steps.forEach(s => (byStage[s.stage] || byStage[3]).push(s));
        let html = '';

        if (opts.notSkills) {
            html += `<p class="ai-sec__sub">Lý do lần này không nằm ở kỹ năng, nhưng nếu bạn muốn ứng tuyển vị trí tương tự, đây là phần CV còn thiếu so với tin.</p>`;
        }

        if (typeof p.coverageNow === 'number') {
            const now = Math.max(0, Math.min(100, p.coverageNow));
            const next = typeof p.coverageAfterStage1 === 'number' ? Math.max(now, Math.min(100, p.coverageAfterStage1)) : now;
            html += `
              <div class="gp-cov">
                <div class="gp-cov__row">
                  <span>CV của bạn khớp <b>${now}%</b> kỹ năng chuyên môn tin cần</span>
                  ${next > now ? `<span class="gp-cov__gain">→ <b>${next}%</b> sau chặng 1</span>` : ''}
                </div>
                <div class="gp-cov__bar"><span class="gp-cov__next" data-w="${next}"></span><span class="gp-cov__now" data-w="${now}"></span></div>
              </div>`;
        }

        if (!steps.length) {
            html += `<p class="ai-sec__sub">Theo đồ thị kỹ năng, CV đã có các kỹ năng chuyên môn tin này nhắc tới. Điểm cần cải thiện nằm ở cách trình bày kinh nghiệm — xem phần "Nên sửa CV thế nào" ở trên.</p>`;
        } else {
            html += '<ol class="gp-stages">';
            [1, 2, 3].forEach(n => {
                const list = byStage[n];
                if (!list.length) return;
                html += `
                  <li class="gp-stage" data-stage="${n}">
                    <div class="gp-stage__head">
                      <span class="gp-stage__num">${n}</span>
                      <b>${esc(list[0].stageLabel || '')}</b>
                      <span class="gp-stage__hint">${esc(STAGE_HINT[n])}</span>
                    </div>
                    <ul class="gp-skills">
                      ${list.map(s => {
                          const why = [];
                          if (s.relatedTo && s.relatedTo.length) why.push(`dựa trên ${s.relatedTo.map(esc).join(', ')} bạn đã có`);
                          if (s.after && s.after.length) why.push(`học sau ${s.after.map(esc).join(', ')}`);
                          if (s.activePostings) why.push(`${s.activePostings} tin đang tuyển cần`);
                          if (s.opens) why.push(`mở thêm ${s.opens} tin gần hồ sơ bạn`);
                          return `<li>
                              <a class="gp-skill" href="/Jobs?q=${encodeURIComponent(s.skill)}" title="Xem tin tuyển dụng cần ${esc(s.skill)}">${esc(s.skill)}</a>
                              <span class="gp-why">${why.join(' · ')}</span>
                            </li>`;
                      }).join('')}
                    </ul>
                  </li>`;
            });
            html += '</ol>';
            if (p.totalSteps > steps.length) {
                html += `<p class="ai-sec__sub">Và ${p.totalSteps - steps.length} kỹ năng khác tin này nhắc tới — bắt đầu từ chặng 1 trước.</p>`;
            }
        }

        if (Array.isArray(p.matched) && p.matched.length) {
            html += `<div class="ai-chips"><span class="ai-sec__sub" style="margin:0">Đã khớp:</span>${p.matched.map(s => `<span class="ai-chip ai-chip--ok"><i data-lucide="check"></i>${esc(s)}</span>`).join('')}</div>`;
        }
        if (Array.isArray(p.softSkills) && p.softSkills.length) {
            html += `<p class="ai-sec__sub">Tin cũng cần ${p.softSkills.map(esc).join(', ')} — ghi một ví dụ cụ thể vào CV thay vì chỉ liệt kê.</p>`;
        }
        if (Array.isArray(p.unmapped) && p.unmapped.length) {
            html += `<p class="ai-sec__sub">Tin còn nhắc: ${p.unmapped.map(esc).join(', ')}.</p>`;
        }
        return html;
    }

    async function fillGapPlan(container, applicationId, match, opts) {
        const box = container.querySelector('[data-learning]');
        if (!box) return;
        try {
            const res = await fetch(`/JobApplications/GetMyApplicationGapPlan?applicationId=${encodeURIComponent(applicationId)}`);
            const d = await res.json();
            if (!d || !d.success || !d.plan) throw new Error((d && d.message) || 'no plan');
            box.innerHTML = `<h6 class="ai-sec__h"><i data-lucide="route"></i> Lộ trình để đạt tin này</h6>` + renderGapPlan(d.plan, opts);
            icons();
            requestAnimationFrame(() => {
                box.querySelectorAll('.gp-cov__bar > span[data-w]').forEach(s => { s.style.width = s.dataset.w + '%'; });
            });
        } catch {
            fillLearning(container, match && match.missing);
        }
    }

    // Thanh điểm chạy từ 0 lên sau khi gắn vào DOM.
    function animate(container) {
        requestAnimationFrame(() => {
            container.querySelectorAll('.ai-meter__bar > span[data-w]').forEach(s => { s.style.width = s.dataset.w + '%'; });
        });
    }

    // ---------------------------------------------------------------------
    // "Nên học gì tiếp" — /Jobs/GetLearningPath (AiCore /api/v2/skills/learning-path)
    // ---------------------------------------------------------------------
    let learningCache = null;
    async function fillLearning(container, missing) {
        const box = container.querySelector('[data-learning]');
        if (!box) return;
        const head = box.querySelector('.ai-sec__h').outerHTML;
        try {
            if (!learningCache) {
                const res = await fetch('/Jobs/GetLearningPath?limit=8');
                learningCache = await res.json();
            }
            const data = learningCache;
            const miss = (missing || []).map(lower);
            if (!data || !data.success) {
                const fallback = (missing || []).slice(0, 4);
                box.innerHTML = head + (fallback.length
                    ? `<p class="ai-sec__sub">Bắt đầu từ chính các kỹ năng tin này yêu cầu mà CV chưa có: ${fallback.map(esc).join(', ')}.</p>`
                    : `<p class="ai-sec__sub">${esc((data && data.message) || 'Chưa lấy được gợi ý kỹ năng lúc này.')}</p>`);
                if (!data || !data.success) learningCache = null;
                return;
            }
            const sugg = (data.suggestions || []).slice();
            // Kỹ năng tin này cần lên đầu.
            sugg.sort((a, b) => (miss.includes(lower(b.skill)) ? 1 : 0) - (miss.includes(lower(a.skill)) ? 1 : 0));
            const covered = new Set(sugg.map(s => lower(s.skill)));
            const extra = (missing || []).filter(m => !covered.has(lower(m))).slice(0, 4);

            box.innerHTML = head + `
              <p class="ai-sec__sub">Xếp theo số việc được gợi ý cho bạn cần kỹ năng đó, độ gần với kỹ năng bạn đã có và số tin đang tuyển.</p>
              <ol class="ai-list mi-learn">
                ${sugg.slice(0, 6).map(s => `
                  <li>
                    <b>${esc(s.skill)}</b>
                    ${miss.includes(lower(s.skill)) ? '<span class="ai-chip ai-chip--miss" style="margin-left:6px">Tin này cần</span>' : ''}
                    <div class="mi-learn__meta">
                      ${s.relatedTo && s.relatedTo.length ? `Gần với ${s.relatedTo.map(esc).join(', ')} bạn đã có` : ''}
                      ${s.activePostings ? ` · ${s.activePostings} tin đang tuyển cần` : ''}
                      ${s.recommendedJobs ? ` · ${s.recommendedJobs} việc gợi ý cho bạn cần` : ''}
                    </div>
                    ${s.exampleJobs && s.exampleJobs.length ? `<div class="mi-learn__meta">Ví dụ: ${s.exampleJobs.map(esc).join(', ')}</div>` : ''}
                  </li>`).join('')}
              </ol>
              ${extra.length ? `<p class="ai-sec__sub">Tin này còn yêu cầu: ${extra.map(esc).join(', ')}.</p>` : ''}
              ${!sugg.length && !extra.length ? '<p class="ai-sec__sub">CV của bạn đã phủ các kỹ năng phổ biến trong nhóm việc được gợi ý.</p>' : ''}`;
            icons();
        } catch {
            box.innerHTML = head + '<p class="ai-sec__sub">Không kết nối được dịch vụ kỹ năng.</p>';
        }
    }

    // ---------------------------------------------------------------------
    // Ngăn "Vì sao?" phía ứng viên
    // ---------------------------------------------------------------------
    let dlg = null, scrim = null;
    function ensureSheet() {
        if (dlg) return;
        scrim = document.createElement('div');
        scrim.className = 'a-scrim';
        scrim.hidden = true;
        dlg = document.createElement('div');
        dlg.className = 'a-dialog mi-dialog';
        dlg.setAttribute('role', 'dialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', 'miTitle');
        dlg.hidden = true;
        dlg.innerHTML = `
          <div class="a-dialog__head">
            <div class="mi-head">
              <div class="mi-eyebrow">Phân tích CV với tin</div>
              <h2 class="a-dialog__title" id="miTitle"></h2>
              <div class="mi-sub" id="miSub"></div>
            </div>
            <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-mi-close aria-label="Đóng"><i data-lucide="x"></i></button>
          </div>
          <div class="a-dialog__body" id="miBody"></div>
          <div class="a-dialog__foot" id="miFoot"></div>`;
        document.body.append(scrim, dlg);
        const close = () => {
            if (window.ArisMotion) window.ArisMotion.closeDialog(dlg, scrim);
            else { dlg.hidden = true; scrim.hidden = true; }
        };
        scrim.addEventListener('click', close);
        dlg.addEventListener('click', (e) => { if (e.target.closest('[data-mi-close]')) close(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.hidden) close(); });
    }
    function openSheet(origin) {
        ensureSheet();
        if (window.ArisMotion) window.ArisMotion.openDialog(dlg, scrim, origin);
        else { dlg.hidden = false; scrim.hidden = false; }
    }

    function setHeader(title, sub) {
        dlg.querySelector('#miTitle').textContent = title || 'Phân tích';
        dlg.querySelector('#miSub').innerHTML = sub || '';
    }

    function fillBody(html, match, gap) {
        const body = dlg.querySelector('#miBody');
        body.innerHTML = `<div class="mi-body">${html}</div>`;
        icons();
        animate(body);
        if (gap) fillGapPlan(body, gap.applicationId, match, gap);
        else fillLearning(body, match && match.missing);
    }

    // data: dữ liệu gắn sẵn trên thẻ gợi ý (xem _RecommendedJobsPartial)
    function openForRecommendation(data, origin) {
        openSheet(origin);
        setHeader(data.jobTitle, esc(data.company || ''));
        fillBody(render(data, { audience: 'candidate', cvLink: '/Resume/Index' }), data);
        dlg.querySelector('#miFoot').innerHTML = `
            <a class="a-btn a-btn--ghost" href="/Resume/Index">Quản lý CV</a>
            <a class="a-btn a-btn--primary" href="/Jobs/Details/${encodeURIComponent(data.jobId)}">Xem tin &amp; ứng tuyển</a>`;
    }

    async function openForApplication(applicationId, origin) {
        openSheet(origin);
        setHeader('Đang tải…', '');
        dlg.querySelector('#miBody').innerHTML = `
          <div class="mi-body">
            <div class="ai-skel" style="width:40%;height:28px"></div>
            <div class="ai-skel" style="width:100%"></div><div class="ai-skel" style="width:85%"></div>
            <p class="ai-sec__sub" style="margin-top:8px">Nếu đơn chưa được chấm, AI cần 5–40 giây để đọc CV và tin.</p>
          </div>`;
        dlg.querySelector('#miFoot').innerHTML = '';
        try {
            const res = await fetch(`/JobApplications/GetMyApplicationInsight?applicationId=${encodeURIComponent(applicationId)}`);
            const d = await res.json();
            if (!d.success) throw new Error(d.message || 'Không tải được phân tích.');
            setHeader(d.job.title, `${esc(d.job.company || '')} · <span class="mi-status">${esc(d.statusLabel)}</span>`);
            let pre = '';
            if (d.rejection) {
                pre = renderRejection(d.rejection);
            } else if (d.employerNote && d.status === 'Rejected') {
                pre = `<div class="mi-note"><b>Phản hồi từ nhà tuyển dụng</b><p>${esc(d.employerNote)}</p></div>`;
            }
            fillBody(pre + render(d.match, {
                audience: 'candidate',
                cvLink: '/Resume/Index',
                emptyText: d.matchError || 'AI chưa chấm được CV này.'
            }), d.match, { applicationId, notSkills: !!(d.rejection && d.rejection.skillGap === false) });
            dlg.querySelector('#miFoot').innerHTML = `
                <a class="a-btn a-btn--ghost" href="/Jobs/Details/${encodeURIComponent(d.job.id)}">Xem tin</a>
                ${d.status === 'Rejected' ? '<a class="a-btn a-btn--secondary" href="/Jobs">Tìm việc khác</a>' : ''}
                <a class="a-btn a-btn--primary" href="/Resume/Index">Sửa CV</a>`;
        } catch (err) {
            setHeader('Không tải được phân tích', '');
            dlg.querySelector('#miBody').innerHTML = `<div class="ai-empty"><i data-lucide="alert-circle"></i><div>${esc(err.message)}</div></div>`;
            icons();
        }
    }

    // Uỷ quyền sự kiện: mọi nút [data-insight-app] / [data-insight-rec] trên trang.
    document.addEventListener('click', (e) => {
        const appBtn = e.target.closest('[data-insight-app]');
        if (appBtn) {
            e.preventDefault();
            openForApplication(appBtn.dataset.insightApp, appBtn);
            return;
        }
        const recBtn = e.target.closest('[data-insight-rec]');
        if (recBtn) {
            e.preventDefault();
            const holder = recBtn.closest('[data-rec-json]');
            if (!holder) return;
            try {
                openForRecommendation(JSON.parse(holder.dataset.recJson), recBtn);
            } catch { /* JSON hỏng: bỏ qua */ }
        }
    });

    window.ArisMatchInsight = { render, animate, fillLearning, fillGapPlan, renderGapPlan, renderRejection, openForApplication, openForRecommendation, tierOf };
})();
