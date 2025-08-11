export declare const formatDate: (date: Date) => string;
export declare const formatDateTime: (date: Date) => string;
export declare const parseDate: (dateString: string) => Date;
export declare const isDateInFuture: (date: Date) => boolean;
export declare const isDateInPast: (date: Date) => boolean;
export declare const minutesUntilKickoff: (kickoffTime: Date) => number;
export declare const canMakePrediction: (kickoffTime: Date, bufferMinutes?: number) => boolean;
