/**
 * Non-secret Turnstile configuration health probe.
 * Reports key shape only; never prints a complete key.
 */
const base='https://vyrnivo-downloads.onrender.com';
const response=await fetch(base+'/api/security/status',{signal:AbortSignal.timeout(25000)});
const body=await response.json();
const key=String(body.siteKey||'');
const info={
  httpStatus:response.status,
  enabled:body.enabled===true,
  publicSiteKeyLength:key.length,
  publicSiteKeyPrefix:key.slice(0,5),
  publicSiteKeySuffix:key.slice(-4),
  leadingOrTrailingWhitespace:key.trim()!==key,
  suspiciousQuotes:key.startsWith('"')||key.endsWith('"')||key.startsWith("'")||key.endsWith("'"),
  containsWhitespace:/\s/.test(key),
  resemblesCloudflareSiteKey:/^0x[0-9A-Za-z_-]+$/.test(key),
  resemblesCloudflareTestKey:/^[123]x00000000000000000000[A-Z]{2}$/.test(key)
};
console.log('TURNSTILE_CONFIG_DIAGNOSTIC',JSON.stringify(info));
if(!response.ok||!info.enabled)process.exitCode=1;
