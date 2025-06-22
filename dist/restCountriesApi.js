"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCountryInfo = getCountryInfo;
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const REST_COUNTRIES_API_NAME_URL = "https://restcountries.com/v3.1/name";
const REST_COUNTRIES_API_ALPHA_URL = "https://restcountries.com/v3.1/alpha";
function getCountryInfo(country) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        if (!country || typeof country !== "string" || country.trim().length < 2) {
            return "Invalid country name.";
        }
        // Normalize input: trim, capitalize first letter of each word for name-based queries
        const normalizedCountry = country
            .trim()
            .toLowerCase()
            .replace(/[^a-zA-Z\s]/g, "");
        // Determine if input is likely a country code (2 letters)
        const isCountryCode = /^[a-zA-Z]{2}$/.test(country.trim().toUpperCase());
        let apiUrl = isCountryCode
            ? `${REST_COUNTRIES_API_ALPHA_URL}/${country.trim().toUpperCase()}`
            : `${REST_COUNTRIES_API_NAME_URL}/${encodeURIComponent(normalizedCountry.replace(/\b\w/g, (char) => char.toUpperCase()))}`;
        try {
            const response = yield axios_1.default.get(apiUrl, {
                params: { fields: "name,capital,currencies,languages,population" },
            });
            const data = response.data;
            if (!data || (Array.isArray(data) && data.length === 0)) {
                throw new Error("No country data returned");
            }
            const countryData = Array.isArray(data) ? data[0] : data;
            const currency = countryData.currencies
                ? ((_a = Object.values(countryData.currencies)[0]) === null || _a === void 0 ? void 0 : _a.name) || "N/A"
                : "N/A";
            const languages = countryData.languages
                ? Object.values(countryData.languages).join(", ") || "N/A"
                : "N/A";
            const capital = ((_b = countryData.capital) === null || _b === void 0 ? void 0 : _b[0]) || "N/A";
            const population = ((_c = countryData.population) === null || _c === void 0 ? void 0 : _c.toLocaleString()) || "N/A";
            return `Country: ${countryData.name.common}, Capital: ${capital}, Currency: ${currency}, Languages: ${languages}, Population: ${population}`;
        }
        catch (error) {
            if (((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) === 404 && !isCountryCode) {
                // Try partial match for name-based queries
                try {
                    const partialResponse = yield axios_1.default.get(`${REST_COUNTRIES_API_NAME_URL}/${encodeURIComponent(normalizedCountry)}`, {
                        params: {
                            fields: "name,capital,currencies,languages,population",
                            partial: true,
                        },
                    });
                    const data = partialResponse.data[0];
                    const currency = data.currencies
                        ? Object.values(data.currencies)[0].name
                        : "N/A";
                    const languages = data.languages
                        ? Object.values(data.languages).join(", ")
                        : "N/A";
                    return `Country: ${data.name.common}, Capital: ${data.capital[0]}, Currency: ${currency}, Languages: ${languages}, Population: ${data.population.toLocaleString()}`;
                }
                catch (partialError) {
                    console.error("Rest Countries partial match error:", ((_e = partialError.response) === null || _e === void 0 ? void 0 : _e.data) || partialError.message);
                    return `Country info unavailable for "${normalizedCountry}".`;
                }
            }
            console.error("Rest Countries API error:", ((_f = error.response) === null || _f === void 0 ? void 0 : _f.data) || error.message);
            return `Country info unavailable for "${country}".`;
        }
    });
}
