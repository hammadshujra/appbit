const cheerio = require('cheerio');
const state = require('../state');
const config = require('../config');
const { getPool } = require('../db');
const { compareVersions } = require('../utils/version');
const activity = require('./activity');
const notifications = require('./notifications');
const crypto = require('node:crypto');
const source = require('./apk-source');
const fields = require('./apk-fields');
const history = require('./apk-history');
const remote = require('./remote');
const {checkedQuery} = require('../utils/sql-checked');

const BASE_URL = 'https://liteapks.com';
const SOURCE_TYPE = 'liteapks';
const PLATFORM_KEY = 'android';
const SYNC_KEY = 'apk-main';
const WORKER_INTERVAL_MS = 3500;
const DEFAULT_DAILY_PAGES = 8;
const DEFAULT_FULL_PAGES = 80;
const DEFAULT_MAX_ITEMS = 50000;

let workerStarted = false;
let workerBusy = false;
let discoveryTask=null, activeJobController=null, recoveryDone=false, taxonomyBusy=false;

function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
function stripTitleNoise(value) {
  return cleanText(value)
    .replace(/\s*[|–—-]\s*LITEAPKS.*$/i, '')
    .replace(/\s+v?\d+(?:\.\d+){1,}[0-9A-Za-z._+-]*\s+(?:APK|XAPK|APKS)\b.*$/i, '')
    .replace(/\s+(?:MOD\s+APK|APK\s+MOD|Premium\s+APK).*$/i, '')
    .trim();
}
function slugFromUrl(value) {
  try {
    const u = new URL(value, BASE_URL);
    const name = u.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(name.replace(/\.html?$/i, '')).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  } catch { return ''; }
}
function internalPackageId(url) {
  const slug = slugFromUrl(url);
  return slug ? `liteapks:${slug}` : '';
}
function normalizeSourceUrl(value) {
  try {
    if(value==null||!String(value).trim())return null;
    const u = new URL(value, BASE_URL);
    if (u.protocol !== 'https:') return null;
    if (!/(^|\.)liteapks\.com$/i.test(u.hostname)) return null;
    u.hash = '';
    return u.toString();
  } catch { return null; }
}
function normalizeMetadataUrl(value, base = BASE_URL) {
  try {
    if(value==null||!String(value).trim())return null;
    const u = new URL(value, base);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (u.username || u.password) return null;
    u.hash = '';
    return u.toString();
  } catch { return null; }
}
function compactLabelObject(map) {
  const out = {};
  let count = 0;
  for (const [key, value] of map.entries()) {
    if (count++ >= 80) break;
    out[String(key).slice(0,80)] = cleanText(value).slice(0,500);
  }
  return out;
}
function parseRating(value) {
  const raw=cleanText(value);
  if(!raw)return null;
  const m=raw.match(/(?:^|\b)([0-5](?:\.\d{1,2})?)(?:\s*\/\s*5|\s*(?:stars?|★))?/i);
  if(!m)return null;
  const n=Number(m[1]);
  return Number.isFinite(n)&&n>=0&&n<=5?Math.round(n*100)/100:null;
}
const parseCount = fields.parseCount;
function isLikelyAppUrl(value) {
  const url = normalizeSourceUrl(value);
  if (!url) return false;
  const u = new URL(url);
  const p = u.pathname.toLowerCase();
  if (!/\.html?$/.test(p)) return false;
  if (/\/(?:privacy|terms|dmca|disclaimer|contact|about|faq|policy|request|report)(?:[-/]|\.|$)/i.test(p)) return false;
  if (/\/download\//i.test(p)) return false;
  return true;
}
const parseBytes = fields.parseBytes;
const parseDate = fields.parseDate;
const normalizeVersion = fields.normalizeVersion;
function extractUpdatedRaw($,app,labels,pageText='') {
  const candidates=[
    [firstLabel(labels,['updated','last updated','update date','release date']),'source:updated'],
    [app?.dateModified,'schema:dateModified'],
    [$('[itemprop="dateModified"]').attr('datetime'),'itemprop:dateModified'],
    [$('[itemprop="dateModified"]').attr('content'),'itemprop:dateModified'],
    [metadataContent($,['meta[property="software:release_date"]','meta[name="dateModified"]','meta[itemprop="dateModified"]']),'meta:dateModified']
  ];
  $('time[datetime],time[content]').each((_,el)=>{
    const context=cleanText($(el).parent().text());
    if(/updated|modified|release/i.test(context))candidates.push([$(el).attr('datetime')||$(el).attr('content'),'time:updated']);
  });
  const match=String(pageText||'').match(/(?:last\s+updated|updated(?:\s+on)?|update\s+date|release\s+date)\s*[:：-]?\s*((?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})|(?:[A-Z][a-z]{2,8}\s+\d{1,2},?\s+20\d{2})|(?:\d{1,2}\s+[A-Z][a-z]{2,8}\s+20\d{2}))/i);
  if(match)candidates.push([match[1],'text:updated']);
  // Article/publication dates do not establish the software's last update.
  // Retain publication separately, never mislabel it as an app update.
  for(const [value,from] of candidates)if(parseDate(value))return {value:parseDate(value),source:from};
  return {value:null,source:null};
}
const labelMap = fields.collectLabels;
const firstLabel = fields.firstLabel;
const jsonLdObjects = fields.softwareObjects;
const pickSoftwareJsonLd = fields.chooseSoftware;
function metadataContent($, selectors) {
  for (const s of selectors) {
    const v=$(s).first().attr('content') || $(s).first().text();
    if(cleanText(v))return cleanText(v);
  }
  return null;
}

function contentTextBlocks($, root) {
  const blocks=[];const seen=new Set();
  root.find('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre').addBack('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre').each((_,el)=>{
    const node=$(el),tag=String(el.tagName||el.name||'').toLowerCase();
    const text=cleanText(node.text());
    if(!text||text.length<2||seen.has(text))return;
    seen.add(text);
    blocks.push({el,node,tag,text});
  });
  return blocks;
}
function headingLevel(block){return /^h[1-6]$/.test(block?.tag||'')?Number(block.tag.slice(1)):99}
const DESCRIPTION_HEADING_RE=/^(?:description|about(?: this)? (?:app|game)|about\b|overview|introduction|what is\b)/i;
const MOD_HEADING_RE=/^(?:mod\s*(?:info|information|features?)|what(?:'s| is) (?:the )?mod|mod menu|mod apk info)\b/i;
const EXCLUDED_CONTENT_HEADING_RE=/^(?:faqs?|frequently asked questions|safety(?: data| information)?|data safety|security(?: information)?|comments?|user comments?|reviews?|recommended(?: for you)?|recommendations?|related(?: apps?| games?)?|similar(?: apps?| games?)?|you may also like|more apps?|latest apps?|popular apps?|download(?: now| apk| xapk| apks)?|how to download|how to install|installation|older versions?|old versions?|previous versions?|version history|screenshots?|gallery|permissions?|privacy|changelog|what(?:'s| is) new)\b/i;
function sanitizeContentRoot($, node){
  const root=node.clone();
  root.find('script,style,noscript,svg,canvas,form,button,input,select,textarea,nav,footer,aside').remove();
  root.find('[class*="breadcrumb"],[class*="recommend"],[class*="related"],[class*="comment"],[class*="share"],[class*="social"],[class*="advert"],[class*="ads"],[class*="screenshot"],[class*="gallery"],[class*="rating"],[class*="stat"],[class*="safety"],[class*="faq"],[id*="comment"],[id*="related"],[id*="screenshot"],[id*="safety"],[id*="faq"]').remove();
  return root;
}
function sectionFromBlocks(blocks,startIndex,{stopOnMod=false,stopOnDescription=false}={}){
  if(startIndex<0)return null;
  const start=blocks[startIndex],level=headingLevel(start),parts=[];
  for(let i=startIndex+1;i<blocks.length;i++){
    const block=blocks[i],isHeading=/^h[1-6]$/.test(block.tag);
    if(isHeading){
      const title=block.text;
      if(EXCLUDED_CONTENT_HEADING_RE.test(title))break;
      if(stopOnMod&&MOD_HEADING_RE.test(title))break;
      if(stopOnDescription&&DESCRIPTION_HEADING_RE.test(title))break;
      if(stopOnDescription&&headingLevel(block)<=level)break;
    }
    if(EXCLUDED_CONTENT_HEADING_RE.test(block.text)&&isHeading)break;
    parts.push(block.tag==='li'?'• '+block.text:block.text);
  }
  const value=parts.join('\n\n').trim();
  return value.length>=20?value.slice(0,500000):null;
}
function exactSectionContainer($, selectors){
  for(const selector of selectors){
    const nodes=$(selector);
    for(let i=0;i<nodes.length;i++){
      const node=sanitizeContentRoot($,$(nodes[i]));
      const text=cleanText(node.text());
      if(text.length>=40)return node;
    }
  }
  return null;
}
function metaValues($, keys){
  const wanted=new Set(keys.map(x=>String(x).toLowerCase()));const out=[];
  $('meta').each((_,el)=>{
    const node=$(el),key=cleanText(node.attr('name')||node.attr('property')||node.attr('itemprop')).toLowerCase();
    if(!wanted.has(key))return;
    const value=node.attr('content')||node.attr('value')||node.text();if(cleanText(value))out.push(value);
  });
  return out;
}
function metaCandidate(values,{max=5000,min=1}={}){
  for(const value of values){
    const text=cleanText(value);
    if(text.length<min||text.length>max)continue;
    if(/^(?:just a moment|attention required|access denied|checking your browser|verify you are human)$/i.test(text))continue;
    return text;
  }
  return null;
}
function sourceContentData($, appName='', schemaApp={}) {
  // SEO metadata must come from actual page metadata, never from unrelated body text.
  const metaTitle=metaCandidate([
    $('title').first().text(),
    ...metaValues($,['title','og:title','twitter:title'])
  ],{max:1000}) || null;
  const metaDescription=metaCandidate([
    ...metaValues($,['description','og:description','twitter:description']),
    schemaApp?.description
  ],{min:10,max:5000}) || null;

  // Prefer a real article/content root, but never copy an entire <main> by default.
  const root=exactSectionContainer($,[
    '[itemprop="articleBody"]','.entry-content','.post-content','.article-content','.single-content',
    '.apk-content','.app-content','.content-post','.post-body','.article-body'
  ]);
  const working=root||sanitizeContentRoot($,$('body'));
  const blocks=contentTextBlocks($,working);

  let descriptionSectionText=null,modInfoText=null;
  let descriptionIndex=-1,modIndex=-1;
  for(let i=0;i<blocks.length;i++){
    const b=blocks[i];if(!/^h[1-6]$/.test(b.tag))continue;
    if(descriptionIndex<0&&DESCRIPTION_HEADING_RE.test(b.text))descriptionIndex=i;
    if(modIndex<0&&MOD_HEADING_RE.test(b.text))modIndex=i;
  }
  if(descriptionIndex>=0)descriptionSectionText=sectionFromBlocks(blocks,descriptionIndex,{stopOnMod:true});
  if(modIndex>=0)modInfoText=sectionFromBlocks(blocks,modIndex,{stopOnDescription:true});

  // Some templates expose these sections as dedicated containers without a heading.
  if(!descriptionSectionText){
    const container=exactSectionContainer($,[
      '#description','[data-section="description"]','.description-content','.app-description','.apk-description',
      '.post-description','.article-description','[itemprop="description"]'
    ]);
    if(container){
      const parts=contentTextBlocks($,container).filter(b=>!EXCLUDED_CONTENT_HEADING_RE.test(b.text));
      const value=parts.map(b=>b.tag==='li'?'• '+b.text:b.text).join('\n\n').trim();
      if(value.length>=20)descriptionSectionText=value.slice(0,500000);
    }
  }
  if(!modInfoText){
    const container=exactSectionContainer($,[
      '#mod-info','#modinfo','[data-section="mod-info"]','.mod-info','.modinfo','.mod-features','.mod-information'
    ]);
    if(container){
      const parts=contentTextBlocks($,container).filter(b=>!EXCLUDED_CONTENT_HEADING_RE.test(b.text));
      const value=parts.map(b=>b.tag==='li'?'• '+b.text:b.text).join('\n\n').trim();
      if(value.length>=3)modInfoText=value.slice(0,100000);
    }
  }

  // If the page has a real article body but no explicit Description heading, keep
  // only the opening written content and stop at Mod Info / FAQ / Safety / comments /
  // recommendations / download sections. This avoids the old "copy whole page" bug.
  if(!descriptionSectionText&&root){
    const parts=[];
    for(const b of blocks){
      const isHeading=/^h[1-6]$/.test(b.tag);
      if(isHeading&&(MOD_HEADING_RE.test(b.text)||EXCLUDED_CONTENT_HEADING_RE.test(b.text)))break;
      if(isHeading&&appName&&normalizeSourceText(b.text)===normalizeSourceText(appName))continue;
      if(/^(?:download|download apk|google play|share|request update|screenshots?)$/i.test(b.text))continue;
      parts.push(b.tag==='li'?'• '+b.text:b.text);
    }
    const value=parts.join('\n\n').trim();
    if(value.length>=40)descriptionSectionText=value.slice(0,500000);
  }

  // Only the requested core written content is exported: Description + Mod Info.
  const core=[];
  if(descriptionSectionText)core.push(descriptionSectionText);
  if(modInfoText&&(!descriptionSectionText||!normalizeSourceText(descriptionSectionText).includes(normalizeSourceText(modInfoText))))core.push(`Mod Info\n\n${modInfoText}`);
  const sourceContentText=core.join('\n\n').trim().slice(0,500000)||null;
  return {metaTitle,metaDescription,sourceContentText,descriptionSectionText,modInfoText};
}
function normalizeSourceText(value){return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

const SIZE_TOKEN_RE=/\b\d+(?:[.,]\d+)?\s*(?:bytes?|[kmgt]i?b|kilo(?:byte)?s?|mega(?:byte)?s?|giga(?:byte)?s?|tera(?:byte)?s?)\b/i;
const BROWSER_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
function rawHtmlSizeCandidates(html){
  const raw=String(html||''),out=[];
  const add=(value,sourceName)=>{const bytes=parseBytes(value);if(bytes&&!out.some(x=>x.bytes===bytes))out.push({raw:cleanText(value),bytes,source:sourceName})};
  const textPatterns=[
    /(?:data-(?:file-?)?size|data-download-size|contentSize|fileSize|downloadSize|apkSize|appSize|packageSize)\s*[=:]\s*["']([^"']{1,80})["']/gi,
    /["'](?:contentSize|fileSize|downloadSize|apkSize|appSize|packageSize)["']\s*:\s*["']([^"']{1,80})["']/gi,
    /(?:\bSIZE\b|\bFILE\s+SIZE\b|\bAPK\s+SIZE\b)[\s\S]{0,220}?((?:\d+(?:[.,]\d+)?)\s*(?:bytes?|[kmgt]i?b|kilo(?:byte)?s?|mega(?:byte)?s?|giga(?:byte)?s?|tera(?:byte)?s?))/gi,
    /((?:\d+(?:[.,]\d+)?)\s*(?:bytes?|[kmgt]i?b|kilo(?:byte)?s?|mega(?:byte)?s?|giga(?:byte)?s?|tera(?:byte)?s?))[\s\S]{0,220}?\bSIZE\b/gi
  ];
  for(const re of textPatterns){let m;let guard=0;while((m=re.exec(raw))&&guard++<30)add(m[1],'source:raw-html')}
  const bytePatterns=[/["'](?:fileSizeBytes|file_size_bytes|contentLength|content_length)["']\s*:\s*(\d{4,})/gi,/(?:data-file-size-bytes|data-content-length)\s*=\s*["']?(\d{4,})/gi];
  for(const re of bytePatterns){let m;let guard=0;while((m=re.exec(raw))&&guard++<20)add(m[1]+' bytes','source:raw-bytes')}
  return out;
}
function localizedSizeCandidates($){
  const out=[];const add=(value,sourceName)=>{const match=cleanText(value).match(SIZE_TOKEN_RE);if(!match)return;const bytes=parseBytes(match[0]);if(bytes&&!out.some(x=>x.bytes===bytes))out.push({raw:match[0],bytes,source:sourceName})};
  $('body *').each((_,el)=>{
    const node=$(el);if(node.children().length)return;
    if(fields.fieldKey(node.text())!=='size')return;
    if(node.closest('nav,footer,aside,[class*="recommend"],[class*="related"],[class*="history"]').length)return;
    add(node.prev().text(),'source:size-neighbour');add(node.next().text(),'source:size-neighbour');
    let group=node.parent();
    for(let depth=0;depth<7&&group.length;depth++,group=group.parent()){
      const text=cleanText(group.text());if(!text||text.length>1200)continue;
      const matches=text.match(new RegExp(SIZE_TOKEN_RE.source,'ig'))||[];
      if(matches.length===1){add(matches[0],'source:size-card');break}
    }
  });
  return out;
}
function heroSizeCandidates($){
  const out=[];
  const blocked='nav,footer,aside,[class*="recommend"],[class*="related"],[class*="old-version"],[class*="history"],[class*="faq"],[class*="safety"],[class*="comment"],[class*="description"],[class*="post-content"],[class*="entry-content"],[class*="screenshot"],[class*="gallery"]';
  const add=(raw,score,sourceName,node)=>{
    const match=cleanText(raw).match(SIZE_TOKEN_RE);if(!match)return;
    const bytes=parseBytes(match[0]);if(!bytes)return;
    const existing=out.find(x=>x.bytes===bytes);if(existing){if(score>existing.score){existing.score=score;existing.source=sourceName;existing.raw=match[0]}return}
    out.push({raw:match[0],bytes,source:sourceName,score,node});
  };
  $('body *').each((_,el)=>{
    const node=$(el);if(node.children().length||node.closest(blocked).length)return;
    const text=cleanText(node.text());if(!text||text.length>120||!SIZE_TOKEN_RE.test(text))return;
    let score=0;
    const parent=node.parent();
    const siblingText=cleanText(parent.text());
    if(/\bsize\b/i.test(siblingText))score+=80;
    if(node.prev().length&&fields.fieldKey(node.prev().text())==='size')score+=120;
    if(node.next().length&&fields.fieldKey(node.next().text())==='size')score+=120;
    const cls=[node.attr('class'),parent.attr('class'),parent.attr('id')].filter(Boolean).join(' ');
    if(/hero|header|summary|top|detail|meta|info|stat/i.test(cls))score+=35;
    let group=parent;
    for(let depth=0;depth<8&&group.length;depth++,group=group.parent()){
      const t=cleanText(group.text());if(!t||t.length>3500)continue;
      if(/\b(?:download\s+(?:apk|xapk|apks)|download now)\b/i.test(t))score+=28;
      if(/\bversion\b/i.test(t))score+=20;
      if(/\b(?:google play|get it on)\b/i.test(t)||group.find('a[href*="play.google.com/store/apps/details"]').length)score+=18;
      if(/(?:★|\brating\b|\b[0-5](?:\.\d+)?\s*\/\s*5\b)/i.test(t))score+=10;
      if(/\b(?:faq|safety|comments?|recommended|related apps?)\b/i.test(t))score-=100;
    }
    add(text,score,'source:hero-size',node);
  });
  return out.sort((a,b)=>b.score-a.score).map(({node,...x})=>x);
}
function extractSizeInfo($,app,labels,pageText='',rawHtml=''){
  const candidates=[];
  const add=(raw,sourceName)=>{if(raw==null||raw==='')return;const bytes=parseBytes(raw);if(bytes&&!candidates.some(x=>x.bytes===bytes))candidates.push({raw:cleanText(raw),bytes,source:sourceName})};
  for(const x of heroSizeCandidates($))add(x.raw,x.source);
  add(firstLabel(labels,['size','file size','apk size','app size','download size','package size']),'source:label');
  add(app?.fileSize,'schema:fileSize');
  add(app?.contentSize,'schema:contentSize');
  $('[data-size],[data-filesize],[data-file-size],[data-download-size],[data-content-size],[itemprop="contentSize"],meta[itemprop="contentSize"],meta[name="fileSize"],meta[name="filesize"]').each((_,el)=>{
    const node=$(el);for(const a of ['data-size','data-filesize','data-file-size','data-download-size','data-content-size','content'])add(node.attr(a),`source:${a}`);add(node.text(),'source:size-element');
  });
  const structured=fields.structuredFileSize?.($);if(structured?.bytes)add(structured.raw,'source:structured-size');
  for(const x of localizedSizeCandidates($))add(x.raw,x.source);
  for(const x of rawHtmlSizeCandidates(rawHtml))add(x.raw,x.source);
  const text=cleanText(pageText||$('body').text());
  const patterns=[
    new RegExp('(?:^|\\s)SIZE\\s*[:：-]?\\s*('+SIZE_TOKEN_RE.source+')','i'),
    new RegExp('('+SIZE_TOKEN_RE.source+')[\\s\\S]{0,30}?(?:SIZE|TOTAL\\s+SIZE)\\b','i'),
    new RegExp('(?:APK|APP|FILE|DOWNLOAD|PACKAGE)\\s+SIZE\\s*[:：-]?\\s*('+SIZE_TOKEN_RE.source+')','i'),
    new RegExp('(?:SIZE|TOTAL\\s+SIZE)[\\s\\S]{0,30}?('+SIZE_TOKEN_RE.source+')','i')
  ];
  for(const re of patterns){const m=text.match(re);if(m)add(m[1],'source:text-size')}
  const best=candidates.find(x=>Number(x.bytes)>0)||{raw:null,bytes:null,source:null};
  return {...best,candidates:candidates.slice(0,12)};
}
function explicitPackageUrls($,pageUrl){
  const out=[],seen=new Set();
  const add=raw=>{const url=normalizeMetadataUrl(raw,pageUrl);if(!url||seen.has(url))return;let decoded='';try{decoded=decodeURIComponent(new URL(url).pathname+new URL(url).search)}catch{}if(!/\.(?:apk|xapk|apks)(?:$|[?&#=])/i.test(decoded)&&!/[?&](?:url|file|download|link)=[^&]*(?:apk|xapk|apks)/i.test(decoded))return;seen.add(url);out.push(url)};
  $('a[href],a[data-url],a[data-download],[data-href]').each((_,el)=>{for(const a of ['href','data-url','data-download','data-href'])add($(el).attr(a))});
  return out.slice(0,8);
}
async function renderedPageSnapshot(pageUrl,{signal}={}){
  if(signal?.aborted)return null;let browser;
  try{
    const {chromium}=require('playwright');
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    const context=await browser.newContext({userAgent:BROWSER_UA,viewport:{width:1440,height:1000},locale:'en-US'});
    const page=await context.newPage();
    if(signal){signal.addEventListener('abort',()=>page.close().catch(()=>{}),{once:true})}
    const response=await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:20000});
    const status=response?.status?.()||0;if(status===401||status===403)return null;
    await page.waitForLoadState('networkidle',{timeout:3500}).catch(()=>{});
    await page.waitForFunction(()=>/\b(?:SIZE|FILE SIZE|APK SIZE)\b/i.test(document.body?.innerText||''),null,{timeout:3500}).catch(()=>{});
    await page.waitForTimeout(600);
    const html=await page.content();
    if(/(?:cf-turnstile|cf-chl-|checking your browser|just a moment|verify you are human)/i.test(html))return null;
    const bodyText=await page.locator('body').innerText().catch(()=> '');
    return {html,bodyText,status,url:page.url()};
  }catch{return null}finally{try{await browser?.close()}catch{}}
}
async function renderedSizeInfo(pageUrl,{signal}={}){
  const snap=await renderedPageSnapshot(pageUrl,{signal});if(!snap)return null;
  try{
    const $=cheerio.load(snap.html),labels=labelMap($),objects=jsonLdObjects($),app=pickSoftwareJsonLd(objects,null);
    const info=extractSizeInfo($,app,labels,snap.bodyText,snap.html);
    if(info?.bytes)return {...info,source:'source:rendered-page'};
    for(const packageUrl of explicitPackageUrls($,snap.url||pageUrl)){
      const bytes=await remote.probeRemoteFileSize(packageUrl,{signal});
      if(bytes)return {raw:String(bytes)+' bytes',bytes,source:'source:rendered-package-headers'};
    }
  }catch{}
  return null;
}
function extractHistoricalVersions($,pageUrl,currentVersion){return history.extractHistory($,pageUrl,currentVersion)}

function srcsetFirst(value) {
  const raw=String(value||'').trim();
  if(!raw)return null;
  const items=raw.split(',').map(x=>x.trim()).filter(Boolean).map(x=>x.split(/\s+/)[0]).filter(Boolean);
  return items.length?items[items.length-1]:null;
}
function cssBackgroundUrl(value) {
  const m=String(value||'').match(/url\((?:["']?)([^)"']+)(?:["']?)\)/i);
  return m?m[1]:null;
}
function elementImageValues($, el) {
  const node=$(el);const values=[];
  const add=v=>{v=String(v||'').trim();if(v&&!values.includes(v))values.push(v)};
  ['data-src','data-lazy-src','data-original','data-url','data-image','data-bg','data-background','src','content'].forEach(a=>add(node.attr(a)));
  add(srcsetFirst(node.attr('data-srcset')));add(srcsetFirst(node.attr('srcset')));add(cssBackgroundUrl(node.attr('style')));
  if((el?.tagName||'').toLowerCase()==='picture')node.find('source,img').each((_,child)=>elementImageValues($,child).forEach(add));
  return values;
}
function normalizedImageValues($, elements, pageUrl) {
  const out=[];const seen=new Set();
  elements.each((_,el)=>{for(const raw of elementImageValues($,el)){const url=normalizeMetadataUrl(raw,pageUrl);if(!url||seen.has(url))continue;let path='';try{path=new URL(url).pathname.toLowerCase()}catch{}if(/\.(?:svg|ico)(?:$|\?)/i.test(path))continue;seen.add(url);out.push(url)}});
  return out;
}
function sameImage(a,b){
  if(!a||!b)return false;
  try{const x=new URL(a),y=new URL(b);return x.origin===y.origin&&x.pathname===y.pathname}catch{return a===b}
}
function screenshotUrls($, app, pageUrl) {
  const values=[];const seen=new Set();
  const push=value=>{const url=normalizeMetadataUrl(value,pageUrl);if(!url||seen.has(url))return;let path='';try{path=new URL(url).pathname.toLowerCase()}catch{}if(/\.(?:svg|ico)(?:$|\?)/i.test(path))return;seen.add(url);values.push(url)};
  const raw=app?.screenshot||app?.screenshots||null;
  if(Array.isArray(raw))raw.forEach(v=>push(typeof v==='string'?v:v?.url||v?.contentUrl));else if(raw)push(typeof raw==='string'?raw:raw?.url||raw?.contentUrl);
  const selectors='[class*="screenshot"] img,[class*="screenshot"] source,[class*="screenshots"] img,[class*="screenshots"] source,[class*="gallery"] img,[class*="gallery"] source,[class*="slider"] img,[class*="slider"] source,[id*="screenshot"] img,[data-gallery] img';
  normalizedImageValues($,$(selectors),pageUrl).forEach(push);
  $('h2,h3,h4').filter((_,el)=>/screenshots?|images?|gallery/i.test(cleanText($(el).text()))).each((_,heading)=>{
    let node=$(heading).next();let hops=0;
    while(node.length&&hops++<6&&!/^H[1-4]$/i.test(node[0]?.tagName||'')){
      normalizedImageValues($,node.find('img,source,picture').addBack('img,source,picture'),pageUrl).forEach(push);node=node.next();
    }
  });
  return values.slice(0,24);
}

function appIconUrl($, app, pageUrl) {
  const selectors='.app-icon img,.app-icon source,.apk-icon img,.apk-icon source,.icon-app img,.post-icon img,[class*="app-icon"] img,[class*="apk-icon"] img,[class*="app-logo"] img,[class*="apk-logo"] img,img[itemprop="image"]';
  const candidates=normalizedImageValues($,$(selectors),pageUrl);
  for(const url of candidates)return url;
  const raw=app?.image;
  for(const v of (Array.isArray(raw)?raw:[raw])){const url=normalizeMetadataUrl(typeof v==='string'?v:v?.url||v?.contentUrl,pageUrl);if(url)return url}
  return null;
}

function categorySlug(value) {
  return cleanText(value).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,160) || 'other';
}
function sourceSection(pageUrl, app, category, crumbs=[]) {
  let path='';
  try{path=new URL(pageUrl).pathname.toLowerCase()}catch{}
  const type=String(app?.['@type']||'').toLowerCase();
  const context=[category,...crumbs].join(' ').toLowerCase();
  if(/\/(?:game|games)(?:\/|$)/.test(path)||/videogame|\bgame\b/.test(type)||/\bgames?\b/.test(context))return 'games';
  return 'apps';
}
function categoryContext($, app, labels, pageUrl) {
  const crumbs=[];const links=[];const seen=new Set();
  $('.breadcrumb a,.breadcrumbs a,[class*="breadcrumb"] a,nav[aria-label="breadcrumb"] a,nav[aria-label="Breadcrumb"] a').each((_,el)=>{
    const name=cleanText($(el).text()),url=normalizeSourceUrl($(el).attr('href'));if(!name||!url||seen.has(url))return;seen.add(url);crumbs.push(name);links.push({name,url});
  });
  const fallback=cleanText(app?.applicationCategory||firstLabel(labels,['category','genre']))||null;
  const ignored=/^(home|apps?|games?|latest|updated|popular|trending|download|mod apk)$/i;
  let chosen=null;for(const link of links){if(!ignored.test(link.name)&&!isLikelyAppUrl(link.url))chosen=link}
  const name=cleanText(chosen?.name||fallback)||'Other';const url=chosen?.url||null;
  const section=sourceSection(pageUrl,app,name,crumbs);
  return {name:name.slice(0,120),slug:categorySlug(url?slugFromUrl(url):name),url,section,parentSlug:section,breadcrumbs:crumbs.slice(0,12)};
}
function coverImageUrl($, app, pageUrl, iconUrl, screenshots=[]) {
  const candidates=[];const seen=new Set();
  const add=(url,score=0)=>{url=normalizeMetadataUrl(url,pageUrl);if(!url||sameImage(url,iconUrl)||screenshots.some(x=>sameImage(url,x)))return;if(seen.has(url))return;seen.add(url);candidates.push({url,score})};
  const groups=[
    ['.cover img,.cover source,.cover picture,.cover-image img,.app-cover img,.apk-cover img,[class*="cover"] img,[class*="cover"] source,[class*="banner"] img,[class*="hero"] img',100],
    ['.post-thumbnail img,.featured-image img,[class*="featured"] img,[class*="thumbnail"] img',80],
    ['meta[property="og:image"],meta[name="twitter:image"],meta[property="twitter:image"]',65]
  ];
  for(const [selector,score] of groups)$(selector).each((_,el)=>elementImageValues($,el).forEach(v=>add(v,score)));
  $('[style*="background-image"],[data-bg],[data-background]').each((_,el)=>elementImageValues($,el).forEach(v=>add(v,90)));
  const raw=app?.image;for(const v of (Array.isArray(raw)?raw:[raw]))if(v)add(typeof v==='string'?v:v?.contentUrl||v?.url,55);
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]?.url||null;
}
function ratingCountFrom(app, labels) {
  return parseCount(app?.aggregateRating?.ratingCount || app?.aggregateRating?.reviewCount || firstLabel(labels,['rating count','ratings','reviews','review count']));
}
function scoreFromDetails(details) {
  const downloads=Math.max(0,Number(details.downloadCount||0));
  const ratings=Math.max(0,Number(details.ratingCount||0));
  const rating=Math.max(0,Math.min(5,Number(details.ratingValue||0)));
  const updated=details.updatedDate?new Date(`${details.updatedDate}T00:00:00Z`).getTime():0;
  const ageDays=updated&&Number.isFinite(updated)?Math.max(0,(Date.now()-updated)/86400000):3650;
  const recency=Math.max(0,30-Math.min(30,ageDays));
  const popularity=Math.log10(downloads+1)*32 + Math.log10(ratings+1)*12 + rating*8 + recency*0.4;
  const trending=Math.log10(downloads+1)*10 + Math.log10(ratings+1)*7 + rating*6 + Math.max(0,45-Math.min(45,ageDays))*2;
  return {popularity:Math.round(popularity*100)/100,trending:Math.round(trending*100)/100};
}

function playStoreUrl($, app, labels, sourcePackageId, pageUrl) {
  const candidates=[];
  const add=value=>{if(value)candidates.push(value)};
  const same=app?.sameAs;
  if(Array.isArray(same))same.forEach(add);else add(same);
  add(app?.url);
  add(firstLabel(labels,['google play','play store','google play store','original app','original version']));
  // Only inspect the app's own information container. Generic page links
  // frequently belong to advertisements or unrelated recommendations.
  $('.app-stats a[href*="play.google.com/store/apps/details"],.apk-info a[href*="play.google.com/store/apps/details"],.app-info a[href*="play.google.com/store/apps/details"],[itemprop="downloadUrl"][href*="play.google.com/store/apps/details"]').each((_,el)=>add($(el).attr('href')));
  if(sourcePackageId){
    $('a[href*="play.google.com/store/apps/details"]').each((_,el)=>add($(el).attr('href')));
  }
  for(const value of candidates){
    const url=normalizeMetadataUrl(value,pageUrl);if(!url)continue;
    try{
      const u=new URL(url),id=u.searchParams.get('id');
      if(u.hostname==='play.google.com'&&u.pathname==='/store/apps/details'&&id&&(!sourcePackageId||sourcePackageId===id))return u.toString();
    }catch{}
  }
  return null;
}

function downloadPageUrl($, pageUrl) {
  const candidates = [];
  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href');
    const text = cleanText($(el).text());
    const url = normalizeSourceUrl(raw);
    if (!url) return;
    try {
      const u = new URL(url);
      if (/^\/download\//i.test(u.pathname) && (/(?:download|apk|xapk|apks|get)/i.test(text) || /\/download\//i.test(u.pathname))) {
        candidates.push({ url: u.toString(), score: /download\s+(?:apk|xapk|apks)/i.test(text) ? 3 : /download/i.test(text) ? 2 : 1 });
      }
    } catch {}
  });
  candidates.sort((a,b)=>b.score-a.score || a.url.length-b.url.length);
  return candidates[0]?.url || null;
}

function apkTypeLabel({ title, modInfo, price, labels, pageText }) {
  const labelText=cleanText(firstLabel(labels,['mod info','mod features','features','type','apk type','mod'])||'');
  const text=[title,modInfo,labelText,pageText.slice(0,5000)].filter(Boolean).join(' | ');
  const out=[];
  const add=v=>{ if(v&&!out.some(x=>x.toLowerCase()===v.toLowerCase()))out.push(v); };
  if(/pre[- ]?activated/i.test(text))add('Pre-Activated');
  if(/unlimited\s+(?:money|coins?|gems?|currency|cash)/i.test(text))add((text.match(/unlimited\s+(?:money|coins?|gems?|currency|cash)/i)||['Unlimited'])[0].replace(/\b\w/g,c=>c.toUpperCase()));
  if(/premium\s+unlocked/i.test(text))add('Premium Unlocked');
  else if(/pro\s+unlocked/i.test(text))add('Pro Unlocked');
  else if(/(?:all\s+features?|features?)\s+unlocked|unlocked\s+(?:apk|features?)/i.test(text))add('Unlocked APK');
  if(/\bmod(?:ded)?\s*apk\b/i.test(text) || /\bmod\b/i.test(modInfo||''))add('MOD APK');
  if(/\bpaid\b/i.test(text) && !out.length)add('Paid');
  const numericPrice=Number(price);
  if((String(price||'').trim()==='0'||numericPrice===0||/\bfree\b/i.test(text))&&!out.length)add('Free');
  if(!out.length)add(modInfo?cleanText(modInfo).slice(0,120):'APK');
  return out.slice(0,4).join(' · ');
}
function externalWebsite($, labels, app, pageUrl) {
  const candidates = [
    app?.author?.url, app?.publisher?.url,
    firstLabel(labels,['official website','website','developer website','homepage'])
  ];
  $('a[href]').each((_,el)=>{
    const text=cleanText($(el).text());
    if (/^(?:official\s+)?(?:website|homepage|developer website)$/i.test(text)) candidates.push($(el).attr('href'));
  });
  for (const value of candidates) {
    const url=normalizeMetadataUrl(value,pageUrl);
    if (!url) continue;
    try { if (!/(^|\.)liteapks\.com$/i.test(new URL(url).hostname)) return url; } catch {}
  }
  return null;
}

async function parseAppPage(html, pageUrl) {
  const sourcePageUrl=normalizeSourceUrl(pageUrl);
  if(!sourcePageUrl)throw new Error('LiteAPKs page URL is invalid.');
  const $=cheerio.load(String(html||''));
  const labels=labelMap($);
  const objects=jsonLdObjects($);
  let sourcePackageId=cleanText(firstLabel(labels,['package name','package id','package'])||'')||null;
  const app=pickSoftwareJsonLd(objects,sourcePackageId);
  if(!sourcePackageId){const identifier=fields.personName(app.identifier)||fields.personName(app.packageName);if(/^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)+$/i.test(identifier||''))sourcePackageId=identifier;}
  if(!/^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)+$/i.test(sourcePackageId||''))sourcePackageId=null;
  const pageText=cleanText($('body').text());
  const title=stripTitleNoise(fields.validValue(app.name)||firstLabel(labels,['app name','application name','game name'])||metadataContent($,['h1','meta[property="og:title"]','meta[name="twitter:title"]','title']));
  const sourceContent=sourceContentData($,title,app);
  const fallbackDescription=cleanText(app.description || sourceContent.metaDescription || metadataContent($,['meta[name="description"]','meta[property="og:description"]','.description','.entry-content p']));
  const description=cleanText(sourceContent.descriptionSectionText || sourceContent.sourceContentText || fallbackDescription);
  const version=normalizeVersion(firstLabel(labels,['version','latest version','current version'])||app.softwareVersion||app.version||(pageText.match(/\bVersion\s*[:：]?\s*v?([0-9][0-9A-Za-z._+-]{0,40})/i)||[])[1]);
  const updated=extractUpdatedRaw($,app,labels,pageText);
  const headerDeveloper=metadataContent($,['.app-hero [class*="developer"]','.app-hero a[href*="/developer/"]','.app-header [class*="developer"]','.app-header a[href*="/developer/"]','[itemprop="author"] [itemprop="name"]','[itemprop="author"] a']);
  // Do not guess a developer from arbitrary elements surrounding <h1>.
  // Current LiteAPKs pages expose it in the labeled stats row or explicit hero metadata.
  const heroDeveloper=null;
  const developer=firstLabel(labels,['developer','publisher','author'])||fields.personName(app.developer)||fields.personName(app.author)||fields.personName(app.creator)||fields.personName(app.publisher)||headerDeveloper||heroDeveloper;
  const categoryInfo=categoryContext($,app,labels,sourcePageUrl);
  const category=categoryInfo.name;
  const sizeInfo=extractSizeInfo($,app,labels,pageText,html);
  const sizeRaw=sizeInfo.raw;
  const androidRaw=cleanText(app.operatingSystem||firstLabel(labels,['requires android','android','minimum android','min android']));
  const architecture=cleanText(firstLabel(labels,['architecture','cpu architecture','supported abi','abi']))||null;
  const modInfo=cleanText(firstLabel(labels,['mod info','mod features'])||sourceContent.modInfoText||'').slice(0,255)||null;
  if(!sourceContent.modInfoText&&modInfo)sourceContent.modInfoText=modInfo;
  if(modInfo&&(!sourceContent.sourceContentText||!normalizeSourceText(sourceContent.sourceContentText).includes(normalizeSourceText(modInfo)))){
    sourceContent.sourceContentText=[sourceContent.descriptionSectionText,`Mod Info\n\n${modInfo}`].filter(Boolean).join('\n\n').trim()||null;
  }
  const price=cleanText(app.offers?.price??firstLabel(labels,['price']))||null;
  const ratingValue=parseRating(app.aggregateRating?.ratingValue||firstLabel(labels,['rating','user rating'])||(pageText.match(/(?:rating|rated)\s*[:：]?\s*([0-5](?:\.\d{1,2})?)(?:\s*\/\s*5|\s*★)?/i)||[])[1]);
  const iconUrl=appIconUrl($,app,sourcePageUrl);
  const screenshots=screenshotUrls($,app,sourcePageUrl).filter(u=>u!==iconUrl);
  const coverImage=coverImageUrl($,app,sourcePageUrl,iconUrl,screenshots);
  const officialUrl=externalWebsite($,labels,app,sourcePageUrl);
  const playStore=playStoreUrl($,app,labels,sourcePackageId,sourcePageUrl);
  const downloadPage=downloadPageUrl($,sourcePageUrl);
  const apkType=apkTypeLabel({title,modInfo,price,labels,pageText});
  const licenseName=cleanText(firstLabel(labels,['license','licence']))||null;
  const language=cleanText(firstLabel(labels,['language','languages']))||null;
  const interactionStats=Array.isArray(app.interactionStatistic)?app.interactionStatistic:[app.interactionStatistic];
  const downloadStat=interactionStats.find(s=>/DownloadAction/i.test(String(s?.interactionType?.['@type']||s?.interactionType||'')));
  const viewStat=interactionStats.find(s=>/ViewAction/i.test(String(s?.interactionType?.['@type']||s?.interactionType||'')));
  const downloadLabel=firstLabel(labels,['downloads','download count']);
  const viewLabel=firstLabel(labels,['views','view count','reached'])||((pageText.match(/(?:REACHED|VIEWS?)\s+([0-9.,]+\s*(?:K|M|B)?\s*\+?)/i)||[])[1]);
  const viewCount=parseCount(viewLabel)??fields.structuredCount(viewStat);
  // LiteAPKs currently exposes a REACHED/views counter on many detail pages
  // instead of a separate download counter. Use that source counter as the
  // download/popularity count only when no explicit download count exists.
  const downloadCount=parseCount(downloadLabel)??fields.structuredCount(app.downloadCount??app.numDownloads??downloadStat)??viewCount;
  const ratingCount=ratingCountFrom(app,labels);
  const slug=slugFromUrl(sourcePageUrl);
  const structuredType=String(app['@type']||'');
  const validPackage=/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i.test(sourcePackageId||'');
  const looksLike=Boolean(title&&(validPackage||/^(?:SoftwareApplication|MobileApplication|VideoGame|GameApplication)$/i.test(structuredType)||(version&&downloadPage&&(iconUrl||screenshots.length))||(version&&developer&&(sizeRaw||androidRaw))));
  const apkFormat=/\bXAPK\b/i.test(pageText)?'XAPK':'APK';
  const tags=[];if(modInfo)tags.push('MOD');if(category)tags.push(category);
  const scores=scoreFromDetails({downloadCount,ratingCount,ratingValue,updatedDate:updated.value});
  const historyData=extractHistoricalVersions($,sourcePageUrl,version);
  const missingFields=[['developer',developer],['version',version],['size',parseBytes(sizeRaw)],['updated',updated.value],['downloads',downloadCount]].filter(([,value])=>value==null||value==='').map(([key])=>key);
  const fieldSources={developer:developer?'source-page':null,version:version?'source-page':null,size:sizeInfo.bytes?sizeInfo.source:null,updated:updated.source,downloads:downloadCount!=null?'source-page':null,views:viewCount!=null?'source-page':null};
  const result={
    looksLikeAppPage:looksLike,missingFields,fieldSources,internalPackageId:`liteapks:${slug}`,sourceSlug:slug,sourceType:SOURCE_TYPE,platformKey:PLATFORM_KEY,sourcePageUrl,
    sourcePackageId:sourcePackageId?.slice(0,255)||null,name:title||slug||'Android app',developer:developer?.slice(0,255)||null,
    category:category?.slice(0,120)||'Other',sourceSection:categoryInfo.section,categorySlug:categoryInfo.slug,categoryUrl:categoryInfo.url,
    version,description:description?.slice(0,65535)||null,metaTitle:sourceContent.metaTitle?.slice(0,1000)||null,metaDescription:sourceContent.metaDescription?.slice(0,5000)||null,
    sourceContentText:sourceContent.sourceContentText||null,descriptionSectionText:sourceContent.descriptionSectionText||null,modInfoText:sourceContent.modInfoText||null,updatedDate:updated.value,fileSizeBytes:sizeInfo.bytes,fileSizeLabel:sizeRaw||null,
    minimumOsVersion:androidRaw?.slice(0,255)||null,architecture:architecture?.slice(0,80)||null,apkFormat,iconUrl,coverImageUrl:coverImage,screenshots,
    officialUrl,licenseName,language,downloadCount,viewCount,modInfo,price,ratingValue,ratingCount,popularityScore:scores.popularity,trendingScore:scores.trending,
    apkType,playStoreUrl:playStore,downloadPageUrl:downloadPage,tags,oldVersions:historyData.versions,historyPageUrl:historyData.historyPageUrl,
    metadata:{
      source:'LiteAPKs',fieldSources,missingFields,sourcePageUrl,sourceSlug:slug,sourcePackageId:sourcePackageId||null,name:title||null,developer:developer||null,
      version:version||null,updated:updated.value,updatedDate:updated.value,updatedDateSource:updated.source,publishedDate:parseDate(app.datePublished),
      size:sizeRaw??null,fileSizeRaw:sizeRaw??null,fileSizeBytes:sizeInfo.bytes,fileSizeSource:sizeInfo.source||null,sizeCandidates:sizeInfo.candidates||[],requiresAndroid:androidRaw||null,
      metaTitle:sourceContent.metaTitle||null,metaDescription:sourceContent.metaDescription||null,sourceContentText:sourceContent.sourceContentText||null,descriptionSectionText:sourceContent.descriptionSectionText||null,modInfoText:sourceContent.modInfoText||null,
      architecture:architecture||null,apkFormat,modInfo:modInfo||null,apkType,price:price||null,ratingValue,ratingCount,
      sourceSection:categoryInfo.section,category:categoryInfo.name,categorySlug:categoryInfo.slug,categoryUrl:categoryInfo.url,breadcrumbs:categoryInfo.breadcrumbs,
      popularityScore:scores.popularity,trendingScore:scores.trending,iconUrl:iconUrl||null,coverImageUrl:coverImage||null,screenshots,
      playStoreUrl:playStore||null,downloadPageUrl:downloadPage||null,officialUrl:officialUrl||null,licenseName:licenseName||null,
      language:language||null,downloadCount,downloadCountLabel:parseCount(downloadLabel)!=null?downloadLabel:(downloadCount!=null&&viewLabel?viewLabel:null),viewCount,historyPageUrl:historyData.historyPageUrl,oldVersions:historyData.versions,labels:compactLabelObject(labels)
    }
  };
  return result;
}

function discoverLinks(html, pageUrl) {
  const $=cheerio.load(String(html||''));
  const apps=[]; const listings=[]; const seenA=new Set(); const seenL=new Set();
  $('a[href]').each((_,el)=>{
    const raw=$(el).attr('href'); const url=normalizeSourceUrl(raw);
    if(!url)return;
    if(isLikelyAppUrl(url)){
      if(!seenA.has(url)){seenA.add(url);apps.push(url)}
      return;
    }
    const u=new URL(url); const text=cleanText($(el).text()).toLowerCase();
    const path=u.pathname.toLowerCase();
    if(u.origin===BASE_URL && (/\/page\/\d+\/?$/.test(path) || /(?:next|older|more apps|latest|updated)/i.test(text))) {
      if(!seenL.has(url)){seenL.add(url);listings.push(url)}
    }
  });
  return {apps,listings};
}

async function fetchText(url,options={}) {
  const safe=normalizeSourceUrl(url);
  if(!safe)throw new source.SourceError('Only public LiteAPKs URLs are supported.',400,'INVALID_SOURCE_URL');
  return source.fetchText(safe,{...options,gapMs:config.apkResolverRequestGapMs});
}

function xmlLocations(xml) {
  const out=[]; const re=/<loc>\s*([^<]+?)\s*<\/loc>/gi; let m;
  while((m=re.exec(String(xml||'')))){
    const url=normalizeSourceUrl(m[1].replace(/&amp;/g,'&'));
    if(url)out.push(url);
  }
  return out;
}
function xmlEntries(xml) {
  const out=[];
  const text=String(xml||'');
  const blockRe=/<(?:url|sitemap)>[\s\S]*?<\/(?:url|sitemap)>/gi;
  let block;
  while((block=blockRe.exec(text))){
    const loc=(block[0].match(/<loc>\s*([^<]+?)\s*<\/loc>/i)||[])[1];
    const lastmod=(block[0].match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i)||[])[1]||null;
    const url=loc?normalizeSourceUrl(loc.replace(/&amp;/g,'&')):null;
    if(url)out.push({url,lastmod:lastmod?cleanText(lastmod):null});
  }
  return out;
}
function recentLastmod(value, days=3) {
  if(!value)return false;
  const ms=new Date(value).getTime();
  return Number.isFinite(ms) && ms >= Date.now()-(Math.max(1,days)*24*60*60*1000);
}
async function sitemapAppUrls(limit=DEFAULT_MAX_ITEMS,signal,exclude=new Set()) {
  const candidates=[`${BASE_URL}/sitemap.xml`,`${BASE_URL}/sitemap_index.xml`];
  const appUrls=[]; const visited=new Set(),seen=new Set();
  const add=url=>{if(isLikelyAppUrl(url)&&!exclude.has(url)&&!seen.has(url)){seen.add(url);appUrls.push(url)}};
  for(const root of candidates){
    try{
      const {text}=await fetchText(root,{accept:'application/xml,text/xml,text/plain,*/*',signal});
      const locs=xmlLocations(text);
      if(!locs.length)continue;
      const sitemapUrls=locs.filter(x=>/sitemap/i.test(new URL(x).pathname)).slice(0,60);
      const direct=locs.filter(isLikelyAppUrl);
      direct.forEach(add);
      for(const sm of sitemapUrls){
        if(visited.has(sm))continue;visited.add(sm);
        try{const r=await fetchText(sm,{accept:'application/xml,text/xml,text/plain,*/*',signal});xmlLocations(r.text).forEach(add);}catch(err){if(err.code==='SOURCE_STOPPED'||err.code==='SOURCE_ACCESS_DENIED'||err.code==='SOURCE_CHALLENGE'||['SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'].includes(err.code))throw err}
        if(appUrls.length>=limit)break;
      }
      if(appUrls.length)break;
    }catch(err){if(err.code==='SOURCE_STOPPED'||err.code==='SOURCE_ACCESS_DENIED'||err.code==='SOURCE_CHALLENGE'||['SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'].includes(err.code))throw err}
  }
  return [...new Set(appUrls)].slice(0,limit);
}

async function sitemapRecentlyModifiedAppUrls(limit=2000, days=3,signal) {
  const roots=[`${BASE_URL}/sitemap.xml`,`${BASE_URL}/sitemap_index.xml`];
  const found=[]; const seen=new Set();
  for(const root of roots){
    try{
      const {text}=await fetchText(root,{accept:'application/xml,text/xml,text/plain,*/*',signal});
      const entries=xmlEntries(text);
      if(!entries.length)continue;
      const direct=entries.filter(e=>isLikelyAppUrl(e.url)&&recentLastmod(e.lastmod,days));
      for(const e of direct){if(!seen.has(e.url)){seen.add(e.url);found.push(e.url)}}
      const childMaps=entries.filter(e=>/sitemap/i.test(new URL(e.url).pathname)).slice(0,80);
      for(const child of childMaps){
        if(found.length>=limit)break;
        // A recent sitemap lastmod is useful as a hint, but individual URL
        // lastmod values are still required before an app is queued.
        try{
          const r=await fetchText(child.url,{accept:'application/xml,text/xml,text/plain,*/*',signal});
          for(const e of xmlEntries(r.text)){
            if(isLikelyAppUrl(e.url)&&recentLastmod(e.lastmod,days)&&!seen.has(e.url)){
              seen.add(e.url);found.push(e.url);if(found.length>=limit)break;
            }
          }
        }catch(err){if(err.code==='SOURCE_STOPPED'||err.code==='SOURCE_ACCESS_DENIED'||err.code==='SOURCE_CHALLENGE'||['SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'].includes(err.code))throw err}
      }
      if(found.length)break;
    }catch(err){if(err.code==='SOURCE_STOPPED'||err.code==='SOURCE_ACCESS_DENIED'||err.code==='SOURCE_CHALLENGE'||['SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'].includes(err.code))throw err}
  }
  return found.slice(0,limit);
}

async function crawlListings(maxPages=DEFAULT_DAILY_PAGES,limit=DEFAULT_MAX_ITEMS,signal,exclude=new Set()) {
  const queue=[BASE_URL]; const visited=new Set(); const apps=[]; const appSeen=new Set();
  while(queue.length && visited.size<maxPages && apps.length<limit){
    if(signal?.aborted)throw new source.SourceError('Request stopped.',499,'SOURCE_STOPPED');
    const url=queue.shift();if(visited.has(url))continue;visited.add(url);
    try{
      const {text, url:finalUrl}=await fetchText(url,{signal});
      const d=discoverLinks(text,finalUrl);
      for(const a of d.apps){if(!exclude.has(a)&&!appSeen.has(a)){appSeen.add(a);apps.push(a);if(apps.length>=limit)break}}
      for(const n of d.listings){if(!visited.has(n)&&queue.length<maxPages*2)queue.push(n)}
    }catch(err){if(visited.size===1||['SOURCE_STOPPED','SOURCE_ACCESS_DENIED','SOURCE_CHALLENGE','SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'].includes(err.code))throw err}
  }
  return apps;
}

// Read a source-linked download/details page only when the primary page is
// missing facts. This is a normal public metadata request, not a direct APK
// resolver or an access-control bypass. Version-specific facts must match.
async function enrichMissingSourceFields(details,{signal}={}) {
  const missing=details.missingFields||[];
  const index=source.sourceUrl(details.downloadPageUrl);
  if(!index||!missing.length||source.sourceUrl(details.sourcePageUrl)===index)return details;
  try{
    const response=await fetchText(index,{signal});
    const $=cheerio.load(response.text),labels=labelMap($);
    const pageText=cleanText($('body').text());
    const app=pickSoftwareJsonLd(jsonLdObjects($),details.sourcePackageId);
    const secondaryVersion=normalizeVersion(firstLabel(labels,['version'])||app.softwareVersion||app.version);
    const compatibleVersion=!secondaryVersion||secondaryVersion===details.version;
    const developer=firstLabel(labels,['developer','publisher','author'])||fields.personName(app.developer)||fields.personName(app.author)||fields.personName(app.publisher);
    const sizeInfo=extractSizeInfo($,app,labels,pageText,response.text);
    const sizeRaw=sizeInfo.raw;
    const updated=extractUpdatedRaw($,app,labels,cleanText($('body').text()));
    const explicitDownloads=parseCount(firstLabel(labels,['downloads','download count']))??fields.structuredCount(app.downloadCount??app.numDownloads);
    const views=parseCount(firstLabel(labels,['views','reached']))??null;
    const downloads=explicitDownloads??views;
    const apply=(key,value,metaKey=key)=>{
      if(value==null||value==='')return;
      if(details[key]!=null&&details[key]!=='')return;
      details[key]=value;details.metadata[metaKey]=value;
      details.fieldSources[key==='fileSizeBytes'?'size':key==='updatedDate'?'updated':key]='source:download-details';
    };
    apply('developer',developer);
    if(compatibleVersion){
      if(sizeInfo.bytes){apply('fileSizeBytes',sizeInfo.bytes);if(!details.metadata.size)details.metadata.size=sizeRaw;details.fieldSources.size=sizeInfo.source||'source:download-details';}
      apply('updatedDate',updated.value);
      if(updated.value&&!details.metadata.updated){details.metadata.updated=updated.value;details.metadata.updatedDateSource='source:download-details';}
    }
    apply('downloadCount',downloads);apply('viewCount',views);
    if(compatibleVersion&&!details.fileSizeBytes){
      for(const packageUrl of explicitPackageUrls($,response.url)){
        const bytes=await remote.probeRemoteFileSize(packageUrl,{signal});
        if(bytes){apply('fileSizeBytes',bytes);details.metadata.size=bytes;details.fieldSources.size='source:package-headers';break}
      }
    }
    if(compatibleVersion&&!details.fileSizeBytes){
      const rendered=await renderedSizeInfo(response.url,{signal});
      if(rendered?.bytes){apply('fileSizeBytes',rendered.bytes);details.metadata.size=rendered.raw||rendered.bytes;details.fieldSources.size='source:rendered-download-page';}
    }
    details.missingFields=metadataMissingFields(details);
    details.metadata.missingFields=details.missingFields;
    details.metadata.fieldSources=details.fieldSources;
  }catch(err){
    if(signal?.aborted||err.code==='SOURCE_STOPPED')throw err;
    details.metadata.enrichmentWarning=String(err.message||err).slice(0,300);
  }
  return details;
}
function metadataMissingFields(d) {
  const checks={name:d.metadata?.name||d.name,developer:d.developer,version:d.version,size:d.fileSizeBytes,updated:d.updatedDate,downloads:d.downloadCount};
  return Object.entries(checks).filter(([key,v])=>v==null||v===''||key==='size'&&!(Number(v)>0)).map(([key])=>key);
}
function requiredMissingFields(d){return metadataMissingFields(d).filter(k=>k!=='downloads')}

async function fetchPackageDetails(pageUrl,{signal}={}) {
  const {text,url}=await fetchText(pageUrl,{signal});
  const d=await parseAppPage(text,url);
  if(!d.looksLikeAppPage)throw new Error('LiteAPKs did not return a recognizable app detail page.');
  await enrichMissingSourceFields(d,{signal});
  // V2.4: when the ordinary HTTP response omits client-rendered source facts,
  // parse one normal Chromium rendering of the exact same public app page.
  // This repairs both the visible SIZE stat and the article/meta content path.
  if(!d.fileSizeBytes||!d.metaTitle||!d.metaDescription||!d.sourceContentText){
    const snapshot=await renderedPageSnapshot(d.sourcePageUrl,{signal});
    if(snapshot?.html){
      try{
        const renderedDetails=await parseAppPage(snapshot.html,snapshot.url||d.sourcePageUrl);
        if(!d.fileSizeBytes&&renderedDetails.fileSizeBytes){
          d.fileSizeBytes=renderedDetails.fileSizeBytes;d.fileSizeLabel=renderedDetails.fileSizeLabel||renderedDetails.metadata?.size||null;
          d.metadata.fileSizeBytes=renderedDetails.fileSizeBytes;d.metadata.size=d.fileSizeLabel||renderedDetails.fileSizeBytes;d.metadata.fileSizeRaw=d.fileSizeLabel||null;
          d.metadata.fileSizeSource='source:rendered-app-page';d.fieldSources.size='source:rendered-app-page';
        }
        for(const key of ['metaTitle','metaDescription','sourceContentText','descriptionSectionText','modInfoText']){
          if(!d[key]&&renderedDetails[key])d[key]=renderedDetails[key];
          if(!d.metadata[key]&&renderedDetails.metadata?.[key])d.metadata[key]=renderedDetails.metadata[key];
        }
        if((!d.description||d.description.length<80)&&renderedDetails.description)d.description=renderedDetails.description;
      }catch{}
    }
  }
  if(!d.fileSizeBytes){
    const rendered=await renderedSizeInfo(d.sourcePageUrl,{signal});
    if(rendered?.bytes){d.fileSizeBytes=rendered.bytes;d.fileSizeLabel=rendered.raw||null;d.metadata.fileSizeBytes=rendered.bytes;d.metadata.size=rendered.raw||rendered.bytes;d.metadata.fileSizeRaw=rendered.raw||null;d.metadata.fileSizeSource=rendered.source;d.fieldSources.size=rendered.source;d.metadata.fieldSources=d.fieldSources;}
  }
  d.missingFields=metadataMissingFields(d);d.metadata.missingFields=d.missingFields;d.metadata.fieldSources=d.fieldSources;
  // Follow only an actual history/index link exposed by the app page. This
  // is a bounded metadata request, not an APK download or a guessed URL.
  const index=history.safeVersionUrl(d.historyPageUrl,url);
  if(index&&!history.samePage(index,url)){
    try{
      const response=await fetchText(index,{signal});
      const parsed=history.extractHistory(cheerio.load(response.text),response.url,d.version);
      const combined=new Map();
      for(const v of [...parsed.versions,...d.oldVersions])if(v.version&&v.sourcePageUrl&&!combined.has(v.version.toLowerCase()))combined.set(v.version.toLowerCase(),v);
      d.oldVersions=[...combined.values()].slice(0,25);
      d.historyPageUrl=response.url;
      d.metadata.historyPageUrl=response.url;
      d.metadata.oldVersions=d.oldVersions;
    }catch(err){
      if(signal?.aborted||err.code==='SOURCE_STOPPED')throw err;
      // A temporarily unavailable history page must not erase or block the
      // otherwise valid app metadata. Its index link remains available.
      d.metadata.historyError=String(err.message||err).slice(0,300);
    }
  }
  return d;
}

async function getSyncState() {
  const [rows] = await getPool().query('SELECT * FROM apk_sync_state WHERE sync_key=? LIMIT 1', [SYNC_KEY]);
  return rows[0] || {sync_key:SYNC_KEY,status:'idle',mode:'daily',queue_json:'[]',total_count:0,requested_count:0,processed_count:0,inserted_count:0,updated_count:0,failed_count:0,last_error:null,last_started_at:null,last_completed_at:null,next_sync_at:null};
}

async function ensureStateRow() {
  await getPool().query(`INSERT INTO apk_sync_state (sync_key,status,mode,queue_json,next_sync_at)
    VALUES (?,'idle','daily','[]',NOW()) ON DUPLICATE KEY UPDATE sync_key=VALUES(sync_key)`, [SYNC_KEY]);
}

async function discoverForSync(mode='daily',requestedLimit=null,signal) {
  const configured=Math.max(1,Math.min(DEFAULT_MAX_ITEMS,Number(config.apkResolverMaxItems||DEFAULT_MAX_ITEMS)));
  const limit=requestedLimit==null?configured:Math.max(1,Math.min(configured,Number(requestedLimit)||1));
  let urls=[];const discoveryErrors=[];
  const tryDiscovery=async fn=>{try{return await fn()}catch(err){if(err.code==='SOURCE_STOPPED')throw err;discoveryErrors.push(err);return []}};
  if(mode==='full'){
    urls=await tryDiscovery(()=>sitemapAppUrls(limit,signal));
    if(!urls.length)urls=await tryDiscovery(()=>crawlListings(Math.max(10,Number(config.apkResolverFullPages||DEFAULT_FULL_PAGES)),limit,signal));
  }else if(mode==='new'){
    // Exclude saved URLs before applying the candidate limit. Otherwise a
    // library with many apps can exhaust a small batch on old sitemap URLs.
    const [rows]=await getPool().query('SELECT source_page_url FROM apps');
    const existing=new Set(rows.map(r=>normalizeSourceUrl(r.source_page_url)).filter(Boolean));
    const cap=Math.min(configured,Math.max(limit*10,100));
    // A blocked sitemap must not disable Auto Import when the public listing
    // pages are still reachable. Try the independent listing path as fallback.
    urls=await tryDiscovery(()=>sitemapAppUrls(cap,signal,existing));
    if(!urls.length)urls=await tryDiscovery(()=>crawlListings(Math.max(2,Number(config.apkResolverDailyPages||DEFAULT_DAILY_PAGES)),cap,signal,existing));
  }else{
    urls=await tryDiscovery(()=>sitemapRecentlyModifiedAppUrls(Math.min(limit,2000),3,signal));
    if(!urls.length)urls=await tryDiscovery(()=>crawlListings(Math.max(2,Number(config.apkResolverDailyPages||DEFAULT_DAILY_PAGES)),Math.min(limit,2000),signal));
  }
  if(!urls.length&&discoveryErrors.length)throw discoveryErrors[discoveryErrors.length-1];
  return [...new Set(urls)].slice(0,mode==='new'?Math.min(configured,Math.max(limit*10,100)):limit);
}
function importCap(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>50000)throw Object.assign(new Error('Enter a whole number from 1 to 50,000.'),{status:400});return n}
async function recoverSync(){
  if(recoveryDone||!state.dbReady)return;
  await ensureStateRow();
  await getPool().query("UPDATE apk_sync_state SET status='paused',last_error='Import was interrupted by a server restart. Start a new manual batch when ready.' WHERE sync_key=? AND status IN ('running','discovering')",[SYNC_KEY]);
  recoveryDone=true;
}
async function startSync({mode='new',requestedBy=null,force=false,limit=10}={}) {
  await ensureStateRow();await recoverSync();
  const db=getPool(),st=await getSyncState(),cap=importCap(limit);
  if(['running','discovering'].includes(st.status)||discoveryTask||workerBusy)throw Object.assign(new Error('An import is already in progress. Stop it before starting another.'),{status:409,code:'IMPORT_BUSY'});
  const chosen=['daily','full','new'].includes(mode)?mode:'new',runId=crypto.randomUUID();
  await db.query(`UPDATE apk_sync_state SET run_id=?,status='discovering',mode=?,queue_json='[]',total_count=0,requested_count=?,processed_count=0,inserted_count=0,updated_count=0,failed_count=0,incomplete_count=0,current_url=NULL,last_error=NULL,requested_by=?,completion_notified=0,last_started_at=NOW(),next_sync_at=NULL WHERE sync_key=?`,[runId,chosen,cap,requestedBy?Number(requestedBy):null,SYNC_KEY]);
  const controller=new AbortController();activeJobController=controller;
  const task=(async()=>{
    try{
      const urls=await discoverForSync(chosen,cap,controller.signal);
      if(controller.signal.aborted)return;
      await db.query("UPDATE apk_sync_state SET status=?,queue_json=?,total_count=?,last_error=NULL WHERE sync_key=? AND run_id=? AND status='discovering'",[urls.length?'running':'complete',JSON.stringify(urls),urls.length,SYNC_KEY,runId]);
      if(requestedBy)await activity.record(Number(requestedBy),'apk_sync_started',{details:{mode:chosen,total:urls.length}});
    }catch(err){
      if(err.code!=='SOURCE_STOPPED')await db.query("UPDATE apk_sync_state SET status='paused',last_error=?,next_sync_at=NULL WHERE sync_key=? AND run_id=? AND status='discovering'",[String(err.message||err).slice(0,1800),SYNC_KEY,runId]);
    }finally{if(activeJobController===controller)activeJobController=null;if(discoveryTask===task)discoveryTask=null}
  })();
  discoveryTask=task;
  return getSyncState();
}
async function stopSync() {
  await ensureStateRow();
  await getPool().query("UPDATE apk_sync_state SET status='stopped',current_url=NULL,next_sync_at=NULL WHERE sync_key=? AND status IN ('running','discovering','paused')",[SYNC_KEY]);
  activeJobController?.abort();
  return getSyncState();
}

async function syncMedia(appId,details,{db=null}={}) {
  const own=!db,conn=db||await getPool().getConnection();
  try{
    if(own)await conn.beginTransaction();
    const groups=[['icon',details.iconUrl?[details.iconUrl]:[]],['cover',details.coverImageUrl?[details.coverImageUrl]:[]],['screenshot',Array.isArray(details.screenshots)?details.screenshots.slice(0,24):[]]];
    for(const [type,urls] of groups){
      // A missing image is not permission to delete the old image.
      if(!urls.length)continue;
      await conn.query('DELETE FROM apk_media WHERE app_id=? AND media_type=?',[appId,type]);
      for(let i=0;i<urls.length;i++)await conn.query('INSERT INTO apk_media (app_id,media_type,remote_url,sort_order) VALUES (?,?,?,?)',[appId,type,urls[i],i]);
    }
    if(own)await conn.commit();
  }catch(err){if(own)await conn.rollback();throw err}finally{if(own)conn.release()}
}

async function upsertManaged(details,{autoAdd=true}={}) {
  if(!details?.looksLikeAppPage)throw new Error('The source page did not look like an Android app detail page.');
  if(!details.internalPackageId)throw new Error('The APK source did not provide a stable app identity.');
  if(!details.version||!(details.metadata?.name||details.name))throw Object.assign(new Error('The source did not provide a verified app name and version. No incomplete identity was imported.'),{status:422,code:'SOURCE_IDENTITY_INCOMPLETE'});
  const db=await getPool().getConnection();
  try{
  await db.beginTransaction();
  if(details.categoryUrl){
    const [[known]]=await db.query('SELECT section,name,slug FROM apk_categories WHERE source_url=? AND active=1 LIMIT 1',[details.categoryUrl]);
    if(known){details.sourceSection=known.section;details.category=known.name;details.categorySlug=known.slug;}
  }
  const [[existing]]=await db.query('SELECT * FROM apps WHERE package_id=? LIMIT 1 FOR UPDATE',[details.internalPackageId]);
  if(!existing&&!autoAdd)throw Object.assign(new Error('The existing APK record was not found; no new app was created.'),{status:404});
  let previous={};if(existing){try{previous=JSON.parse(existing.source_metadata_json||'{}')}catch{}}
  // V2.6: recover a size that the fresh scan already found under any supported
  // metadata key before the database/version merge can discard it.
  if(!parseBytes(details.fileSizeBytes)){
    for(const value of [details.fileSizeLabel,details.metadata?.fileSizeBytes,details.metadata?.fileSizeRaw,details.metadata?.size,details.metadata?.fileSize,details.metadata?.file_size,details.metadata?.apkSize,details.metadata?.appSize,details.metadata?.downloadSize,details.metadata?.packageSize]){
      const bytes=parseBytes(value);if(bytes){details.fileSizeBytes=bytes;details.metadata.fileSizeBytes=bytes;if(!details.metadata.size)details.metadata.size=value;break}
    }
  }
  // A partial source response must not erase already imported media or metadata.
  const merged={...previous,...details.metadata};
  const freshContentKeys=new Set(['sourceContentText','descriptionSectionText','modInfoText']);
  for(const [key,value] of Object.entries(details.metadata||{})){
    if((value==null||value===''||Array.isArray(value)&&!value.length)&&previous[key]!=null&&!freshContentKeys.has(key))merged[key]=previous[key];
  }
  for(const key of freshContentKeys)if(details.metadata?.[key]==null||details.metadata?.[key]==='')delete merged[key];
  const versionMap=new Map();
  for(const v of [...(Array.isArray(details.oldVersions)?details.oldVersions:[]),...(Array.isArray(previous.oldVersions)?previous.oldVersions:[])]){
    const url=history.safeVersionUrl(v?.sourcePageUrl);
    if(!v?.version||!url||history.samePage(url,details.sourcePageUrl)||history.isHistoryOnlyUrl(url)||v.version===details.version)continue;
    if(!versionMap.has(v.version.toLowerCase()))versionMap.set(v.version.toLowerCase(),{...v,sourcePageUrl:url});
  }
  if((previous.version||existing?.current_version)&&details.version&&details.version!==(previous.version||existing?.current_version)){
    if(!details.updatedDate){merged.updatedDate=null;merged.updated=null;merged.updatedDateSource=null;}
    if(!details.fileSizeBytes){merged.fileSizeBytes=null;merged.size=null;}
  }
  details.oldVersions=[...versionMap.values()].slice(0,25);
  merged.oldVersions=details.oldVersions;
  merged.historyPageUrl=history.safeVersionUrl(details.historyPageUrl)||history.safeVersionUrl(previous.historyPageUrl)||null;
  details.metadata=merged;
  const previousSourceVersion=existing?.current_version||previous.version||null;
  const versionChanged=Boolean(previousSourceVersion&&details.version&&details.version!==previousSourceVersion);
  for(const key of ['name','iconUrl','coverImageUrl','screenshots','playStoreUrl','description','developer','category','categorySlug','categoryUrl','sourcePackageId','version','updatedDate','fileSizeBytes','minimumOsVersion','architecture','language','licenseName','downloadCount','ratingValue','ratingCount','modInfo']){
    if(details[key]==null||details[key]===''||Array.isArray(details[key])&&!details[key].length){
      if(versionChanged&&['fileSizeBytes','updatedDate'].includes(key))continue;
      const old={name:existing?.name,iconUrl:previous.iconUrl,coverImageUrl:previous.coverImageUrl,screenshots:previous.screenshots,playStoreUrl:previous.playStoreUrl,description:existing?.description,developer:existing?.developer,category:existing?.category,categorySlug:existing?.category_slug,categoryUrl:existing?.category_url,sourcePackageId:existing?.source_package_id,version:existing?.current_version,updatedDate:existing?.source_updated_at,fileSizeBytes:existing?.file_size_bytes,minimumOsVersion:existing?.minimum_os_version,architecture:existing?.architecture,language:existing?.language,licenseName:existing?.license_name,downloadCount:existing?.download_count,ratingValue:existing?.rating_value,ratingCount:existing?.rating_count,modInfo:existing?.mod_info};
      if(old[key]!=null&&old[key]!=='')details[key]=old[key];
    }
  }
  for(const [key,value] of Object.entries({name:details.name,developer:details.developer,version:details.version,
    updatedDate:details.updatedDate,fileSizeBytes:details.fileSizeBytes,downloadCount:details.downloadCount,
    category:details.category,sourcePackageId:details.sourcePackageId,description:details.description})){
    if(value!=null&&value!=='')merged[key]=value;
  }
  if(details.updatedDate)merged.updated=details.updatedDate;
  if(details.fileSizeBytes&&(!merged.size||!parseBytes(merged.size)))merged.size=details.fileSizeBytes;
  details.metadata=merged;
  const missing=metadataMissingFields(details);
  const requiredMissing=requiredMissingFields(details);
  const metadataStatus=requiredMissing.length?'pending':'ready';
  const metadataError=requiredMissing.length?'Source metadata needs: '+requiredMissing.join(', '):null;
  merged.missingFields=missing;
  merged.fieldSources={...(previous.fieldSources||{}),...(details.fieldSources||{})};
  details.missingFields=missing;
  details.fieldSources=merged.fieldSources;

  // Never let a partial parser response replace a verified category hierarchy.
  if(existing?.category_slug&&existing?.category_url&&!details.categoryUrl){details.category=existing.category;details.categorySlug=existing.category_slug;details.categoryUrl=existing.category_url;details.sourceSection=existing.source_section;}

  let available=false;
  if(existing&&details.version){
    try{available=!existing.current_version||compareVersions(details.version,existing.current_version)>0}catch{available=!existing.current_version||details.version!==existing.current_version}
  }
  await checkedQuery(db,`INSERT INTO apps
    (package_id,name,category,source_section,category_slug,category_url,rating_value,rating_count,mod_info,popularity_score,trending_score,developer,current_version,description,official_url,source_page_url,source_package_id,source_updated_at,source_metadata_json,apk_type,architecture,file_size_bytes,minimum_os_version,language,license_name,download_count,tags_json,published,workspace_added_at,latest_version,update_available,last_checked_at,update_error,metadata_status,metadata_revision,metadata_error,metadata_updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,NOW(),?,?,NOW(),NULL,?,1,?,NOW())
    ON DUPLICATE KEY UPDATE
      name=VALUES(name),category=COALESCE(VALUES(category),category),source_section=COALESCE(VALUES(source_section),source_section),category_slug=COALESCE(VALUES(category_slug),category_slug),category_url=COALESCE(VALUES(category_url),category_url),
      rating_value=COALESCE(VALUES(rating_value),rating_value),rating_count=COALESCE(VALUES(rating_count),rating_count),mod_info=COALESCE(VALUES(mod_info),mod_info),popularity_score=GREATEST(VALUES(popularity_score),0),trending_score=GREATEST(VALUES(trending_score),0),
      developer=COALESCE(VALUES(developer),developer),current_version=COALESCE(VALUES(current_version),current_version),description=COALESCE(VALUES(description),description),official_url=COALESCE(VALUES(official_url),official_url),source_page_url=VALUES(source_page_url),source_package_id=COALESCE(VALUES(source_package_id),source_package_id),source_updated_at=COALESCE(VALUES(source_updated_at),source_updated_at),
      source_metadata_json=VALUES(source_metadata_json),apk_type=COALESCE(VALUES(apk_type),apk_type),architecture=COALESCE(VALUES(architecture),architecture),file_size_bytes=COALESCE(VALUES(file_size_bytes),file_size_bytes),
      minimum_os_version=COALESCE(VALUES(minimum_os_version),minimum_os_version),language=COALESCE(VALUES(language),language),license_name=COALESCE(VALUES(license_name),license_name),download_count=COALESCE(VALUES(download_count),download_count),
      tags_json=VALUES(tags_json),latest_version=COALESCE(VALUES(latest_version),latest_version),update_available=GREATEST(VALUES(update_available),update_available),last_checked_at=NOW(),update_error=NULL,metadata_status=VALUES(metadata_status),metadata_error=VALUES(metadata_error),metadata_updated_at=NOW()`,
    [details.internalPackageId,details.name,details.category,details.sourceSection||'apps',details.categorySlug||categorySlug(details.category),details.categoryUrl||null,details.ratingValue,details.ratingCount,details.modInfo,details.popularityScore||0,details.trendingScore||0,details.developer,details.version,details.description,details.officialUrl,details.sourcePageUrl,details.sourcePackageId,details.updatedDate,JSON.stringify(details.metadata),details.apkType||details.apkFormat,details.architecture,details.fileSizeBytes,details.minimumOsVersion,details.language,details.licenseName,details.downloadCount,JSON.stringify(details.tags||[]),details.version||null,available?1:0,metadataStatus,metadataError]);
  // Keep a newly detected release from inheriting stale size/date values.
  // This is a separate parameterized UPDATE so MariaDB/MySQL never sees
  // placeholders inside ON DUPLICATE KEY expressions.
  if(versionChanged){
    await checkedQuery(db,'UPDATE apps SET source_updated_at=?,file_size_bytes=?,latest_version=current_version,update_available=? WHERE package_id=?',[details.updatedDate||null,details.fileSizeBytes||null,available?1:0,details.internalPackageId]);
  }
  const [[app]]=await db.query('SELECT * FROM apps WHERE package_id=? LIMIT 1',[details.internalPackageId]);
  if(!app)throw new Error('APK record could not be created.');
  await db.query(`INSERT INTO apk_categories (section,name,slug,source_url,parent_slug,last_seen_at,active)
    VALUES (?,?,?,?,?,NOW(),1) ON DUPLICATE KEY UPDATE name=IF(source_url IS NULL,VALUES(name),name),source_url=COALESCE(source_url,VALUES(source_url)),parent_slug=COALESCE(parent_slug,VALUES(parent_slug)),last_seen_at=NOW(),active=1`,
    [details.sourceSection||'apps',details.category||'Other',details.categorySlug||categorySlug(details.category),details.categoryUrl||null,details.sourceSection||'apps']);
  await db.query(`INSERT INTO apk_metadata (app_id,metadata_json) VALUES (?,?) ON DUPLICATE KEY UPDATE metadata_json=VALUES(metadata_json)`,[app.id,JSON.stringify(details.metadata)]);
  await db.query(`INSERT INTO publish_queue (app_id,status) VALUES (?,?) ON DUPLICATE KEY UPDATE status=IF(status='published','published',VALUES(status))`,[app.id,app.published?'published':'ready']);
  await syncMedia(app.id,details,{db});
  // Earlier builds assigned the current source URL to versions whose real
  // URLs were unknown. Clear only those false links, preserving the rows.
  const [savedLinks]=await db.query('SELECT id,source_page_url FROM apk_versions WHERE app_id=? AND version<>? AND source_page_url IS NOT NULL',[app.id,details.version||'']);
  for(const row of savedLinks){
    if(history.samePage(row.source_page_url,details.sourcePageUrl)){
      await db.query('UPDATE apk_versions SET source_page_url=NULL WHERE id=? AND app_id=?',[row.id,app.id]);
    }
  }
  const historyRows=[...(details.oldVersions||[])];
  if(details.version) historyRows.unshift({version:details.version,updatedDate:details.updatedDate,sourcePageUrl:details.sourcePageUrl,fileSizeBytes:details.fileSizeBytes});
  for(const v of historyRows.slice(0,25)){
    if(!v?.version)continue;
    const versionUrl=(history.isHistoryOnlyUrl(v.sourcePageUrl)?null:history.safeVersionUrl(v.sourcePageUrl))||null;
    const versionSize=v.version===details.version?details.fileSizeBytes:(v.fileSizeBytes||null);
    await checkedQuery(db,`INSERT INTO apk_versions (app_id,version,source_page_url,file_size_bytes,architecture,apk_type,release_date,release_date_source)
      VALUES (?,?,?,?,?,?,?,'source-page') ON DUPLICATE KEY UPDATE source_page_url=COALESCE(VALUES(source_page_url),source_page_url),file_size_bytes=COALESCE(VALUES(file_size_bytes),file_size_bytes),release_date=COALESCE(VALUES(release_date),release_date)`,
      [app.id,v.version,versionUrl,versionSize,details.architecture,details.apkType||details.apkFormat,v.updatedDate||null]);
    if(v.version===details.version&&versionChanged){
      await checkedQuery(db,'UPDATE apk_versions SET file_size_bytes=?,release_date=? WHERE app_id=? AND version=?',[details.fileSizeBytes||null,details.updatedDate||null,app.id,v.version]);
    }
  }
  await db.commit();
  return {app,inserted:!existing,updated:Boolean(existing),updateAvailable:available,metadataStatus,missingFields:missing};
  }catch(err){try{await db.rollback()}catch{}throw err}finally{db.release()}
}


function taxonomyLinks(html,pageUrl) {
  const $=cheerio.load(String(html||''));const out=[];const seen=new Set();
  const sectionFromNode=el=>{
    const a=$(el),href=normalizeSourceUrl(a.attr('href'));let path='';try{path=new URL(href||pageUrl).pathname.toLowerCase()}catch{}
    if(/\/(?:games?|game)(?:\/|$)/.test(path))return 'games';if(/\/(?:apps?|application)(?:\/|$)/.test(path))return 'apps';
    for(const parent of a.parents('li,ul,nav,section,div').slice(0,5).toArray()){
      const node=$(parent);const heading=cleanText(node.children('a,span,strong,b,h2,h3,h4').first().text());
      if(/^games?$/i.test(heading))return'games';if(/^apps?$/i.test(heading))return'apps';
      const cls=String(node.attr('class')||'');if(/game/i.test(cls)&&!/app/i.test(cls))return'games';if(/app/i.test(cls)&&!/game/i.test(cls))return'apps';
    }
    let sourcePath='';try{sourcePath=new URL(pageUrl).pathname.toLowerCase()}catch{}return /\/games?(?:\/|$)/.test(sourcePath)?'games':'apps';
  };
  $('a[href]').each((_,el)=>{
    const name=cleanText($(el).text()),url=normalizeSourceUrl($(el).attr('href'));if(!url||!name)return;
    let path='';try{path=new URL(url).pathname.toLowerCase()}catch{}
    if(/\/(?:page|download|blog|news|article|tag|author)\//.test(path))return;
    if(/^(?:home|latest|updated|popular|trending|about|contact|dmca|privacy|terms|download|request|blog)$/i.test(name))return;
    const slug=categorySlug(slugFromUrl(url)||name);if(['apps','app','games','game','category','categories',''].includes(slug))return;
    const section=sectionFromNode(el),key=`${section}:${slug}`;if(seen.has(key))return;
    // Category links usually live in category/menu/breadcrumb structures. This prevents generic footer links becoming categories.
    const context=String($(el).parents('nav,ul,li,[class*="menu"],[class*="categor"],[class*="sidebar"],[class*="dropdown"]').first().attr('class')||'')+' '+cleanText($(el).parents('nav,ul,li').first().text()).slice(0,180);
    const menuContext=/(categor|menu|sidebar|dropdown|apps?|games?)/i.test(context);
    if(!menuContext&&!/\/(?:category|categories|apps?|games?)\//.test(path))return;
    if(/\.html?$/.test(path)&&(!menuContext||name.length>45||/(?:\bapk\b|\bmod\b|version|download)/i.test(name)))return;
    seen.add(key);out.push({section,name:name.slice(0,160),slug,url,parentSlug:section});
  });
  return out.slice(0,400);
}
async function ensureTaxonomyRoots(db) {
  for(const [section,name,order] of [['apps','Apps',0],['games','Games',1]]){
    await db.query(`INSERT INTO apk_categories (section,name,slug,source_url,parent_slug,sort_order,last_seen_at,active) VALUES (?,?,?,?,NULL,?,NOW(),1)
      ON DUPLICATE KEY UPDATE name=VALUES(name),parent_slug=NULL,sort_order=VALUES(sort_order),active=1,last_seen_at=NOW()`,[section,name,section,`${BASE_URL}/${section}`,order]);
  }
  await db.query(`UPDATE apk_categories SET parent_slug=section WHERE slug<>section AND (parent_slug IS NULL OR parent_slug='')`);
}
async function readTaxonomyFetch(db=getPool()) {
  const [[row]]=await db.query('SELECT setting_value FROM settings WHERE setting_key=? LIMIT 1',['apk_taxonomy_fetch']);
  if(row?.setting_value){try{const saved=JSON.parse(row.setting_value);if(saved.status==='fetching'&&!taxonomyBusy)return {...saved,status:'interrupted',lastError:'The previous category fetch was interrupted. Saved categories were preserved.'};return saved}catch{}}
  const [[existing]]=await db.query("SELECT COUNT(*) total,MAX(last_seen_at) last_seen FROM apk_categories WHERE slug<>section AND source_url IS NOT NULL");
  // Old installations may contain a real saved taxonomy, but no fetch-complete marker.
  // Preserve it without claiming that an unverified crawl was complete.
  return Number(existing?.total||0)>0?{status:'existing',sourceCategoryCount:Number(existing.total),lastSuccessAt:existing.last_seen,verified:false}:{status:'not_fetched',sourceCategoryCount:0,verified:false};
}
async function saveTaxonomyFetch(value){
  await getPool().query('INSERT INTO settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)', ['apk_taxonomy_fetch',JSON.stringify(value)]);
}
async function refreshTaxonomy({force=false}={}) {
  const db=getPool();await ensureTaxonomyRoots(db);
  if(taxonomyBusy)throw Object.assign(new Error('A category fetch is already running.'),{status:409,code:'TAXONOMY_BUSY'});
  const previous=await readTaxonomyFetch(db);
  if(!force&&['complete','existing'].includes(previous.status))return {...await taxonomyState(),skipped:true,message:'Saved categories are already available. Use Refresh only when you explicitly want to fetch again.'};
  taxonomyBusy=true;
  await saveTaxonomyFetch({...previous,status:'fetching',startedAt:new Date().toISOString(),lastError:null});
  const queue=[BASE_URL,`${BASE_URL}/apps`,`${BASE_URL}/games`],visited=new Set(),found=new Map(),errors=[];
  try{
    // Crawl only category/navigation pages, never an unbounded app listing.
    while(queue.length&&visited.size<120){
      const candidate=queue.shift();if(visited.has(candidate))continue;visited.add(candidate);
      try{
        const r=await fetchText(candidate),links=taxonomyLinks(r.text,r.url);
        for(const c of links){
          found.set(`${c.section}:${c.slug}`,c);
          if(!visited.has(c.url)&&!queue.includes(c.url)&&queue.length<160)queue.push(c.url);
        }
      }catch(err){
        if(['SOURCE_ACCESS_DENIED','SOURCE_CHALLENGE','SOURCE_RATE_LIMITED','SOURCE_STOPPED'].includes(err.code))throw err;
        errors.push(`${candidate}: ${err.message||err}`);
      }
    }
    if(queue.length)errors.push('Category crawl reached its safety limit before all category pages were checked.');
    if(!found.size)throw Object.assign(new Error('No verified category links were returned by LiteAPKs. The existing category structure was preserved.'),{status:502,code:'TAXONOMY_EMPTY'});
    // All network discovery finishes before the stored hierarchy is changed.
    // Thus a failed fetch cannot delete or replace the existing categories.
    let order=10;
    for(const c of found.values())await db.query(`INSERT INTO apk_categories (section,name,slug,source_url,parent_slug,sort_order,last_seen_at,active) VALUES (?,?,?,?,?,?,NOW(),1)
      ON DUPLICATE KEY UPDATE name=VALUES(name),source_url=VALUES(source_url),parent_slug=VALUES(parent_slug),sort_order=VALUES(sort_order),last_seen_at=NOW(),active=1`,[c.section,c.name,c.slug,c.url,c.parentSlug||c.section,order++]);
    const finished={status:errors.length?'partial':'complete',verified:false,coverage:'discovered-source-navigation',sourceCategoryCount:found.size,lastSuccessAt:errors.length?previous.lastSuccessAt||null:new Date().toISOString(),lastError:errors.length?errors.slice(0,5).join('\n'):null,visitedPages:visited.size};
    await saveTaxonomyFetch(finished);
    return {...await taxonomyState(),liveFetched:true,sourceCategoryCount:found.size,visitedPages:visited.size,errors:errors.slice(0,5),message:'Saved the category links returned by the source. Completeness is not certified without an authoritative category export.'};
  }catch(err){
    await saveTaxonomyFetch({...previous,status:'failed',lastError:String(err.message||err).slice(0,1800),lastAttemptAt:new Date().toISOString()});
    throw err;
  }finally{taxonomyBusy=false}
}
async function categoryDescendants(section,slug){
  const root=String(slug||'').trim();if(!root)return [];
  if(!['apps','games'].includes(section))throw Object.assign(new Error('Select Apps or Games before choosing a category.'),{status:400});
  const [rows]=await getPool().query('SELECT slug,parent_slug FROM apk_categories WHERE section=? AND active=1',[section]);
  const children=new Map();for(const row of rows){if(!children.has(row.parent_slug))children.set(row.parent_slug,[]);children.get(row.parent_slug).push(row.slug)}
  const seen=new Set(),queue=[root];while(queue.length&&seen.size<500){const key=queue.shift();if(seen.has(key))continue;seen.add(key);queue.push(...(children.get(key)||[]))}
  return [...seen];
}
async function taxonomyState() {
  const db=getPool();await ensureTaxonomyRoots(db);
  const [rows]=await db.query(`SELECT c.section,c.name,c.slug,c.source_url,c.parent_slug,c.sort_order,COUNT(a.id) app_count
    FROM apk_categories c LEFT JOIN apps a ON a.source_section=c.section AND a.category_slug=c.slug
    WHERE c.active=1 GROUP BY c.id,c.section,c.name,c.slug,c.source_url,c.parent_slug,c.sort_order ORDER BY FIELD(c.section,'apps','games'),c.sort_order,c.name`);
  const [[totals]]=await db.query(`SELECT COUNT(*) total,SUM(source_section='apps') apps,SUM(source_section='games') games FROM apps`);
  const sections={apps:Number(totals?.apps||0),games:Number(totals?.games||0)};
  const categories=rows.filter(r=>r.slug!==r.section).map(r=>({section:r.section,name:r.name,slug:r.slug,parentSlug:r.parent_slug||r.section,sourceUrl:r.source_url||null,directCount:Number(r.app_count||0),count:Number(r.app_count||0)}));
  // Parent counts include descendants, without counting an app more than once.
  for(const c of categories){const descendants=await categoryDescendants(c.section,c.slug);c.count=categories.filter(x=>x.section===c.section&&descendants.includes(x.slug)).reduce((n,x)=>n+x.directCount,0)}
  const roots=['apps','games'].map(section=>({section,name:section==='apps'?'Apps':'Games',slug:section,count:sections[section],children:categories.filter(c=>c.section===section)}));
  return {total:Number(totals?.total||0),sections,categories,roots,fetch:await readTaxonomyFetch(db)};
}

function rankedAppLinks(html,pageUrl) {
  const $=cheerio.load(String(html||''));const out=[];const seen=new Set();
  $('a[href]').each((_,el)=>{const url=normalizeSourceUrl($(el).attr('href'));if(!url||!isLikelyAppUrl(url)||seen.has(url))return;seen.add(url);out.push(url)});
  return out;
}
async function refreshRankings(limit=100) {
  const db=getPool();
  await db.query('UPDATE apps SET source_popularity_rank=NULL,source_trending_rank=NULL');
  const home=await fetchText(BASE_URL);
  const $=cheerio.load(home.text);const candidates=[];
  $('a[href]').each((_,el)=>{const text=cleanText($(el).text());if(/popular|trending|top\s+(?:apps|games)|most\s+download/i.test(text)){const url=normalizeSourceUrl($(el).attr('href'));if(url)candidates.push({url,type:/trend/i.test(text)?'trending':'popular'})}});
  if(!candidates.length)candidates.push({url:BASE_URL,type:'popular'});
  for(const item of candidates.slice(0,8)){
    try{const r=item.url===BASE_URL?home:await fetchText(item.url);const urls=rankedAppLinks(r.text,r.url).slice(0,Math.max(1,Math.min(500,Number(limit)||100)));let rank=0;for(const url of urls){rank++;const col=item.type==='trending'?'source_trending_rank':'source_popularity_rank';await db.query(`UPDATE apps SET ${col}=? WHERE source_page_url=?`,[rank,url])}}catch{}
  }
  await db.query(`UPDATE apps SET popularity_score=(LOG10(COALESCE(download_count,0)+1)*32)+(LOG10(COALESCE(rating_count,0)+1)*12)+(COALESCE(rating_value,0)*8)+GREATEST(0,30-LEAST(30,DATEDIFF(CURDATE(),COALESCE(source_updated_at,DATE_SUB(CURDATE(),INTERVAL 3650 DAY)))))*0.4,
    trending_score=(LOG10(COALESCE(download_count,0)+1)*10)+(LOG10(COALESCE(rating_count,0)+1)*7)+(COALESCE(rating_value,0)*6)+GREATEST(0,45-LEAST(45,DATEDIFF(CURDATE(),COALESCE(source_updated_at,DATE_SUB(CURDATE(),INTERVAL 3650 DAY)))))*2`);
  return {ok:true};
}

async function searchCatalog(q,limit=30) {
  const needle=String(q||'').trim();
  if(!needle)return [];
  const like=`%${needle}%`;
  const [rows]=await getPool().query(`SELECT * FROM apps WHERE name LIKE ? OR source_package_id LIKE ? OR package_id LIKE ? OR source_page_url LIKE ? ORDER BY updated_at DESC LIMIT ?`,[like,like,like,like,Math.max(1,Math.min(100,Number(limit)||30))]);
  return rows.map(r=>({packageId:r.package_id,name:r.name,developer:r.developer||'Android Developer',category:r.category||'Android Apps',sourceType:SOURCE_TYPE,platformKey:PLATFORM_KEY,sourcePageUrl:r.source_page_url,sourcePackageId:r.source_package_id,managed:true,managedAppId:Number(r.id),updatedDate:r.source_updated_at||null}));
}

async function ensureManagedFromUrl(pageUrl) {
  const d=await fetchPackageDetails(pageUrl);
  return (await upsertManaged(d,{autoAdd:true})).app;
}

async function enrichManagedAppById(id) {
  const db=getPool();
  const [[app]]=await db.query('SELECT * FROM apps WHERE id=? LIMIT 1',[id]);
  if(!app)throw new Error('App not found.');
  if(!app.source_page_url)throw new Error('APK source page is missing.');
  try{
    await db.query("UPDATE apps SET metadata_status='fetching',metadata_error=NULL WHERE id=?",[id]);
    const d=await fetchPackageDetails(app.source_page_url);
    if(d.internalPackageId!==app.package_id)throw Object.assign(new Error('Source identity changed. Refresh stopped without creating a new record.'),{status:409});
    await upsertManaged(d,{autoAdd:false});
    const [[fresh]]=await db.query('SELECT * FROM apps WHERE id=? LIMIT 1',[id]);
    return fresh;
  }catch(err){
    await db.query("UPDATE apps SET metadata_status='error',metadata_error=?,update_error=? WHERE id=?",[String(err.message||err).slice(0,1800),String(err.message||err).slice(0,1800),id]);
    throw err;
  }
}

const mediaRefreshBusy=new Set();
async function refreshMediaForApp(id,{kinds=['icon','cover','screenshot']}={}) {
  id=Number(id);
  if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('Invalid app ID.'),{status:400});
  const allowed=new Set(['icon','cover','screenshot']);
  if(!Array.isArray(kinds)||!kinds.length||kinds.some(k=>!allowed.has(k)))throw Object.assign(new Error('Select icon, cover, or screenshot media.'),{status:400});
  kinds=[...new Set(kinds)];
  if(mediaRefreshBusy.has(id))throw Object.assign(new Error('A media refresh is already running for this app.'),{status:409});
  mediaRefreshBusy.add(id);
  const db=getPool();
  try{
    const [[app]]=await db.query('SELECT * FROM apps WHERE id=? LIMIT 1',[id]);
    if(!app)throw Object.assign(new Error('App not found.'),{status:404});
    const details=await fetchPackageDetails(app.source_page_url);
    if(details.internalPackageId!==app.package_id)throw Object.assign(new Error('Source identity changed. Existing media was preserved.'),{status:409});
    let previous={};try{previous=JSON.parse(app.source_metadata_json||'{}')}catch{}
    const merged={...previous};
    const keys={icon:'iconUrl',cover:'coverImageUrl',screenshot:'screenshots'};
    const artwork={},sourceReturnedKinds=[],retainedKinds=[];
    for(const kind of kinds){
      const key=keys[kind],value=details.metadata?.[key];
      if(value!=null&&value!==''&&(!Array.isArray(value)||value.length)){
        merged[key]=value;artwork[key]=value;sourceReturnedKinds.push(kind);
      }else{
        retainedKinds.push(kind);
      }
    }
    const conn=await db.getConnection();
    try{
      await conn.beginTransaction();
      await conn.query("UPDATE apps SET source_metadata_json=?,metadata_updated_at=NOW() WHERE id=?",[JSON.stringify(merged),id]);
      await conn.query('INSERT INTO apk_metadata (app_id,metadata_json) VALUES (?,?) ON DUPLICATE KEY UPDATE metadata_json=VALUES(metadata_json)',[id,JSON.stringify(merged)]);
      await syncMedia(id,artwork,{db:conn});
      await conn.commit();
    }catch(err){await conn.rollback();throw err}finally{conn.release()}
    return {appId:id,icon:Boolean(merged.iconUrl),cover:Boolean(merged.coverImageUrl),screenshots:Array.isArray(merged.screenshots)?merged.screenshots.length:0,requestedKinds:kinds,sourceReturnedKinds,retainedKinds};
  }catch(err){await db.query('UPDATE apps SET metadata_error=? WHERE id=?',[String(err.message||err).slice(0,1800),id]).catch(()=>{});throw err}
  finally{mediaRefreshBusy.delete(id)}
}

async function prepareApp(id) {
  const db=getPool();
  const [[app]]=await db.query('SELECT * FROM apps WHERE id=? LIMIT 1',[id]);
  if(!app)throw new Error('App not found.');
  try{return {app:await enrichManagedAppById(id),refreshed:true,warning:null}}catch(err){return {app,refreshed:false,warning:err.message||String(err)}}
}

async function checkUpdateForApp(app,{signal}={}) {
  const details=await fetchPackageDetails(app.source_page_url,{signal});
  if(signal?.aborted)throw Object.assign(new Error('Request stopped.'),{code:'SOURCE_STOPPED',status:499});
  if(details.internalPackageId!==app.package_id)throw Object.assign(new Error('Source identity changed. Existing app was preserved.'),{status:409});
  let available=false;let reason=null;let oldMeta={};
  try{oldMeta=app.source_metadata_json?JSON.parse(app.source_metadata_json):{}}catch{}
  if(details.version){
    try{available=!app.current_version||compareVersions(details.version,app.current_version)>0}catch{available=!app.current_version||details.version!==app.current_version}
    if(available)reason='version';
  }
  if(!available&&app.file_size_bytes&&details.fileSizeBytes&&Number(app.file_size_bytes)!==Number(details.fileSizeBytes)){available=true;reason='size'}
  if(!available&&oldMeta.downloadPageUrl&&details.downloadPageUrl&&String(oldMeta.downloadPageUrl)!==String(details.downloadPageUrl)){available=true;reason='download-page'}
  if(reason)details.metadata.updateReason=reason;
  if(signal?.aborted)throw Object.assign(new Error('Request stopped.'),{code:'SOURCE_STOPPED',status:499});
  // A newer source version is only a candidate during a scan. Do not replace the
  // managed current-version metadata (especially size/date) until Mark Updated is explicit.
  if(!(available&&reason==='version'))await upsertManaged(details,{autoAdd:false});
  await getPool().query(`UPDATE apps SET latest_version=?,update_available=?,last_checked_at=NOW(),update_error=NULL WHERE id=?`,[details.version||app.current_version,available?1:0,app.id]);
  return {details,available,reason};
}

async function markUpdated(id) {
  const fresh=await enrichManagedAppById(id);
  const latest=fresh.latest_version||fresh.current_version;
  await getPool().query('UPDATE apps SET current_version=?,latest_version=NULL,update_available=0,last_checked_at=NOW(),update_error=NULL WHERE id=?',[latest,id]);
  return true;
}

async function finishSyncIfNeeded(db,st) {
  if(st.status!=='running')return st;
  let queue=[];try{queue=JSON.parse(st.queue_json||'[]')}catch{}
  if(queue.length)return st;
  await db.query("UPDATE apk_sync_state SET status='complete',current_url=NULL,last_completed_at=NOW(),next_sync_at=NULL WHERE sync_key=? AND run_id=? AND status='running'",[SYNC_KEY,st.run_id]);
  const done=await getSyncState();
  if(done.status==='complete'&&Number(done.requested_by||0)&&!Number(done.completion_notified||0)){
    const [mark]=await db.query('UPDATE apk_sync_state SET completion_notified=1 WHERE sync_key=? AND run_id=? AND completion_notified=0',[SYNC_KEY,st.run_id]);
    if(mark.affectedRows){
      const uid=Number(done.requested_by);
      await activity.record(uid,'apk_sync_completed',{details:{processed:Number(done.processed_count||0),inserted:Number(done.inserted_count||0),updated:Number(done.updated_count||0),incomplete:Number(done.incomplete_count||0),failed:Number(done.failed_count||0)}});
      await notifications.notifyUser(uid,{actorUserId:uid,type:Number(done.failed_count||0)?'warning':'success',title:'APK sync completed',message:`${Number(done.processed_count||0).toLocaleString()} pages checked · ${Number(done.inserted_count||0).toLocaleString()} added · ${Number(done.updated_count||0).toLocaleString()} refreshed · ${Number(done.incomplete_count||0).toLocaleString()} need metadata · ${Number(done.failed_count||0).toLocaleString()} failed.`,dedupeKey:`apk-sync-${st.run_id}`});
    }
  }
  return getSyncState();
}
async function step() {
  if(workerBusy||discoveryTask||!state.dbReady)return getSyncState();
  workerBusy=true;
  try{
    const db=getPool();let st=await getSyncState();
    if(st.status!=='running')return st;
    let queue=[];try{queue=JSON.parse(st.queue_json||'[]')}catch{}
    if(!queue.length)return finishSyncIfNeeded(db,st);
    if(st.mode==='new'&&Number(st.requested_count||0)>0&&Number(st.inserted_count||0)>=Number(st.requested_count)){
      await db.query("UPDATE apk_sync_state SET queue_json='[]',current_url=NULL WHERE sync_key=? AND run_id=? AND status='running'",[SYNC_KEY,st.run_id]);
      return finishSyncIfNeeded(db,await getSyncState());
    }
    const url=queue[0],runId=st.run_id;
    const controller=new AbortController();activeJobController=controller;
    const [claimed]=await db.query("UPDATE apk_sync_state SET current_url=? WHERE sync_key=? AND run_id=? AND status='running'",[url,SYNC_KEY,runId]);
    if(!claimed.affectedRows)return getSyncState();
    try{
      const details=await fetchPackageDetails(url,{signal:controller.signal});
      if(controller.signal.aborted)return getSyncState();
      const current=await getSyncState();if(current.status!=='running'||current.run_id!==runId)return current;
      const result=await upsertManaged(details,{autoAdd:true});
      await db.query("UPDATE apk_sync_state SET queue_json=?,processed_count=processed_count+1,inserted_count=inserted_count+?,updated_count=updated_count+?,incomplete_count=incomplete_count+?,current_url=NULL,last_error=NULL WHERE sync_key=? AND run_id=? AND status='running'",[JSON.stringify(queue.slice(1)),result.inserted?1:0,result.updated?1:0,result.metadataStatus==='pending'?1:0,SYNC_KEY,runId]);
      if(st.mode==='new'&&Number(st.requested_count||0)>0&&Number(st.inserted_count||0)+(result.inserted?1:0)>=Number(st.requested_count)){
        await db.query("UPDATE apk_sync_state SET queue_json='[]',current_url=NULL WHERE sync_key=? AND run_id=? AND status='running'",[SYNC_KEY,runId]);
      }
    }catch(err){
      if(err.code==='SOURCE_STOPPED')return getSyncState();
      const message=String(err.message||err).slice(0,1800);
      const pauseSource=['SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'].includes(err.code);
      // A single app page may be unavailable while the rest of the LiteAPKs
      // catalog remains reachable. Record that page as failed and continue;
      // only source-wide/transient failures pause the whole batch.
      if(pauseSource){await db.query("UPDATE apk_sync_state SET status='paused',last_error=?,current_url=NULL WHERE sync_key=? AND run_id=? AND status='running'",[message,SYNC_KEY,runId]);}
      else await db.query("UPDATE apk_sync_state SET queue_json=?,processed_count=processed_count+1,failed_count=failed_count+1,current_url=NULL,last_error=? WHERE sync_key=? AND run_id=? AND status='running'",[JSON.stringify(queue.slice(1)),message,SYNC_KEY,runId]);
    }finally{if(activeJobController===controller)activeJobController=null}
    st=await getSyncState();return finishSyncIfNeeded(db,st);
  }finally{workerBusy=false}
}
async function autoTick() {
  if(!state.dbReady||workerBusy)return;
  try{await recoverSync();const st=await getSyncState();if(st.status==='running')await step()}catch(err){console.error('[Appbit] APK resolver worker:',err.message||err)}
}
function startApkResolverWorker() {
  if(workerStarted)return;workerStarted=true;
  const first=setTimeout(autoTick,12000);if(first.unref)first.unref();
  const timer=setInterval(autoTick,WORKER_INTERVAL_MS);if(timer.unref)timer.unref();
  console.log('[Appbit] APK resolver worker started (explicit imports only).');
}

module.exports={
  BASE_URL,SOURCE_TYPE,PLATFORM_KEY,SYNC_KEY,
  parseAppPage,discoverLinks,fetchPackageDetails,getSyncState,startSync,stopSync,step,startApkResolverWorker,
  taxonomyState,refreshTaxonomy,categoryDescendants,refreshRankings,
  ensureManagedFromUrl,enrichManagedAppById,refreshMediaForApp,prepareApp,checkUpdateForApp,markUpdated,searchCatalog,
  internalPackageId,normalizeSourceUrl,isLikelyAppUrl,metadataMissingFields,requiredMissingFields
};
