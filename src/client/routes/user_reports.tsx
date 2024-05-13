import { DateToYMDString } from "../helpers/datetime";
import { getRouteApi } from "@tanstack/react-router";
import UserReportFrame from "../components/user_report_frame";

const routeApi = getRouteApi("/user_reports");

export default function UserReports() {
  const searchParams = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const navigateToDate = (newDateString: string) => {
    navigate({ search: { ...searchParams, from: newDateString } });
  };

  // The default selected date is two days ago. We're running on processed
  // telemetry data that could be up to 24 hours outdated, so this makes sure
  // we're not missing reports.
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() - 2);

  if (!searchParams["from"]) {
    navigateToDate(DateToYMDString(maxDate));
    return;
  }

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
              value={searchParams["from"]}
              max={DateToYMDString(maxDate)}
              onChange={(ev) => navigateToDate(ev.target.value)}
              required
            />
          </div>
        </form>
      </section>
      <section>
        <UserReportFrame from={searchParams["from"]} to={searchParams["from"]} />
      </section>
    </>
  );
}
