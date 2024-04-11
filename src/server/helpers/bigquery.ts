import { BigQuery } from "@google-cloud/bigquery";

export function getDefaultProject() {
  return process.env.BQ_PROJECT_ID;
}

export function getBqConnection(projectId = getDefaultProject()) {
  return new BigQuery({ projectId });
}
