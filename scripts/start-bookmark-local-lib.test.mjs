import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLauncherConfig,
  getPowerShellArguments,
} from './start-bookmark-local-lib.mjs';

test('getLauncherConfig returns the default local launcher settings', () => {
  const config = getLauncherConfig('D:\\Work\\workspace\\codex\\bookMark');

  assert.equal(config.url, 'http://localhost:8787');
  assert.equal(config.scriptRelativePath, 'scripts\\start-bookmark-local.ps1');
  assert.equal(config.browserOpenDelayMs, 1500);
  assert.equal(config.entryFileName, 'start-bookmark-local.cmd');
  assert.deepEqual(config.buildCommand, ['npm', 'run', 'build:web']);
  assert.deepEqual(config.devCommand, ['npm', 'run', 'dev:api']);
  assert.deepEqual(config.preferredShells, [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'powershell.exe',
  ]);
});

test('getPowerShellArguments returns the launcher invocation flags', () => {
  assert.deepEqual(
    getPowerShellArguments('D:\\Work\\workspace\\codex\\bookMark\\scripts\\start-bookmark-local.ps1'),
    [
      '-ExecutionPolicy',
      'Bypass',
      '-NoExit',
      '-File',
      'D:\\Work\\workspace\\codex\\bookMark\\scripts\\start-bookmark-local.ps1',
    ],
  );
});
