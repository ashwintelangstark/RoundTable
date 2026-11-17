/**
 * Environment & Weather Engine for RoundTable 3D Interview Room.
 * Synchronizes with user's system time, location, and real-time weather.
 */

export type TimeOfDay = "dawn" | "day" | "sunset" | "night";
export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow" | "fog" | "storm";

export interface EnvironmentState {
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
  temperature: string;
  timeString: string;
  locationName: string;
  isDay: boolean;

  // 3D Scene Parameters
  skyTopColor: string;
  skyHorizonColor: string;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  fogColor: string;
  fogNear: number;
  fogFar: number;
  interiorLightColor: string;
  interiorLightIntensity: number;
  windowGlowColor: string;
  windowGlowIntensity: number;
  precipitation: "none" | "rain" | "snow";
}

/**
 * Calculates atmospheric lighting profile based on time of day and weather.
 */
export function getAtmosphericProfile(
  timeOfDay: TimeOfDay,
  weather: WeatherCondition,
  isDay: boolean,
): Omit<
  EnvironmentState,
  "timeOfDay" | "weather" | "temperature" | "timeString" | "locationName" | "isDay"
> {
  let skyTopColor = "#3d6e94";
  let skyHorizonColor = "#b8d2de";
  let ambientColor = "#cfdce6";
  let ambientIntensity = 1.35;
  let sunColor = "#fff7ed";
  let sunIntensity = 2.2;
  let sunPosition: [number, number, number] = [-6, 14, -8];
  let fogColor = "#8fa6b0";
  let fogNear = 30;
  let fogFar = 75;
  let interiorLightColor = "#fbf5e6";
  let interiorLightIntensity = 0.85;
  let windowGlowColor = "#c0dce6";
  let windowGlowIntensity = 0.35;
  let precipitation: "none" | "rain" | "snow" = "none";

  switch (timeOfDay) {
    case "dawn":
      skyTopColor = "#3c4e68";
      skyHorizonColor = "#f3a67d";
      ambientColor = "#a8a6b2";
      ambientIntensity = 1.1;
      sunColor = "#ffaa77";
      sunIntensity = 1.8;
      sunPosition = [-14, 5.5, -8]; // Low angle eastern light
      fogColor = "#b39088";
      interiorLightIntensity = 1.2;
      windowGlowColor = "#f5aa7e";
      windowGlowIntensity = 0.55;
      break;

    case "day":
      skyTopColor = "#3a7eb8";
      skyHorizonColor = "#c0dded";
      ambientColor = "#dceaf2";
      ambientIntensity = 1.45;
      sunColor = "#fff4df";
      sunIntensity = 2.4;
      sunPosition = [-5, 16, -6];
      fogColor = "#8ea8b5";
      interiorLightIntensity = 0.75;
      windowGlowColor = "#bfe0f0";
      windowGlowIntensity = 0.3;
      break;

    case "sunset":
      skyTopColor = "#2b294e";
      skyHorizonColor = "#ff7b38";
      ambientColor = "#8d646b";
      ambientIntensity = 1.15;
      sunColor = "#ff8838";
      sunIntensity = 2.3;
      sunPosition = [14, 4.8, -7]; // Warm golden rays from west
      fogColor = "#9e6154";
      interiorLightIntensity = 1.35;
      windowGlowColor = "#ff8c4a";
      windowGlowIntensity = 0.65;
      break;

    case "night":
      skyTopColor = "#060b14";
      skyHorizonColor = "#121d30";
      ambientColor = "#1c2a3d";
      ambientIntensity = 0.62;
      sunColor = "#8fa9cf"; // Cool moonlight
      sunIntensity = 0.7;
      sunPosition = [8, 12, -9];
      fogColor = "#0c1523";
      interiorLightColor = "#fedbb0";
      interiorLightIntensity = 2.1; // Rich warm indoor chandelier & recessed lighting
      windowGlowColor = "#182740";
      windowGlowIntensity = 0.15;
      break;
  }

  // Adjust for active weather conditions
  switch (weather) {
    case "cloudy":
      skyTopColor = timeOfDay === "night" ? "#0a111a" : "#6a7b88";
      skyHorizonColor = timeOfDay === "night" ? "#141c26" : "#a8b5bd";
      ambientIntensity *= 0.85;
      sunIntensity *= 0.5;
      fogColor = timeOfDay === "night" ? "#0b121b" : "#83929b";
      fogNear = 22;
      fogFar = 55;
      interiorLightIntensity *= 1.25;
      break;

    case "fog":
      fogColor = timeOfDay === "night" ? "#101924" : "#9ca8b0";
      fogNear = 12;
      fogFar = 38;
      ambientIntensity *= 0.75;
      sunIntensity *= 0.35;
      interiorLightIntensity *= 1.3;
      break;

    case "rain":
      precipitation = "rain";
      skyTopColor = timeOfDay === "night" ? "#070e17" : "#4f5e6b";
      skyHorizonColor = timeOfDay === "night" ? "#0f1924" : "#7c8c97";
      ambientIntensity *= 0.78;
      sunIntensity *= 0.38;
      fogColor = timeOfDay === "night" ? "#0a121c" : "#6f7d87";
      fogNear = 16;
      fogFar = 46;
      interiorLightIntensity *= 1.35;
      windowGlowColor = "#546e7f";
      windowGlowIntensity = 0.4;
      break;

    case "snow":
      precipitation = "snow";
      skyTopColor = timeOfDay === "night" ? "#0c1421" : "#768694";
      skyHorizonColor = timeOfDay === "night" ? "#19263a" : "#d8e1e8";
      ambientColor = "#ccd6de";
      ambientIntensity *= 0.95;
      sunIntensity *= 0.6;
      fogColor = timeOfDay === "night" ? "#121a26" : "#b0bcc6";
      interiorLightIntensity *= 1.3;
      break;

    case "storm":
      precipitation = "rain";
      skyTopColor = "#080c12";
      skyHorizonColor = "#202a35";
      ambientColor = "#222a33";
      ambientIntensity = 0.55;
      sunIntensity = 0.25;
      fogColor = "#141c24";
      fogNear = 14;
      fogFar = 40;
      interiorLightIntensity = 2.2;
      break;

    case "clear":
    default:
      break;
  }

  // Force day/night coherence if API reported daylight
  if (isDay && timeOfDay === "night") {
    // Edge case: high latitude or timezone skew
    interiorLightIntensity = 1.0;
  }

  return {
    skyTopColor,
    skyHorizonColor,
    ambientColor,
    ambientIntensity,
    sunColor,
    sunIntensity,
    sunPosition,
    fogColor,
    fogNear,
    fogFar,
    interiorLightColor,
    interiorLightIntensity,
    windowGlowColor,
    windowGlowIntensity,
    precipitation,
  };
}

/**
 * Derives the solar time of day based on hours.
 */
export function deriveTimeOfDay(hours: number): TimeOfDay {
  if (hours >= 5 && hours < 8) return "dawn";
  if (hours >= 8 && hours < 17) return "day";
  if (hours >= 17 && hours < 21) return "sunset";
  return "night";
}

/**
 * Maps Open-Meteo WMO weather code to standard condition.
 */
export function mapWmoWeather(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if (code >= 95 && code <= 99) return "storm";
  return "clear";
}

/**
 * Returns a human-friendly city/region from the user's timezone.
 */
export function formatLocationName(timeZone: string): string {
  try {
    const parts = timeZone.split("/");
    const city = parts[parts.length - 1]?.replace(/_/g, " ");
    return city || timeZone;
  } catch {
    return "Local Station";
  }
}
