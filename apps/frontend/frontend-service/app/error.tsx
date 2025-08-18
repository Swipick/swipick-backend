"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-semibold mb-2">Si è verificato un errore</h1>
      <p className="text-gray-600 mb-6">Riprova oppure torna alla pagina iniziale.</p>
      <div className="flex gap-4">
        <button onClick={() => reset()} className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">Riprova</button>
        <Link href="/" className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100">Home</Link>
      </div>
    </main>
  );
}
