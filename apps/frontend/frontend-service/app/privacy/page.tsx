'use client';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-purple-800 mb-8">Privacy Policy</h1>
        
        <div className="prose max-w-none">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Informazioni che Raccogliamo</h2>
          <p className="text-gray-600 mb-6">
            Raccogliamo le seguenti informazioni quando utilizzi Swipick:
          </p>
          <ul className="text-gray-600 mb-6 list-disc list-inside">
            <li>Nome e cognome</li>
            <li>Indirizzo email</li>
            <li>Nickname scelto</li>
            <li>Dati di utilizzo della piattaforma</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Come Utilizziamo le Tue Informazioni</h2>
          <p className="text-gray-600 mb-6">
            Utilizziamo le tue informazioni per:
          </p>
          <ul className="text-gray-600 mb-6 list-disc list-inside">
            <li>Fornire e gestire il servizio Swipick</li>
            <li>Creare e gestire il tuo account</li>
            <li>Comunicare con te riguardo al servizio</li>
            <li>Migliorare la nostra piattaforma</li>
            <li>Garantire la sicurezza del servizio</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">3. Condivisione delle Informazioni</h2>
          <p className="text-gray-600 mb-6">
            Non vendiamo, affittiamo o condividiamo le tue informazioni personali con terze parti, 
            eccetto nei seguenti casi:
          </p>
          <ul className="text-gray-600 mb-6 list-disc list-inside">
            <li>Quando richiesto dalla legge</li>
            <li>Per proteggere i nostri diritti legali</li>
            <li>Con fornitori di servizi che ci aiutano a gestire la piattaforma (sotto accordi di riservatezza)</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">4. Sicurezza dei Dati</h2>
          <p className="text-gray-600 mb-6">
            Implementiamo misure di sicurezza appropriate per proteggere le tue informazioni personali 
            contro accesso, alterazione, divulgazione o distruzione non autorizzati.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">5. I Tuoi Diritti</h2>
          <p className="text-gray-600 mb-6">
            Hai il diritto di:
          </p>
          <ul className="text-gray-600 mb-6 list-disc list-inside">
            <li>Accedere alle tue informazioni personali</li>
            <li>Correggere informazioni inesatte</li>
            <li>Richiedere la cancellazione del tuo account</li>
            <li>Opporti al trattamento dei tuoi dati</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">6. Cookie e Tecnologie Simili</h2>
          <p className="text-gray-600 mb-6">
            Utilizziamo cookie e tecnologie simili per migliorare la tua esperienza, 
            analizzare l&apos;utilizzo del servizio e personalizzare i contenuti.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">7. Modifiche alla Privacy Policy</h2>
          <p className="text-gray-600 mb-6">
            Potremmo aggiornare questa privacy policy periodicamente. 
            Ti informeremo di eventuali modifiche significative.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">8. Contattaci</h2>
          <p className="text-gray-600">
            Per domande sulla privacy policy o sui tuoi dati personali, 
            contattaci all&apos;indirizzo: privacy@swipick.com
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
