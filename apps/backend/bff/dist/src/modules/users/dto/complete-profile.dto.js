"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteProfileDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CompleteProfileDto {
}
exports.CompleteProfileDto = CompleteProfileDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Il nickname è obbligatorio' }),
    (0, class_validator_1.IsString)({ message: 'Il nickname deve essere una stringa' }),
    (0, class_validator_1.Length)(3, 50, { message: 'Il nickname deve essere tra 3 e 50 caratteri' }),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim().toLowerCase()),
    (0, class_validator_1.Matches)(/^[a-z0-9_]+$/, {
        message: 'Il nickname può contenere solo lettere minuscole, numeri e underscore',
    }),
    __metadata("design:type", String)
], CompleteProfileDto.prototype, "nickname", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)({ message: 'Le preferenze devono essere un oggetto' }),
    __metadata("design:type", Object)
], CompleteProfileDto.prototype, "preferences", void 0);
//# sourceMappingURL=complete-profile.dto.js.map