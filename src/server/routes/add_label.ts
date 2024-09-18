import { Request, Response } from "express";

import { endWithStatusAndBody } from "../helpers/http";
import { getBqConnection } from "../helpers/bigquery";

type addLabelPayload = {
  report_uuid?: string;
  label?: string;
};

export default async function handleAddLabel(req: Request, res: Response) {
  const payload = req.body as addLabelPayload;
  if (!payload.report_uuid || !payload.label) {
    return endWithStatusAndBody(res, 400, "Missing report_uuid or label");
  }

  const bq = getBqConnection();
  try {
    const actionName = `mark-${payload.label}`;

    const queries = [
      bq.query({
        query: `INSERT INTO webcompat_user_reports.labels (report_uuid, label, created_at, is_ml)
        VALUES (?, ?, CURRENT_DATETIME(), false);
      `,
        params: [payload.report_uuid, payload.label],
      }),
      bq.query({
        query: `
          INSERT INTO webcompat_user_reports.report_actions (report_uuid, type, created_at)
          VALUES (?, ?, CURRENT_DATETIME())
      `,
        params: [payload.report_uuid, actionName],
      }),
    ];

    await Promise.all(queries);

    endWithStatusAndBody(res, 201, "success");
  } catch (error: any) {
    return endWithStatusAndBody(res, 500, error.toString());
  }
}
