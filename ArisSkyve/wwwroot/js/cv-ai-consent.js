// Các API gửi CV tới AI trả 428 + code "cv_ai_consent_required" khi người dùng chưa đồng ý AI xử lý CV.
// arisFetchWithCvAiConsent(url, init): gọi như fetch; gặp 428 thì hỏi người dùng, ghi nhận đồng ý
// (POST /privacy/cv-ai-consent — header CSRF do wrapper fetch của _AppLayout tự gắn) rồi gửi lại đúng một lần.
(function () {
    'use strict';
    var MESSAGE = 'Tính năng này gửi nội dung CV của bạn tới AI (dịch vụ AI của Aris, Google Gemini, Pinecone) để đọc, chấm CV và gợi ý việc làm.\n\n' +
        'Bạn có đồng ý không? Bạn có thể tắt lại bất cứ lúc nào tại trang Chính sách quyền riêng tư (/privacy).';

    async function consentRequired(response) {
        if (response.status !== 428) return false;
        var body = await response.clone().json().catch(function () { return {}; });
        return !!body && body.code === 'cv_ai_consent_required';
    }

    async function grantConsent() {
        var response = await fetch('/privacy/cv-ai-consent', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });
        return response.ok;
    }

    window.arisFetchWithCvAiConsent = async function (url, init) {
        var first = await fetch(url, init);
        if (!(await consentRequired(first))) return first;
        if (!window.confirm(MESSAGE)) return first;
        if (!(await grantConsent())) return first;
        return fetch(url, init);
    };
})();
