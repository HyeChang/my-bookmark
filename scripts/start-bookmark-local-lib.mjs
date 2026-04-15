import path from 'node:path';

export function getLauncherConfig(repoRoot) {
  return {
    repoRoot,
    entryFileName: 'start-bookmark-local.cmd',
    url: 'http://localhost:8787',
    scriptRelativePath: path.join('scripts', 'start-bookmark-local.ps1'),
    browserOpenDelayMs: 1500,
    buildCommand: ['npm', 'run', 'build:web'],
    devCommand: ['npm', 'run', 'dev:api'],
    preferredShells: [
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'powershell.exe',
    ],
  };
}

export function getPowerShellArguments(scriptPath) {
  return ['-ExecutionPolicy', 'Bypass', '-NoExit', '-File', scriptPath];
}
