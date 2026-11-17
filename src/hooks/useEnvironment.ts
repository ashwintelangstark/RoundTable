import { useEffect, useState } from "react";
import {
  deriveTimeOfDay,
  formatLocationName,
  getAtmosphericProfile,
  mapWmoWeather,
  type EnvironmentState,
  type TimeOfDay,
  type WeatherCondition,
} from "@/lib/environment";

export type WeatherPresetMode = "auto" | "day" | "sunset" | "night" | "rain";

export function useEnvironment() {
  const [preset, setPreset] = useState<WeatherPresetMode>("auto");
  const [now, setNow] = useState(() => new Date());
  const [locationName, setLocationName] = useState(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return formatLocationName(tz);
    } catch {
      return "Local";
    }
  });
  const [realWeather, setRealWeather] = useState<WeatherCondition>("clear");
  const [temperature, setTemperature] = useState("22°C");
  const [isDayTime, setIsDayTime] = useState(true);

  // Update clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real-time weather from Open-Meteo using browser geolocation
  useEffect(() => {
    let cancelled = false;

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    const abortCtrl = new AbortController();

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=temperature_2m,weather_code,is_day&timezone=auto`,
            { signal: abortCtrl.signal },
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            current?: {
              temperature_2m?: number;
              weather_code?: number;
              is_day?: number;
            };
            timezone?: string;
          };
          if (cancelled || !data.current) return;

          if (data.current.temperature_2m !== undefined) {
            setTemperature(`${Math.round(data.current.temperature_2m)}°C`);
          }
          if (data.current.weather_code !== undefined) {
            setRealWeather(mapWmoWeather(data.current.weather_code));
          }
          if (data.current.is_day !== undefined) {
            setIsDayTime(data.current.is_day === 1);
          }
          if (data.timezone) {
            setLocationName(formatLocationName(data.timezone));
          }
        } catch {
          // Weather fetch failed gracefully, system time fallback used
        }
      },
      () => {
        // Permission denied or timeout; stay with default
      },
      { timeout: 4500, maximumAge: 600000 },
    );

    return () => {
      cancelled = true;
      abortCtrl.abort();
    };
  }, []);

  // Calculate active parameters
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  let activeTimeOfDay: TimeOfDay;
  let activeWeather: WeatherCondition;
  let activeIsDay = isDayTime;

  if (preset === "auto") {
    activeTimeOfDay = deriveTimeOfDay(hours);
    activeWeather = realWeather;
    activeIsDay = activeTimeOfDay !== "night";
  } else if (preset === "day") {
    activeTimeOfDay = "day";
    activeWeather = "clear";
    activeIsDay = true;
  } else if (preset === "sunset") {
    activeTimeOfDay = "sunset";
    activeWeather = "clear";
    activeIsDay = true;
  } else if (preset === "night") {
    activeTimeOfDay = "night";
    activeWeather = "clear";
    activeIsDay = false;
  } else {
    // rain
    activeTimeOfDay = hours >= 19 || hours < 6 ? "night" : "day";
    activeWeather = "rain";
    activeIsDay = activeTimeOfDay !== "night";
  }

  const atmosphere = getAtmosphericProfile(activeTimeOfDay, activeWeather, activeIsDay);

  const envState: EnvironmentState = {
    timeOfDay: activeTimeOfDay,
    weather: activeWeather,
    temperature,
    timeString,
    locationName,
    isDay: activeIsDay,
    ...atmosphere,
  };

  return {
    environment: envState,
    preset,
    setPreset,
  };
}
