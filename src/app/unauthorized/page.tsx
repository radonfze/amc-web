export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full text-center space-y-4">
                <h1 className="text-4xl font-bold text-red-600">403</h1>
                <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
                <p className="text-gray-600">
                    You do not have permission to access this page.
                </p>
                <a href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Go Home
                </a>
            </div>
        </div>
    );
}
