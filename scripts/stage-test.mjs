// Conditional per-stage pass rates for the current solver (dinesh API).
import { Cube, randomScramble } from '../src/engine/cube.js';
import { makeRunner, solveCross, solveFirstCorners, solveMiddle, solveLLCross, solveLLCornerOrient, solveLLCornerPerm, solveLLEdgePerm } from '../src/engine/solver.js';

function m32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const S = (c) => c.state;
const rows={F:[21,22,23,24,25,26],R:[12,13,14,15,16,17],B:[48,49,50,51,52,53],L:[39,40,41,42,43,44]};
const dFace=[27,28,29,30,31,32,33,34,35];
const crossOK=(s)=>s[31]==='D'&&[[28,25,'F'],[32,16,'R'],[34,52,'B'],[30,43,'L']].every(([a,b,f])=>s[a]==='D'&&s[b]===f);
const firstOK=(s)=>dFace.every(i=>s[i]==='D')&&Object.entries(rows).every(([f,idx])=>idx.slice(3,6).every(i=>s[i]===f));
const middleOK=(s)=>firstOK(s)&&Object.entries(rows).every(([f,idx])=>[idx[0],idx[2]].every(i=>s[i]===f));
const yCrossOK=(s)=>[7,5,1,3].every(i=>s[i]==='U')&&middleOK(s);
const topOK=(s)=>[0,1,2,3,4,5,6,7,8].every(i=>s[i]==='U')&&middleOK(s);
const cornersHome=(s)=>topOK(s)&&s[9]==='R'&&s[20]==='F'&&s[18]==='F'&&s[38]==='L'&&s[36]==='L'&&s[47]==='B'&&s[45]==='B'&&s[11]==='R';
const SOLVED='UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const N=Number(process.argv[2]||1000);
const st={};
const bump=(k,ok,scr)=>{st[k]=st[k]||{n:0,ok:0,s:null};st[k].n++;if(ok)st[k].ok++;else if(!st[k].s)st[k].s=scr;};
for(let i=0;i<N;i++){
  const scr=randomScramble(25,m32(i+1)); const c=new Cube().moves(scr); const r=makeRunner(c); r.stage={moves:[]};
  try{
    solveCross(r); const a=crossOK(S(c)); bump('1_cross',a,scr.join(' ')); if(!a)continue;
    solveFirstCorners(r); const b=firstOK(S(c)); bump('2_first',b,scr.join(' ')); if(!b)continue;
    solveMiddle(r); const d=middleOK(S(c)); bump('3_middle',d,scr.join(' ')); if(!d)continue;
    solveLLCross(r); const e=yCrossOK(S(c)); bump('4_yellowcross',e,scr.join(' ')); if(!e)continue;
    solveLLCornerOrient(r); const f=topOK(S(c)); bump('5_orient',f,scr.join(' ')); if(!f)continue;
    solveLLCornerPerm(r); const g=cornersHome(S(c)); bump('6_permCorners',g,scr.join(' ')); if(!g)continue;
    solveLLEdgePerm(r); let z=0; while(z++<4&&c.toString()!==SOLVED)r.apply('U');
    bump('7_permEdges',c.toString()===SOLVED,scr.join(' '));
  }catch(err){ bump('THREW:'+err.message.slice(0,30),false,scr.join(' ')); }
}
for(const[k,v] of Object.entries(st)) console.log(`${k}: ${v.ok}/${v.n} (${(100*v.ok/v.n).toFixed(1)}%)`+(v.s?`  fail: ${v.s}`:''));
