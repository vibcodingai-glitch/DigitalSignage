"use client"

import { useEffect, useRef } from "react"

// ==============================================================
// TABLEAU EMBED COMPONENT
// A specialized wrapper for the Tableau Embedding API v3 that
// automatically fills 100% of its container with no fixed-pixel
// constraints imposed by the workbook author's size settings.
// ==============================================================
export default function TableauVizEmbed({ url, onLoaded }: { url: string, onLoaded?: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Inject global style to force Tableau's internal shadowing to be full screen
        const styleId = 'tableau-fullscreen-fix'
        if (!document.getElementById(styleId)) {
            const s = document.createElement('style')
            s.id = styleId
            s.innerHTML = `
                tableau-viz, .tableau-viz-container { width: 100vw !important; height: 100vh !important; }
                iframe { border: none !important; width: 100% !important; height: 100% !important; }
            `
            document.head.appendChild(s)
        }
        
        const container = containerRef.current
        const renderViz = () => {
            if (!container) return
            if (container) {
                container.innerHTML = ''
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const viz: any = document.createElement('tableau-viz')

            // Convert profile/viz URL to embeddable /views/ format
            let embedUrl = url
            try {
                const u = new URL(url)
                const match = u.pathname.match(/\/viz\/([^/]+)\/([^/]+)/)
                if (match) {
                    embedUrl = `https://public.tableau.com/views/${match[1]}/${match[2]}?:embed=y&:showVizHome=no&:toolbar=no`
                } else if (u.pathname.startsWith('/views/')) {
                    u.searchParams.set(':embed', 'y')
                    u.searchParams.set(':showVizHome', 'no')
                    u.searchParams.set(':toolbar', 'no')
                    embedUrl = u.toString()
                }
            } catch { /* use url as-is */ }

            viz.setAttribute('src', embedUrl)
            viz.setAttribute('sizing', 'automatic')
            viz.setAttribute('toolbar', 'no')
            viz.setAttribute('hide-tabs', '')
            viz.style.cssText = 'width:100%;height:100%;display:block;margin:0;padding:0;'
            
            // Call onLoaded when the viz is appended (or slightly after)
            container.appendChild(viz)
            if (onLoaded) setTimeout(onLoaded, 500)
        }

        // If the API custom element is already registered, render immediately
        if (typeof customElements !== 'undefined' && customElements.get('tableau-viz')) {
            renderViz()
            return
        }

        // Avoid loading the script more than once
        const scriptId = 'tableau-embedding-api-v3'
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script')
            script.id = scriptId
            script.type = 'module'
            script.src = 'https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js'
            script.onload = renderViz
            document.head.appendChild(script)
        } else {
            // Script tag exists but may still be loading
            const wait = setInterval(() => {
                if (typeof customElements !== 'undefined' && customElements.get('tableau-viz')) {
                    clearInterval(wait)
                    renderViz()
                }
            }, 100)
            return () => clearInterval(wait)
        }

        return () => { container.innerHTML = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url])

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'block' }}
        />
    )
}
