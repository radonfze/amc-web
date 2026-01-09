import Link from 'next/link'

export default function ManagerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-white shadow-md z-10 flex-shrink-0">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-bold text-blue-600">AMC Manager</h1>
                </div>
                <nav className="p-4 space-y-2">
                    <Link href="/dashboard" className="block px-4 py-2 rounded-md hover:bg-gray-50 text-gray-700 font-medium">
                        Overview
                    </Link>
                    <Link href="/dashboard/contracts" className="block px-4 py-2 rounded-md hover:bg-gray-50 text-gray-700 font-medium">
                        Contracts
                    </Link>
                    {/* Future links: Technicians, Reports */}
                </nav>
            </aside>

            <main className="flex-1 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
