import { Worker, MessageChannel } from "node:worker_threads";
import { Request, Response } from "express";
import type { Logger } from "winston";
import { endWithStatusAndBody } from "./http";

// Create a separate Worker thread to do the requests on since the
// data processing is CPU intensive and would otherwise interfere
// with mainthread responsiveness.
// For now, only a single worker is used though multiple BQ requests
// can be in-flight on it.
export async function handleReport(
  logger: Logger,
  req: Request,
  res: Response,
  workerScript: string,
  workerParams: Record<string, any>,
) {
  const worker = new Worker(workerScript);

  let probabilityThreshold = 0.95;
  if (process.env.PROBABILITY_THRESHOLD) {
    probabilityThreshold = parseFloat(process.env.PROBABILITY_THRESHOLD);
  }

  try {
    // Post the request to the existing worker, and use a new MessageChannel
    // to ensure we only see our own results even if other requests are in-flight.
    const { port1, port2 } = new MessageChannel();
    worker.postMessage(
      {
        type: "fetch",
        projectId: process.env.BQ_PROJECT_ID,
        probabilityThreshold,
        ...workerParams,
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
            logger.verbose(msg.msg);
            break;
          case "error":
            reject(msg.error);
            break;
        }
      });
    });

    res.write(results);
    logger.verbose("Handler done.");
  } catch (error: any) {
    logger.error("Handler failed", { error });
    return endWithStatusAndBody(res, 500, error.toString());
  }

  res.end();
}
