import Link from 'next/link';

export default function StoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <div className="bg-amber-900 text-white py-8 px-4 text-center">
        <h1 className="text-3xl font-bold mb-2">Our Story</h1>
        <p className="text-amber-100">The journey of Amandi & Tharindu</p>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600 text-lg">
            Coming soon — our story will be shared here.
          </p>
        </div>
      </main>

      <nav className="text-center py-8">
        <Link href="/" className="text-amber-800 hover:text-amber-900">
          ← Back to Home
        </Link>
      </nav>
    </div>
  );
}
