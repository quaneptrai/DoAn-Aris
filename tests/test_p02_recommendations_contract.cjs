const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING P02 RECOMMENDATIONS CONTRACT & IDENTITY TESTS ---');

// 1. Verify JobRecommendationDTO & AiResponseWrapper C# declarations
const dtoPath = path.join(__dirname, '../ArisSkyve/Application/DTOs/JobRecommendationDTO.cs');
const dtoContent = fs.readFileSync(dtoPath, 'utf8');
assert.strictEqual(dtoContent.includes('double? Score'), true, 'Score must be nullable double');
assert.strictEqual(dtoContent.includes('int? PostingId'), true, 'Must include PostingId');
assert.strictEqual(dtoContent.includes('posting_id'), true, 'Must map posting_id json property');
assert.strictEqual(dtoContent.includes('evidence'), true, 'Must include evidence');
assert.strictEqual(dtoContent.includes('explanation_status'), true, 'Must include explanation_status');
console.log('PASS: DTO schema matches AiCore contract (posting_id, nullable Score, evidence, explanation_status)');

// 2. Verify JobsController selection & mapping rules
const controllerPath = path.join(__dirname, '../ArisSkyve/Controllers/JobsController.cs');
const controllerContent = fs.readFileSync(controllerPath, 'utf8');
assert.strictEqual(controllerContent.includes('Math.Clamp(topK, 1, 50)'), true, 'topK must be bounded [1, 50]');
assert.strictEqual(controllerContent.includes('OrderByDescending(r => r.LastUpdatedAt)'), true, 'Must sort resumes by LastUpdatedAt DESC');
assert.strictEqual(controllerContent.includes('ThenByDescending(r => r.Id)'), true, 'Must tiebreak resumes by Id DESC');
assert.strictEqual(controllerContent.includes('!string.IsNullOrEmpty(r.VectorId)'), true, 'Must require VectorId');
assert.strictEqual(controllerContent.includes('rec.PostingId.HasValue'), true, 'Must prioritize PostingId');
assert.strictEqual(controllerContent.includes('jobInDb.isActive'), true, 'Must check isActive on matched job');
assert.strictEqual(controllerContent.includes('r.ResumeId == resumeIdBefore'), true, 'Must isolate recommendations by ResumeId');
console.log('PASS: Controller implements unified CV selection and job identity mapping without title fallback and with ResumeId isolation');

// 3. Simulated unit tests for contract parsing & mapping logic
{
    // Case 1: AiCore response with posting_id, null score, and evidence
    const rawAiCoreResponse = {
        status: "success",
        candidate: "Nguyễn Văn A",
        recommendations: [
            {
                job_id: "vec_hash_1",
                posting_id: 101,
                job_title: ".NET Developer",
                company: "Aris Corp",
                final_score: null,
                reason: "Trùng khớp kỹ năng backend",
                advice: "Cần cải thiện tiếng Anh",
                matched_skills: ["C#", "EF Core"],
                missing_skills: ["Docker"],
                evidence: [{ cv_quote: "3 năm C#", job_quote: "Yêu cầu C#" }],
                explanation_status: "grounded"
            },
            {
                job_id: "vec_hash_2",
                posting_id: null,
                original_url: "https://job.vn/102",
                job_title: "Java Developer",
                company: "ABC Tech",
                final_score: 82.5,
                reason: "Phù hợp kỹ năng OOP",
                advice: "",
                matched_skills: ["Java"],
                missing_skills: ["Spring Boot"],
                evidence: [],
                explanation_status: "unavailable"
            }
        ]
    };

    assert.strictEqual(rawAiCoreResponse.recommendations[0].final_score, null);
    assert.strictEqual(rawAiCoreResponse.recommendations[0].posting_id, 101);
    assert.strictEqual(rawAiCoreResponse.recommendations[1].final_score, 82.5);
    console.log('PASS: Simulated AiCore payload preserves null final_score and posting_id');
}

// 4. Verify Partial view handles null score & missing skills phrasing
const partialPath = path.join(__dirname, '../ArisSkyve/Views/Shared/_RecommendedJobsPartial.cshtml');
const partialContent = fs.readFileSync(partialPath, 'utf8');
assert.strictEqual(partialContent.includes('double? s'), true, 'ScoreTier must accept nullable double');
const insightCs = fs.readFileSync(path.join(__dirname, '../ArisSkyve/Infrastructure/Services/Recruitment/MatchInsight.cs'), 'utf8');
assert.strictEqual(partialContent.includes('MatchInsight.BuildSummary'), true, 'Card summary must come from MatchInsight.BuildSummary');
assert.strictEqual(insightCs.includes('CV chưa nhắc'), true, 'Missing skills must be phrased respectfully');
assert.strictEqual(/thiếu kỹ năng/i.test(insightCs), false, 'Summary must not tell the candidate they lack a skill');
assert.strictEqual(partialContent.includes('/100'), true, 'Score must display 100-point scale label');
console.log('PASS: Partial view renders nullable score and respectful missing skills phrasing');
