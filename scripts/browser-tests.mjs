// Next writes next-env.d.ts/tsconfig while creating the isolated test build.
// Restore those generated configuration changes even when a browser test fails.
import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const files=['next-env.d.ts','tsconfig.json'];
const previous=files.map(path=>[path,readFileSync(path)]);
try {
 const result=spawnSync(process.execPath,[require.resolve('@playwright/test/cli'), 'test',...process.argv.slice(2)],{stdio:'inherit',env:process.env});
 process.exitCode=result.status??1;
} finally { for(const [path,content] of previous)writeFileSync(path,content); }
