'use client';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-purple-800 mb-8">Termini di Servizio</h1>
        
        <div className="prose max-w-none">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Accettazione dei Termini</h2>
          <p className="text-gray-600 mb-6">
            Utilizzando Swipick, accetti di essere vincolato da questi termini di servizio. 
            Se non accetti questi termini, non utilizzare il nostro servizio.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Descrizione del Servizio</h2>
          <p className="text-gray-600 mb-6">
            Swipick è una piattaforma che permette agli utenti di fare previsioni sui risultati delle partite di calcio 
            e competere con altri utenti in un ambiente di gioco responsabile.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">3. Account Utente</h2>
          <ul className="text-gray-600 mb-6 list-disc list-inside">
            <li>Devi fornire informazioni accurate e complete durante la registrazione</li>
            <li>Sei responsabile di mantenere la sicurezza del tuo account</li>
            <li>Non puoi condividere il tuo account con altri</li>
            <li>Devi avere almeno 18 anni per utilizzare il servizio</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">4. Comportamento dell&apos;Utente</h2>
          <p className="text-gray-600 mb-6">
            Gli utenti si impegnano a utilizzare il servizio in modo responsabile e rispettoso, 
            evitando comportamenti che possano danneggiare altri utenti o la piattaforma.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">5. Limitazione di Responsabilità</h2>
          <p className="text-gray-600 mb-6">
            Swipick non è responsabile per eventuali perdite derivanti dall&apos;utilizzo del servizio. 
            Il servizio è fornito &quot;così com&apos;è&quot; senza garanzie di alcun tipo.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">6. Modifiche ai Termini</h2>
          <p className="text-gray-600 mb-6">
            Ci riserviamo il diritto di modificare questi termini in qualsiasi momento. 
            Le modifiche saranno comunicate agli utenti attraverso la piattaforma.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">7. Contatti</h2>
          <p className="text-gray-600">
            Per domande sui termini di servizio, contattaci all&apos;indirizzo: support@swipick.com
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
          </p>
        </div>
      </div>
    </div>
  );
}
