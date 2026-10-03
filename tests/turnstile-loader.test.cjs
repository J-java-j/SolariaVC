const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/lib/turnstile.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function harness() {
  const scripts = [], timers = new Map();
  let timer = 0;
  const api = { ready() { throw new Error('ready is invalid with async/defer'); }, render() {}, remove() {} };
  const window = { setTimeout(fn) { timers.set(++timer, fn); return timer; }, clearTimeout(id) { timers.delete(id); } };
  const sandbox = { exports: {}, window, document: {
    createElement() { return { remove() { this.removed = true; } }; },
    head: { append(script) { scripts.push(script); } }
  }};
  vm.runInNewContext(source, sandbox);
  const callbackName = script => new URL(script.src).searchParams.get('onload');
  return { load: sandbox.exports.loadTurnstile, window, scripts, timers, api, callbackName,
    complete(script) { window.turnstile = api; window[callbackName(script)](); } };
}

test('async Turnstile waits for provider callback, shares in-flight load, and reuses initialized API', async () => {
  const h = harness();
  const first = h.load();
  const script = h.scripts[0];
  assert.equal(script.async, true);
  assert.equal(new URL(script.src).searchParams.get('render'), 'explicit');
  let resolved = false;
  first.then(() => { resolved = true; });
  h.window.turnstile = h.api; // Provider can expose its API before initialization completes.
  assert.equal(h.load(), first);
  await Promise.resolve();
  assert.equal(resolved, false);
  h.complete(script);
  assert.equal(await first, h.api);
  assert.equal(await h.load(), h.api);
  assert.equal(h.scripts.length, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.window[h.callbackName(script)], undefined);
});

for (const failure of ['network', 'timeout', 'missing-api']) {
  test(`Turnstile recovers from ${failure} without a stale callback settling the retry`, async () => {
    const h = harness();
    const first = h.load(), script = h.scripts[0];
    const lateCallback = h.window[h.callbackName(script)];
    const rejected = assert.rejects(first, /security check could not load/);
    if (failure === 'network') script.onerror();
    else if (failure === 'timeout') [...h.timers.values()][0]();
    else lateCallback();
    await rejected;
    assert.equal(script.removed, true);
    assert.equal(h.window[h.callbackName(script)], undefined);
    const retry = h.load(), next = h.scripts[1];
    assert.notEqual(h.callbackName(script), h.callbackName(next));
    let resolved = false;
    retry.then(() => { resolved = true; });
    lateCallback();
    await Promise.resolve();
    assert.equal(resolved, false);
    h.complete(next);
    assert.equal(await retry, h.api);
    assert.equal(h.timers.size, 0);
  });
}

test('already initialized Turnstile is reused without calling ready', async () => {
  const h = harness();
  h.window.turnstile = h.api;
  assert.equal(await h.load(), h.api);
  assert.equal(h.scripts.length, 0);
});
