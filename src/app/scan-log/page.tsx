// src/app/scan-log/page.tsx

// Gunakan ../../ untuk mundur 2 folder (keluar dari scan-log, keluar dari app, masuk ke components)
import DashboardLayout from "../../components/DashboardLayout";
import ScanLog from "../../components/ScanLog";

export default function ScanLogPage() {
  return (
    <DashboardLayout>
      <ScanLog />
    </DashboardLayout>
  );
}