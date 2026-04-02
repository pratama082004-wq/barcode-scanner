import HistoryActivity from "../../components/HistoryActivity";
import DashboardLayout from "../../components/DashboardLayout"; 

export default function HistoryActivityPage() {
  return (
    <DashboardLayout>
      <div className="w-full h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto">
        <HistoryActivity />
      </div>
    </DashboardLayout>
  );
}