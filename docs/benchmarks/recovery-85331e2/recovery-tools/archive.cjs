const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const campaign = path.join(repo, 'artifacts/strategy-validation-85331e2');
const branch = 'codex/hearts-strength-recovery-85331e2';
const prefix = 'docs/benchmarks/recovery-85331e2/';
const stateFile = path.join(__dirname, 'archive-status.json');
const lock = path.join(__dirname, 'archive.pid');
const once = process.argv.includes('--once');
function git(args, input, extraEnv = {}) {
  const result = spawnSync('git', args, {
    cwd: repo, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: {...process.env, ...extraEnv}, timeout: 120000,
  });
  if (result.status !== 0) throw Error('git ' + args[0] + ' failed: ' + (result.stderr || result.error));
  return result.stdout.trim();
}
function atomic(file, data) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
function collect(dir, relative = '') {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw Error('Unexpected symbolic link: ' + rel);
    if (entry.isDirectory()) return collect(path.join(dir, entry.name), rel);
    return /\.(json|js|mjs|cjs|md)$/.test(entry.name) ? [rel] : [];
  });
}
function archive() {
  const files = new Map(collect(campaign).map(rel => [rel, fs.readFileSync(path.join(campaign, rel))]));
  for (const name of ['public-rules-next', 'capacity-lead-next', 'strategy-next', 'match-bound-next']) {
    const dir = path.join(repo, 'artifacts', name);
    if (fs.existsSync(dir)) for (const rel of collect(dir)) {
      files.set('hypotheses/' + name + '/' + rel, fs.readFileSync(path.join(dir, rel)));
    }
  }
  files.set('recovery-tools/archive.cjs', fs.readFileSync(__filename));
  for (const [rel, bytes] of files) if (rel.endsWith('.json')) {
    try { JSON.parse(bytes); }
    catch { throw Error('JSON file is not complete yet; preserve the previous archive and retry: ' + rel); }
  }
  const manifest = JSON.parse(files.get('manifest.json'));
  for (const [file, expected] of Object.entries(manifest.hashes)) {
    const actual = crypto.createHash('sha256').update(files.get('snapshot/' + file)).digest('hex');
    if (actual !== expected) throw Error('Frozen source changed: ' + file);
  }
  const progress = [];
  for (const ms of [200, 1200]) for (let worker = 0; worker < 4; worker++) {
    const id = ms + 'ms-' + worker;
    const bytes = files.get('jobs/' + id + '/checkpoint.json');
    if (!bytes) { progress.push({id, completed: 0}); continue; }
    const checkpoint = JSON.parse(bytes);
    if (checkpoint.seed !== 20261260 + worker * 1000003 || checkpoint.milliseconds !== ms || checkpoint.samples !== 16 || checkpoint.count !== (ms === 200 ? 160 : 80)) throw Error('Checkpoint parameters changed: ' + id);
    for (const [file, hash] of Object.entries(checkpoint.sourceHashes)) {
      if (hash !== manifest.hashes[file === 'activeEngine' ? 'src/ai.js' : file]) throw Error('Checkpoint source changed: ' + id);
    }
    checkpoint.records.forEach((row, i) => {
      if (row.game !== i || row.newSeat !== i % 4 || Math.max(...row.totals) < 100) throw Error('Invalid completed match: ' + id);
    });
    progress.push({id, completed: checkpoint.records.length, runId: checkpoint.runId});
  }
  const remote = git(['ls-remote', 'origin', 'refs/heads/' + branch]).split(/\s/)[0];
  if (remote) git(['fetch', '--quiet', 'origin', 'refs/heads/' + branch]);
  const parent = remote || git(['rev-parse', '08cb002^{commit}']);
  const index = path.join(__dirname, 'archive-index-' + process.pid);
  const extraEnv = {GIT_INDEX_FILE: index};
  let commit;
  try {
    git(['read-tree', parent], undefined, extraEnv);
    const lines = [];
    for (const [rel, bytes] of files) {
      const blob = git(['hash-object', '-w', '--stdin'], bytes);
      lines.push('100644 ' + blob + '\t' + prefix + rel + '\n');
    }
    files.set('recovery.json', Buffer.from(JSON.stringify({
      at: new Date().toISOString(), sourceCommit: manifest.sourceCommit, progress,
      note: 'Recovered original campaign; completed games and run IDs preserved. Partial results are not a strength claim.',
    }, null, 2) + '\n'));
    lines.push('100644 ' + git(['hash-object', '-w', '--stdin'], files.get('recovery.json')) + '\t' + prefix + 'recovery.json\n');
    git(['update-index', '--index-info'], lines.join(''), extraEnv);
    const tree = git(['write-tree'], undefined, extraEnv);
    commit = git(['commit-tree', tree, '-p', parent, '-m', 'Preserve original strength campaign checkpoints after environment recovery']);
    git(['push', '--quiet', 'origin', commit + ':refs/heads/' + branch]);
    const verified = git(['ls-remote', 'origin', 'refs/heads/' + branch]).split(/\s/)[0];
    if (verified !== commit) throw Error('Remote archive readback mismatch');
    const result = {at: new Date().toISOString(), state: 'saved', branch, commit, progress};
    atomic(stateFile, result);
    console.log(JSON.stringify(result));
  } finally {
    fs.rmSync(index, {force: true}); fs.rmSync(index + '.lock', {force: true});
  }
}
async function main() {
  if (!once) {
    if (fs.existsSync(lock)) {
      const pid = Number(fs.readFileSync(lock));
      try {
        const command = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
        const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8').split(') ')[1];
        if (stat[0] !== 'Z' && (command.includes(__filename) || command.includes(path.relative(repo, __filename)))) throw Error('Archive controller already running: ' + pid);
      } catch (error) { if (error.message.startsWith('Archive controller')) throw error; }
    }
    fs.writeFileSync(lock, String(process.pid));
    process.on('SIGHUP', () => {});
  }
  do {
    let saved = false;
    try { archive(); saved = true; }
    catch (error) {
      atomic(stateFile, {at: new Date().toISOString(), state: 'failed', error: String(error)});
      console.error(error);
      if (once) throw error;
    }
    if (once) break;
    const assessmentPath = path.join(campaign, 'assessment.json');
    if (fs.existsSync(assessmentPath)) {
      const assessment = JSON.parse(fs.readFileSync(assessmentPath));
      if (saved && assessment.budgets?.every(row => row.state === 'completed')) break;
    }
    await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
  } while (true);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
