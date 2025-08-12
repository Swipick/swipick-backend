import { AppService } from './app.service';
import { Request } from 'express';
interface CreatePredictionDto {
    userId: number;
    mode: 'live' | 'test';
    fixtureId: number;
    choice: '1' | 'X' | '2';
}
interface GetUserStatsParams {
    mode?: 'live' | 'test';
}
export declare class AppController {
    private readonly appService;
    private readonly logger;
    constructor(appService: AppService);
    getHello(): string;
    getHealth(): {
        status: string;
        timestamp: string;
        service: string;
    };
    getFullHealth(): Promise<{
        bff: {
            status: string;
            timestamp: string;
            service: string;
        };
        gamingServices: any;
        overall: {
            status: string;
            timestamp: string;
        };
    }>;
    getFixtures(): Promise<any>;
    getLiveFixtures(): Promise<any>;
    getUpcomingSerieAFixtures(req: Request): Promise<any>;
    getFixtureById(id: string): Promise<any>;
    syncFixtures(body: any): Promise<any>;
    getTeams(): Promise<any>;
    getTeamById(id: string): Promise<any>;
    getTeamStatistics(id: string): Promise<any>;
    getTeamVsTeam(id1: string, id2: string): Promise<any>;
    getGamingServicesHealth(): Promise<any>;
    createPrediction(dto: CreatePredictionDto): Promise<any>;
    getUserWeeklyPredictions(userId: string, week: string, query: GetUserStatsParams): Promise<any>;
    getUserSummary(userId: string, query: GetUserStatsParams): Promise<any>;
    resetTestData(userId: string): Promise<any>;
}
export {};
