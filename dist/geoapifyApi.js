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
exports.getAttractions = getAttractions;
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const GEOAPIFY_API_URL = "https://api.geoapify.com/v2/places";
function getAttractions(city) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!process.env.GEOAPIFY_API_KEY) {
            throw new Error("GEOAPIFY_API_KEY is not defined in .env file");
        }
        try {
            // First, get place ID for the city (Geoapify requires a place filter)
            const placeResponse = yield axios_1.default.get(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&apiKey=${process.env.GEOAPIFY_API_KEY}`);
            const placeId = (_a = placeResponse.data.features[0]) === null || _a === void 0 ? void 0 : _a.properties.place_id;
            if (!placeId)
                return "No attractions found.";
            // Fetch attractions (e.g., tourism, culture, leisure)
            const response = yield axios_1.default.get(GEOAPIFY_API_URL, {
                params: {
                    categories: "tourism,entertainment.culture,leisure",
                    filter: `place:${placeId}`,
                    limit: 3,
                    apiKey: process.env.GEOAPIFY_API_KEY,
                },
            });
            const attractions = response.data.features.map((feature) => {
                const name = feature.properties.name || "Unnamed attraction";
                const category = feature.properties.categories[0] || "place";
                return `${name} (${category})`;
            });
            return attractions.length > 0
                ? `Attractions: ${attractions.join(", ")}`
                : "No attractions found.";
        }
        catch (error) {
            console.error("Geoapify API error:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            return "Attractions unavailable.";
        }
    });
}
