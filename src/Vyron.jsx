import React,{useEffect,useRef,useState} from 'react';
import './Vyron.css';

const W=360,H=440;
const getBest=key=>{try{return Number(localStorage.getItem('vyron-'+key))||0}catch{return 0}};
const saveBest=(key,n)=>{try{localStorage.setItem('vyron-'+key,String(n))}catch{}};
function rounded(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function SkyHop({active}){
 const canvas=useRef(null),keys=useRef({left:false,right:false}),touch=useRef(0),state=useRef(null);
 const [score,setScore]=useState(0),[best,setBest]=useState(()=>getBest('hop')),[over,setOver]=useState(false),[round,setRound]=useState(0);
 useEffect(()=>{const platforms=[{x:110,y:405,w:140},...Array.from({length:8},(_,i)=>({x:25+(i*71)%235,y:355-i*56,w:88}))];state.current={x:164,y:355,vx:0,vy:-8,platforms,score:0,over:false,last:0};setScore(0);setOver(false)},[round]);
 useEffect(()=>{const down=e=>{if(!active||!['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key))return;e.preventDefault();keys.current[e.key==='ArrowLeft'||e.key.toLowerCase()==='a'?'left':'right']=true};
 const up=e=>{if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')keys.current.left=false;if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')keys.current.right=false};
 window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);keys.current={left:false,right:false}}},[active]);
 useEffect(()=>{if(!active)return;let raf=0;const ctx=canvas.current?.getContext('2d');if(!ctx)return;
 const draw=t=>{const s=state.current;if(!s)return;const dt=Math.min(2,(t-(s.last||t))/16.67);s.last=t;
 if(!s.over){const dir=Number(keys.current.right)-Number(keys.current.left)||touch.current;s.vx+=(dir*0.72-s.vx*0.12)*dt;s.x+=s.vx*dt*2.2;s.x=s.x>W? -24:s.x< -24?W:s.x;const oldBottom=s.y+24;s.vy+=0.32*dt;s.y+=s.vy*dt*2.1;
 if(s.vy>0)for(const p of s.platforms){if(oldBottom<=p.y+7&&s.y+24>=p.y&&s.x+22>p.x&&s.x<p.x+p.w){s.y=p.y-24;s.vy=-9.7;break}}
 if(s.y<190){const rise=190-s.y;s.y=190;s.platforms.forEach(p=>p.y+=rise);s.score+=rise;const points=Math.floor(s.score/10);setScore(prev=>prev===points?prev:points);if(points>getBest('hop')){saveBest('hop',points);setBest(points)}}
 s.platforms=s.platforms.filter(p=>p.y<H+24);while(s.platforms.length<9){const top=Math.min(...s.platforms.map(p=>p.y));s.platforms.push({x:18+Math.random()*240,y:top-(47+Math.random()*17),w:76+Math.random()*27})}
 if(s.y>H+30){s.over=true;setOver(true)}
 }
 const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#c9e8ff');bg.addColorStop(1,'#f3eaff');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#ffffff85';for(let i=0;i<9;i++){const x=(i*79+21)%W,y=(i*97+37)%H;ctx.beginPath();ctx.ellipse(x,y,22,7,0,0,Math.PI*2);ctx.fill()}
 for(const p of s.platforms){rounded(ctx,p.x,p.y,p.w,13,6,'#70bda0');rounded(ctx,p.x,p.y,p.w,5,4,'#b2f2cb')}
 rounded(ctx,s.x,s.y,24,24,9,'#7055db');ctx.fillStyle='white';ctx.fillRect(s.x+6,s.y+8,4,4);ctx.fillRect(s.x+15,s.y+8,4,4);
 raf=requestAnimationFrame(draw)};raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf)},[active,round]);
 return <div className="vyron-play"><div className="vyron-score">Height <b>{score}</b><span>Best {best}</span></div><div className="vyron-canvas-wrap"><canvas ref={canvas} width={W} height={H} aria-label="Sky Hop: move left and right to land on platforms"/>{over&&<div className="vyron-overlay"><strong>Nice hop!</strong><span>Height: {score}</span><button type="button" onClick={()=>setRound(n=>n+1)}>Try again</button></div>}</div><div className="vyron-touch"><button type="button" aria-label="Move left" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);touch.current=-1}} onPointerUp={()=>touch.current=0} onPointerCancel={()=>touch.current=0}>◀</button><span>← → or A / D</span><button type="button" aria-label="Move right" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);touch.current=1}} onPointerUp={()=>touch.current=0} onPointerCancel={()=>touch.current=0}>▶</button></div></div>
}
function PerfectStack({active}){
 const canvas=useRef(null),state=useRef(null),[score,setScore]=useState(0),[best,setBest]=useState(()=>getBest('stack')),[over,setOver]=useState(false),[round,setRound]=useState(0);
 useEffect(()=>{state.current={blocks:[{x:85,y:395,w:190}],moving:{x:0,y:359,w:190},direction:1,speed:2.5,score:0,over:false,last:0};setScore(0);setOver(false)},[round]);
 const place=()=>{const s=state.current;if(!active||!s||s.over)return;const prev=s.blocks[s.blocks.length-1],m=s.moving;const left=Math.max(m.x,prev.x),right=Math.min(m.x+m.w,prev.x+prev.w),width=right-left;if(width<=3){s.over=true;setOver(true);return}const perfect=Math.abs(m.x-prev.x)<5;const b={x:perfect?prev.x:left,y:m.y,w:perfect?prev.w:width};s.blocks.push(b);s.score++;setScore(s.score);if(s.score>getBest('stack')){saveBest('stack',s.score);setBest(s.score)}if(s.blocks.length>9){s.blocks.shift();s.blocks.forEach(v=>v.y+=36)}s.moving={x:0,y:b.y-36,w:b.w};s.direction=1;s.speed=Math.min(7,2.5+s.score*.22)};
 useEffect(()=>{const key=e=>{if(active&&(e.code==='Space'||e.code==='Enter')&&!['BUTTON','INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();place()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[active,round]);
 useEffect(()=>{if(!active)return;const ctx=canvas.current?.getContext('2d');if(!ctx)return;let raf=0;const draw=t=>{const s=state.current;if(!s)return;const dt=Math.min(2,(t-(s.last||t))/16.67);s.last=t;if(!s.over){s.moving.x+=s.direction*s.speed*dt;if(s.moving.x<0){s.moving.x=0;s.direction=1}if(s.moving.x+s.moving.w>W){s.moving.x=W-s.moving.w;s.direction=-1}}
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#1d193a');bg.addColorStop(1,'#302251');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#ffffff0b';for(let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
 s.blocks.forEach((b,i)=>rounded(ctx,b.x,b.y,b.w,34,5,['#a2a1ff','#aa8cf7','#8fd9e8','#c6a2ff'][i%4]));if(!s.over)rounded(ctx,s.moving.x,s.moving.y,s.moving.w,34,5,'#d2b9ff');raf=requestAnimationFrame(draw)};raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf)},[active,round]);
 return <div className="vyron-play"><div className="vyron-score">Blocks <b>{score}</b><span>Best {best}</span></div><div className="vyron-canvas-wrap"><canvas ref={canvas} width={W} height={H} onPointerDown={place} aria-label="Perfect Stack: tap the canvas to place the moving block"/>{over&&<div className="vyron-overlay"><strong>Stack complete!</strong><span>{score} blocks stacked</span><button type="button" onClick={()=>setRound(n=>n+1)}>Try again</button></div>}</div><p className="vyron-instruction">Tap the game, click, or press Space to stack.</p></div>
}
export default function Vyron({processing=false}){
 const [open,setOpen]=useState(false),[game,setGame]=useState('hop');
 return <section className="vyron" aria-label="VYRON games"><div className="vyron-head"><div><span className="vyron-eyebrow">PLAY WHILE YOU WAIT</span><h2>VYRON <span>✦</span></h2><p>Two little games. One good way to pass the time.</p></div><button type="button" className="vyron-toggle" onClick={()=>setOpen(x=>!x)} aria-expanded={open}>{open?'Close games':'Play games'}</button></div>{open&&<div className="vyron-body"><div className="vyron-switch" role="group" aria-label="Choose a game"><button type="button" className={game==='hop'?'selected':''} aria-pressed={game==='hop'} onClick={()=>setGame('hop')}>☁️ Sky Hop</button><button type="button" className={game==='stack'?'selected':''} aria-pressed={game==='stack'} onClick={()=>setGame('stack')}>🧱 Perfect Stack</button></div>{game==='hop'?<SkyHop active={open&&processing}/>:<PerfectStack active={open&&processing}/>}<p className="vyron-footnote">Your download continues separately. Games pause when the download finishes.</p></div>}</section>
}
