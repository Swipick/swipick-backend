import { registerAs } from '@nestjs/config';

export interface WebSocketConfig {
  port: number;
  cors: {
    origin: string | boolean;
    credentials: boolean;
  };
  transports: string[];
}

export const WebSocketConfig = registerAs(
  'websocket',
  (): WebSocketConfig => ({
    port: parseInt(process.env.WEBSOCKET_PORT, 10) || 3001,
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  }),
);
