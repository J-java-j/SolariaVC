// Optional integration check: no provider account or network service required.
// REDIS_SERVER_BIN=/path/to/redis-server npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRedisStore } from '../server/contact-store.js';

const exec = promisify(execFile);

test('real Redis executes atomic quota, attempts, claim, expiry and completion Lua', { skip: !process.env.REDIS_SERVER_BIN }, async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'solaria-redis-'));
  const socket = path.join(dir, 'redis.sock');
  const binary = process.env.REDIS_SERVER_BIN;
  const cli = process.env.REDIS_CLI_BIN || path.join(path.dirname(binary), 'redis-cli');
  const server = spawn(binary, ['--port', '0', '--unixsocket', socket, '--save', '', '--appendonly', 'no', '--dir', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server.once('close', resolve));
      server.kill('SIGTERM');
      await closed;
    }
    await rm(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Redis did not start')), 5000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.stdout.on('data', data => { output += data.toString(); if (output.includes('Ready to accept connections')) { clearTimeout(timer); resolve(); } });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Redis exited ${code}: ${output}`)); });
  });
  async function command(args) {
    const { stdout } = await exec(cli, ['--json', '-s', socket, ...args.map(String)]);
    if (stdout.startsWith('error:')) throw new Error(stdout);
    return JSON.parse(stdout);
  }
  const fetchImpl = async (_url, options) => Response.json({ result: await command(JSON.parse(options.body)) });
  const create = () => createRedisStore({ url: 'https://local-test.upstash.io', token: 'test-only', fetchImpl });
  const a = create();
  const b = create();
  const quotas = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b).rateLimit('shared', 3, 60_000)));
  assert.equal(quotas.filter(wait => wait === 0).length, 3);
  assert.equal(quotas.filter(wait => wait > 0).length, 7);

  const record = { codeHash: 'correct', encrypted: 'ciphertext', attempts: 0, status: 'pending' };
  await a.put('attempts', record, 600_000);
  const failures = await Promise.all(Array.from({ length: 7 }, (_, i) => (i % 2 ? a : b).claim('attempts', 'wrong', `owner-${i}`)));
  assert.equal(failures.filter(r => r.status === 'invalid').length, 5);
  assert.equal(failures.filter(r => r.status === 'locked').length, 2);
  assert.equal((await b.claim('attempts', 'correct', 'owner')).status, 'locked');

  await a.put('delivery', record, 600_000);
  const claims = await Promise.all([a.claim('delivery', 'correct', 'first'), b.claim('delivery', 'correct', 'second')]);
  assert.deepEqual(claims.map(r => r.status).sort(), ['busy', 'claimed']);
  const owner = claims[0].status === 'claimed' ? 'first' : 'second';
  assert.equal(await b.finish('delivery', 'wrong-owner', 'sent'), 0);
  assert.equal(await b.finish('delivery', owner, 'sent'), 1);
  assert.equal((await a.claim('delivery', 'correct', 'again')).status, 'sent');
  assert.equal(JSON.parse(await command(['GET', 'solaria:verification:delivery'])).encrypted, undefined);

  await a.put('edge', record, 1000);
  assert.equal((await b.claim('edge', 'correct', 'edge-owner')).status, 'claimed');
  assert.ok(await command(['PTTL', 'solaria:verification:edge']) > 290_000);
  assert.equal(await a.finish('edge', 'edge-owner', 'sent'), 1);

  await a.put('dead', { ...record, status: 'sending', owner: 'dead-owner', leaseUntil: 1 }, 600_000);
  assert.equal((await b.claim('dead', 'correct', 'recovered')).status, 'claimed');
  assert.equal(await a.finish('dead', 'dead-owner', 'sent'), 0);
  assert.equal(await b.finish('dead', 'recovered', 'pending'), 1);
  assert.equal((await a.claim('dead', 'correct', 'retry')).status, 'claimed');
  await a.finish('dead', 'retry', 'pending');
  await command(['PEXPIRE', 'solaria:verification:dead', 1000]);
  assert.equal((await b.claim('dead', 'correct', 'last')).status, 'expired');
  assert.ok(await command(['PTTL', 'solaria:verification:dead']) <= 1000, 'a retry must not extend retention again');

  await a.put('expired', record, 600_000);
  await command(['PEXPIRE', 'solaria:verification:expired', 0]);
  assert.equal((await b.claim('expired', 'correct', 'owner')).status, 'missing');
});
