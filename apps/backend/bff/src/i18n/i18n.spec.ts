import { BadRequestException, NotFoundException } from '@nestjs/common';
import { linguaDaHeader } from './lingua';
import { traduciMessaggio } from './messaggi-en';
import { TraduzioneErroriFilter } from './traduzione-errori.filter';

describe('linguaDaHeader', () => {
  it("inglese solo se la prima lingua è l'inglese", () => {
    expect(linguaDaHeader('en')).toBe('en');
    expect(linguaDaHeader('en-GB,it;q=0.8')).toBe('en');
    expect(linguaDaHeader('it')).toBe('it');
    expect(linguaDaHeader('it-IT,en;q=0.8')).toBe('it');
    expect(linguaDaHeader('de')).toBe('it');
    expect(linguaDaHeader(undefined)).toBe('it');
  });
});

describe('traduciMessaggio', () => {
  it('traduce i messaggi noti e lascia gli altri', () => {
    expect(traduciMessaggio('Utente non trovato', 'en')).toBe('User not found');
    expect(traduciMessaggio('Utente non trovato', 'it')).toBe(
      'Utente non trovato',
    );
    expect(traduciMessaggio('Un messaggio nuovo', 'en')).toBe(
      'Un messaggio nuovo',
    );
  });

  it('traduce anche i messaggi con una parte variabile', () => {
    expect(
      traduciMessaggio(
        'Il codice non contiene O, 1: controlla, le lettere O e I e i numeri 0 e 1 non si usano',
        'en',
      ),
    ).toMatch(/^The code can't contain O, 1:/);
  });
});

describe('TraduzioneErroriFilter', () => {
  const esegui = (
    eccezione: Error & { getStatus(): number; getResponse(): unknown },
    lingua?: string,
  ) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({
          headers: lingua ? { 'accept-language': lingua } : {},
        }),
      }),
    };
    new TraduzioneErroriFilter().catch(eccezione as never, host as never);
    return res;
  };

  it('senza Accept-Language la risposta è quella di sempre', () => {
    const res = esegui(new NotFoundException('Utente non trovato'));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Utente non trovato',
      error: 'Not Found',
      statusCode: 404,
    });
  });

  it('in inglese traduce il messaggio e lascia il resto', () => {
    const res = esegui(new NotFoundException('Utente non trovato'), 'en');
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not found',
      error: 'Not Found',
      statusCode: 404,
    });
  });

  it('traduce anche gli elenchi della validazione', () => {
    const res = esegui(
      new BadRequestException([
        'Il nickname è obbligatorio',
        'La password è obbligatoria',
      ]),
      'en',
    );
    expect((res.json as jest.Mock).mock.calls[0][0].message).toEqual([
      'The nickname is required',
      'The password is required',
    ]);
  });
});
