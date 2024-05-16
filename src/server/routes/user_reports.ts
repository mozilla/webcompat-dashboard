import { Worker, MessageChannel } from "node:worker_threads";
import * as path from "node:path";
import { Request, Response } from "express";
import type { Logger } from "winston";

import { endWithStatusAndBody, getParsedUrl } from "../helpers/http";

// Create a separate Worker thread to do the requests on since the
// data processing is CPU intensive and would otherwise interfere
// with mainthread responsiveness.
// For now, only a single worker is used though multiple BQ requests
// can be in-flight on it.
const worker = new Worker(path.join(__dirname, "..", "helpers", "user_reports_transform.ts"));

export default async function handleUserReports(logger: Logger, req: Request, res: Response) {
  const childLogger = logger.child({ handler: "handleUserReports" });
  childLogger.verbose("Entered handler");

  const searchParams = getParsedUrl(req).searchParams;
  if (!(searchParams.has("from") && searchParams.has("to"))) {
    return endWithStatusAndBody(res, 400, "`from` and `to` query parameters required");
  }

  try {
    // Post the request to the existing worker, and use a new MessageChannel
    // to ensure we only see our own results even if other requests are in-flight.
    const { port1, port2 } = new MessageChannel();
    worker.postMessage(
      {
        type: "fetch",
        projectId: process.env.BQ_PROJECT_ID,
        paramFrom: searchParams.get("from")!,
        paramTo: searchParams.get("to")!,
        port: port1,
      },
      [port1],
    );
    const results = await new Promise((resolve, reject) => {
      port2.on("message", (msg) => {
        switch (msg.type) {
          case "done":
            resolve(msg.result);
            break;
          case "verbose":
            childLogger.verbose(msg.msg);
            break;
          case "error":
            reject(msg.error);
            break;
        }
      });
    });

    res.write(results);
    childLogger.verbose("Handler done.");
  } catch (error: any) {
    childLogger.error("Handler failed", { error });
    return endWithStatusAndBody(res, 500, error.toString());
  }

  res.end();
}
