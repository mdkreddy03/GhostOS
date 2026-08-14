export type Weather = {
  place: string;
  temp: number;
  feels: number;
  code: number;
  label: string;
  high: number;
  low: number;
};

const CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm + hail",
};

export async function fetchWeather(location: string): Promise<Weather | null> {
  const query = location.trim() || "Austin";
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
  );
  const geo = await geoRes.json();
  const hit = geo?.results?.[0];
  if (!hit) return null;
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`,
  );
  const data = await res.json();
  const code = data?.current?.weather_code ?? 0;
  return {
    place: [hit.name, hit.admin1].filter(Boolean).join(", "),
    temp: Math.round(data?.current?.temperature_2m ?? 0),
    feels: Math.round(data?.current?.apparent_temperature ?? 0),
    code,
    label: CODES[code] ?? "Clear",
    high: Math.round(data?.daily?.temperature_2m_max?.[0] ?? 0),
    low: Math.round(data?.daily?.temperature_2m_min?.[0] ?? 0),
  };
}
