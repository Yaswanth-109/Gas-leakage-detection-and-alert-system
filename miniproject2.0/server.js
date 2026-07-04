require("dotenv").config();

process.env.TZ = process.env.APP_TIME_ZONE || "Asia/Kolkata";

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 3000;
const TEMPERATURE_LIMIT = Number(process.env.TEMPERATURE_LIMIT || 40);
const GAS_LIMIT = Number(process.env.GAS_LIMIT || 600);
const ESP32_TIMEOUT_MS = Number(process.env.ESP32_TIMEOUT_MS || 10000);
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Kolkata";
const DB_TIME_ZONE = process.env.DB_TIME_ZONE || "+05:30";

let esp32Online = false;
let esp32LastSeen = null;
let esp32OfflineTimer;
let latestLiveReading = null;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getDatabaseConfig() {
    if (process.env.DATABASE_URL) {
        const url = new URL(process.env.DATABASE_URL);
        const config = {
            host: url.hostname,
            port: Number(url.port || 3306),
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.replace("/", ""),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            timezone: DB_TIME_ZONE
        };

        if (process.env.DB_SSL !== "false") {
            config.ssl = { rejectUnauthorized: false };
        }

        return config;
    }

    const config = {
        host: process.env.DB_HOST || "mysql-2b73e448-yaswanthkrishnathiramdasu-a638.l.aivencloud.com",
        port: Number(process.env.DB_PORT || 11610),
        user: process.env.DB_USER || "avnadmin",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "gas_monitor",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        timezone: DB_TIME_ZONE
    };

    if (process.env.DB_SSL !== "false") {
        config.ssl = { rejectUnauthorized: false };
    }

    return config;
}

const db = mysql.createPool(getDatabaseConfig());

db.on("connection", (connection) => {
    connection.query("SET time_zone = ?", [DB_TIME_ZONE], (err) => {
        if (err) {
            console.error("Timezone Error:", err.message);
        }
    });
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("Database Error:", err.message);
        return;
    }

    connection.release();
    console.log("MySQL Connected");
});

function getSystemStatus(temperature, gas) {
    if (temperature > TEMPERATURE_LIMIT && gas > GAS_LIMIT) {
        return "TEMPERATURE AND GAS ALERT";
    }

    if (gas > GAS_LIMIT) {
        return "GAS ALERT";
    }

    if (temperature > TEMPERATURE_LIMIT) {
        return "TEMPERATURE ALERT";
    }

    return "NORMAL";
}

function getAlertFromReading(row) {
    const temperature = Number(row.temperature);
    const gas = Number(row.gas_value ?? row.gas);
    const createdAt = row.created_at;

    if (temperature > TEMPERATURE_LIMIT && gas > GAS_LIMIT) {
        return {
            type: "TEMPERATURE AND GAS ALERT",
            level: "danger",
            message: `Temperature ${temperature} C and gas ${gas} ppm crossed the limit.`,
            created_at: createdAt
        };
    }

    if (gas > GAS_LIMIT) {
        return {
            type: "GAS ALERT",
            level: "danger",
            message: `Gas level ${gas} ppm crossed the limit.`,
            created_at: createdAt
        };
    }

    if (temperature > TEMPERATURE_LIMIT) {
        return {
            type: "TEMPERATURE ALERT",
            level: "warning",
            message: `Temperature ${temperature} C crossed the limit.`,
            created_at: createdAt
        };
    }

    return null;
}

function getHistoryWhereClause(query) {
    const minutes = Math.min(Math.max(Number(query.minutes) || 15, 1), 1440);

    if (query.start) {
        const start = String(query.start).replace("T", " ");
        return {
            where: "created_at >= ? AND created_at < DATE_ADD(?, INTERVAL ? MINUTE)",
            params: [start, start, minutes],
            minutes
        };
    }

    return {
        where: "created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)",
        params: [minutes],
        minutes
    };
}

function emitEsp32Status() {
    io.emit("esp32Status", {
        online: esp32Online,
        last_seen: esp32LastSeen
    });
}

function markEsp32Online(payload) {
    esp32Online = true;
    esp32LastSeen = new Date().toISOString();
    latestLiveReading = {
        ...payload,
        received_at: esp32LastSeen
    };

    clearEsp32OfflineTimer();
    esp32OfflineTimer = setTimeout(() => {
        esp32Online = false;
        latestLiveReading = null;
        emitEsp32Status();
    }, ESP32_TIMEOUT_MS);

    emitEsp32Status();
}

function clearEsp32OfflineTimer() {
    if (esp32OfflineTimer) {
        clearTimeout(esp32OfflineTimer);
    }
}

io.on("connection", (socket) => {
    socket.emit("esp32Status", {
        online: esp32Online,
        last_seen: esp32LastSeen
    });

    if (esp32Online && latestLiveReading) {
        socket.emit("sensorUpdate", latestLiveReading);
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "smart-air-monitoring",
        temperature_limit: TEMPERATURE_LIMIT,
        gas_limit: GAS_LIMIT,
        app_time_zone: APP_TIME_ZONE,
        db_time_zone: DB_TIME_ZONE,
        esp32_online: esp32Online,
        esp32_last_seen: esp32LastSeen
    });
});

app.get("/api/esp32-status", (req, res) => {
    res.json({
        online: esp32Online,
        last_seen: esp32LastSeen
    });
});

app.post("/sensor-data", (req, res) => {
    const temperature = Number(req.body.temperature);
    const humidity = Number(req.body.humidity);
    const gas = Number(req.body.gas);
    const fan_status = req.body.fan_status || "OFF";
    const buzzer_status = req.body.buzzer_status || "OFF";

    if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || !Number.isFinite(gas)) {
        return res.status(400).json({
            success: false,
            message: "temperature, humidity, and gas must be valid numbers"
        });
    }

    const status = getSystemStatus(temperature, gas);
    const payload = {
        temperature,
        humidity,
        gas,
        fan_status,
        buzzer_status,
        status
    };

    markEsp32Online(payload);
    io.emit("sensorUpdate", payload);

    console.log("====================================");
    console.log("SMART AIR MONITORING SYSTEM");
    console.log("====================================");
    console.log("Temperature :", temperature, "C");
    console.log("Humidity    :", humidity, "%");
    console.log("Gas Value   :", gas);
    console.log("Fan Status  :", fan_status);
    console.log("Buzzer      :", buzzer_status);
    console.log("Status      :", status);
    console.log("====================================");

    const sql = `
        INSERT INTO sensor_data
        (
            temperature,
            humidity,
            gas_value,
            fan_status,
            buzzer_status
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            temperature,
            humidity,
            gas,
            fan_status,
            buzzer_status
        ],
        (err) => {
            if (err) {
                console.error("Insert Error:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            res.status(200).json({
                success: true,
                ...payload
            });
        }
    );
});

app.get("/api/latest", (req, res) => {
    db.query(
        "SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1",
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (result.length === 0) {
                return res.json({});
            }

            res.json(result[0]);
        }
    );
});

app.get("/api/history", (req, res) => {
    const range = getHistoryWhereClause(req.query);
    const sql = `
        SELECT
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:00') AS time_bucket,
            ROUND(AVG(temperature), 2) AS temperature,
            ROUND(AVG(humidity), 2) AS humidity,
            ROUND(AVG(gas_value), 2) AS gas,
            MAX(created_at) AS created_at
        FROM sensor_data
        WHERE ${range.where}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
    `;

    db.query(sql, range.params, (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            minutes: range.minutes,
            data: result
        });
    });
});

app.get("/api/alerts", (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
    const sql = `
        SELECT temperature, humidity, gas_value, fan_status, buzzer_status, created_at
        FROM sensor_data
        WHERE gas_value > ? OR temperature > ?
        ORDER BY created_at DESC
        LIMIT ?
    `;

    db.query(sql, [GAS_LIMIT, TEMPERATURE_LIMIT, limit], (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: result.map(getAlertFromReading).filter(Boolean)
        });
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("====================================");
    console.log(`Server running on port ${PORT}`);
    console.log("Waiting for ESP32 data...");
    console.log("====================================");
});
