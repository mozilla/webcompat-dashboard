import { ClassifiedReport } from "../../shared/types";
import ClassifiedReportContents from "./classified_report_contents";

type ResultListProps = {
  results: ClassifiedReport[];
};

export default function ClassifiedReportList({ results }: ResultListProps) {
  return (
    <div className="result-list">
      <table className="classified-report-list">
        <tbody>
          <tr>
            <th></th>
            <th></th>
            <th>Root domain</th>
            <th>Comment</th>
            <th>ML Label</th>
            <th>ML Confidence</th>
            <th>QA Label</th>
          </tr>
          {results.map((report, index) => {
            return <ClassifiedReportContents key={report.uuid} index={index + 1} report={report} />;
          })}
        </tbody>
      </table>
    </div>
  );
}
