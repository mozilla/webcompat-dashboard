import { DateToYMDString } from "../helpers/datetime";
import { useState } from "react";
import UserReportFrame from "../components/user_report_frame";

export default function UserReports() {
  // The default selected date is two days ago. We're running on processed
  // telemetry data that could be up to 24 hours outdated, so this makes sure
  // we're not missing reports.
  const defaultFromDate = new Date();
  defaultFromDate.setDate(defaultFromDate.getDate() - 2);
  const [fromDate, setFromDate] = useState(DateToYMDString(defaultFromDate));

  return (
    <>
      <h2>User Reports</h2>
      <section>
        <form
          onSubmit={(ev) => {
            // This form should never be submitted - reloading is triggered via
            // a field value state change.
            ev.preventDefault();
          }}
        >
          <div className="form-row">
            <label htmlFor="from">Showing reports filed on</label>
            <input
              id="from"
              name="from"
              type="date"
              value={fromDate}
              max={defaultFromDate.toISOString().split("T")[0]}
              onChange={(ev) => setFromDate(ev.target.value)}
              required
            />
          </div>
        </form>
      </section>
      <section>
        <UserReportFrame from={fromDate} to={fromDate} />
      </section>
    </>
  );
}
