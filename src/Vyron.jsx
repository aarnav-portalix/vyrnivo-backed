import React,{useEffect,useRef,useState} from 'react';
import './Vyron.css';

const W=360,H=440;

const PX=3;
function pixel(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x/PX)*PX,Math.round(y/PX)*PX,Math.max(PX,Math.round(w/PX)*PX),Math.max(PX,Math.round(h/PX)*PX))}
function pixelCloud(ctx,x,y){pixel(ctx,x+12,y,42,9,'#f8f7ec');pixel(ctx,x,y+9,75,15,'#f8f7ec');pixel(ctx,x+9,y+24,54,6,'#e7f0e7')}
function pixelIsland(ctx,p){const x=Math.round(p.x/3)*3,y=Math.round(p.y/3)*3,w=Math.round(p.w/3)*3;pixel(ctx,x+6,y+12,w-12,9,'#735646');pixel(ctx,x+12,y+21,w-24,6,'#8f6b52');pixel(ctx,x,y+3,w,12,'#498e62');pixel(ctx,x+3,y,w-6,6,'#a9d982');for(let i=12;i<w-9;i+=21)pixel(ctx,x+i,y+15,6,3,'#a98463')}
function pixelHero(ctx,x,y,vy){const a=Math.round(x/3)*3,b=Math.round(y/3)*3;pixel(ctx,a+6,b,12,6,'#493d64');pixel(ctx,a+3,b+6,18,12,'#e9aa78');pixel(ctx,a,b+12,24,9,'#496f99');pixel(ctx,a+3,b+21,6,6,'#2d456e');pixel(ctx,a+15,b+21,6,6,'#2d456e');pixel(ctx,a+6,b+9,3,3,'#2e2b3c');pixel(ctx,a+15,b+9,3,3,'#2e2b3c');if(vy<0){pixel(ctx,a+3,b+24,6,3,'#f9d0a1');pixel(ctx,a+15,b+24,6,3,'#f9d0a1')}}

const rand=(a,b)=>a+Math.random()*(b-a);
function sparkle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function burst(s,x,y,color,count=12){for(let i=0;i<count;i++){const a=Math.PI*2*i/count,v=rand(1.3,3.5);s.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:36,color})}}
function particles(ctx,s,dt){s.particles=s.particles.filter(p=>p.life>0);for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.055*dt;p.life-=dt;ctx.globalAlpha=Math.max(0,p.life/36);sparkle(ctx,p.x,p.y,Math.max(.8,p.life/12),p.color)}ctx.globalAlpha=1}
const getBest=key=>{try{return Number(localStorage.getItem('vyron-'+key))||0}catch{return 0}};
const saveBest=(key,n)=>{try{localStorage.setItem('vyron-'+key,String(n))}catch{}};
function rounded(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function GameGlyph({type}){return type==='hop'?<svg viewBox="0 0 32 32" width="27" height="27" aria-hidden="true" shapeRendering="crispEdges"><path fill="#406f66" d="M4 22h24v5H4z"/><path fill="#93c884" d="M4 18h24v5H4z"/><path fill="#f0f3e7" d="M9 7h12v3H9zM5 10h21v8H5z"/><path fill="#79b4b1" d="M10 14h4v3h-4zM18 14h4v3h-4z"/></svg>:<svg viewBox="0 0 32 32" width="27" height="27" aria-hidden="true" shapeRendering="crispEdges"><path fill="#638d87" d="M5 20h22v7H5z"/><path fill="#d6b17b" d="M8 12h18v7H8z"/><path fill="#dba08c" d="M3 4h20v7H3z"/><path fill="#fff" opacity=".5" d="M5 6h15v2H5zM10 14h12v2H10z"/></svg>}
function SkyHop({active}){
 const canvas=useRef(null),keys=useRef({left:false,right:false}),touch=useRef(0),state=useRef(null);
 const [score,setScore]=useState(0),[best,setBest]=useState(()=>getBest('hop')),[over,setOver]=useState(false),[round,setRound]=useState(0),[started,setStarted]=useState(false);
 useEffect(()=>{const platforms=[{x:105,y:395,w:150},...Array.from({length:8},(_,i)=>({x:25+(i*67)%225,y:335-i*55,w:95}))];state.current={x:168,y:366,vx:0,vy:0,platforms,score:0,over:false,last:0,particles:[]};setScore(0);setOver(false);setStarted(false)},[round]);
 useEffect(()=>{const down=e=>{if(!active||!['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key))return;e.preventDefault();keys.current[e.key==='ArrowLeft'||e.key.toLowerCase()==='a'?'left':'right']=true};
 const up=e=>{if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')keys.current.left=false;if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')keys.current.right=false};
 window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);keys.current={left:false,right:false}}},[active]);
 useEffect(()=>{if(!active)return;let raf=0;const ctx=canvas.current?.getContext('2d');if(!ctx)return;
 const draw=t=>{const s=state.current;if(!s)return;const dt=Math.min(2,(t-(s.last||t))/16.67);s.last=t;
 if(started&&!s.over){const dir=Number(keys.current.right)-Number(keys.current.left)||touch.current;s.vx+=(dir*0.9-s.vx*0.18)*dt;s.x+=s.vx*dt*2.8;s.x=s.x>W? -24:s.x< -24?W:s.x;const oldBottom=s.y+24;s.vy+=0.32*dt;s.y+=s.vy*dt*2.1;
 if(s.vy>0)for(const p of s.platforms){if(oldBottom<=p.y+7&&s.y+24>=p.y&&s.x+22>p.x&&s.x<p.x+p.w){s.y=p.y-24;s.vy=-9.7;burst(s,s.x+12,p.y,'#ffffff',7);break}}
 if(s.y<190){const rise=190-s.y;s.y=190;s.platforms.forEach(p=>p.y+=rise);s.score+=rise;const points=Math.floor(s.score/10);setScore(prev=>prev===points?prev:points);if(points>getBest('hop')){saveBest('hop',points);setBest(points)}}
 s.platforms=s.platforms.filter(p=>p.y<H+24);while(s.platforms.length<9){const top=Math.min(...s.platforms.map(p=>p.y));s.platforms.push({x:rand(18,242),y:top-rand(49,64),w:rand(88,105)})}
 if(s.y>H+30){s.over=true;setOver(true)}
 }
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#a5d7d2';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#83c4c3';ctx.fillRect(0,290,W,150);
 ctx.fillStyle='#bde1ce';for(let i=0;i<8;i++){const x=i*64-18;pixel(ctx,x,330+(i%3)*15,48,120,'#bde1ce')}
 for(let i=0;i<7;i++)pixelCloud(ctx,(i*91+18)%410-30,(i*77+30)%280);
 for(const p of s.platforms)pixelIsland(ctx,p);
 pixelHero(ctx,s.x,s.y,s.vy);
 particles(ctx,s,dt);
 raf=requestAnimationFrame(draw)};raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf)},[active,round,started]);
 return <div className="vyron-play"><div className="vyron-score">Height <b>{score}</b><span>Best {best}</span></div><div className="vyron-canvas-wrap"><canvas ref={canvas} width={W} height={H} aria-label="Sky Hop: move left and right to land on platforms"/>{!started&&!over&&<div className="vyron-overlay"><span className="vyron-emoji">01 / HOP</span><strong>Sky Hop</strong><span>Keep climbing. Don't fall!</span><button type="button" onClick={()=>{state.current.vy=-9.7;setStarted(true)}}>Start hopping →</button></div>}{over&&<div className="vyron-overlay"><strong>Nice hop!</strong><span>Height: {score}</span><button type="button" onClick={()=>setRound(n=>n+1)}>Try again</button></div>}</div><div className="vyron-touch"><button type="button" aria-label="Move left" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);touch.current=-1}} onPointerUp={()=>touch.current=0} onPointerCancel={()=>touch.current=0}>◀</button><span>← → or A / D</span><button type="button" aria-label="Move right" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);touch.current=1}} onPointerUp={()=>touch.current=0} onPointerCancel={()=>touch.current=0}>▶</button></div></div>
}
function PerfectStack({active}){
 const canvas=useRef(null),state=useRef(null),placeRef=useRef(null);
 const [score,setScore]=useState(0),[best,setBest]=useState(()=>getBest('stack')),[over,setOver]=useState(false),[round,setRound]=useState(0),[started,setStarted]=useState(false),[streak,setStreak]=useState(0);
 useEffect(()=>{
  state.current={blocks:[{x:85,y:395,w:190}],moving:{x:0,y:359,w:190},direction:1,speed:3.2,score:0,streak:0,over:false,last:0,particles:[],flash:0,offcuts:[],camera:0,shake:0};
  setScore(0);setOver(false);setStarted(false);setStreak(0)
 },[round]);
 const place=()=>{
  const s=state.current;if(!active||!started||!s||s.over)return;
  const prev=s.blocks[s.blocks.length-1],m=s.moving;
  const tolerance=Math.max(2.5,6.5-s.score*.17);
  const perfect=Math.abs(m.x-prev.x)<=tolerance;
  const left=Math.max(m.x,prev.x),right=Math.min(m.x+m.w,prev.x+prev.w);
  const width=perfect?prev.w:right-left;
  if(width<8){s.over=true;s.shake=10;setOver(true);burst(s,prev.x+prev.w/2,m.y+15,'#bc806c',14);return}
  if(perfect){s.streak++;setStreak(s.streak);s.flash=12;burst(s,prev.x+prev.w/2,m.y+16,'#f2d8a4',12)}
  else{
   s.streak=0;setStreak(0);
   if(m.x<prev.x)s.offcuts.push({x:m.x,y:m.y,w:left-m.x,vy:-1.2});
   else s.offcuts.push({x:right,y:m.y,w:m.x+m.w-right,vy:-1.2});
   burst(s,left+width/2,m.y+15,'#9ab6a5',5)
  }
  const block={x:perfect?prev.x:left,y:m.y,w:width};
  s.blocks.push(block);s.score++;setScore(s.score);
  if(s.score>getBest('stack')){saveBest('stack',s.score);setBest(s.score)}
  if(block.y<172){s.camera+=36}
  const fromRight=s.score%2===0;
  s.moving={x:fromRight?W-width:0,y:block.y-36,w:width};
  s.direction=fromRight?-1:1;
  s.speed=Math.min(11.5,3.2+s.score*.32);
 };
 placeRef.current=place;
 useEffect(()=>{
  const key=e=>{
   if(!active||e.repeat||!['Space','Enter'].includes(e.code)||['BUTTON','INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   e.preventDefault();placeRef.current?.()
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
 },[active]);
 useEffect(()=>{
  if(!active)return;
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;let raf=0;
  const draw=t=>{
   const s=state.current;if(!s)return;
   const dt=Math.min(2,(t-(s.last||t))/16.67);s.last=t;
   if(started&&!s.over){
    const phase=s.score>=7?Math.sin(t*.004+s.score)*(.13+Math.min(.25,s.score*.012)):0;
    s.moving.x+=s.direction*s.speed*dt*(1+phase);
    if(s.moving.x<=0){s.moving.x=0;s.direction=1}
    if(s.moving.x+s.moving.w>=W){s.moving.x=W-s.moving.w;s.direction=-1}
   }
   s.offcuts=s.offcuts.filter(p=>p.y<H+70);
   for(const p of s.offcuts){p.y+=(p.vy+=.42*dt)*dt;p.x+=.5*dt}
   ctx.fillStyle='#eee9df';ctx.fillRect(0,0,W,H);
   ctx.strokeStyle='#d5cfc4';ctx.lineWidth=1;
   for(let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
   ctx.save();
   if(s.shake>0){ctx.translate(Math.sin(t*.09)*s.shake*.3,0);s.shake=Math.max(0,s.shake-dt)}
   ctx.translate(0,s.camera);
   const palette=['#cf9d82','#7bafa5','#dfba77','#9e9abf'];
   s.blocks.forEach((block,i)=>{
    if(block.y+s.camera>H+40||block.y+s.camera< -50)return;
    rounded(ctx,block.x,block.y+5,block.w,31,3,'#b7b0a3');
    rounded(ctx,block.x,block.y,block.w,30,3,palette[i%4]);
    if(block.w>12)rounded(ctx,block.x+3,block.y+3,block.w-6,4,2,'#ffffff55')
   });
   for(const p of s.offcuts)if(p.w>0)rounded(ctx,p.x,p.y,p.w,30,2,'#a4aaa2');
   if(!s.over){rounded(ctx,s.moving.x,s.moving.y,s.moving.w,30,3,'#668c86');if(s.moving.w>12)rounded(ctx,s.moving.x+3,s.moving.y+3,s.moving.w-6,4,2,'#ffffff55')}
   particles(ctx,s,dt);
   ctx.restore();
   if(s.flash>0){ctx.fillStyle='rgba(255,255,255,'+(s.flash/180)+')';ctx.fillRect(0,0,W,H);s.flash-=dt}
   raf=requestAnimationFrame(draw)
  };
  raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf)
 },[active,round,started]);
 return <div className="vyron-play">
  <div className="vyron-score">Blocks <b>{score}</b><span>{streak>=2?'PERFECT ×'+streak+' · ':''}Best {best}</span></div>
  <div className="vyron-canvas-wrap">
   <canvas ref={canvas} width={W} height={H} onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;placeRef.current?.()}} aria-label="Perfect Stack: tap the game to place the moving block"/>
   {!started&&!over&&<div className="vyron-overlay"><span className="vyron-emoji">02 / STACK</span><strong>Perfect Stack</strong><span>One tap per block. The speed rises as you climb.</span><button type="button" onClick={()=>setStarted(true)}>Start stacking →</button></div>}
   {over&&<div className="vyron-overlay"><strong>Tower finished</strong><span>{score} blocks stacked · Best {best}</span><button type="button" onClick={()=>setRound(n=>n+1)}>Try again</button></div>}
  </div>
  <p className="vyron-instruction">Tap anywhere on the game · Space on desktop · Perfect hits keep your width</p>
 </div>
}
export default function Vyron({processing=false}){
 const [open,setOpen]=useState(true),[game,setGame]=useState('hop');
 return <section className="vyron" aria-label="VYRON games"><div className="vyron-head"><div><span className="vyron-eyebrow">TWO GAMES · ZERO DISTRACTIONS</span><h2>VYRON</h2><p>Pick a game, chase your best, play whenever.</p></div><button type="button" className="vyron-toggle" onClick={()=>setOpen(x=>!x)} aria-expanded={open}>{open?'Close games':'Play games'}</button></div>{open&&<div className="vyron-body"><div className="vyron-switch" role="group" aria-label="Choose a game"><button type="button" className={game==='hop'?'selected':''} aria-pressed={game==='hop'} onClick={()=>setGame('hop')}><GameGlyph type="hop"/><span><strong>Sky Hop</strong><small>Pixel platformer</small></span></button><button type="button" className={game==='stack'?'selected':''} aria-pressed={game==='stack'} onClick={()=>setGame('stack')} ><GameGlyph type="stack"/><span><strong>Perfect Stack</strong><small>Timing challenge</small></span></button></div>{game==='hop'?<SkyHop active={open&&processing}/>:<PerfectStack active={open&&processing}/>}<p className="vyron-footnote">No account. No loading screens. Just play. Downloads run separately.</p></div>}</section>
}
