import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const helperRoot = path.dirname(fileURLToPath(import.meta.url));
const rootIndex = process.argv.indexOf('--root');
const root = rootIndex < 0 ? helperRoot : path.resolve(process.argv[rootIndex + 1]);
const wheelDir = path.join(root, 'wheels');
fs.mkdirSync(wheelDir, { recursive: true });
const args = process.argv.slice(2);
const argsRootIndex = args.indexOf('--root');
if (argsRootIndex >= 0) args.splice(argsRootIndex,2);
const requested = new Set(args);
const lock = JSON.parse(fs.readFileSync(path.join(helperRoot,'dependency-lock.json'),'utf8'));
const packages = lock.map(item=>[item.name,item.version]).filter(([name]) => requested.size===0 || requested.has(name));
const manifest = [];
for (let start=0; start<packages.length; start+=4) {
  await Promise.all(packages.slice(start,start+4).map(async ([name, version]) => {
    const response = await fetch(`https://pypi.org/pypi/${name}/${version ? version+'/' : ''}json`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${name} metadata: ${response.status}`);
    const data = await response.json();
    const pinned = lock.find(item=>item.name===name && item.version===version);
    const file = data.urls.find(item=>item.filename===pinned.artifact && item.digests.sha256===pinned.sha256);
    if (!file) throw new Error(`No compatible public artifact: ${name}`);
    const target = path.join(wheelDir,file.filename);
    let bytes = fs.existsSync(target) ? fs.readFileSync(target) : null;
    if (!bytes || createHash('sha256').update(bytes).digest('hex')!==file.digests.sha256) {
      const download = await fetch(file.url, { signal: AbortSignal.timeout(360000) });
      if (!download.ok) throw new Error(`${name} download: ${download.status}`);
      bytes = Buffer.from(await download.arrayBuffer());
      if(createHash('sha256').update(bytes).digest('hex')!==file.digests.sha256)throw new Error(`Package digest mismatch: ${name}`);
      fs.writeFileSync(target,bytes);
    }
    const entry = { name:data.info.name, version:data.info.version, artifact:file.filename, sha256:file.digests.sha256, requires:data.info.requires_dist??[] };
    manifest.push(entry);
    console.log(JSON.stringify({ package:entry.name, version:entry.version, bytes:bytes.length }));
  }));
}
fs.writeFileSync(path.join(root,'dependency-manifest.json'),JSON.stringify(manifest,null,2));
