import { UserReport } from "../../shared/types";

export type UserReportEntry = {
  root_domain: string;
  known_reports: UserReport[];
  unknown_reports: UserReport[];
};
