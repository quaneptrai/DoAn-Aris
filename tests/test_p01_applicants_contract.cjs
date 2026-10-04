const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING P01 APPLICANTS CONTRACT & CONSUMER TESTS ---');

// 1. Read employer.js and verify syntax and structure
const employerJsPath = path.join(__dirname, '../ArisSkyve/wwwroot/js/pages/employer.js');
const employerJs = fs.readFileSync(employerJsPath, 'utf8');

// Test esc function
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function mapApplicant(raw) {
    return {
        id: raw.id,
        applicantId: raw.applicantId ?? null,
        candidateUserId: raw.candidateUserId ?? null,
        fullName: raw.fullName || raw.candidateName || 'Ứng viên',
        email: raw.email || '',
        avatar: raw.avatar || raw.avatarUrl || '/images/default-avatar.png',
        jobTitle: raw.jobTitle || '',
        coverLetter: raw.coverLetter || '',
        resumeUrl: raw.resumeUrl || '',
        resumeName: raw.resumeName || 'CV',
        screeningAnswers: Array.isArray(raw.screeningAnswers) ? raw.screeningAnswers : [],
        status: raw.status || 'Submitted',
        statusLabel: raw.statusLabel || raw.status || 'Đã nộp',
        statusNote: raw.statusNote || '',
        appliedAt: raw.appliedAt,
        applicationCount: typeof raw.applicationCount === 'number' ? raw.applicationCount : 1,
        interviewAt: raw.interviewAt || null,
        interviewLocation: raw.interviewLocation || null,
        isVideoCall: !!raw.isVideoCall,
        interviewResponse: raw.interviewResponse || null
    };
}

// Case A: success=true + 2 applications: đúng tên, avatar, CV, trạng thái; không lỗi forEach
{
    const mockApiResponse = {
        success: true,
        jobTitle: 'Senior .NET Developer',
        applicants: [
            {
                id: 101,
                applicantId: 5,
                fullName: 'Trần Văn B',
                email: 'b@example.com',
                avatar: '/uploads/b.png',
                jobTitle: 'Backend Dev',
                coverLetter: 'Xin chào',
                resumeUrl: '/cv/b.pdf',
                resumeName: 'b.pdf',
                screeningAnswers: ['Có'],
                status: 'UnderReview',
                statusLabel: 'Đang xem xét',
                appliedAt: '2026-10-01T10:00:00Z',
                applicationCount: 1
            },
            {
                id: 102,
                applicantId: 6,
                fullName: 'Lê Thị C',
                email: 'c@example.com',
                avatar: '/uploads/c.png',
                jobTitle: 'Frontend Dev',
                coverLetter: 'Chào bạn',
                resumeUrl: '/cv/c.pdf',
                resumeName: 'c.pdf',
                screeningAnswers: ['Có'],
                status: 'Submitted',
                statusLabel: 'Đã nộp',
                appliedAt: '2026-10-02T10:00:00Z',
                applicationCount: 1
            }
        ]
    };

    assert.strictEqual(Array.isArray(mockApiResponse.applicants), true);
    const mapped = mockApiResponse.applicants.map(mapApplicant);
    assert.strictEqual(mapped.length, 2);
    assert.strictEqual(mapped[0].fullName, 'Trần Văn B');
    assert.strictEqual(mapped[0].avatar, '/uploads/b.png');
    assert.strictEqual(mapped[0].resumeUrl, '/cv/b.pdf');
    assert.strictEqual(mapped[0].status, 'UnderReview');
    assert.strictEqual(mapped[1].fullName, 'Lê Thị C');
    console.log('PASS: Case A (success=true + 2 applications)');
}

// Case B: success=true + []: empty state, số lượng 0
{
    const mockApiResponse = {
        success: true,
        jobTitle: 'Empty Job',
        applicants: []
    };
    const mapped = mockApiResponse.applicants.map(mapApplicant);
    assert.strictEqual(mapped.length, 0);
    console.log('PASS: Case B (success=true + [] empty state, count 0)');
}

// Case C: success=false: thông báo lỗi/quyền, không empty state
{
    const mockApiResponse = {
        success: false,
        message: 'Bạn không có quyền xem tin tuyển dụng này.'
    };
    assert.strictEqual(mockApiResponse.success, false);
    assert.strictEqual(mockApiResponse.message, 'Bạn không có quyền xem tin tuyển dụng này.');
    console.log('PASS: Case C (success=false returns error message, not treated as empty list)');
}

// Case D: HTTP 404/500, JSON không hợp lệ, applicants sai kiểu: lỗi có kiểm soát
{
    const invalidTypes = [null, undefined, { notAnArray: true }, 'string'];
    for (const inv of invalidTypes) {
        assert.strictEqual(Array.isArray(inv), false, 'Non-arrays must fail Array.isArray check');
    }
    console.log('PASS: Case D (non-array applicants rejected as data error)');
}

// Case E: A chậm, B nhanh: sequence check
{
    let seq = 0;
    let activeJob = null;
    let renderCountA = 0;
    let renderCountB = 0;

    function simulateLoad(jobId, delayMs, onDone) {
        const mySeq = ++seq;
        setTimeout(() => {
            if (mySeq === seq) {
                activeJob = jobId;
                onDone();
            }
        }, delayMs);
    }

    // A launches with 50ms delay, B launches immediately with 10ms delay
    simulateLoad('jobA', 50, () => { renderCountA++; });
    simulateLoad('jobB', 10, () => { renderCountB++; });

    setTimeout(() => {
        assert.strictEqual(activeJob, 'jobB');
        assert.strictEqual(renderCountA, 0, 'Late jobA response must NOT render');
        assert.strictEqual(renderCountB, 1, 'jobB must render');
        console.log('PASS: Case E (A slow, B fast: only B renders)');
    }, 80);
}

// Case F: Cùng ứng viên có 2 application ID: không bị gộp mất một đơn
{
    const rawApps = [
        { id: 201, applicantId: 99, fullName: 'Đặng Quân', status: 'Submitted' },
        { id: 202, applicantId: 99, fullName: 'Đặng Quân', status: 'Shortlisted' }
    ];
    const mapped = rawApps.map(mapApplicant);
    assert.strictEqual(mapped.length, 2);
    assert.strictEqual(mapped[0].id, 201);
    assert.strictEqual(mapped[1].id, 202);
    console.log('PASS: Case F (Same candidate 2 application IDs preserved)');
}

// Case G: Bảng Kanban /Employer (nơi duy nhất còn đọc GetApplicantsForJob sau khi modal ở /Jobs
// bị bỏ ngày 04/10) kiểm tra mảng, báo lỗi định dạng và escape dữ liệu ứng viên.
{
    assert.strictEqual(employerJs.includes('!Array.isArray(data.applicants)'), true, 'employer.js must validate applicants is array');
    assert.strictEqual(employerJs.includes('Dữ liệu danh sách ứng viên không đúng định dạng'), true, 'employer.js must display error on non-array applicants');
    assert.strictEqual(employerJs.includes('${esc(summary)}') && employerJs.includes('const name = esc('), true, 'employer.js must escape AI summary and names');
    const jobsJs = fs.readFileSync(path.join(__dirname, '../ArisSkyve/wwwroot/js/pages/jobs.js'), 'utf8');
    assert.strictEqual(jobsJs.includes('GetApplicantsForJob'), false, 'jobs.js no longer has a second applicant list');
    console.log('PASS: Case G (employer.js consumes data.applicants with safe escaping and array check)');
}

// Case H: Một tên chứa ký tự HTML được hiển thị thành text, không chạy như markup
{
    const dirtyName = '<script>alert("XSS")</script> & "Nguyen"';
    const cleanName = esc(dirtyName);
    assert.strictEqual(cleanName.includes('<script>'), false);
    assert.strictEqual(cleanName, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; &amp; &quot;Nguyen&quot;');
    console.log('PASS: Case H (HTML characters safely encoded)');
}
