import { Pluralize } from "../helpers/language";
import { useQuery } from "@tanstack/react-query";
import { UserReportEntry } from "../types/user_reports";
import LoadingSpinner from "./loading_spinner";
import UserReportList from "./user_report_list";

type UserReportFrameProps = {
  from: string;
  to: string;
};

export default function UserReportFrame({ from, to }: UserReportFrameProps) {
  const { isLoading, error, data } = useQuery<UserReportEntry[], Error>({
    queryKey: ["userReportResults", from, to],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_WEB_ROOT}/api/user_reports.json?${new URLSearchParams({ from, to })}`,
        {
          credentials: "include",
        },
      );

      const resData = await res.json();
      if (res.status == 200) {
        return resData;
      } else if (resData.error) {
        throw new Error(resData.error);
      } else {
        throw new Error(`Unexpected sever-side error! status code: ${res.status}`);
      }
    },
  });

  return (
    <>
      {isLoading && <LoadingSpinner />}
      {error && (
        <div className="error-box">
          <p>
            <strong>Error while trying to load the data</strong>:
          </p>
          <p>{error.message}</p>
        </div>
      )}
      {data &&
        (data.length < 1 ? (
          <h3>No reports for the selected date range found! :(</h3>
        ) : (
          <>
            <h3>
              Found reports for {data.length} {Pluralize(data.length, "domain", "domains")}:
            </h3>
            <UserReportList results={data} />
          </>
        ))}
    </>
  );
}
