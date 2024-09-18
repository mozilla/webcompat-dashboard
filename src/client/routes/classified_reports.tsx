import { DateToYMDString } from "../helpers/datetime";
import { useState } from "react";
import ClassifiedReportFrame from "../components/classified_report_frame";

export default function ClassifiedReports() {
  const defaultToDate = new Date();
  const [toDate, setToDate] = useState(DateToYMDString(defaultToDate));

  const defaultFromDate = new Date();
  defaultFromDate.setDate(defaultToDate.getDate() - 2);
  const [fromDate, setFromDate] = useState(DateToYMDString(defaultFromDate));

  const defaultPrediction = "invalid";
  const [prediction, setPrediction] = useState(defaultPrediction);

  return (
    <>
      <h2>Classified Reports</h2>
      <section>
        <form
          onSubmit={(ev) => {
            // This form should never be submitted - reloading is triggered via
            // a field value state change.
            ev.preventDefault();
          }}
        >
          <div className="form-row">
            <label htmlFor="from">
              Showing
              <select
                className="prediction-selector"
                value={prediction}
                onChange={(ev) => setPrediction(ev.target.value)}
              >
                <option value="all">all</option>
                <option value="valid">valid</option>
                <option value="invalid">invalid</option>
              </select>
              reports filed between
            </label>
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
        <ClassifiedReportFrame from={fromDate} to={toDate} prediction={prediction} />
      </section>
    </>
  );
}
