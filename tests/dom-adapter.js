// Test-only Cheerio-shaped adapter backed by Chromium's native DOM.
// It is not included in the production runtime and is not a Cheerio replacement.
function createDomAdapter(html){
 const doc=new DOMParser().parseFromString(html,'text/html');
 class Selection{
  constructor(nodes,previous=[]){this.nodes=[...new Set(nodes.filter(Boolean))];this.previous=previous;this.length=this.nodes.length;this.nodes.forEach((n,i)=>this[i]=n)}
  each(fn){this.nodes.forEach((n,i)=>fn(i,n));return this}
  text(){return this.nodes.map(n=>n.textContent||'').join('')}
  attr(name,value){if(value!==undefined){this.nodes.forEach(n=>n.setAttribute?.(name,value));return this}return this.nodes[0]?.getAttribute?.(name)??undefined}
  first(){return new Selection(this.nodes.slice(0,1),this.nodes)}
  eq(i){return new Selection([this.nodes.at(i)],this.nodes)}
  index(value){const target=value instanceof Selection?value.nodes[0]:value;return this.nodes.indexOf(target)}
  slice(a,b){return new Selection(this.nodes.slice(a,b),this.nodes)}
  toArray(){return [...this.nodes]}
  find(sel){return new Selection(this.nodes.flatMap(n=>[...(n.querySelectorAll?.(sel)||[])]),this.nodes)}
  children(sel){let out=this.nodes.flatMap(n=>[...n.children||[]]);if(sel)out=out.filter(n=>n.matches(sel));return new Selection(out,this.nodes)}
  contents(){return new Selection(this.nodes.flatMap(n=>[...n.childNodes||[]]),this.nodes)}
  prev(sel){let out=this.nodes.map(n=>n.previousElementSibling).filter(Boolean);if(sel)out=out.filter(n=>n.matches(sel));return new Selection(out,this.nodes)}
  next(sel){let out=this.nodes.map(n=>n.nextElementSibling).filter(Boolean);if(sel)out=out.filter(n=>n.matches(sel));return new Selection(out,this.nodes)}
  parent(){return new Selection(this.nodes.map(n=>n.parentElement),this.nodes)}
  parents(sel){const out=[];for(const n of this.nodes){let p=n.parentElement;while(p){if(!sel||p.matches(sel))out.push(p);p=p.parentElement}}return new Selection(out,this.nodes)}
  closest(sel){return new Selection(this.nodes.map(n=>n.closest?.(sel)),this.nodes)}
  filter(sel){return new Selection(this.nodes.filter((n,i)=>typeof sel==='function'?sel(i,n):n.matches?.(sel)),this.nodes)}
  addBack(sel){return new Selection([...this.nodes,...this.previous.filter(n=>!sel||n.matches?.(sel))],this.nodes)}
  add(value){return new Selection([...this.nodes,...$(value).nodes],this.nodes)}
  clone(){return new Selection(this.nodes.map(n=>n.cloneNode?.(true)).filter(Boolean),this.nodes)}
  remove(){this.nodes.forEach(n=>n.remove?.());return this}
 }
 function $(value){if(typeof value==='string')return new Selection([...doc.querySelectorAll(value)]);if(value instanceof Selection)return value;if(Array.isArray(value))return new Selection(value);return new Selection(value?[value]:[])}
 $.root=()=>new Selection([doc]);return $;
}
