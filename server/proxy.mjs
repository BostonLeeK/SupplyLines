// Passing requests through to another game server on this machine: pages and files over HTTP, and the game socket
// as a raw upgrade. Used for private games (/r/CODE/) and, in local development, for blitz under /fast/.
import http from 'http';
import net from 'net';

// `path` is what the other server should see (the prefix already cut off)
export function proxyHttp(req, res, port, path, ip) {
  const headers = { ...req.headers }; if (!headers['x-forwarded-for']) headers['x-forwarded-for'] = ip;
  const up = http.request({ host: '127.0.0.1', port, method: req.method, path, headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(up);
}

export function proxyUpgrade(req, socket, head, port, path, ip) {
  const up = net.connect(port, '127.0.0.1', () => {
    let h = `${req.method} ${path} HTTP/1.1\r\n`, xff = false;
    for (let i = 0; i < req.rawHeaders.length; i += 2) { if (/^x-forwarded-for$/i.test(req.rawHeaders[i])) xff = true; h += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`; }
    if (!xff) h += `X-Forwarded-For: ${ip}\r\n`;
    up.write(h + '\r\n'); if (head && head.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
  });
  up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
}

// a fixed prefix (like /fast) that belongs to another server; FAST_PROXY=http://127.0.0.1:5178 sets it up
export function createPrefixProxy(prefix, target) {
  const port = +new URL(target).port, re = new RegExp('^' + prefix.replace(/\/$/, '') + '(?=/|$)');
  return {
    handle(req, res, p, ip) {
      if (!re.test(p)) return false;
      if (p === prefix.replace(/\/$/, '')) { res.writeHead(301, { location: prefix.replace(/\/?$/, '/') + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '') }); res.end(); return true; }
      proxyHttp(req, res, port, req.url.replace(re, '') || '/', ip); return true;
    },
    upgrade(req, socket, head, ip) { if (!re.test(req.url)) return false; proxyUpgrade(req, socket, head, port, req.url.replace(re, '') || '/', ip); return true; },
  };
}
