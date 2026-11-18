import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransferReporter,parseExtractorProgress,parseExtractorTelemetry} from './progress-metrics.mjs';

test('yt-dlp progress parser reads actual emitted percentage (not a mis-escaped expression)',()=>{
 assert.equal(parseExtractorProgress('download: 17.5%\n'),17.5);
 assert.equal(parseExtractorProgress('random\ndownload: 10.0%\ndownload: 58.4%\n'),58.4);
 assert.equal(parseExtractorProgress('download: N/A%\n'),null);
 assert.equal(parseExtractorProgress('Preparing video without progress'),null);
 assert.equal(parseExtractorProgress('download: 9999%'),null);
});

test('real ETA only when a known size and measured transfer rate exist',()=>{
 let timestamp=1000;
 const samples=[];
 const report=createTransferReporter({now:()=>timestamp,totalBytes:1024*1024,onProgress:p=>samples.push(p)});
 report(65536);
 assert.equal(samples.length,0,'Too little data to report a trustworthy ETA');
 timestamp+=1000;
 report(65536);
 assert.equal(samples.at(-1).estimatedSecondsRemaining,null);
 timestamp+=2400;
 report(65536);
 assert.ok(samples.at(-1).estimatedSecondsRemaining>0,'Calculate only from elapsed bytes and transfer speed');
 assert.equal(samples.at(-1).progressSource,'measured-transfer');
 assert.ok(samples.at(-1).progressPercent>0);
 assert.equal(samples.at(-1).totalBytes,1024*1024);
 assert.ok(samples.at(-1).progressUpdatedAt>=1000);
});

test('unknown total never generates a percentage or made-up ETA',()=>{
 let timestamp=0;
 const samples=[];
 const report=createTransferReporter({now:()=>timestamp,totalBytes:null,onProgress:p=>samples.push(p)});
 report(64000);
 timestamp+=3500;
 report(128000);
 const final=samples.at(-1);
 assert.equal(final.estimatedSecondsRemaining,null);
 assert.equal(final.progressPercent,null);
 assert.equal(final.progressSource,null);
 assert.equal(final.transferredBytes,192000);
});

test('transfer percentages remain bounded even with inconsistent declared length',()=>{
 let timestamp=0;
 const samples=[];
 const report=createTransferReporter({now:()=>timestamp,totalBytes:1024,onProgress:p=>samples.push(p)});
 report(1024);
 timestamp+=1500;
 report(2048);
 assert.ok(samples.at(-1).progressPercent<=99.9);
 assert.equal(samples.at(-1).estimatedSecondsRemaining,null);
});

test('extractor speed dashboard uses only numeric source telemetry',()=>{
 const measured=parseExtractorTelemetry('download: 42.5%|00:09|524288|1048576|2097152');
 assert.equal(measured.percent,42.5);
 assert.equal(measured.speedBytesPerSecond,524288);
 assert.equal(measured.transferredBytes,1048576);
 assert.equal(measured.totalBytes,2097152);
 const unknown=parseExtractorTelemetry('download: 42.5%|NA|NA|NA|NA');
 assert.equal(unknown.speedBytesPerSecond,null);
 assert.equal(unknown.totalBytes,null);
 assert.equal(unknown.etaSeconds,null);
});

test('numeric extractor telemetry is parsed instead of silently showing Measuring',()=>{
 const report=parseExtractorTelemetry('download: 12.5%|00:15|262144|131072|1048576');
 assert.deepEqual([report.speedBytesPerSecond,report.transferredBytes,report.totalBytes],[262144,131072,1048576]);
});
test('missing extractor metrics are unknown, never coerced to zero',()=>{
 const report=parseExtractorTelemetry('download: 0.0%|NA|NA|NA|NA');
 assert.equal(report.percent,0);
 assert.equal(report.speedBytesPerSecond,null);
 assert.equal(report.transferredBytes,null);
 assert.equal(report.totalBytes,null);
});
