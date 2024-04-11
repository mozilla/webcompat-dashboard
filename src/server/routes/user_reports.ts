import { Worker } from "node:worker_threads";
import * as path from "node:path";
import { Request, Response } from "express";
import type { Logger } from "winston";
import { getDefaultProject } from "../helpers/bigquery";

import { endWithStatusAndBody, getParsedUrl } from "../helpers/http";

export default async function handleUserReports(logger: Logger, req: Request, res: Response) {
  const childLogger = logger.child({ handler: "handleUserReports" });
  childLogger.verbose("Entered handler");

  const searchParams = getParsedUrl(req).searchParams;
  if (!(searchParams.has("from") && searchParams.has("to"))) {
    return endWithStatusAndBody(res, 400, "`from` and `to` query parameters required");
  }

  try {
    const worker = new Worker(path.join(__dirname, "..", "helpers", "user_reports_transform.ts"), {
      workerData: {
        projectId: getDefaultProject(),
        paramFrom: searchParams.get("from")!,
        paramTo: searchParams.get("to")!,
      },
    });

    const results = await new Promise((resolve) => {
      worker.on("message", (msg) => {
        if (msg.type == "done") {
          resolve(msg.result);
        } else if (msg.type == "verbose") {
          childLogger.verbose(msg.msg);
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
