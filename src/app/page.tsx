import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-900">
      <main className="flex w-full max-w-md flex-col items-center gap-8 px-6 text-center">
        
        {/* Branding Placeholder - You can add an <Image> here later */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-10 w-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Pryzo AMC
          </h1>
          <p className="text-lg text-gray-500">
            Enterprise Annual Maintenance Contract Management Platform
          </p>
        </div>

        <div className="w-full space-y-4 pt-4">
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Sign In to Dashboard
          </Link>
          
          <p className="text-xs text-gray-400">
            Authorized Personnel Only
          </p>
        </div>

      </main>
      
      <footer className="absolute bottom-6 text-sm text-gray-400">
        &copy; {new Date().getFullYear()} Radon FZE. All rights reserved.
      </footer>
    </div>
  );
}
