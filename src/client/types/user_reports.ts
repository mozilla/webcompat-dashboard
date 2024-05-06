import { UserReport } from "../../shared/types";

export type UserReportEntry = {
  root_domain: string;
  reports_count: number;
  reports: UserReport[];
};
