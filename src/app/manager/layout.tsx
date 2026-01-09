import ManagerNav from '@/components/ManagerNav';

export default function ManagerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <ManagerNav />
            <main className="p-4 max-w-7xl mx-auto py-8">{children}</main>
        </div>
    );
}
