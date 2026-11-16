/**
 * Conservative security headers: block framing, plugins, unsafe base URLs and
 * cross-site form posts without constraining existing Instagram/YouTube embeds.
 * Avoid restrictive script/iframe CSP until third-party embeds are audited.
 */
export function setSecurityHeaders(res){
 res.setHeader('x-content-type-options','nosniff');
 res.setHeader('x-frame-options','DENY');
 res.setHeader('referrer-policy','strict-origin-when-cross-origin');
 res.setHeader('permissions-policy','camera=(), microphone=(), geolocation=(), payment=()');
 res.setHeader('content-security-policy',"object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
 res.setHeader('cross-origin-opener-policy','same-origin');
}
