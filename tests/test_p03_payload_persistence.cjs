const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing P03 Payload Persistence & Cache Hydration ---');

const repoRoot = path.resolve(__dirname, '..');
const jobsControllerPath = path.join(repoRoot, 'ArisSkyve', 'Controllers', 'JobsController.cs');
const entityPath = path.join(repoRoot, 'ArisSkyve', 'Domain', 'Entities', 'UserRecommendations.cs');
const payloadDtoPath = path.join(repoRoot, 'ArisSkyve', 'Application', 'DTOs', 'AiRecommendationPayload.cs');
const migrationPath = path.join(repoRoot, 'ArisSkyve', 'Migrations', '20261003161005_AddPayloadAndResumeIdToUserRecommendations.cs');

// Test 1: UserRecommendations entity definition has new properties
const entityContent = fs.readFileSync(entityPath, 'utf8');
assert(entityContent.includes('public int? ResumeId { get; set; }'), 'UserRecommendations must have ResumeId');
assert(entityContent.includes('public double? Score { get; set; }'), 'UserRecommendations must have Score');
assert(entityContent.includes('public int? Rank { get; set; }'), 'UserRecommendations must have Rank');
assert(entityContent.includes('public string? PayloadJson { get; set; }'), 'UserRecommendations must have PayloadJson');
console.log('✓ Test 1: UserRecommendations entity contains ResumeId, Score, Rank, PayloadJson');

// Test 2: AiRecommendationPayload DTO contains all expected fields
const payloadDtoContent = fs.readFileSync(payloadDtoPath, 'utf8');
assert(payloadDtoContent.includes('matched_skills'), 'AiRecommendationPayload must contain matched_skills');
assert(payloadDtoContent.includes('missing_skills'), 'AiRecommendationPayload must contain missing_skills');
assert(payloadDtoContent.includes('evidence'), 'AiRecommendationPayload must contain evidence');
assert(payloadDtoContent.includes('advice'), 'AiRecommendationPayload must contain advice');
assert(payloadDtoContent.includes('explanation_status'), 'AiRecommendationPayload must contain explanation_status');
assert(payloadDtoContent.includes('llm_model'), 'AiRecommendationPayload must contain llm_model');
console.log('✓ Test 2: AiRecommendationPayload DTO contains complete schema');

// Test 3: Migration exists and adds columns to UserRecommendations table
assert(fs.existsSync(migrationPath), 'Migration file must exist');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');
assert(migrationContent.includes('AddColumn<string>'), 'Migration must add string column for PayloadJson');
assert(migrationContent.includes('PayloadJson'), 'Migration must mention PayloadJson');
assert(migrationContent.includes('ResumeId'), 'Migration must mention ResumeId');
console.log('✓ Test 3: EF Core migration file adds columns cleanly');

// Test 4: JobsController cache hydration logic
const jobsControllerContent = fs.readFileSync(jobsControllerPath, 'utf8');
assert(jobsControllerContent.includes('AiRecommendationPayload? payload = null;'), 'JobsController must deserialize payload on cache hit');
assert(jobsControllerContent.includes('MatchedSkills = payload?.MatchedSkills'), 'JobsController must hydrate MatchedSkills');
assert(jobsControllerContent.includes('MissingSkills = payload?.MissingSkills'), 'JobsController must hydrate MissingSkills');
assert(jobsControllerContent.includes('Advice = payload?.Advice ?? string.Empty'), 'JobsController must hydrate Advice');
assert(jobsControllerContent.includes('Evidence = payload?.Evidence'), 'JobsController must hydrate Evidence');
console.log('✓ Test 4: JobsController correctly hydrates Advice, MatchedSkills, MissingSkills, Evidence from cache');

// Test 5: JobsController persistence serializes payload and sets Rank
assert(jobsControllerContent.includes('Rank = rankIndex'), 'JobsController must assign rankIndex');
assert(jobsControllerContent.includes('PayloadJson = payloadJson'), 'JobsController must set PayloadJson on persistence');
assert(jobsControllerContent.includes('existing.PayloadJson = payloadJson'), 'JobsController must update older rows lacking payload');
console.log('✓ Test 5: JobsController serializes and persists payload and updates legacy records');

console.log('\n--- All P03 tests passed successfully! ---');
