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
exports.CreateUserDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateUserDto {
}
exports.CreateUserDto = CreateUserDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Il nome è obbligatorio' }),
    (0, class_validator_1.IsString)({ message: 'Il nome deve essere una stringa' }),
    (0, class_validator_1.Length)(2, 100, { message: 'Il nome deve essere tra 2 e 100 caratteri' }),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim()),
    (0, class_validator_1.Matches)(/^[a-zA-ZÀ-ÿ\s'.-]+$/, {
        message: 'Il nome può contenere solo lettere, spazi, apostrofi e punti',
    }),
    __metadata("design:type", String)
], CreateUserDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Il nickname è obbligatorio' }),
    (0, class_validator_1.IsString)({ message: 'Il nickname deve essere una stringa' }),
    (0, class_validator_1.Length)(3, 50, { message: 'Il nickname deve essere tra 3 e 50 caratteri' }),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim().toLowerCase()),
    (0, class_validator_1.Matches)(/^[a-z0-9_]+$/, {
        message: 'Il nickname può contenere solo lettere minuscole, numeri e underscore',
    }),
    __metadata("design:type", String)
], CreateUserDto.prototype, "nickname", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "L'email è obbligatoria" }),
    (0, class_validator_1.IsEmail)({}, { message: 'Inserisci un indirizzo email valido' }),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim().toLowerCase()),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La password è obbligatoria' }),
    (0, class_validator_1.IsString)({ message: 'La password deve essere una stringa' }),
    (0, class_validator_1.Length)(8, 128, { message: 'La password deve essere tra 8 e 128 caratteri' }),
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'La password deve contenere almeno una lettera minuscola, una maiuscola e un numero',
    }),
    __metadata("design:type", String)
], CreateUserDto.prototype, "password", void 0);
//# sourceMappingURL=create-user.dto.js.map