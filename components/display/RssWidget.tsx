"use client"

import { useEffect, useState } from "react"
import { Rss } from "lucide-react"

export default function RssWidget({ url }: { url: string }) {
    const [items, setItems] = useState<{ title: string, date: string }[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchRss = async () => {
            try {
                // Use a public CORS proxy to fetch the RSS feed
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
                const res = await fetch(proxyUrl)
                const data = await res.json()
                
                if (!data.contents) throw new Error("Empty response")
                
                const parser = new DOMParser()
                const xmlDoc = parser.parseFromString(data.contents, "text/xml")
                
                const parseError = xmlDoc.querySelector("parsererror")
                if (parseError) throw new Error("Invalid RSS Feed")

                const itemsList = xmlDoc.querySelectorAll("item")
                const parsedItems = Array.from(itemsList).slice(0, 10).map(item => ({
                    title: item.querySelector("title")?.textContent || "No title",
                    date: item.querySelector("pubDate")?.textContent || ""
                }))

                setItems(parsedItems)
            } catch (err: any) {
                setError(err.message)
            }
        }

        fetchRss()
        const interval = setInterval(fetchRss, 1000 * 60 * 30) // refresh every 30 min
        return () => clearInterval(interval)
    }, [url])

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-red-400 p-8 text-center">
                <Rss className="h-12 w-12 mb-4 opacity-50" />
                <p>Failed to load RSS feed:</p>
                <p className="text-xs font-mono mt-2">{error}</p>
            </div>
        )
    }

    if (items.length === 0) {
        return <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white animate-pulse">Loading Feed...</div>
    }

    return (
        <div className="w-full h-full bg-zinc-900 flex flex-col text-white overflow-hidden p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-zinc-700 pb-4 shrink-0">
                <div className="bg-orange-500 p-2 rounded-lg">
                    <Rss className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Latest News</h2>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
                {/* CSS animation for scrolling news vertically */}
                <style>{`
                    @keyframes scrollUp {
                        0% { transform: translateY(100%); }
                        100% { transform: translateY(-100%); }
                    }
                    .animate-rss-scroll {
                        animation: scrollUp 30s linear infinite;
                    }
                `}</style>
                <div className="animate-rss-scroll space-y-6">
                    {items.map((item, idx) => (
                        <div key={idx} className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
                            <h3 className="text-xl font-semibold leading-snug">{item.title}</h3>
                            {item.date && <p className="text-sm text-zinc-400 mt-2 font-mono">{new Date(item.date).toLocaleString()}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
