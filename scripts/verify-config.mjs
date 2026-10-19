import env from '@next/env';
import fs from 'node:fs';
import dns from 'node:dns/promises';
import { execFileSync } from 'node:child_process';
env.loadEnvConfig(process.cwd());
const raw=fs.readFileSync('.env.local','utf8');
const keys=[...raw.matchAll(/^\s*([A-Z_][A-Z0-9_]*)\s*=/gm)].map(m=>m[1]);
const duplicates=[...new Set(keys.filter((k,i)=>keys.indexOf(k)!==i))];
let ignored=false,tracked=false;
try{execFileSync('git',['check-ignore','.env.local'],{stdio:'pipe'});ignored=true;}catch{}
try{execFileSync('git',['ls-files','--error-unmatch','.env.local'],{stdio:'pipe'});tracked=true;}catch{}
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','APP_ORIGIN'];
console.log(JSON.stringify({duplicates,configured:required.every(k=>!!process.env[k]),correctOrigin:process.env.APP_ORIGIN==='http://localhost:3001',ignored,tracked}));
try {
 const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);await dns.lookup(url.hostname);console.log('Supabase DNS resolves.');
 const r=await fetch(new URL('/auth/v1/settings',url),{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)});
 const d=await r.json();const otherProviders=Object.entries(d.external||{}).filter(([k,v])=>v&&k!=='google').map(([k])=>k);
 console.log(JSON.stringify({authStatus:r.status,googleEnabled:d.external?.google,otherProviders}));
 if(!r.ok||!d.external?.google||otherProviders.length||duplicates.length||tracked||!ignored)process.exitCode=1;
}catch(e){console.log(JSON.stringify({connectivity:false,errorCode:e.cause?.code||e.code||e.name}));process.exitCode=1;}
