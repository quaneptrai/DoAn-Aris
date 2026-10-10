// File formats and weighted question imports, adapted from the 26Flow question workflow.
(function (root) {
    'use strict';
    const clean = value => String(value ?? '').trim();
    const header = value => clean(value).replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const aliases = { Code: ['id', 'code', 'question_id', 'ma_cau_hoi'], Question: ['question', 'cau_hoi'], AnswerKey: ['answer', 'answer_key', 'dap_an', 'correct_answer'], KeyPoints: ['points', 'key_points', 'y_chinh'], Weight: ['weight', 'trong_so'], PrepSeconds: ['prep_seconds', 'preparation_seconds', 'giay_chuan_bi'], AnswerSeconds: ['answer_seconds', 'giay_tra_loi'], Retakes: ['retakes', 'max_retries', 'so_lan_lam_lai'], PointWeights: ['point_weights', 'trong_so_y'] };
    const field = (row, name) => aliases[name].map(key => row[key]).find(v => v != null);
    const fields = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [header(k), v]));
    const number = (value, fallback, min, max, label) => { if (value == null || value === '') return fallback; const n = Number(value); if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: giá trị phải từ ${min} đến ${max}.`); return n; };
    function csv(text) {
        const first = text.split(/\r?\n/)[0]; const separator = first.includes('\t') ? '\t' : first.includes(',') ? ',' : ';';
        const rows = []; let row = [], value = '', quoted = false;
        for (let i = 0; i <= text.length; i++) {
            const c = text[i];
            if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
            else if (!quoted && (c === separator || c === '\n' || c == null)) { row.push(value); value = ''; if (c !== separator) { if (row.some(x => x.trim())) rows.push(row); row = []; } }
            else if (c !== '\r' || quoted) value += c;
        }
        if (quoted) throw new Error('CSV có dấu ngoặc kép chưa đóng.');
        const names = (rows.shift() || []).map(header);
        if (names.length === 0 || new Set(names).size !== names.length || names.some(n => !n)) throw new Error('CSV thiếu tiêu đề hoặc có tiêu đề trùng.');
        return rows.map((values, i) => { if (values.length !== names.length) throw new Error(`Dòng CSV ${i + 2} không khớp số cột.`); return Object.fromEntries(names.map((name, index) => [name, values[index]])); });
    }
    function txt(text) {
        const rows = []; let row = {}, key = '';
        for (const line of text.split(/\r?\n/)) {
            const match = line.match(/^\s*(ID|Mã câu hỏi|Câu hỏi(?:\s+\d+)?|Question(?:\s+\d+)?|Đáp án|Answer|Ý chính|Key points|Trọng số|Giây chuẩn bị|Giây trả lời|Số lần làm lại)\s*:\s*(.*)$/i);
            if (match) { const name = header(match[1].replace(/\s+\d+$/, '')); if ((['id', 'ma_cau_hoi'].includes(name) && (row.id || row.ma_cau_hoi)) || ['cau_hoi', 'question'].includes(name) && (row.cau_hoi || row.question)) { rows.push(row); row = {}; } key = name; row[key] = match[2]; }
            else if (key && line.trim()) row[key] += '\n' + line.trim();
        }
        if (Object.keys(row).length) rows.push(row); return rows;
    }
    function rows(text, name) {
        text = clean(text).replace(/^\uFEFF/, ''); if (!text) throw new Error('File rỗng.');
        if (/\.json$/i.test(name) || /^[\[{]/.test(text)) { let value; try { value = JSON.parse(text); } catch { throw new Error('JSON không hợp lệ.'); } return Array.isArray(value) ? value : value.questions ?? value.answers; }
        if (/\.(csv|tsv)$/i.test(name)) return csv(text);
        if (/\.txt$/i.test(name)) return txt(text);
        throw new Error('Hỗ trợ file CSV, TSV, JSON và TXT.');
    }
    function normalize(raw, i) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Dòng ${i + 1} không phải câu hỏi.`);
        const row = fields(raw); const q = {};
        for (const name of ['Code', 'Question', 'AnswerKey']) q[name] = clean(field(row, name));
        q.Code ||= `q${i + 1}`;
        if (!q.Question || q.Question.length > 2000 || q.AnswerKey.length > 4000 || q.Code.length > 80) throw new Error(`Câu ${q.Code} thiếu nội dung hoặc quá dài.`);
        const points = field(row, 'KeyPoints');
        q.KeyPoints = Array.isArray(points) ? points.map(p => typeof p === 'object' ? clean(p.text) : clean(p)).join(';') : clean(points);
        const pointWeights = field(row, 'PointWeights');
        q.PointWeights = (Array.isArray(pointWeights) ? pointWeights.join(';') : clean(pointWeights)) || (Array.isArray(points) && points.some(p => p && typeof p === 'object') ? points.map(p => typeof p === 'object' ? number(p.weight, 1, .01, 1000, 'Trọng số ý') : 1).join(';') : '');
        if (q.PointWeights) {
            const weights = q.PointWeights.split(';');
            if (weights.length !== q.KeyPoints.split(';').filter(p => p.trim()).length || weights.some(w => !w.trim())) throw new Error(`Trọng số ý câu ${q.Code} không khớp số ý chính.`);
            weights.forEach(w => number(w, 1, .01, 1000, 'Trọng số ý'));
        }
        if (q.KeyPoints.length > 2000 || q.PointWeights.length > 2000) throw new Error(`Ý chính câu ${q.Code} quá dài.`);
        q.Weight = number(field(row, 'Weight'), 1, .01, 1000, 'Trọng số câu');
        q.PrepSeconds = Math.round(number(field(row, 'PrepSeconds'), 10, 0, 120, 'Giây chuẩn bị'));
        q.AnswerSeconds = Math.round(number(field(row, 'AnswerSeconds'), 90, 15, 600, 'Giây trả lời'));
        q.Retakes = Math.round(number(field(row, 'Retakes'), 1, 0, 3, 'Số lần làm lại'));
        return q;
    }
    function parse(text, name) {
        const list = rows(text, name); if (!Array.isArray(list) || !list.length || list.length > 200) throw new Error('File cần có từ 1 đến 200 câu hỏi.');
        const questions = list.map(normalize); if (new Set(questions.map(q => q.Code)).size !== questions.length) throw new Error('Mã câu hỏi bị trùng.'); return questions;
    }
    function merge(questions, text, name) {
        const list = rows(text, name); if (!Array.isArray(list) || !list.length) throw new Error('File đáp án rỗng.');
        const byCode = new Map(questions.map(q => [q.Code, q])); const seen = new Set(); const changes = new Map();
        for (const raw of list) { const row = fields(raw), id = clean(field(row, 'Code')), answer = clean(field(row, 'AnswerKey')); if (!byCode.has(id) || !answer || seen.has(id)) throw new Error(`Đáp án ${id || '(không có mã)'} bị trùng, thiếu nội dung hoặc không có câu tương ứng.`); seen.add(id); const q = byCode.get(id); changes.set(id, normalize({ ...q, AnswerKey: answer, KeyPoints: field(row, 'KeyPoints') ?? q.KeyPoints, PointWeights: field(row, 'PointWeights') ?? (field(row, 'KeyPoints') ? '' : q.PointWeights) }, 0)); }
        return questions.map(q => changes.get(q.Code) ?? q);
    }
    const sample = [ { id: 'q1', cau_hoi: 'Dependency Injection giúp gì khi viết phần mềm?', dap_an: 'Giảm phụ thuộc cứng giữa các lớp và giúp thay thế dependency khi kiểm thử.', y_chinh: [{ text: 'giảm phụ thuộc cứng', weight: 2 }, { text: 'thay thế dependency khi kiểm thử', weight: 1 }], trong_so: 2, giay_chuan_bi: 10, giay_tra_loi: 60 }, { id: 'q2', cau_hoi: 'Bạn kiểm tra lỗi một thiết bị nhúng không khởi động như thế nào?', dap_an: 'Kiểm tra nguồn, reset, clock, kết nối debugger và log khởi động.', y_chinh: 'nguồn;reset;clock;debugger;log', giay_chuan_bi: 15, giay_tra_loi: 90 } ];
    root.ArisInterviewData = { parse, merge, sample }; if (typeof module === 'object' && module.exports) module.exports = root.ArisInterviewData;
})(typeof globalThis === 'object' ? globalThis : this);
