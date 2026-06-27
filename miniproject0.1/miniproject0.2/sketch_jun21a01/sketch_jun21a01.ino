#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ============================
// Sensor Pins
// ============================
#define DHTPIN 4
#define DHTTYPE DHT11

#define MQ2_PIN 34
#define RELAY_PIN 23
#define BUZZER_PIN 22

// ============================
// Thresholds
// ============================
#define TEMP_THRESHOLD 40
#define GAS_THRESHOLD 600

// ============================
// WiFi Credentials
// ============================
const char* ssid = "yaswanth@123";
const char* password = "143691436";

// ============================
// Node.js Server URL
// ============================
const char* serverUrl = "https://gas-leakage-detection-and-alert-system-1.onrender.com/sensor-data";

DHT dht(DHTPIN, DHTTYPE);

// =====================================
// Connect WiFi
// =====================================
void connectWiFi() {

  Serial.print("Connecting to WiFi");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("================================");
  Serial.println("WiFi Connected");
  Serial.print("ESP32 IP Address : ");
  Serial.println(WiFi.localIP());
  Serial.println("================================");
}

// =====================================
// Send Data to Node.js Server
// =====================================
void sendData(float temperature,
              float humidity,
              int gasValue,
              String fanStatus,
              String buzzerStatus) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("WiFi Lost... Reconnecting");

    connectWiFi();
  }

  HTTPClient http;

  http.setTimeout(5000);

  http.begin(serverUrl);

  http.addHeader("Content-Type", "application/json");

  String payload =
    "{"
    "\"temperature\":" + String(temperature, 1) +
    ",\"humidity\":" + String(humidity, 1) +
    ",\"gas\":" + String(gasValue) +
    ",\"fan_status\":\"" + fanStatus + "\"" +
    ",\"buzzer_status\":\"" + buzzerStatus + "\"" +
    "}";

  Serial.println();
  Serial.println("Sending JSON");
  Serial.println(payload);

  int httpCode = http.POST(payload);

  Serial.print("HTTP Response Code : ");
  Serial.println(httpCode);

  if (httpCode == HTTP_CODE_OK) {

    Serial.println("Data Sent Successfully");

    String response = http.getString();

    Serial.println("Server Response:");
    Serial.println(response);
  }
  else {

    Serial.print("HTTP Error : ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// =====================================
// Setup
// =====================================
void setup() {

  Serial.begin(115200);

  dht.begin();

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Relay OFF
  digitalWrite(RELAY_PIN, HIGH);

  // Buzzer OFF
  digitalWrite(BUZZER_PIN, LOW);

  connectWiFi();

  Serial.println("Smart Air Monitoring System Started");
}

// =====================================
// Main Loop
// =====================================
void loop() {

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int gasValue = analogRead(MQ2_PIN);

  if (isnan(temperature) || isnan(humidity)) {

    Serial.println("DHT11 Reading Failed");

    delay(2000);

    return;
  }

  bool highTemp = (temperature > TEMP_THRESHOLD);
  bool highGas = (gasValue > GAS_THRESHOLD);

  String fanStatus = "OFF";
  String buzzerStatus = "OFF";
  String status = "NORMAL";

  // ==========================
  // Relay Control
  // ==========================

  if (highTemp || highGas) {

    digitalWrite(RELAY_PIN, LOW);

    fanStatus = "ON";
  }
  else {

    digitalWrite(RELAY_PIN, HIGH);

    fanStatus = "OFF";
  }

  // ==========================
  // Buzzer Control
  // ==========================

  if (highGas) {

    digitalWrite(BUZZER_PIN, HIGH);

    buzzerStatus = "ON";
  }
  else {

    digitalWrite(BUZZER_PIN, LOW);

    buzzerStatus = "OFF";
  }

  // ==========================
  // Status
  // ==========================

  if (highTemp && highGas) {

    status = "TEMPERATURE AND GAS ALERT";
  }
  else if (highGas) {

    status = "GAS ALERT";
  }
  else if (highTemp) {

    status = "TEMPERATURE ALERT";
  }

  // ==========================
  // Serial Monitor
  // ==========================

  Serial.println();
  Serial.println("====================================");
  Serial.println("SMART AIR MONITORING SYSTEM");
  Serial.println("====================================");

  Serial.print("Temperature : ");
  Serial.print(temperature);
  Serial.println(" °C");

  Serial.print("Humidity    : ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("Gas Value   : ");
  Serial.println(gasValue);

  Serial.print("Fan         : ");
  Serial.println(fanStatus);

  Serial.print("Buzzer      : ");
  Serial.println(buzzerStatus);

  Serial.print("Status      : ");
  Serial.println(status);

  Serial.println("====================================");

  // ==========================
  // Send Data
  // ==========================

  sendData(
    temperature,
    humidity,
    gasValue,
    fanStatus,
    buzzerStatus
  );

  delay(2000);
}