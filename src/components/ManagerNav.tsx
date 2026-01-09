import Link from 'next/link';
import { NotificationBell } from './NotificationBell';

export default function ManagerNav() {
    return (
        <nav className="bg-blue-700 text-white p-4 shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="font-bold text-lg">AMC Manager</div>
                <div className="flex gap-4 text-sm font-medium items-center">
                    <Link href="/manager" className="hover:bg-blue-600 px-3 py-2 rounded transition">Dashboard</Link>
                    <Link href="/manager/contracts" className="hover:bg-blue-600 px-3 py-2 rounded transition">Contracts</Link>
                    <Link href="/manager/map" className="hover:bg-blue-600 px-3 py-2 rounded transition">Map</Link>

                    {/* Data Ops */}
                    <div className="h-6 w-px bg-blue-500 mx-1"></div>
                    <Link href="/manager/import" className="hover:bg-blue-600 px-3 py-2 rounded transition flex items-center gap-2">
                        <span>📥</span> Import
                    </Link>

                    {/* Tools */}
                    <Link href="/manager/technicians" className="hover:bg-blue-600 px-3 py-2 rounded transition">Techs</Link>
                </div>
                <div className="ml-4">
                    <NotificationBell />
                </div>
            </div>
        </nav>
    );
}
