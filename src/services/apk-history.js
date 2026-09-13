'use strict';
const {clean,parseBytes,parseDate,normalizeVersion}=require('./apk-fields');
const {sourceUrl}=require('./apk-source');
function safeVersionUrl(value,base){if(value==null||!String(value).trim())return null;return sourceUrl(value,base)||null}
function samePage(a,b){try{const x=new URL(a),y=new URL(b);return x.origin===y.origin&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'')&&x.search===y.search}catch{return false}}
function versionFromText(value){
 const text=clean(value);
 const m=text.match(/\b(?:version|ver\.?|v)\s*[:：#-]?\s*(\d+(?:\.[\da-z]+)+(?:[-+._][\da-z]+)*)/i)
   ||text.match(/(?:^|\s)(\d+(?:\.[\da-z]+)+(?:[-+._][\da-z]+)*)(?=\s|$|\()/i);
 return m?normalizeVersion(m[1]):null;
}
function isHistoryIndex(url){
 try{const u=new URL(url);return /(?:old|previous|all)[-_]?versions?|version[-_]?history|release[-_]?history/i.test(u.pathname+u.search)}catch{return false}
}
function isHistoryOnlyUrl(url){
 if(!isHistoryIndex(url))return false;
 try{const u=new URL(url);return !/(?:[?&](?:ver|version|v|id)=|\/(?:download|release)\/|(?:^|[-_/])v?\d+(?:[.-]\d+)+(?:[-+._][a-z0-9]+)*(?:\/|\.html?|$))/i.test(u.pathname+u.search)}catch{return false}
}
function historyIndex($,pageUrl){
 const found=[];
 $('a[href]').each((_,el)=>{
  const text=clean($(el).text()),url=safeVersionUrl($(el).attr('href'),pageUrl);
  if(!url||samePage(url,pageUrl))return;
  if(/(?:old|previous|all)\s+versions?|version\s+history|release\s+history/i.test(text)||isHistoryIndex(url)){
   const score=/old|previous|all/i.test(text)?3:isHistoryIndex(url)?2:1;
   found.push({url,score});
  }
 });
 found.sort((a,b)=>b.score-a.score);
 return found[0]?.url||null;
}
function extractHistory($,pageUrl,currentVersion){
 const sourcePageUrl=safeVersionUrl(pageUrl);if(!sourcePageUrl)return {versions:[],historyPageUrl:null};
 const found=new Map();let historyPageUrl=historyIndex($,sourcePageUrl);
 function add(anchor){
  const link=$(anchor),url=safeVersionUrl(link.attr('href'),sourcePageUrl);
  if(!url||samePage(url,sourcePageUrl))return;
  const text=clean(link.text());
  const card=link.closest('li,tr,[class*="version-item"],[class*="version-card"],[class*="version-row"],[class*="release-item"],[class*="release-card"]');
  const context=clean(card.length?card.first().text():link.parent().text()).slice(0,700);
  const version=versionFromText(text)||versionFromText(context);
  if(!version){if(isHistoryIndex(url))historyPageUrl=historyPageUrl||url;return}
  if(version===currentVersion)return;
  // A listing/index URL is not a per-version URL. Never assign an index
  // or the current app URL to a historical version as a fabricated link.
  if(isHistoryOnlyUrl(url)){
   historyPageUrl=historyPageUrl||url;return;
  }
  const size=(context.match(/\b\d[\d,.]*\s*(?:[kmgt]i?b|bytes?)\b/i)||[])[0]||null;
  const dateText=(context.match(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}\b/i)||[])[0];
  if(!found.has(version.toLowerCase()))found.set(version.toLowerCase(),{version,sourcePageUrl:url,updatedDate:parseDate(dateText),fileSizeBytes:parseBytes(size)});
 }
 const headings=$('h2,h3,h4').filter((_,el)=>/(?:old|previous|all)\s+versions?|version\s+history|release\s+history/i.test(clean($(el).text())));
 headings.each((_,heading)=>{
  let node=$(heading).next(),hops=0;
  while(node.length&&hops++<12&&!/^H[1-4]$/i.test(node[0]?.tagName||'')){
   node.find('a[href]').addBack('a[href]').each((__,el)=>add(el));node=node.next();
  }
 });
 $('[class*="old-version"],[class*="previous-version"],[class*="version-list"],[id*="old-version"],[id*="version-history"],[class*="release-history"]').each((_,el)=>{$(el).find('a[href]').each((__,a)=>add(a))});
 return {versions:[...found.values()].slice(0,25),historyPageUrl};
}
module.exports={safeVersionUrl,samePage,versionFromText,isHistoryIndex,isHistoryOnlyUrl,historyIndex,extractHistory};
