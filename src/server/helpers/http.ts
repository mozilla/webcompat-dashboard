import http from "http";

export function endWithStatusAndBody(res: http.ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.write(JSON.stringify({ error: message }));
  res.end();
}

export function getParsedUrl(req: http.IncomingMessage): URL {
  return new URL(req.url!, `https://${req.headers.host!}/`);
}
