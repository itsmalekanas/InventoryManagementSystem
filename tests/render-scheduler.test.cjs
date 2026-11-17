const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { frameUpdate } = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../web/render-scheduler.js'), 'utf8') + ';({frameUpdate})');

test('rapid edits render once per frame using the latest draft; flush cancels the pending frame', () => {
  const frames = new Map();
  let id = 0, draft = '', output = [];
  const update = frameUpdate(() => output.push(draft), callback => { frames.set(++id, callback); return id; }, key => frames.delete(key));
  for (const value of ['a', 'ab', 'abc']) { draft = value; update(); }
  assert.equal(frames.size, 1);
  assert.deepEqual(output, []);
  const runFrame = () => { const [key, callback] = frames.entries().next().value; frames.delete(key); callback(); };
  runFrame();
  assert.deepEqual(output, ['abc']);
  draft = 'saved'; update(); update.flush(); update.flush();
  assert.equal(frames.size, 0);
  assert.deepEqual(output, ['abc', 'saved']);
  draft = 'next'; update(); runFrame();
  assert.deepEqual(output, ['abc', 'saved', 'next']);
});
