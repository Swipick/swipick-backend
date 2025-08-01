export const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

export const formatDateTime = (date: Date): string => {
  return date.toISOString();
};

export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

export const isDateInFuture = (date: Date): boolean => {
  return date.getTime() > Date.now();
};

export const isDateInPast = (date: Date): boolean => {
  return date.getTime() < Date.now();
};

export const minutesUntilKickoff = (kickoffTime: Date): number => {
  const now = new Date();
  const diff = kickoffTime.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60));
};

export const canMakePrediction = (
  kickoffTime: Date,
  bufferMinutes: number = 15
): boolean => {
  return minutesUntilKickoff(kickoffTime) > bufferMinutes;
};
