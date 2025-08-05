import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { LiveUpdatesService } from './live-updates.service';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  port: parseInt(process.env.WEBSOCKET_PORT) || 3002,
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class LiveUpdatesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(LiveUpdatesGateway.name);
  private connectedClients = new Map<string, Socket>();

  constructor(private readonly liveUpdatesService: LiveUpdatesService) {}

  handleConnection(client: Socket) {
    this.connectedClients.set(client.id, client);
    this.logger.log(
      `Client connected: ${client.id} (Total: ${this.connectedClients.size})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(
      `Client disconnected: ${client.id} (Total: ${this.connectedClients.size})`,
    );
  }

  @SubscribeMessage('subscribe_match')
  handleMatchSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { fixtureId: number },
  ) {
    const room = `match_${payload.fixtureId}`;
    client.join(room);

    this.logger.debug(
      `Client ${client.id} subscribed to match ${payload.fixtureId}`,
    );

    return {
      status: 'subscribed',
      fixtureId: payload.fixtureId,
      room,
    };
  }

  @SubscribeMessage('unsubscribe_match')
  handleMatchUnsubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { fixtureId: number },
  ) {
    const room = `match_${payload.fixtureId}`;
    client.leave(room);

    this.logger.debug(
      `Client ${client.id} unsubscribed from match ${payload.fixtureId}`,
    );

    return {
      status: 'unsubscribed',
      fixtureId: payload.fixtureId,
    };
  }

  @SubscribeMessage('get_live_matches')
  async handleGetLiveMatches(@ConnectedSocket() client: Socket) {
    try {
      const liveMatches = await this.liveUpdatesService.processLiveMatches();
      const updates = liveMatches.map((match) =>
        this.liveUpdatesService.formatMatchUpdate(match),
      );

      client.emit('live_matches', updates);

      return { status: 'success', count: updates.length };
    } catch (error) {
      this.logger.error('Failed to get live matches for client', error);
      client.emit('error', { message: 'Failed to fetch live matches' });
      return { status: 'error', message: error.message };
    }
  }

  // Method to broadcast match updates to subscribed clients
  broadcastMatchUpdate(fixtureId: number, update: any) {
    const room = `match_${fixtureId}`;
    this.server.to(room).emit('match_update', update);

    this.logger.debug(
      `Broadcasted update for match ${fixtureId} to room ${room}`,
    );
  }

  // Method to broadcast general fixture updates
  broadcastFixtureUpdate(fixtures: any[]) {
    this.server.emit('fixtures_update', fixtures);

    this.logger.debug(`Broadcasted fixture update to all clients`);
  }

  // Method to get connection stats
  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      rooms: this.server.sockets.adapter.rooms.size,
    };
  }
}
