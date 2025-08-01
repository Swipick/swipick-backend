"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeString = exports.isValidMatchStatus = exports.isValidScore = exports.isEmail = void 0;
const isEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isEmail = isEmail;
const isValidScore = (score) => {
    return Number.isInteger(score) && score >= 0 && score <= 99;
};
exports.isValidScore = isValidScore;
const isValidMatchStatus = (status) => {
    return ["scheduled", "live", "finished"].includes(status);
};
exports.isValidMatchStatus = isValidMatchStatus;
const sanitizeString = (input) => {
    return input.trim().replace(/[<>]/g, "");
};
exports.sanitizeString = sanitizeString;
//# sourceMappingURL=validation.utils.js.map