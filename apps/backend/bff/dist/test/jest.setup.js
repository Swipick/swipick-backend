"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
global.console = {
    ...console,
};
process.env.NODE_ENV = 'test';
process.env.PORT = '9000';
//# sourceMappingURL=jest.setup.js.map