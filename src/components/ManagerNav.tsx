import Link from 'next/link';
import { NotificationBell } from './NotificationBell';

export default function ManagerNav() {
    return (
        <nav className="bg-blue-700 text-white p-4 shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="font-bold text-lg">AMC Manager</div>
                <div className="flex gap-6 text-sm font-medium">
                    <Link href="/manager" className="hover:text-blue-200 transition">Dashboard</Link>
                    <Link href="/manager/contracts" className="hover:text-blue-200 transition">Contracts</Link>
                    <Link href="/manager/contracts/lifecycle" className="hover:text-blue-200 transition opacity-80 text-xs mt-0.5">Lifecycle</Link>
                    <Link href="/manager/map" className="hover:text-blue-200 transition">Map</Link>
                    <Link href="/manager/import" className="text-gray-600 hover:text-blue-600">Import</Link>
                    <Link href="/manager/customers/merge" className="text-gray-600 hover:text-blue-600">Merge</Link>
                    <Link href="/manager/technicians" className="hover:bg-blue-600 px-3 py-2 rounded transition">Technicians</Link>
                    <Link href="/manager/technicians/areas" className="hover:bg-blue-600 px-3 py-2 rounded transition text-sm opacity-80">Areas</Link>
                    <Link href="/manager/technicians/performance" className="hover:bg-blue-600 px-3 py-2 rounded transition text-sm opacity-80">Performance</Link>
                    <Link href="/manager/import" className="hover:bg-blue-600 px-3 py-2 rounded transition">Import</Link>
                    <Link href="/manager/customers/merge" className="hover:bg-blue-600 px-3 py-2 rounded transition text-sm opacity-80">Merge</Link>
                    <Link href="/manager/payments" className="hover:text-blue-200 transition">Payments</Link>
                </div>
                <div className="ml-4">
                    <NotificationBell />
                </div>
            </div>
        </nav>
    );
}
