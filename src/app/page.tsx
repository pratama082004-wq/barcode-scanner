// src/app/page.tsx
import DashboardLayout from "../components/DashboardLayout";
import DashboardScan from "../components/DashboardScan";

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardScan />
    </DashboardLayout>
  );
}