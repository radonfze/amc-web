import OfflineBanner from "@/components/OfflineBanner";
import OfflineSyncManager from "@/components/OfflineSyncManager";
import { Toaster } from 'sonner';

export default function TechnicianLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <OfflineSyncManager />
            <OfflineBanner />
            <Toaster position="top-center" />

            {/* Mobile Header could go here */}
            <header className="bg-blue-600 p-4 text-white shadow-sm sticky top-0 z-10">
                <h1 className="text-lg font-bold">Technician Portal</h1>
            </header>

            <main className="p-4">
                {children}
            </main>

            {/* Mobile Bottom Nav could go here */}
        </div>
    )
}
