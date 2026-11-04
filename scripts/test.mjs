// Explicit file list works on Windows and Node 20, and never runs tests in backups/.
import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=(await readdir(new URL('../test/',import.meta.url))).filter(name=>name.endsWith('.test.mjs')).sort();
if(!files.length)throw new Error('No test files found');
const child=spawn(process.execPath,['--test',...files.map(name=>'test/'+name)],{cwd:root,stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
