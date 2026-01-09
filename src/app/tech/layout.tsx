import TechNav from '@/components/TechNav';

export default function TechLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-100">
            <TechNav />
            <main className="p-3 pb-20 max-w-md mx-auto">{children}</main>
        </div>
    );
}
