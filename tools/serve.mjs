import http from 'http'; import fs from 'fs'; import path from 'path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1')),'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(root,p); if(!f.startsWith(root)||!fs.existsSync(f)){r.writeHead(404);return r.end();}
 r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(+process.env.PORT || 5177);
