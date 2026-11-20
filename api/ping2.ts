export default function handler(req: any, res: any): void {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain');
  res.end('pong ' + process.version);
}
