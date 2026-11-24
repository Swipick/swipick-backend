import { EmailService } from './email.service';

describe('EmailService — lingua', () => {
  const service = new EmailService(
    {
      get: (k: string, d?: unknown) => (k === 'EMAIL_PROVIDER' ? 'smtp' : d),
    } as never,
    {} as never,
  );
  const crea = (tipo: 'verifica' | 'reset', lingua: 'it' | 'en') =>
    tipo === 'verifica'
      ? (service as any).generateVerificationEmailTemplate(
          'Zeno',
          'https://x.test/?a=1',
          lingua,
        )
      : (service as any).generatePasswordResetEmailTemplate(
          'Zeno',
          'https://x.test/?a=1',
          lingua,
        );

  it('italiano: oggetti e testi di sempre', () => {
    expect(crea('verifica', 'it').subject).toBe(
      'Conferma il tuo indirizzo email',
    );
    expect(crea('reset', 'it').subject).toBe('Reimposta la tua password');
    expect(crea('verifica', 'it').html).toContain('<html lang="it">');
  });

  it('inglese: oggetto, lingua della pagina e testi', () => {
    const v = crea('verifica', 'en');
    expect(v.subject).toBe('Confirm your email address');
    expect(v.html).toContain('<html lang="en">');
    expect(v.html).toContain('Hi Zeno, one more step');
    expect(v.html).toContain('Follow Swipick on Instagram');
    expect(v.text).toContain('Open this link:');
    expect(v.html).not.toMatch(/Ciao|Conferma|Segui Swipick/);
    expect(crea('reset', 'en').subject).toBe('Reset your password');
  });
});
