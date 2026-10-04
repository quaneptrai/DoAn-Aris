import assert from 'node:assert/strict';
import { assessResume, proposalForCheck, proposalToAddSkill, validateCoachProposal } from '../src/coach-rules.ts';
import { sample } from '../src/sample.ts';

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};

const changedLeafPaths = (before, after, path = '') => {
  if (Object.is(before, after)) return [];
  const beforeIsObject = before && typeof before === 'object';
  const afterIsObject = after && typeof after === 'object';
  if (!beforeIsObject || !afterIsObject) return [path];

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap(key => changedLeafPaths(before[key], after[key], path
    ? Array.isArray(before) || Array.isArray(after) ? `${path}[${key}]` : `${path}.${key}`
    : key));
};

const checkExactCandidateDelta = (source, proposal, expectedPaths) => {
  const actualPaths = changedLeafPaths(source, proposal.candidate).sort();
  assert.deepEqual(actualPaths, expectedPaths.slice().sort(), `Proposal must only change ${expectedPaths.join(', ')}, not ${actualPaths.join(', ') || 'nothing'}`);
  checks++;
};

const resumeWithSourceEvidence = () => {
  const data = structuredClone(sample);
  data.basics.headline = 'Platform Engineer';
  data.basics.summary = '';
  data.skills = [{ category: 'Technical skills', items: [{ name: 'Go', level: 'competent' }] }];
  data.work = [{
    id: 'platform-role', company: 'Source Systems', role: 'Platform Engineer',
    startDate: '2023-01', endDate: null, isCurrent: true,
    highlights: ['Built internal platform tooling for deployment teams.'],
    techStack: ['Go', 'Kubernetes'],
  }];
  data.projects = [{
    id: 'platform-project', title: 'Release Console', tagline: 'Deployment workflow',
    description: 'Internal release workflow dashboard.', featured: true,
    stack: ['Go', 'Kubernetes'],
  }];
  return data;
};

const summaryCheckFor = data => {
  const item = assessResume(data).checks.find(checkItem => checkItem.id === 'summary');
  assert.ok(item, 'Summary quality check exists');
  return item;
};

const data = resumeWithSourceEvidence();
const summaryProposal = proposalForCheck(data, summaryCheckFor(data));

check(summaryProposal, 'A fact-grounded summary proposal is available when the CV has enough source facts');
check(summaryProposal.tab === 'profile', 'Summary proposal identifies the profile editor section');
check(summaryProposal.before.length > 0, 'Summary proposal visibly identifies an empty current value for review');
check(summaryProposal.after === summaryProposal.candidate.basics.summary, 'Summary preview text is exactly the candidate summary value');
check(summaryProposal.after.includes('Platform Engineer'), 'Summary proposal preserves the source headline instead of inventing a role');
check(summaryProposal.after.includes('Go'), 'Summary proposal cites an existing source skill');
check(!/\b(?:10\+? years?|expert|industry-leading|proven track record|increased revenue|99%)\b/i.test(summaryProposal.after), 'Summary proposal does not invent generic seniority, outcomes, or metrics');
checkExactCandidateDelta(data, summaryProposal, ['basics.summary']);
check(summaryProposal.detail.length > 0 && /không|khong|only|source|fact/i.test(summaryProposal.detail), 'Summary proposal explains that it is based on source CV facts');
check(Array.isArray(summaryProposal.changes) && summaryProposal.changes.length === 1, 'Proposal declares one precise field change');
check(summaryProposal.changes[0].path === 'basics.summary', 'Proposal identifies the exact changed CV field');
check(summaryProposal.changes[0].before === data.basics.summary && summaryProposal.changes[0].after === summaryProposal.after, 'Declared field change matches the source and preview values');
check(Array.isArray(summaryProposal.evidence) && summaryProposal.evidence.some(item => item.path === 'basics.headline' && item.value === 'Platform Engineer'), 'Proposal exposes the headline evidence it uses');
check(summaryProposal.evidence.some(item => item.path === 'skills[0].items[0].name' && item.value === 'Go'), 'Proposal exposes the skill evidence it uses');
check(typeof summaryProposal.verificationNote === 'string' && summaryProposal.verificationNote.trim().length > 0, 'Proposal includes a verification note before the user applies it');
check(validateCoachProposal(data, summaryProposal), 'A fact-grounded proposal with an exact delta validates');

const tampered = structuredClone(summaryProposal);
tampered.candidate.basics.headline = 'Invented Executive';
check(!validateCoachProposal(data, tampered), 'A proposal with an undeclared hidden field mutation is rejected');

check(proposalToAddSkill(data, 'Kubernetes') === null, 'Target skill demand is not turned into an auto-applicable CV claim, even when it appears in free-text source material');
check(proposalToAddSkill(data, 'Terraform') === null, 'Unsupported skills are rejected instead of being turned into auto-applicable CV edits');

const factFree = structuredClone(data);
factFree.basics.headline = '';
factFree.basics.summary = '';
factFree.skills = [];
factFree.work = [];
factFree.projects = [];
check(proposalForCheck(factFree, summaryCheckFor(factFree)) === null, 'A generic fact-free summary is rejected rather than fabricated');

console.log(`COACH QUALITY RULES: ${checks} checks passed`);
