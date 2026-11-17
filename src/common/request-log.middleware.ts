import type { NextFunction, Request, Response } from 'express';

// KEEP THIS: one log line per request (status + duration) is what the workspace Monitoring tab charts.
//
// Writes ONE JSON line to stdout per finished request, health checks included (the
// platform filters the kubelet's probes itself):
//   {"status":200,"durationMs":3.2,"method":"GET","path":"/health","ua":"curl/8.5.0"}
// Never logs bodies, cookies, headers other than the user agent, or the query string.
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    const url = req.originalUrl || req.url || '';
    const q = url.indexOf('?');
    const line = {
      status: res.statusCode,
      durationMs:
        Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10,
      method: req.method,
      path: (q === -1 ? url : url.slice(0, q)).slice(0, 512),
      ua: String(req.headers['user-agent'] || '').slice(0, 256),
    };
    process.stdout.write(JSON.stringify(line) + '\n');
  };
  res.once('finish', finish);
  res.once('close', finish);
  next();
}
