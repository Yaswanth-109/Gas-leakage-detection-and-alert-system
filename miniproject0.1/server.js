require("dotenv").config();

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
            queueLimit: 0
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
        queueLimit: 0
    };

    if (process.env.DB_SSL !== "false") {
        config.ssl = { rejectUnauthorized: false };
    }

    return config;
}

const db = mysql.createPool(getDatabaseConfig());

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

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "smart-air-monitoring",
        temperature_limit: TEMPERATURE_LIMIT,
        gas_limit: GAS_LIMIT
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

            const payload = {
                temperature,
                humidity,
                gas,
                fan_status,
                buzzer_status,
                status
            };

            io.emit("sensorUpdate", payload);

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

server.listen(PORT, "0.0.0.0", () => {
    console.log("====================================");
    console.log(`Server running on port ${PORT}`);
    console.log("Waiting for ESP32 data...");
    console.log("====================================");
});
