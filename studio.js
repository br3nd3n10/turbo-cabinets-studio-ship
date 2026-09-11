const parts=['p1','p2','p3','p4'];
const texts=await Promise.all(parts.map(p=>fetch(new URL('./studio.'+p+'.txt',import.meta.url)).then(r=>{if(!r.ok)throw new Error('studio '+p);return r.text()})));
const s=document.createElement('script');
s.type='module';
s.textContent=texts.join('');
document.documentElement.append(s);
