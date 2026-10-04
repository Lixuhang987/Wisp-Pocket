import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CodexCLI } from "../../src/actions/CodexCLI.ts";

// The uncontrollable CLI boundary is replaced; stdin, argv, JSONL and disk I/O are real.
export async function codexFixture(directory: string) {
  const script = join(directory, "codex-fixture.mjs");
  await writeFile(script, `
import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';
const statePath=join(dirname(process.argv[1]),'fixture-state');
const state=existsSync(statePath)?readFileSync(statePath,'utf8'):'ready';
if(process.argv.includes('--version')) { console.log('codex-cli fixture');process.exit(state==='unavailable'?2:0); }
if(process.argv.includes('login')) { if(state==='not_logged_in')console.error('Not logged in');process.exit(state==='not_logged_in'?1:0); }
const args=process.argv.slice(2), prompt=readFileSync(0,'utf8');
const resume=args.indexOf('resume'), id=resume<0?randomUUID():args[resume+1];
const emit=value=>console.log(JSON.stringify(value));
appendFileSync('invocations.jsonl',JSON.stringify({args,prompt,cwd:process.cwd(),id})+'\\n');
emit({type:'thread.started',thread_id:id});
emit({type:'item.completed',item:{id:'warning',type:'error',message:'fixture configuration warning'}});
if(prompt==='FAIL') { emit({type:'turn.failed',error:{message:'approval required: fixture execution blocked '+ '细节'.repeat(1500)}});process.exit(1); }
if(prompt==='TOO_LARGE') {
 emit({type:'item.completed',item:{id:'long',type:'command_execution',aggregated_output:'x'.repeat(2200000),status:'failed',exit_code:1}});
 emit({type:'item.completed',item:{id:'reply',type:'agent_message',text:JSON.stringify({success:true,reply:'fixture reports completion despite discarded operation',error:null})}});
 emit({type:'turn.completed'});await new Promise(resolve=>process.stdout.write('',resolve));process.exit(0);
}
if(prompt.startsWith('背景：'))await new Promise(resolve=>setTimeout(resolve,150));
emit({type:'item.completed',item:{id:'initial-check',type:'command_execution',status:'failed',aggregated_output:'initial check failed; later corrected',exit_code:1}});
writeFileSync('result.txt',(existsSync('result.txt')?readFileSync('result.txt','utf8')+'\\n':'')+prompt);
emit({type:'item.completed',item:{id:'changes',type:'file_change',status:'completed',changes:[{path:'result.txt',kind:'update'}]}});
emit({type:'item.completed',item:{id:'reply',type:'agent_message',text:JSON.stringify({success:true,reply:'已完成：'+prompt+(prompt.startsWith('背景：')?'；长正文'.repeat(4000):''),error:null})}});
emit({type:'turn.completed',usage:{}});
`);
  return new CodexCLI({ command: { executable: process.execPath, prefixArgs: [script] } });
}
