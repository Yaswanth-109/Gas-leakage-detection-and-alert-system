# Smart Air Monitoring Dashboard

A real-time air quality and gas leakage monitoring system built with ESP32, DHT11, MQ2 gas sensor, Node.js, MySQL, Socket.IO, and a responsive web dashboard.

The ESP32 reads temperature, humidity, and gas values, controls the exhaust fan and buzzer, then sends live readings to the Node.js server. The server stores readings in MySQL and pushes updates instantly to the browser dashboard.

## Features

- Live temperature, humidity, and gas monitoring
- Automatic fan and buzzer status display
- Real-time dashboard updates using Socket.IO
- MySQL storage for sensor readings
- Latest reading API for dashboard refresh
- Responsive dashboard design for desktop and mobile
- Deployment-ready Node.js server for Render
- Aiven MySQL compatible configuration

## Project Flow

```text
DHT11 + MQ2 Sensor
        |
        v
      ESP32
        |
        v
Node.js Express Server
        |
        +--> MySQL Database
        |
        v
Socket.IO Live Dashboard
```

## Hardware Used

- ESP32
- DHT11 temperature and humidity sensor
- MQ2 gas sensor
- Relay module
- Exhaust fan
- Buzzer
- Breadboard and jumper wires

## Software Stack

- Node.js
- Express.js
- Socket.IO
- MySQL
- Aiven MySQL
- HTML, CSS, JavaScript
- Render for deployment

## Folder Structure

```text
miniproject0.1/
|-- public/
|   |-- images/
|   |   |-- light_on.png
|   |   `-- light off.png
|   `-- index.html
|-- .env.example
|-- .gitignore
|-- database.sql
|-- package.json
|-- README.md
`-- server.js
```

## Database Setup

Create a MySQL database named:

```text
gas_monitor
```

Then create the table:

```sql
CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    temperature FLOAT NOT NULL,
    humidity FLOAT NOT NULL,
    gas_value INT NOT NULL,
    fan_status VARCHAR(10) NOT NULL DEFAULT 'OFF',
    buzzer_status VARCHAR(10) NOT NULL DEFAULT 'OFF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The same SQL is available in `database.sql`.

## Environment Variables

Create a `.env` file for local development. Do not upload `.env` to GitHub.

```text
PORT=3000
DB_HOST=mysql-2b73e448-yaswanthkrishnathiramdasu-a638.l.aivencloud.com
DB_PORT=11610
DB_USER=avnadmin
DB_PASSWORD=your_aiven_password
DB_NAME=gas_monitor
DB_SSL=true
TEMPERATURE_LIMIT=40
GAS_LIMIT=600
ESP32_TIMEOUT_MS=10000
```

## Local Setup

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Open the dashboard:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## API Endpoints

### Dashboard

```text
GET /
```

Serves the live web dashboard.

### Receive Sensor Data

```text
POST /sensor-data
```

Example JSON:

```json
{
  "temperature": 35.5,
  "humidity": 62,
  "gas": 720,
  "fan_status": "ON",
  "buzzer_status": "ON"
}
```

### Latest Reading

```text
GET /api/latest
```

Returns the most recent row from the database.

### ESP32 Status

```text
GET /api/esp32-status
```

Returns whether the server is currently receiving live ESP32 data.

### Health Check

```text
GET /health
```

Returns server status and configured alert limits.

## Alert Logic

```text
Temperature alert: temperature > 40
Gas alert: gas > 600
```

These limits match the ESP32 and dashboard logic.

## ESP32 Online/Offline Logic

The server marks ESP32 as online whenever it receives `POST /sensor-data`.

If no new sensor data arrives within:

```text
ESP32_TIMEOUT_MS=10000
```

the server marks ESP32 as offline and the dashboard clears the old readings.

## Render Deployment

Create a new Render Web Service and connect this GitHub repository.

Use:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Add environment variables in Render:

```text
DB_PASSWORD=your_real_aiven_password
```

The Aiven host, port, user, database name, and SSL defaults are already present in `server.js`, but they can also be added in Render:

```text
DB_HOST=mysql-2b73e448-yaswanthkrishnathiramdasu-a638.l.aivencloud.com
DB_PORT=11610
DB_USER=avnadmin
DB_NAME=gas_monitor
DB_SSL=true
TEMPERATURE_LIMIT=40
GAS_LIMIT=600
ESP32_TIMEOUT_MS=10000
```

After deployment, Render provides a public URL:

```text
https://your-app-name.onrender.com
```

## ESP32 Update After Deployment

Update the ESP32 server URL:

```cpp
const char* serverUrl = "https://your-app-name.onrender.com/sensor-data";
```

If using HTTPS on ESP32, the Arduino code may need `WiFiClientSecure` with certificate handling or `setInsecure()` for demo use.

## Security Notes

- Do not upload `.env` to GitHub.
- Do not hardcode the real database password in `server.js`.
- Keep the Aiven password only in local `.env` or Render environment variables.
- If a password was accidentally exposed, regenerate it in Aiven.

## Author

Smart Air Monitoring System mini project.
