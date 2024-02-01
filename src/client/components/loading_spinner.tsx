import lightbulb from "../assets/img/lightbulb.svg";

export default function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <img src={lightbulb} width="100" height="100" alt="Loading..." />
    </div>
  );
}
