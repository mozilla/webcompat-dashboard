import { BigQuery } from "@google-cloud/bigquery";

export function getBqConnection() {
  return new BigQuery({
    projectId: process.env.BQ_PROJECT_ID,
  });
}
