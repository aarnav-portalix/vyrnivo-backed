import React from 'react';

export const legalSections=['privacy','terms','copyright','disclaimer'];
const labels={privacy:'Privacy Policy',terms:'Terms of Use',copyright:'Copyright & Removal',disclaimer:'Service Notice'};
const effective='16 November 2026';

export default function LegalCenter({selected='privacy',onSelect=()=>{}}){
 return <section className="legal-center" id="legal-center" aria-labelledby="legal-title">
  <div className="legal-header">
   <div><p className="faq-eyebrow">Transparency & safety</p><h2 id="legal-title">Policies & legal</h2><p>Plain-language information about using Vyrnivo responsibly.</p></div>
   <span className="legal-date">Updated {effective}</span>
  </div>
  <div className="legal-tabs" role="group" aria-label="Legal documents">
   {legalSections.map(key=><button type="button" key={key} aria-pressed={selected===key} className={selected===key?'active':''} onClick={()=>onSelect(key)}>{labels[key]}</button>)}
  </div>
  <article className="legal-document" aria-label={labels[selected]} key={selected}>
   {selected==='privacy'&&<>
    <h3>Privacy Policy</h3>
    <p className="legal-updated">Effective {effective}</p>
    <p>Vyrnivo is a free, account-free video discovery and media conversion website. This policy describes the information processed by the website as currently implemented. It does not cover data collected independently by YouTube, Instagram, hosting providers, or other linked services.</p>
    <h4>1. Information involved when you use the site</h4>
    <p>When you submit a link or search, the site processes the video URL, search words, your chosen output format, and temporary download-job information to answer your request. You do not need to create an account or supply your name or email to use the current download feature.</p>
    <p>Your browser stores format and quality preferences, the last temporary job reference, and a random browser identifier using local storage. The identifier is sent in periodic requests to count approximately active browsers. It is held in server memory only while active and expires after about 75 seconds without another heartbeat. The count represents browser sessions, not individual people.</p>
    <h4>2. Processing by third parties</h4>
    <p>Vyrnivo uses third-party hosting and may forward the URL and conversion settings needed for a request to external media-processing services. Search requests may be made through public search services. Visiting an external video, licensed-source page, or preview may contact that third party and allow it to process technical information according to its own policies. The site also loads external font resources. We cannot control those providers' independent records or retention.</p>
    <p>When enabled, our anti-bot verification uses Cloudflare Turnstile. Its widget may process browser, network, and device signals to determine whether a download request appears automated. The server sends the short-lived verification token to Cloudflare to validate it, and does not save that token as part of a user account. For more details, see <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare’s privacy policy</a>. The check appears before starting a download, not while merely browsing the site.</p>
    <h4>3. Temporary files and download links</h4>
    <p>Completed files are stored temporarily on the site's server. Download links normally expire ten minutes after preparation and may stop working earlier after a restart. The server removes expired jobs when it is running; deletion may happen after the service resumes if it was suspended. Anyone you share a temporary file link with may be able to access that file until it expires. Do not use private, confidential, or personal media links.</p>
    <h4>4. Hosting logs and local storage</h4>
    <p>Hosting and network services may process IP addresses, request times, browser or device information, and error logs for security, operations, and abuse prevention. Vyrnivo does not currently provide an advertising-account system or sell an account profile to advertisers. No claim of complete anonymity is made. Your browser's local-storage settings can clear preferences and the browser identifier.</p>
    <h4>5. Security and choices</h4>
    <p>Use public links for content you are allowed to save. Do not paste access tokens, passwords, private share links, or other secrets. You may clear this site's local storage in your browser. Since there are no Vyrnivo accounts, there is no account profile to delete; temporary jobs expire automatically. The privacy practices of external websites are governed by those websites.</p>
    <h4>6. Questions and changes</h4>
    <p>For general, non-sensitive questions about the website, you can use the <a href="https://github.com/aarnav-portalix/vyrnivo-backed/issues" target="_blank" rel="noopener noreferrer">project issue tracker</a>. This is a public forum: never include personal information, private video URLs, passwords, or other secrets. The site operator should provide a private privacy contact method before wider public promotion. Material policy updates will be posted here with a new date.</p>
   </>}
   {selected==='terms'&&<>
    <h3>Terms of Use</h3>
    <p className="legal-updated">Effective {effective}</p>
    <p>These terms describe the intended use of Vyrnivo. By using the website, you agree to use it lawfully, respect other people's rights, and follow the terms of relevant content platforms.</p>
    <h4>1. Permitted use</h4>
    <p>Only submit material you own, material with an appropriate license, or material you otherwise have permission to download or convert. Public availability alone does not mean you have permission to reuse a video or its audio. You are responsible for checking copyright, platform terms, and applicable rules before saving, reposting, or distributing media.</p>
    <h4>2. Prohibited use</h4>
    <p>Do not use the website to violate copyright, privacy, platform access restrictions, or other rights; submit confidential or private content without authorization; try to defeat security measures; or overload, automate abuse of, or interfere with the website or its external providers. Vyrnivo does not authorize circumvention of DRM or access controls.</p>
    <h4>3. Free service and availability</h4>
    <p>Vyrnivo is currently free to use and does not promise a minimum number of downloads, a particular video quality, permanent availability, or successful access to every source. Features, supported formats, temporary file limits, third-party connections, and availability may change or be suspended without notice.</p>
    <h4>4. Temporary links and sharing</h4>
    <p>Files are held for a limited time. Treat the generated link like a temporary access key; anyone who obtains it might be able to download that file before expiry. You are responsible for whether you share or redistribute a file and for securing content you download.</p>
    <h4>5. Third-party platforms</h4>
    <p>Vyrnivo is an independent utility, not an official YouTube, Google, Instagram, or Meta product. External websites and processing services have their own rules and privacy policies. You remain responsible for complying with those rules.</p>
    <h4>6. No warranty and responsibility</h4>
    <p>The website is provided on an as-available basis. We do not promise uninterrupted operation, complete file accuracy, or compatibility with every device. Nothing in these terms excludes rights or legal protections that cannot lawfully be excluded in your jurisdiction.</p>
    <h4>7. Updates and questions</h4>
    <p>These terms may be updated as features change. Please review the effective date above. General questions can be raised through the <a href="https://github.com/aarnav-portalix/vyrnivo-backed/issues" target="_blank" rel="noopener noreferrer">public project issue tracker</a>; do not post sensitive information there.</p>
   </>}
   {selected==='copyright'&&<>
    <h3>Copyright & Content Removal</h3>
    <p className="legal-updated">Effective {effective}</p>
    <p>Vyrnivo respects creators and rights holders. It does not grant users permission to copy, modify, publish, or monetize third-party content. Ownership and license information remain with the original creators and platforms.</p>
    <h4>Download responsibly</h4>
    <p>Use content you created, public-domain or openly licensed materials consistent with their license terms, or content you have express permission to save. Some Creative Commons licenses require attribution or have other conditions. An independently hosted licensed clip may differ from a linked video.</p>
    <h4>Temporary processing and removal requests</h4>
    <p>Media files prepared by the service are temporary, generally expire after ten minutes, and may disappear sooner after a restart. If you believe material processed by this service infringes your rights, identify the relevant public source URL, the specific issue, and your relationship to the work in a removal request. The site operator should establish a private rights-holder contact channel before broad public release; the <a href="https://github.com/aarnav-portalix/vyrnivo-backed/issues" target="_blank" rel="noopener noreferrer">public issue tracker</a> is for non-sensitive reports only. Do not post personal details or private links publicly.</p>
    <h4>Not affiliated with source platforms</h4>
    <p>Vyrnivo is not endorsed by or affiliated with YouTube, Google, Instagram, or Meta. Trademarks and content belong to their respective owners.</p>
   </>}
   {selected==='disclaimer'&&<>
    <h3>Service & Availability Notice</h3>
    <p className="legal-updated">Effective {effective}</p>
    <h4>What a status indicator means</h4>
    <p>“Ready to try” means the website has not recently recorded a blocking condition for that processing route. It does not confirm access to a particular video or guarantee a successful conversion. Temporary usage limits, source restrictions, and network errors can change without notice.</p>
    <h4>Search, previews, and media quality</h4>
    <p>Search results may be incomplete, delayed, or unavailable. Embedded video previews and external pages are provided by independent third parties. You are responsible for evaluating their content and verifying source rights before use. Output quality depends on available formats, licensing, and source availability.</p>
    <h4>File life cycle</h4>
    <p>Prepared files are temporary and ordinarily expire ten minutes after creation. Avoid relying on Vyrnivo as an archive or a backup service. Keep your own authorized copy of any media you need to retain.</p>
    <h4>Support and contact</h4>
    <p>For non-sensitive technical reports, use the <a href="https://github.com/aarnav-portalix/vyrnivo-backed/issues" target="_blank" rel="noopener noreferrer">project issue tracker</a>. No paid support or guaranteed response time is offered.</p>
   </>}
  </article>
 </section>;
}
