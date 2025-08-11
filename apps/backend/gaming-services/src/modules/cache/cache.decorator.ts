import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache_key';
export const CACHE_TTL = 'cache_ttl';

export const CacheResult = (key: string, ttl: number = 300) => {
  return (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata(CACHE_KEY, key)(target, propertyName, descriptor);
    SetMetadata(CACHE_TTL, ttl)(target, propertyName, descriptor);
  };
};
