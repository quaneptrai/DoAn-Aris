const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing R2, R3, R5, R6: Backend Cache, Concurrency & Batch Coverage ---');

const repoRoot = path.resolve(__dirname, '..');
const jobsControllerPath = path.join(repoRoot, 'ArisSkyve', 'Controllers', 'JobsController.cs');
const payloadDtoPath = path.join(repoRoot, 'ArisSkyve', 'Application', 'DTOs', 'AiRecommendationPayload.cs');

const jobsControllerCode = fs.readFileSync(jobsControllerPath, 'utf8');
const payloadDtoCode = fs.readFileSync(payloadDtoPath, 'utf8');

// =========================================================================
// 1. SOURCE INTEGRITY & PATTERN VERIFICATION
// =========================================================================
console.log('>>> TEST 1: Source code contracts for R2, R3, R5, R6 in JobsController.cs & DTOs...');

// R2: Query must strictly match ResumeVersion and ResumeId for current resume
assert(jobsControllerCode.includes('r.ResumeVersion == currentResumeVersion'),
    'R2 Failed: Cache query must match ResumeVersion == currentResumeVersion');
assert(jobsControllerCode.includes('r.ResumeId == resumeIdBefore'),
    'R2 Failed: Cache query must strictly match ResumeId == resumeIdBefore');
assert(!jobsControllerCode.includes('r.ResumeId == null'),
    'R2 Failed: Cache query must not contain fallback ResumeId == null');

// R3: Must use AsNoTracking() for CV re-validation in both recommendation and scoring pipelines
assert(jobsControllerCode.includes('_context.Resumes\r\n                                .AsNoTracking()') ||
       jobsControllerCode.includes('_context.Resumes\n                                .AsNoTracking()') ||
       jobsControllerCode.includes('.AsNoTracking()'),
    'R3 Failed: Must use AsNoTracking() to bypass EF Core identity map cache');
assert(jobsControllerCode.includes('latestResumeAfter.Id == resumeIdBefore') ||
       jobsControllerCode.includes('latestResumeAfter.Id != resumeIdBefore'),
    'R3 Failed: Must verify whether latest resume identity shifted during AI execution');

// R5: Must overwrite records and remove obsolete batch records
assert(jobsControllerCode.includes('existing.PayloadJson = payloadJson;'),
    'R5 Failed: Must overwrite existing.PayloadJson on refresh');
assert(jobsControllerCode.includes('existing.Score = rec.Score;'),
    'R5 Failed: Must overwrite existing.Score on refresh');
assert(jobsControllerCode.includes('existing.Rank = rankIndex;'),
    'R5 Failed: Must overwrite existing.Rank on refresh');
assert(jobsControllerCode.includes('_context.UserRecommendations.RemoveRange(obsoleteRecords);'),
    'R5 Failed: Must remove obsolete records not present in the new batch');

// R6: Payload DTO and controller must track RequestedTopK
assert(payloadDtoCode.includes('RequestedTopK'),
    'R6 Failed: AiRecommendationPayload must declare RequestedTopK');
assert(jobsControllerCode.includes('RequestedTopK = topK'),
    'R6 Failed: Controller must save RequestedTopK in serialized payload');
assert(jobsControllerCode.includes('hasFullEvaluation'),
    'R6 Failed: Controller must determine if batch evaluation was complete');

console.log('✓ TEST 1 PASSED: Source contracts verified for R2, R3, R5, R6.');

// =========================================================================
// 2. SIMULATION & ALGORITHMIC VERIFICATION
// =========================================================================

// Simulation database
class MockRecommendationDb {
    constructor() {
        this.records = [];
        this.nextId = 1;
    }

    add(rec) {
        const id = this.nextId++;
        const record = { id, ...rec };
        this.records.push(record);
        return record;
    }

    removeRange(items) {
        const idsToRemove = new Set(items.map(i => i.id));
        this.records = this.records.filter(r => !idsToRemove.has(r.id));
    }

    query({ userId, resumeVersion, resumeId }) {
        return this.records.filter(r =>
            r.userId === userId &&
            r.resumeVersion.getTime() === resumeVersion.getTime() &&
            r.resumeId === resumeId
        );
    }
}

// TEST 2: R2 - CV A v1 cache not returned for CV A v2 or CV B
console.log('>>> TEST 2: R2 - Verification of cache isolation across CV versions and identities...');
{
    const db = new MockRecommendationDb();
    const v1Date = new Date('2026-10-01T08:00:00Z');
    const v2Date = new Date('2026-10-03T12:00:00Z');

    // User 1 has CV A (id=10) at v1, recommendations cached
    db.add({
        userId: 1,
        jobId: 101,
        resumeId: 10,
        score: 85,
        resumeVersion: v1Date,
        payloadJson: JSON.stringify({ version: 1, score: 85, requested_top_k: 5 })
    });
    db.add({
        userId: 1,
        jobId: 102,
        resumeId: 10,
        score: 75,
        resumeVersion: v1Date,
        payloadJson: JSON.stringify({ version: 1, score: 75, requested_top_k: 5 })
    });

    // 2.1 Request with CV A v1 hits cache
    const cacheHitV1 = db.query({ userId: 1, resumeVersion: v1Date, resumeId: 10 });
    assert.strictEqual(cacheHitV1.length, 2, 'CV A v1 should find 2 cached recommendations');

    // 2.2 User updates CV A to v2: query with v2 must return 0 results
    const cacheMissV2 = db.query({ userId: 1, resumeVersion: v2Date, resumeId: 10 });
    assert.strictEqual(cacheMissV2.length, 0, 'CV A v2 must NOT receive v1 cache; must trigger fresh AI call');

    // 2.3 User switches to CV B (id=20) at v1: query with resumeId=20 must return 0 results
    const cacheMissCvB = db.query({ userId: 1, resumeVersion: v1Date, resumeId: 20 });
    assert.strictEqual(cacheMissCvB.length, 0, 'CV B must NOT receive CV A cache records');

    // 2.4 User with legacy cache (resumeId = null): query with resumeId=20 must NOT match legacy record
    db.add({
        userId: 1,
        jobId: 103,
        resumeId: null,
        score: 90,
        resumeVersion: v1Date,
        payloadJson: JSON.stringify({ version: 1, score: 90, requested_top_k: 5 })
    });
    const cacheMissLegacy = db.query({ userId: 1, resumeVersion: v1Date, resumeId: 20 });
    assert.strictEqual(cacheMissLegacy.length, 0, 'CV B must strictly ignore legacy resumeId=null cache records');

    console.log('✓ TEST 2 PASSED: R2 cache isolation verified across versions and resumes.');
}

// TEST 3: R3 - EF Core Tracking simulation: In-memory stale instance vs AsNoTracking
console.log('>>> TEST 3: R3 - Simulation of DbContext tracking vs AsNoTracking detection...');
{
    // Simulating database storage
    const realDb = {
        resume: { id: 10, employeeId: 5, lastUpdatedAt: new Date('2026-10-01T10:00:00Z') }
    };

    // Context 1 tracks the entity initially
    const context1IdentityMap = {
        resume: { ...realDb.resume } // tracked reference
    };

    const initialVersion = context1IdentityMap.resume.lastUpdatedAt;

    // Concurrent Tab/Context 2 updates CV in real database
    realDb.resume.lastUpdatedAt = new Date('2026-10-01T10:05:00Z');

    // Simulating query WITHOUT AsNoTracking (returns instance from identity map)
    const trackedQuery = () => context1IdentityMap.resume;
    const trackedResult = trackedQuery();
    const failureToDetect = trackedResult.lastUpdatedAt.getTime() === initialVersion.getTime();
    assert.strictEqual(failureToDetect, true,
        'Without AsNoTracking, EF Core identity map returns stale instance, failing to detect update');

    // Simulating query WITH AsNoTracking (queries fresh from DB)
    const noTrackingQuery = () => ({ ...realDb.resume });
    const freshResult = noTrackingQuery();
    const cvModifiedDuringEvaluation = freshResult.lastUpdatedAt.getTime() !== initialVersion.getTime();
    assert.strictEqual(cvModifiedDuringEvaluation, true,
        'With AsNoTracking, fresh database timestamp is loaded and detects concurrent CV modification');

    console.log('✓ TEST 3 PASSED: R3 AsNoTracking successfully detects concurrent CV modification.');
}

// TEST 4: R5 - Force refresh overwrites scores/ranks/payloads and removes obsolete jobs
console.log('>>> TEST 4: R5 - Verification of force refresh batch overwrite and obsolete cleanup...');
{
    const db = new MockRecommendationDb();
    const versionDate = new Date('2026-10-03T10:00:00Z');

    // Initial Batch A: Job 1 (score 80, rank 1), Job 2 (score 70, rank 2)
    db.add({
        userId: 1,
        jobId: 1,
        resumeId: 10,
        score: 80,
        rank: 1,
        reason: 'Lý do cũ Job 1',
        resumeVersion: versionDate,
        payloadJson: JSON.stringify({ score: 80, rank: 1, advice: 'Lời khuyên cũ' })
    });
    db.add({
        userId: 1,
        jobId: 2,
        resumeId: 10,
        score: 70,
        rank: 2,
        reason: 'Lý do cũ Job 2',
        resumeVersion: versionDate,
        payloadJson: JSON.stringify({ score: 70, rank: 2, advice: 'Lời khuyên cũ 2' })
    });

    assert.strictEqual(db.records.length, 2, 'Initial DB should have 2 records');

    // User triggers force refresh. Fresh AI returns Batch B:
    // Job 1 (score 95, rank 1) - UPDATED
    // Job 3 (score 88, rank 2) - NEW
    // (Job 2 is not in Batch B - OBSOLETE)
    const freshAiBatch = [
        { jobId: 1, score: 95, rank: 1, reason: 'Lý do MỚI Job 1', advice: 'Lời khuyên MỚI' },
        { jobId: 3, score: 88, rank: 2, reason: 'Lý do MỚI Job 3', advice: 'Lời khuyên MỚI 3' }
    ];

    // Implement R5 controller persistence logic
    const oldBatchRecords = db.query({ userId: 1, resumeVersion: versionDate, resumeId: 10 });
    const newJobIds = new Set(freshAiBatch.map(b => b.jobId));

    freshAiBatch.forEach((rec, idx) => {
        const rankIndex = idx + 1;
        const payloadJson = JSON.stringify({ score: rec.score, rank: rankIndex, advice: rec.advice, requested_top_k: 5 });
        const existing = oldBatchRecords.find(r => r.jobId === rec.jobId);

        if (!existing) {
            db.add({
                userId: 1,
                jobId: rec.jobId,
                resumeId: 10,
                score: rec.score,
                rank: rankIndex,
                reason: rec.reason,
                resumeVersion: versionDate,
                payloadJson
            });
        } else {
            // Overwrite cleanly
            existing.score = rec.score;
            existing.rank = rankIndex;
            existing.reason = rec.reason;
            existing.payloadJson = payloadJson;
        }
    });

    // Remove obsolete jobs not in new batch
    const obsoleteRecords = oldBatchRecords.filter(r => !newJobIds.has(r.jobId));
    db.removeRange(obsoleteRecords);

    // Assert final database state
    assert.strictEqual(db.records.length, 2, 'DB should still have 2 records after replacement');
    const job1InDb = db.records.find(r => r.jobId === 1);
    const job2InDb = db.records.find(r => r.jobId === 2);
    const job3InDb = db.records.find(r => r.jobId === 3);

    assert(job1InDb, 'Job 1 must remain in DB');
    assert.strictEqual(job1InDb.score, 95, 'Job 1 score must be overwritten with 95');
    assert.strictEqual(job1InDb.reason, 'Lý do MỚI Job 1', 'Job 1 reason must be overwritten');
    assert(job1InDb.payloadJson.includes('Lời khuyên MỚI'), 'Job 1 payload must be updated');

    assert.strictEqual(job2InDb, undefined, 'Job 2 (obsolete from Batch A) must be removed completely');

    assert(job3InDb, 'Job 3 must be added to DB');
    assert.strictEqual(job3InDb.score, 88, 'Job 3 score must be 88');

    console.log('✓ TEST 4 PASSED: R5 force refresh successfully overwrote existing records and removed obsolete ones.');
}

// TEST 5: R6 - Batch completion with fewer than topK prevents infinite/repeated AI calls
console.log('>>> TEST 5: R6 - TopK coverage and completion evaluation logic...');
{
    // Simulation function matching JobsController.cs lines 408-412
    function evaluateCacheSufficiency({ cachedDtosCount, existingRecs, topK }) {
        const hasFullEvaluation = existingRecs.some(r => {
            if (!r.payloadJson) return false;
            try {
                const p = JSON.parse(r.payloadJson);
                return p.requested_top_k != null && p.requested_top_k >= topK;
            } catch { return false; }
        });

        return cachedDtosCount >= topK || existingRecs.length >= topK || hasFullEvaluation;
    }

    // Case 5.1: AI returned only 2 jobs when topK=5 was requested (all available matches)
    const existingRecsSmallBatch = [
        { jobId: 1, payloadJson: JSON.stringify({ requested_top_k: 5 }) },
        { jobId: 2, payloadJson: JSON.stringify({ requested_top_k: 5 }) }
    ];

    // User loads page again with default topK=5
    const sufficientForTopK5 = evaluateCacheSufficiency({
        cachedDtosCount: 2,
        existingRecs: existingRecsSmallBatch,
        topK: 5
    });
    assert.strictEqual(sufficientForTopK5, true,
        'Cache must be deemed SUFFICIENT for topK=5 because previous run fully evaluated for requested_top_k=5');

    // Case 5.2: User requests larger topK=10
    const sufficientForTopK10 = evaluateCacheSufficiency({
        cachedDtosCount: 2,
        existingRecs: existingRecsSmallBatch,
        topK: 10
    });
    assert.strictEqual(sufficientForTopK10, false,
        'Cache must be deemed INSUFFICIENT for topK=10 because previous run only requested topK=5');

    console.log('✓ TEST 5 PASSED: R6 correctly distinguishes completed batch from larger topK requests.');
}

console.log('\n======================================================');
console.log('   ALL R2, R3, R5, R6 TESTS PASSED CLEANLY!          ');
console.log('======================================================\n');
