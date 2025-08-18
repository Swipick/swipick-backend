import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-semibold mb-2">Pagina non trovata</h1>
      <p className="text-gray-600 mb-6">La pagina richiesta non esiste o è stata spostata.</p>
      <Link href="/" className="text-purple-600 hover:underline">Torna alla home</Link>
    </main>
  );
}
