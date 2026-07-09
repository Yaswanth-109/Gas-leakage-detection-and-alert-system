# Smart Air Monitoring Dashboard

A real-time ESP32 air quality and gas leakage monitoring system with a Node.js backend, MySQL storage, Socket.IO live updates, database-backed graphs, alert history, and a responsive light/dark dashboard.

The ESP32 reads temperature, humidity, and MQ2 gas values, controls the exhaust fan and buzzer, then sends readings to the Node.js server. The server stores readings in MySQL and pushes live updates to the browser dashboard.

## Features

- Logo-based dashboard design using the project color palette
- Light and dark theme buttons
- Browser-style refresh button
- Sidebar navigation with Live Dashboard, Graphs, and Alerts
- ESP32 online/offline status from the server
- Live alert status: Normal, Gas Alert, Temperature Alert, or Gas and Temperature Alert
- Live gas, humidity, and temperature gauges
- Fan and buzzer ON/OFF status cards
- MySQL-backed graphs for gas, temperature, humidity, and combined data
- Graph filters for metric, start date/time, and time range
- Alerts sorted by latest date and time
- WhatsApp alert message API support for notifying the user during gas or temperature alerts
- Render deployment-ready Node.js app
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
        +--> WhatsApp Message API
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
|   |   |-- logo.png
|   |   |-- light_on.png
|   |   `-- light off.png
|   `-- index.html
|-- .env.example
|-- .gitignore
|-- database.sql
|-- package.json
|-- README.md
|-- sketch_jun21a01/
|   `-- sketch_jun21a01.ino
`-- server.js
```

## Database Setup

Create a MySQL database named:

```text
gas_monitor
```

Create the table:

```sql
CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    temperature FLOAT NOT NULL,
    humidity FLOAT NOT NULL,
    gas_value INT NOT NULL,
    fan_status VARCHAR(10) NOT NULL DEFAULT 'OFF',
    buzzer_status VARCHAR(10) NOT NULL DEFAULT 'OFF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sensor_data_created_at (created_at)
);
```

The same SQL is available in `database.sql`.

If your table already exists, you can add the graph/alert performance index separately:

```sql
CREATE INDEX idx_sensor_data_created_at ON sensor_data (created_at);
```

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
APP_TIME_ZONE=Asia/Kolkata
DB_TIME_ZONE=+05:30
WHATSAPP_API_URL=your_whatsapp_api_url
WHATSAPP_PHONE_NUMBER=your_whatsapp_number
WHATSAPP_API_KEY=your_whatsapp_api_key
```

Only `DB_PASSWORD` is required in Render if the other values remain as defaults in `server.js`.
Add the WhatsApp variables only when WhatsApp alert messages are enabled.

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

## API Endpoints

### Dashboard

```text
GET /
```

Serves the dashboard UI.

### Receive ESP32 Sensor Data

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

Returns the most recent database row.

### ESP32 Status

```text
GET /api/esp32-status
```

Returns whether the server is currently receiving live ESP32 data.

### Graph History

```text
GET /api/history?minutes=15
```

Returns minute-wise average values from MySQL for gas, temperature, and humidity.
The dashboard uses these rows for the graph x-axis time labels.

Optional query values:

```text
minutes=15
start=2026-07-04T10:30
```

### Alerts

```text
GET /api/alerts?limit=100
```

Returns gas and temperature alerts sorted by latest date/time.

### WhatsApp Alert Message API

The project can send an alert message to the configured user through a WhatsApp message API when sensor values cross the configured limits.

WhatsApp alerts are intended for:

```text
Temperature alert: temperature > TEMPERATURE_LIMIT
Gas alert: gas > GAS_LIMIT
```

Recommended environment variables:

```text
WHATSAPP_API_URL=your_whatsapp_api_url
WHATSAPP_PHONE_NUMBER=your_whatsapp_number
WHATSAPP_API_KEY=your_whatsapp_api_key
```

Do not hardcode the real WhatsApp API key, phone number, or token in the source code. Store them in local `.env` or Render environment variables.

### Health Check

```text
GET /health
```

Returns server status and configured alert limits.
It also returns the configured application and database time zones.

## Alert Logic

```text
Temperature alert: temperature > 40
Gas alert: gas > 600
```

## ESP32 Online/Offline Logic

The server marks ESP32 as online whenever it receives `POST /sensor-data`.

If no new sensor data arrives within:

```text
ESP32_TIMEOUT_MS=10000
APP_TIME_ZONE=Asia/Kolkata
DB_TIME_ZONE=+05:30
```

the server marks ESP32 as offline and the dashboard clears old live readings.

## Render Deployment

Create a new Render Web Service and connect this GitHub repository.

Use:

```text
Runtime: Node
Root Directory: miniproject0.1
Build Command: npm install
Start Command: npm start
```

Add this environment variable in Render:

```text
DB_PASSWORD=your_real_aiven_password
```

Optional Render variables:

```text
DB_HOST=mysql-2b73e448-yaswanthkrishnathiramdasu-a638.l.aivencloud.com
DB_PORT=11610
DB_USER=avnadmin
DB_NAME=gas_monitor
DB_SSL=true
TEMPERATURE_LIMIT=40
GAS_LIMIT=600
ESP32_TIMEOUT_MS=10000
WHATSAPP_API_URL=your_whatsapp_api_url
WHATSAPP_PHONE_NUMBER=your_whatsapp_number
WHATSAPP_API_KEY=your_whatsapp_api_key
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
