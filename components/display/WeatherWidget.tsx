"use client"

import { useEffect, useState } from "react"
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun } from "lucide-react"

export default function WeatherWidget({ location }: { location: string }) {
    const [weather, setWeather] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // 1. Geocode location
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`)
                const geoData = await geoRes.json()
                
                if (!geoData.results || geoData.results.length === 0) {
                    throw new Error("Location not found")
                }

                const { latitude, longitude, name, country } = geoData.results[0]

                // 2. Fetch forecast
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`)
                const weatherData = await weatherRes.json()

                setWeather({
                    name: `${name}, ${country}`,
                    temp: Math.round(weatherData.current_weather.temperature),
                    code: weatherData.current_weather.weathercode,
                })
            } catch (err: any) {
                setError(err.message)
            }
        }

        fetchWeather()
        const interval = setInterval(fetchWeather, 1000 * 60 * 15) // refresh every 15 min
        return () => clearInterval(interval)
    }, [location])

    if (error) {
        return <div className="w-full h-full flex items-center justify-center bg-sky-900 text-white font-mono text-sm">Weather Error: {error}</div>
    }

    if (!weather) {
        return <div className="w-full h-full flex items-center justify-center bg-sky-900 text-white animate-pulse">Loading Weather...</div>
    }

    // Map WMO weather codes to icons
    const renderIcon = (code: number) => {
        const props = { className: "h-24 w-24 text-white drop-shadow-md" }
        if (code === 0) return <Sun {...props} className="h-24 w-24 text-yellow-300 drop-shadow-md" />
        if (code >= 1 && code <= 3) return <Cloud {...props} />
        if (code >= 45 && code <= 48) return <CloudFog {...props} />
        if (code >= 51 && code <= 67) return <CloudDrizzle {...props} className="h-24 w-24 text-blue-200 drop-shadow-md" />
        if (code >= 71 && code <= 77) return <CloudSnow {...props} />
        if (code >= 80 && code <= 82) return <CloudRain {...props} className="h-24 w-24 text-blue-300 drop-shadow-md" />
        if (code >= 95 && code <= 99) return <CloudLightning {...props} className="h-24 w-24 text-yellow-400 drop-shadow-md" />
        return <Sun {...props} /> // default
    }

    return (
        <div className="w-full h-full bg-gradient-to-br from-sky-500 to-indigo-600 flex flex-col items-center justify-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-20">
                {renderIcon(weather.code)}
            </div>
            
            <div className="z-10 text-center flex flex-col items-center">
                {renderIcon(weather.code)}
                <h1 className="text-8xl font-black mt-4 tracking-tighter drop-shadow-lg">{weather.temp}°</h1>
                <h2 className="text-2xl font-semibold tracking-wide uppercase opacity-90 mt-2">{weather.name}</h2>
            </div>
        </div>
    )
}
