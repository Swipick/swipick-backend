"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canMakePrediction = exports.minutesUntilKickoff = exports.isDateInPast = exports.isDateInFuture = exports.parseDate = exports.formatDateTime = exports.formatDate = void 0;
const formatDate = (date) => {
    return date.toISOString().split("T")[0];
};
exports.formatDate = formatDate;
const formatDateTime = (date) => {
    return date.toISOString();
};
exports.formatDateTime = formatDateTime;
const parseDate = (dateString) => {
    return new Date(dateString);
};
exports.parseDate = parseDate;
const isDateInFuture = (date) => {
    return date.getTime() > Date.now();
};
exports.isDateInFuture = isDateInFuture;
const isDateInPast = (date) => {
    return date.getTime() < Date.now();
};
exports.isDateInPast = isDateInPast;
const minutesUntilKickoff = (kickoffTime) => {
    const now = new Date();
    const diff = kickoffTime.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60));
};
exports.minutesUntilKickoff = minutesUntilKickoff;
const canMakePrediction = (kickoffTime, bufferMinutes = 15) => {
    return (0, exports.minutesUntilKickoff)(kickoffTime) > bufferMinutes;
};
exports.canMakePrediction = canMakePrediction;
//# sourceMappingURL=date.utils.js.map