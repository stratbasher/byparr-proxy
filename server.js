const express = require("express");

const app = express();
app.use(express.json());

const BYPARR_URL = process.env.BYPARR_URL || "http://byparr:8191/v1";
const PORT = process.env.PORT || 3000;

function now() {
    return new Date().toISOString();
}

function reqId() {
    return Math.random().toString(36).substring(2, 10);
}

function log(reqId, direction, message, meta = {}) {
    const metaStr = Object.entries(meta)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");

    console.log(
        `[${now()}] [REQ ${reqId}] ${direction} ${message} ${metaStr}`
    );
}

app.get("/fetch", async (req, res) => {
    const id = reqId();
    const start = Date.now();

    const rawUrl = req.query.url;
    const userAgent = req.headers["user-agent"] || "unknown";

    log(id, "IN", "request_received", {
        method: "GET",
        ip: req.ip,
        ua: userAgent
    });

    if (!rawUrl) {
        log(id, "ERR", "missing_url_param");
        return res.status(400).send("Missing ?url=");
    }

    const targetUrl = decodeURIComponent(rawUrl);

    log(id, "MID", "decoded_url", { url: targetUrl });

    try {
        log(id, "OUT", "byparr_request_start", { byparr: BYPARR_URL });

        const byparrStart = Date.now();

        const byparrResponse = await fetch(BYPARR_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                cmd: "request.get",
                url: targetUrl
            })
        });

        const byparrTime = Date.now() - byparrStart;

        log(id, "IN", "byparr_response", {
            status: byparrResponse.status,
            time_ms: byparrTime
        });

        if (!byparrResponse.ok) {
            log(id, "ERR", "byparr_failed", { status: byparrResponse.status });
            return res.status(500).send("Byparr request failed");
        }

        const data = await byparrResponse.json();
        const html = data?.solution?.response;

        if (!html) {
            log(id, "ERR", "missing_html_response");
            return res.status(500).send("No HTML in response");
        }

        const totalTime = Date.now() - start;

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);

        log(id, "OUT", "response_sent", {
            bytes: html.length,
            total_ms: totalTime
        });

    } catch (err) {
        log(id, "ERR", "exception", {
            message: err.message
        });

        res.status(500).send("Internal error");
    }
});

app.listen(PORT, () => {
    console.log(`[${now()}] shim_started port=${PORT} byparr=${BYPARR_URL}`);
});
