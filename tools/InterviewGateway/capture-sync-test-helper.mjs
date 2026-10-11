// Test-only capture using regular files, compatible with restricted Windows handles.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function spawnCapturedSync(command, args, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-test-process-'));
  const handles = [];
  try {
    let input = 'ignore';
    if (options.input != null) {
      const file = path.join(dir, 'stdin'); fs.writeFileSync(file, options.input);
      input = fs.openSync(file, 'r'); handles.push(input);
    }
    const stdout = path.join(dir, 'stdout'), stderr = path.join(dir, 'stderr');
    const out = fs.openSync(stdout, 'w'), err = fs.openSync(stderr, 'w'); handles.push(out, err);
    const { input: ignoredInput, encoding, ...rest } = options;
    const result = spawnSync(command, args, { ...rest, windowsHide: true, stdio: [input, out, err] });
    const read = file => { const bytes = fs.readFileSync(file); return encoding ? bytes.toString(encoding) : bytes; };
    return { ...result, stdout: read(stdout), stderr: read(stderr) };
  } finally {
    for (const handle of handles) fs.closeSync(handle);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function execCapturedSync(command, args, options = {}) {
  const result = spawnCapturedSync(command, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) throw Object.assign(new Error(`Media fixture failed: ${result.stderr.toString()}`), result);
  return result.stdout;
}
