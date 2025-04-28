import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const REST_COUNTRIES_API_URL = "https://restcountries.com/v3.1/name";

export async function getCountryInfo(country: string): Promise<string> {
  if (!country || typeof country !== "string" || country.trim().length < 2) {
    return "Invalid country name.";
  }

  // Normalize input: trim, capitalize first letter of each word
  const normalizedCountry = country
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/[^a-zA-Z\s]/g, "");

  try {
    const response = await axios.get(
      `${REST_COUNTRIES_API_URL}/${encodeURIComponent(normalizedCountry)}`,
      {
        params: { fields: "name,capital,currencies,languages,population" },
      }
    );

    const data = response.data[0];
    const currency = Object.values(data.currencies as { [key: string]: any })[0]
      .name;
    const languages = Object.values(data.languages).join(", ");
    return `Country: ${data.name.common}, Capital: ${
      data.capital[0]
    }, Currency: ${currency}, Languages: ${languages}, Population: ${data.population.toLocaleString()}`;
  } catch (error: any) {
    if (error.response?.status === 404) {
      // Try partial match
      try {
        const partialResponse = await axios.get(
          `${REST_COUNTRIES_API_URL}/${encodeURIComponent(normalizedCountry)}`,
          {
            params: {
              fields: "name,capital,currencies,languages,population",
              partial: true,
            },
          }
        );
        const data = partialResponse.data[0];
        const currency = Object.values(
          data.currencies as { [key: string]: any }
        )[0].name;
        const languages = Object.values(data.languages).join(", ");
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
    return `Country info unavailable for "${normalizedCountry}".`;
  }
}
