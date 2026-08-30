import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <section className="text-center py-20 px-4">
        <h1 className="text-5xl font-bold text-amber-900 mb-4">
          Amandi & Tharindu
        </h1>
        <p className="text-xl text-amber-700 mb-4">
          December 14, 2026 | Colombo, Sri Lanka
        </p>
        <p className="text-lg text-gray-600 mb-8">
          We invite you to celebrate our special day
        </p>
        <Link
          href="/login"
          className="inline-block bg-amber-800 text-white px-8 py-3 rounded-lg hover:bg-amber-900 transition"
        >
          Access Your Invitation
        </Link>
      </section>

      {/* Navigation */}
      <nav className="border-t border-amber-100 py-6">
        <div className="max-w-4xl mx-auto px-4 flex justify-center gap-6">
          <Link href="/" className="text-amber-800 hover:text-amber-900">
            Home
          </Link>
          <Link href="/story" className="text-amber-800 hover:text-amber-900">
            Our Story
          </Link>
          <Link href="/celebration" className="text-amber-800 hover:text-amber-900">
            Celebration
          </Link>
          <Link href="/gallery" className="text-amber-800 hover:text-amber-900">
            Gallery
          </Link>
          <Link href="/wishes" className="text-amber-800 hover:text-amber-900">
            Wishes
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-500 text-sm border-t border-gray-200">
        <p>© 2026 Amandi & Tharindu</p>
      </footer>
    </main>
  );
}
