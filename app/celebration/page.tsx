import Link from 'next/link';

export default function CelebrationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <div className="bg-amber-900 text-white py-8 px-4 text-center">
        <h1 className="text-3xl font-bold mb-2">Celebration</h1>
        <p className="text-amber-100">Join us on December 14, 2026</p>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-amber-900 mb-4">Ceremony</h2>
            <p className="text-gray-600">Location and time to be announced</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-amber-900 mb-4">Reception</h2>
            <p className="text-gray-600">Details coming soon</p>
          </div>
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
