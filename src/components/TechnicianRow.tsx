export default function TechnicianRow({ tech }: { tech: any }) {
    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center hover:bg-gray-50">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {tech.name ? tech.name.charAt(0).toUpperCase() : 'T'}
                </div>
                <div>
                    <div className="font-semibold text-gray-900">{tech.name || 'Unnamed Technician'}</div>
                    <div className="text-xs text-gray-500">{tech.email || tech.phone || 'No contact info'}</div>
                </div>
            </div>
            <div className="text-sm">
                <span className={`px-2 py-1 rounded text-xs ${tech.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {tech.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
        </div>
    );
}
