import { Request, Response } from "express";

import { endWithStatusAndBody } from "../helpers/http";
import { getBqConnection } from "../helpers/bigquery";

type MarkInvalidPayload = {
  report_uuid?: string;
};

export default async function handleMarkInvalid(req: Request, res: Response) {
  const payload = req.body as MarkInvalidPayload;
  if (!payload.report_uuid) {
    return endWithStatusAndBody(res, 400, "Missing report_uuid or type");
  }

  const bq = getBqConnection();
  try {
    await Promise.all([
      bq.query({
        query: `
        INSERT INTO webcompat_user_reports.report_actions (report_uuid, type, created_at)
        VALUES (?, "mark-invalid", CURRENT_DATETIME())
      `,
        params: [payload.report_uuid],
      }),
      bq.query({
        query: `INSERT INTO webcompat_user_reports.labels (report_uuid, label, created_at, is_ml)
        VALUES (?, "invalid", CURRENT_DATETIME(), false);
      `,
        params: [payload.report_uuid],
      }),
    ]);

    endWithStatusAndBody(res, 201, "success");
  } catch (error: any) {
    return endWithStatusAndBody(res, 500, error.toString());
  }
}
