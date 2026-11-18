/**
 * Download transfer telemetry from actual bytes and Content-Length.
 * Never predict completion during unknown extraction or source-wait stages.
 */
export function createTransferReporter({now=Date.now,onProgress=()=>{},totalBytes=null,stage='Receiving media'}={}){
 const validTotal=Number.isSafeInteger(totalBytes)&&totalBytes>0?totalBytes:null;
 let firstAt=null,lastAt=null,lastBytes=0;
 let received=0,smoothedSpeed=null;
 return function report(chunkBytes){
  const n=Number(chunkBytes);
  if(!Number.isSafeInteger(n)||n<=0)return;
  received+=n;
  const t=now();
  if(firstAt===null){firstAt=t;lastAt=t}
  if(t-lastAt<400&&validTotal&&received<validTotal)return;
  const elapsedMs=Math.max(0,t-firstAt);
  const intervalMs=Math.max(1,t-lastAt);
  const deltaBytes=received-lastBytes;
  if(intervalMs>=400&&deltaBytes>0){
   const instant=deltaBytes/(intervalMs/1000);
   smoothedSpeed=smoothedSpeed===null?instant:0.3*instant+0.7*smoothedSpeed;
   lastAt=t;lastBytes=received;
  }
  const percent=validTotal?Math.min(99.9,Math.round(received/validTotal*1000)/10):null;
  const remaining=validTotal&&smoothedSpeed>0&&elapsedMs>=2500&&received>=65536&&received<validTotal
   ?Math.min(3600,Math.ceil((validTotal-received)/smoothedSpeed)):null;
  onProgress({
   stage,
   progressPercent:percent,
   progressSource:validTotal?'measured-transfer':null,
   progressUpdatedAt:t,
   speedBytesPerSecond:elapsedMs>=1000&&smoothedSpeed>0?Math.round(smoothedSpeed):null,
   transferredBytes:received,
   totalBytes:validTotal,
   estimatedSecondsRemaining:remaining
  });
 };
}

export function parseExtractorProgress(output){
 const text=String(output||'');
 const matches=[...text.matchAll(/download:\s*(\d+(?:\.\d+)?)%/g)];
 const percent=matches.length?Number(matches.at(-1)[1]):null;
 return Number.isFinite(percent)&&percent>=0&&percent<=100?percent:null;
}

/** yt-dlp reports an optional *measured, phase-specific* ETA. Never invent one. */
export function parseExtractorTelemetry(output){
 const lines=String(output||'').split(/\r?\n/).filter(line=>line.startsWith('download:'));
 const last=lines.at(-1)||'';
 const [percentText,etaText]=last.slice('download:'.length).split('|');
 const percentMatch=String(percentText||'').match(/(\d+(?:\.\d+)?)%/);
 const number=percentMatch?Number(percentMatch[1]):null;
 const percent=Number.isFinite(number)&&number>=0&&number<=100?number:null;
 let etaSeconds=null;
 const value=String(etaText||'').trim();
 if(/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)){
  const parts=value.split(':').map(Number);
  etaSeconds=parts.reduce((total,n)=>total*60+n,0);
 }else if(/^\d+(?:\.\d+)?s?$/.test(value)){
  etaSeconds=Math.ceil(Number.parseFloat(value));
 }
 if(!Number.isFinite(etaSeconds)||etaSeconds>7200||etaSeconds<0)etaSeconds=null;
 return {percent,etaSeconds};
}
