import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const rootIndex = process.argv.indexOf('--root');
const root = rootIndex < 0 ? path.dirname(fileURLToPath(import.meta.url)) : path.resolve(process.argv[rootIndex + 1]);
export const sourceRevision = '74a1d147b17a8c3092dd5430504bd83ef6c7eb23';
export const modelRevision = 'f36e7edfe1684461a8343844af60babc2efbb727';
const checkpointSha = '9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e';
const modelDir = path.join(root, 'models', 'converter');
const sourceDir = path.join(root, 'downloads');
fs.mkdirSync(modelDir, { recursive: true });
fs.mkdirSync(sourceDir, { recursive: true });

async function download(url, target, expected) {
  if (fs.existsSync(target) && (!expected || createHash('sha256').update(fs.readFileSync(target)).digest('hex') === expected)) return;
  const response = await fetch(url, { signal: AbortSignal.timeout(240000) });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const hash = createHash('sha256');
  const bytes = new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); callback(null, chunk); } });
  const partial = target + '.part';
  await pipeline(Readable.fromWeb(response.body), bytes, fs.createWriteStream(partial));
  const sha256 = hash.digest('hex');
  if (expected && sha256 !== expected) throw new Error('Official checkpoint SHA-256 mismatch');
  fs.renameSync(partial, target);
  console.log(JSON.stringify({ artifact: path.relative(root, target), bytes: fs.statSync(target).size, sha256 }));
}

await Promise.all([
  download(`https://codeload.github.com/myshell-ai/OpenVoice/zip/${sourceRevision}`, path.join(sourceDir, 'openvoice-source.zip'), 'd08cbc84f4ec7abc76f9dddb5bbb221e906e49cfe5febd37133152bdeacb8be4'),
  download(`https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/${modelRevision}/converter/checkpoint.pth`, path.join(modelDir, 'checkpoint.pth'), checkpointSha),
  download(`https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/${modelRevision}/converter/config.json`, path.join(modelDir, 'config.json'), '9dfff60350b8c63f2c664efd92a61b2516efb22671466960f0e5dfebd881fa47'),
]);
fs.writeFileSync(path.join(root, 'source-manifest.json'), JSON.stringify({ sourceRevision, modelRevision, checkpointSha256: checkpointSha }, null, 2));
