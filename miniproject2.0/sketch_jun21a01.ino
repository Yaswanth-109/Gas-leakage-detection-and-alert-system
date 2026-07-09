// Smart Air Monitoring System with WhatsApp (Circuit Digest)
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT11
#define MQ2_PIN 34
#define RELAY_PIN 23
#define BUZZER_PIN 22

#define TEMP_THRESHOLD 40
#define GAS_THRESHOLD 600

const char* ssid="yaswanth@123";
const char* password="143691436";
const char* serverUrl="https://gas-leakage-detection-and-alert-system-1.onrender.com/sensor-data";
const char* apiKey="cd_yas_150626_5-KU6f";
const char* host="www.circuitdigest.cloud";

DHT dht(DHTPIN,DHTTYPE);
bool alertSent=false;

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
  Serial.print("IP Address : ");
  Serial.println(WiFi.localIP());
  Serial.println("================================");
}

void sendWhatsApp(String status,float t,float h,int gas){
 WiFiClientSecure client; client.setInsecure();
 if(!client.connect(host,443)) return;
 String payload="{\"phone_number\":\"919121328286\",\"template_id\":\"threshold_violation_alert\",\"variables\":{\"device_name\":\"Smart Air Monitoring System\",\"parameter\":\""+status+"\",\"measured_value\":\"Temp:"+String(t,1)+"C Hum:"+String(h,1)+"% Gas:"+String(gas)+"\",\"limit\":\"Threshold Exceeded\",\"location\":\"Home\"}}";
 client.println("POST /api/v1/whatsapp/send HTTP/1.1");
 client.println("Host: www.circuitdigest.cloud");
 client.println("X-API-Key: "+String(apiKey));
 client.println("Content-Type: application/json");
 client.print("Content-Length: "); client.println(payload.length());
 client.println("Connection: close"); client.println(); client.print(payload);
 while(client.connected()||client.available()){if(client.available()) client.readStringUntil('\n');}
 client.stop();
}

void sendData(float t,float h,int gas,String fan,String buzz){
 HTTPClient http;
 http.begin(serverUrl);
 http.addHeader("Content-Type","application/json");
 String p="{\"temperature\":"+String(t,1)+",\"humidity\":"+String(h,1)+",\"gas\":"+String(gas)+",\"fan_status\":\""+fan+"\",\"buzzer_status\":\""+buzz+"\"}";
 http.POST(p); http.end();
}

void setup(){
 Serial.begin(115200); dht.begin();
 pinMode(RELAY_PIN,OUTPUT); pinMode(BUZZER_PIN,OUTPUT);
 digitalWrite(RELAY_PIN,HIGH); digitalWrite(BUZZER_PIN,LOW);
 connectWiFi();
}

void loop(){
 if(WiFi.status()!=WL_CONNECTED) connectWiFi();
 float t=dht.readTemperature(), h=dht.readHumidity();
 int gas=analogRead(MQ2_PIN);
 if(isnan(t)||isnan(h)){delay(2000); return;}
 bool highTemp=t>TEMP_THRESHOLD, highGas=gas>GAS_THRESHOLD;
 String fan="OFF", buzz="OFF", status="NORMAL";
 if(highTemp||highGas){digitalWrite(RELAY_PIN,LOW); fan="ON";} else {digitalWrite(RELAY_PIN,HIGH);}
 if(highGas){digitalWrite(BUZZER_PIN,HIGH); buzz="ON";} else digitalWrite(BUZZER_PIN,LOW);
 if(highTemp&&highGas) status="TEMPERATURE AND GAS ALERT";
 else if(highGas) status="GAS ALERT";
 else if(highTemp) status="TEMPERATURE ALERT";
 if((highTemp||highGas)&&!alertSent){sendWhatsApp(status,t,h,gas); alertSent=true;}
 if(!highTemp&&!highGas) alertSent=false;
 sendData(t,h,gas,fan,buzz);
 // ==========================
// Serial Monitor
// ==========================

Serial.println();
Serial.println("====================================");
Serial.println("SMART AIR MONITORING SYSTEM");
Serial.println("====================================");

Serial.print("Temperature : ");
Serial.print(t);
Serial.println(" °C");

Serial.print("Humidity    : ");
Serial.print(h);
Serial.println(" %");

Serial.print("Gas Value   : ");
Serial.println(gas);

Serial.print("Fan         : ");
Serial.println(fan);

Serial.print("Buzzer      : ");
Serial.println(buzz);

Serial.print("Status      : ");
Serial.println(status);

Serial.println("====================================");
 delay(2000);
}
