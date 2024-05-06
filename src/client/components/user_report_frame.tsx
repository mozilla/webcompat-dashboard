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

      return await res.json();
    },
  });

  return (
    <>
      {isLoading && <LoadingSpinner />}
      {error && (
        <div className="error-box">
          <p>{error.message}</p>
          <p>Are you connected to the Mozilla Corp VPN?</p>
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
