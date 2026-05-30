"use client"

import { QRCodeSVG } from "qrcode.react"

export function QRCodeOverlay({ url, label = "Scan Me" }: { url: string, label?: string }) {
    if (!url) return null

    return (
        <div className="absolute bottom-6 right-6 z-50 flex flex-col items-center bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-2xl border border-white/20 animate-in slide-in-from-bottom-8 fade-in duration-700">
            <div className="bg-white p-2 rounded-xl shadow-inner">
                <QRCodeSVG
                    value={url}
                    size={96}
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"H"}
                    includeMargin={false}
                />
            </div>
            <p className="text-black font-bold text-[10px] mt-2 uppercase tracking-widest">{label}</p>
        </div>
    )
}
