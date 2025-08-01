export const isEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidScore = (score: number): boolean => {
  return Number.isInteger(score) && score >= 0 && score <= 99;
};

export const isValidMatchStatus = (status: string): boolean => {
  return ["scheduled", "live", "finished"].includes(status);
};

export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};
