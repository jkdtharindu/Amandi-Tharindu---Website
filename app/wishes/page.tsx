import Link from 'next/link';

export default function WishesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <div className="bg-amber-900 text-white py-8 px-4 text-center">
        <h1 className="text-3xl font-bold mb-2">Wishes</h1>
        <p className="text-amber-100">Messages from our loved ones</p>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600 text-lg mb-6">
            Guest wishes will appear here.
          </p>
          <Link
            href="/login"
            className="inline-block bg-amber-800 text-white px-6 py-2 rounded-lg hover:bg-amber-900 transition"
          >
            Login to Leave a Wish
          </Link>
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
