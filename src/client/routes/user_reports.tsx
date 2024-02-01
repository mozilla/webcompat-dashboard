import { DateToYMDString } from "../helpers/datetime";
import { useState } from "react";
import UserReportFrame from "../components/user_report_frame";

export default function UserReports() {
  const defaultToDate = new Date();
  const [toDate, setToDate] = useState(DateToYMDString(defaultToDate));

  const defaultFromDate = new Date();
  defaultFromDate.setDate(defaultToDate.getDate() - 7);
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
            <label htmlFor="from">Showing reports filed between</label>
            <input
              id="from"
              name="from"
              type="date"
              value={fromDate}
              onChange={(ev) => setFromDate(ev.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="to">and</label>
            <input
              id="to"
              name="to"
              type="date"
              value={toDate}
              onChange={(ev) => setToDate(ev.target.value)}
              required
            />
          </div>
        </form>
      </section>
      <section>
        <UserReportFrame from={fromDate} to={toDate} />
      </section>
    </>
  );
}
