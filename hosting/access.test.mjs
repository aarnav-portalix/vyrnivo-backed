import test from 'node:test';
import assert from 'node:assert/strict';
import {sameOrigin,hasBackendToken,allowApi,allowFileUpload} from './access.mjs';
const request = (method,headers={}) => ({method,headers});
test('same-origin browser uploads work with server-side bearer token enabled',()=>{
 const env={DOWNLOAD_API_TOKEN:'private-secret'};
 const req=request('POST',{host:'vyrnivo.onrender.com',origin:'https://vyrnivo.onrender.com'});
 assert.equal(sameOrigin(req),true);
 assert.equal(allowApi(req,env),true);
 assert.equal(allowFileUpload(req,env),true);
});
test('no cross-origin writes or forged origin hosts',()=>{
 const env={DOWNLOAD_API_TOKEN:'private-secret'};
 for(const origin of ['https://attacker.example','http://vyrnivo.onrender.com','https://vyrnivo.onrender.com.evil.test']){
  const req=request('POST',{host:'vyrnivo.onrender.com',origin});
  assert.equal(allowApi(req,env),false);
  assert.equal(allowFileUpload(req,env),false);
 }
 assert.equal(allowApi(request('POST',{host:'vyrnivo.onrender.com'}),env),false);
});
test('proxy bearer works, including on POST with no Origin',()=>{
 const env={DOWNLOAD_API_TOKEN:'private-secret',APP_ORIGIN:'https://site.example'};
 const req=request('POST',{authorization:'Bearer private-secret'});
 assert.equal(hasBackendToken(req,env),true);
 assert.equal(allowApi(req,env),true);
 assert.equal(allowFileUpload(req,env),true);
 assert.equal(allowApi(request('POST',{authorization:'Bearer wrong'}),env),false);
});
test('public status and random-ID download GETs require no secret',()=>{
 const env={DOWNLOAD_API_TOKEN:'private-secret'};
 assert.equal(allowApi(request('GET'),env),true);
 assert.equal(allowApi(request('HEAD'),env),true);
});
test('file-host configured origin is enforced for browser uploads',()=>{
 const env={APP_ORIGIN:'https://site.example'};
 assert.equal(allowFileUpload(request('POST',{host:'other.example',origin:'https://other.example'}),env),false);
 assert.equal(allowFileUpload(request('POST',{host:'site.example',origin:'https://site.example'}),env),true);
});
