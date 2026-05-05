import LoadingSpinner from "../ui/loadingSpinner";

export default function LoadingScreen() {
  return (
    <div className="w-screen h-screen bg-[#fdfdfd] flex items-center justify-center">
        <LoadingSpinner />
    </div>
  )
}