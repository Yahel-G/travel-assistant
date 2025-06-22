import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const REST_COUNTRIES_API_NAME_URL = "https://restcountries.com/v3.1/name";
const REST_COUNTRIES_API_ALPHA_URL = "https://restcountries.com/v3.1/alpha";

export async function getCountryInfo(country: string | null): Promise<string> {
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
    : `${REST_COUNTRIES_API_NAME_URL}/${encodeURIComponent(
        normalizedCountry.replace(/\b\w/g, (char) => char.toUpperCase())
      )}`;

  try {
    const response = await axios.get(apiUrl, {
      params: { fields: "name,capital,currencies,languages,population" },
    });

    const data = response.data;
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error("No country data returned");
    }

    const countryData = Array.isArray(data) ? data[0] : data;
    const currency = countryData.currencies
      ? Object.values(countryData.currencies as { [key: string]: any })[0]
          ?.name || "N/A"
      : "N/A";
    const languages = countryData.languages
      ? Object.values(countryData.languages).join(", ") || "N/A"
      : "N/A";
    const capital = countryData.capital?.[0] || "N/A";
    const population = countryData.population?.toLocaleString() || "N/A";

    return `Country: ${countryData.name.common}, Capital: ${capital}, Currency: ${currency}, Languages: ${languages}, Population: ${population}`;
  } catch (error: any) {
    if (error.response?.status === 404 && !isCountryCode) {
      // Try partial match for name-based queries
      try {
        const partialResponse = await axios.get(
          `${REST_COUNTRIES_API_NAME_URL}/${encodeURIComponent(
            normalizedCountry
          )}`,
          {
            params: {
              fields: "name,capital,currencies,languages,population",
              partial: true,
            },
          }
        );
        const data = partialResponse.data[0];
        const currency = data.currencies
          ? Object.values(data.currencies as { [key: string]: any })[0].name
          : "N/A";
        const languages = data.languages
          ? Object.values(data.languages).join(", ")
          : "N/A";
        return `Country: ${data.name.common}, Capital: ${
          data.capital[0]
        }, Currency: ${currency}, Languages: ${languages}, Population: ${data.population.toLocaleString()}`;
      } catch (partialError: any) {
        console.error(
          "Rest Countries partial match error:",
          partialError.response?.data || partialError.message
        );
        return `Country info unavailable for "${normalizedCountry}".`;
      }
    }
    console.error(
      "Rest Countries API error:",
      error.response?.data || error.message
    );
    return `Country info unavailable for "${country}".`;
  }
}
