import { Request, Response } from "express";

import { endWithStatusAndBody } from "../helpers/http";
import { getBqConnection } from "../helpers/bigquery";

type TrackActionPayload = {
  report_uuid?: string;
  type?: string;
};

export default async function handleTrackAction(req: Request, res: Response) {
  const payload = req.body as TrackActionPayload;
  if (!(payload.report_uuid && payload.type)) {
    return endWithStatusAndBody(res, 400, "Missing report_uuid or type");
  }

  const bq = getBqConnection();
  try {
    await bq.query({
      query: `
        INSERT INTO webcompat_user_reports.report_actions (report_uuid, type, created_at)
        VALUES (?, ?, CURRENT_DATETIME())
      `,
      params: [payload.report_uuid, payload.type],
    });

    endWithStatusAndBody(res, 201, "success");
  } catch (error: any) {
    return endWithStatusAndBody(res, 500, error.toString());
  }
}
