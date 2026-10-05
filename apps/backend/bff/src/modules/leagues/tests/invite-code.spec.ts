import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  normalizeInviteCode,
  invalidCharactersIn,
  inviteCodeExpiry,
  isInviteCodeExpired,
} from '../invite-code';

describe('invite-code', () => {
  describe('alfabeto', () => {
    it('non contiene i caratteri che si confondono a voce', () => {
      for (const ambiguous of ['0', 'O', '1', 'I', 'L']) {
        expect(INVITE_CODE_ALPHABET).not.toContain(ambiguous);
      }
    });

    it('ha 31 simboli: lo spazio dei codici e 31^4', () => {
      expect(INVITE_CODE_ALPHABET.length).toBe(31);
      expect(new Set(INVITE_CODE_ALPHABET).size).toBe(31);
    });
  });

  describe('generateInviteCode', () => {
    it('produce sempre codici della lunghezza giusta e dentro l alfabeto', () => {
      for (let i = 0; i < 500; i++) {
        const code = generateInviteCode();
        expect(code).toHaveLength(INVITE_CODE_LENGTH);
        for (const char of code) {
          expect(INVITE_CODE_ALPHABET).toContain(char);
        }
      }
    });

    it('non ripete sempre lo stesso codice', () => {
      const codes = new Set(
        Array.from({ length: 200 }, () => generateInviteCode()),
      );
      expect(codes.size).toBeGreaterThan(100);
    });
  });

  describe('normalizeInviteCode', () => {
    it('accetta minuscole, spazi e trattini', () => {
      expect(normalizeInviteCode('k7m2')).toBe('K7M2');
      expect(normalizeInviteCode(' K7 M2 ')).toBe('K7M2');
      expect(normalizeInviteCode('K7-M2')).toBe('K7M2');
    });

    it('rifiuta i caratteri ambigui invece di indovinare', () => {
      expect(normalizeInviteCode('K0M2')).toBeNull();
      expect(normalizeInviteCode('KOM2')).toBeNull();
      expect(normalizeInviteCode('K1M2')).toBeNull();
      expect(normalizeInviteCode('KIM2')).toBeNull();
      expect(normalizeInviteCode('KLM2')).toBeNull();
    });

    it('rifiuta lunghezze diverse da quattro', () => {
      expect(normalizeInviteCode('K7M')).toBeNull();
      expect(normalizeInviteCode('K7M2X')).toBeNull();
      expect(normalizeInviteCode('')).toBeNull();
    });

    it('rifiuta quello che non e una stringa', () => {
      expect(normalizeInviteCode(undefined as unknown as string)).toBeNull();
      expect(normalizeInviteCode(null as unknown as string)).toBeNull();
    });
  });

  describe('invalidCharactersIn', () => {
    it('dice quali caratteri non vanno, senza ripeterli', () => {
      expect(invalidCharactersIn('0OM2')).toEqual(['0', 'O']);
      expect(invalidCharactersIn('k7m2')).toEqual([]);
    });
  });

  describe('scadenza', () => {
    it('cade 48 ore dopo la generazione', () => {
      const now = new Date('2026-10-03T10:00:00Z');
      expect(inviteCodeExpiry(now).toISOString()).toBe(
        '2026-10-05T10:00:00.000Z',
      );
    });

    it('e scaduto nell istante esatto, non un attimo dopo', () => {
      const expires = new Date('2026-10-05T10:00:00Z');
      expect(
        isInviteCodeExpired(expires, new Date('2026-10-05T09:59:59Z')),
      ).toBe(false);
      expect(
        isInviteCodeExpired(expires, new Date('2026-10-05T10:00:00Z')),
      ).toBe(true);
    });

    it('tratta un codice senza scadenza come chiuso', () => {
      expect(isInviteCodeExpired(null)).toBe(true);
      expect(isInviteCodeExpired(undefined)).toBe(true);
    });
  });
});
