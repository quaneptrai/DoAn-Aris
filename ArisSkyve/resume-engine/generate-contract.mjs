import { z } from 'zod';
import { CanonicalResumeSchema } from './src/schema.ts';
import { mkdir, writeFile } from 'node:fs/promises';

const schema = z.toJSONSchema(CanonicalResumeSchema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' });
schema.$id = 'https://aris.local/contracts/canonical-resume.schema.json';
await mkdir('contracts', { recursive: true });
await writeFile('contracts/canonical-resume.schema.json', JSON.stringify(schema, null, 2) + '\n');
