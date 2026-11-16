import test from 'node:test';
import assert from 'node:assert/strict';
import {createHumanVerification} from './security.mjs';

test('Turnstile is optional until both keys are configured and never exposes the secret',async()=>{
 const missing=createHumanVerification({siteKey:'public-key'});
 assert.equal(missing.enabled,false);
 assert.equal(missing.incomplete,true);
 assert.deepEqual(missing.publicStatus(),{enabled:false,siteKey:null});
 assert.deepEqual(await missing.verify('anything'),{ok:true});
 const enabled=createHumanVerification({siteKey:'public-key',secretKey:'private-secret'});
 assert.deepEqual(enabled.publicStatus(),{enabled:true,siteKey:'public-key'});
 assert.doesNotMatch(JSON.stringify(enabled.publicStatus()),/private-secret/);
});

test('rejects missing, too-large, invalid, wrong-hostname and wrong-action Turnstile tokens',async()=>{
 let requests=0;
 const verify=createHumanVerification({siteKey:'test-site',secretKey:'test-secret',expectedHostname:'vyrnivo-downloads.onrender.com',fetchImpl:async(_url,opts)=>{
  requests++;
  const fields=new URLSearchParams(opts.body);
  assert.equal(fields.get('secret'),'test-secret');
  assert.equal(fields.get('response'),'abcdefgh');
  return new Response(JSON.stringify({success:true,hostname:'evil.example',action:'download'}),{status:200,headers:{'content-type':'application/json'}});
 }});
 assert.equal((await verify.verify('')).code,'BOT_CHECK_REQUIRED');
 assert.equal((await verify.verify('t'.repeat(2049))).code,'BOT_CHECK_REQUIRED');
 assert.equal(requests,0,'Malformed tokens should never contact Cloudflare');
 assert.equal((await verify.verify('abcdefgh')).code,'BOT_CHECK_FAILED');
 assert.equal(requests,1);
 const wrongAction=createHumanVerification({siteKey:'site',secretKey:'secret',fetchImpl:async()=>Response.json({success:true,hostname:'vyrnivo-downloads.onrender.com',action:'login'})});
 assert.equal((await wrongAction.verify('abcdefgh')).code,'BOT_CHECK_FAILED');
});

test('accepts only successful Siteverify responses on the expected host and download action',async()=>{
 let called=0;
 const verify=createHumanVerification({siteKey:'site',secretKey:'secret',fetchImpl:async(url,init)=>{
  called++;
  assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(init.redirect,'error');
  return Response.json({success:true,hostname:'vyrnivo-downloads.onrender.com',action:'download'});
 }});
 assert.equal((await verify.verify('abcdefgh')).ok,true);
 assert.equal(called,1);
});
test('fails closed on verification outages and expired tokens',async()=>{
 const unavailable=createHumanVerification({siteKey:'site',secretKey:'secret',fetchImpl:async()=>{throw Error('offline')}});
 const failure=await unavailable.verify('abcdefgh');
 assert.equal(failure.code,'BOT_CHECK_UNAVAILABLE');
 assert.equal(failure.status,503);
 const expired=createHumanVerification({siteKey:'site',secretKey:'secret',fetchImpl:async()=>Response.json({success:false,'error-codes':['timeout-or-duplicate']})});
 assert.equal((await expired.verify('abcdefgh')).code,'BOT_CHECK_FAILED');
});
