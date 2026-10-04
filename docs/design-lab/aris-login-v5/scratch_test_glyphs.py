from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    page = b.new_page()
    page.goto("http://127.0.0.1:5183/index.html")
    res = page.evaluate("""() => {
        const c = document.createElement("canvas");
        c.width = 1200;
        c.height = 360;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 1200, 360);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 210px 'Plus Jakarta Sans', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.letterSpacing = "28px";
        ctx.fillText("ARIS", 600, 180);
        const data = ctx.getImageData(0, 0, 1200, 360).data;
        const activeCoords = [];
        for (let y = 0; y < 360; y++) {
            for (let x = 0; x < 1200; x++) {
                const idx = (y * 1200 + x) * 4;
                if (data[idx] > 120) {
                    activeCoords.push({x, y});
                }
            }
        }
        // Subsample exactly 4000 points uniformly
        const sampled = [];
        const step = activeCoords.length / 4000;
        for (let i = 0; i < 4000; i++) {
            const idx = Math.floor(i * step);
            sampled.push(activeCoords[idx]);
        }
        return {
            totalActive: activeCoords.length,
            sampledCount: sampled.length,
            firstPoint: sampled[0],
            lastPoint: sampled[sampled.length - 1]
        };
    }""")
    print("Uniform sampling 4000 points:", res)
    b.close()
