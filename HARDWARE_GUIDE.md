# คู่มือข้อกำหนดฮาร์ดแวร์และการเชื่อมต่อจริง (Hardware Specification & Integration Guide)

เอกสารนี้ระบุรายละเอียดทางเทคนิคและข้อกำหนดจริงทั้งหมด สำหรับการเขียนโปรแกรมลงในอุปกรณ์ฮาร์ดแวร์ (IoT / GPS Tracker) เพื่อให้ส่งข้อมูลขึ้นระบบแผนที่บนเว็บได้อย่างสมบูรณ์ 100%

---

## 1. ข้อมูลการเชื่อมต่อ MQTT (Network & Broker Configuration)

โปรแกรมบนฮาร์ดแวร์ต้องตั้งค่าการเชื่อมต่อไปยัง MQTT Broker ตามนี้:

| รายการ | ค่าที่ต้องตั้งในโปรแกรม | คำอธิบาย |
| :--- | :--- | :--- |
| **MQTT Broker Host** | `broker.emqx.io` | โฮสต์เซิร์ฟเวอร์ Broker สาธารณะ (ใช้งานได้ทันที) |
| **Port (TCP)** | `1883` | พอร์ตมาตรฐานสำหรับฮาร์ดแวร์ทั่วไป (ไม่เข้ารหัส TLS) |
| **Port (TLS/SSL)** | `8883` | *(ทางเลือก)* พอร์ตเข้ารหัส SSL หากโมดูลรองรับ MQTTS |
| **Username** | *(เว้นว่าง / ปล่อยเป็น `NULL`)* | ไม่ต้องใส่ |
| **Password** | *(เว้นว่าง / ปล่อยเป็น `NULL`)* | ไม่ต้องใส่ |
| **Client ID** | เช่น `esp32_shuttle_01` | ควรตั้งไม่ให้ซ้ำกับอุปกรณ์อื่น |
| **Keep Alive** | `60` วินาที | ช่วงเวลาส่ง Ping เช็คสถานะเชื่อมต่อ |
| **Clean Session** | `true` | ไม่ต้องค้าง Session เก่า |

---

## 2. MQTT Topic ที่ต้อง Publish

- **Topic Name:**
  ```text
  shuttle/fleet/v1/shuttle-01/telemetry
  ```
- **QoS:** `0` (หรือ `1`)
- **Retain:** `false`
- **ความถี่ในการส่ง (Publish Interval):** ทุกๆ **1 ถึง 2 วินาที** (ไม่ควรช้ากว่า 5 วินาที เพื่อให้หมุดรถเคลื่อนที่บนแผนที่อย่างต่อเนื่อง)

---

## 3. รูปแบบข้อมูล JSON Payload (Data Schema)

ฮาร์ดแวร์ต้องสร้างข้อความ JSON และส่งไปใน Payload โดยมีโครงสร้างดังนี้:

### ตัวอย่าง JSON จริงที่สมบูรณ์:
```json
{
  "vehicle_id": "shuttle-01",
  "lat": 13.756331,
  "lng": 100.501765,
  "speed": 34.5,
  "heading": 85.0,
  "timestamp": 1729412400000
}
```

### คำอธิบายประเภทข้อมูลและเงื่อนไข (บังคับตามนี้):

| ฟิลด์ (Key) | ชนิดข้อมูล (Type) | ตัวอย่างค่า | เงื่อนไขและการคำนวณ |
| :--- | :--- | :--- | :--- |
| `vehicle_id` | `String` | `"shuttle-01"` | รหัสประจำตัวรถ (ต้องเป็น String) |
| `lat` | `Float / Double` | `13.756331` | พิกัดละติจูด (องศาทศนิยม WGS84) ทศนิยมอย่างน้อย 5-6 ตำแหน่ง |
| `lng` | `Float / Double` | `100.501765` | พิกัดลองจิจูด (องศาทศนิยม WGS84) ทศนิยมอย่างน้อย 5-6 ตำแหน่ง |
| `speed` | `Float / Double` | `34.5` | ความเร็วรถ **หน่วยกิโลเมตรต่อชั่วโมง (km/h)** เท่านั้น *(ข้อควรระวัง: โมดูล GPS ทั่วไปจะให้ค่าเป็น Knots ต้องคูณ `1.852` ก่อน)* |
| `heading` | `Float / Int` | `85.0` | ทิศทางมุมองศาที่รถกำลังมุ่งหน้าไป (`0.0` ถึง `360.0` องศา) โดย 0=เหนือ, 90=ตะวันออก, 180=ใต้, 270=ตะวันตก |
| `timestamp` | `Int64 / Long` | `1729412400000` | เวลาสากลระดับ **มิลลิวินาที (Epoch Milliseconds)** ซึ่งสามารถดึงจากเวลาของดาวเทียม GPS หรือคำนวณจาก Unix Epoch |

---

## 4. แผนผังการต่อวงจรเบื้องต้น (ESP32 + โมดูล GPS NEO-6M / NEO-M8N)

```
[ โมดูล GPS NEO-6M/M8N ]             [ บอร์ด ESP32 ]
  VCC (3.3V หรือ 5V)   ─────────────>  3V3 หรือ 5V (VIN)
  GND                  ─────────────>  GND
  TXD                  ─────────────>  GPIO 16 (RX2)
  RXD                  ─────────────>  GPIO 17 (TX2)
```

---

## 5. ตัวอย่างโค้ดจริงสำหรับ ESP32 (Arduino C++)

คุณสามารถก๊อปปี้โค้ดนี้ไปเปิดใน **Arduino IDE** หรือ **PlatformIO** ติดตั้งไลบรารี:
1. `PubSubClient` (โดย Nick O'Leary)
2. `TinyGPSPlus` (โดย Mikal Hart)
3. `ArduinoJson` (โดย Benoît Blanchon)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <time.h>

// 1. ตั้งค่า WiFi
const char* ssid = "YOUR_WIFI_SSID";          // เปลี่ยนเป็นชื่อ WiFi ของคุณ
const char* password = "YOUR_WIFI_PASSWORD";  // เปลี่ยนเป็นรหัสผ่าน WiFi

// 2. ตั้งค่า MQTT Broker
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* mqtt_topic = "shuttle/fleet/v1/shuttle-01/telemetry";
const char* vehicle_id = "shuttle-01";

// 3. กำหนดขา Serial สำหรับเชื่อมต่อกับ GPS (GPIO 16 = RX2, GPIO 17 = TX2)
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastPublishTime = 0;
const unsigned long publishInterval = 1500; // ส่งพิกัดทุก 1.5 วินาที

// ฟังก์ชันแปลงเวลาจาก GPS เป็น Unix Epoch (มิลลิวินาที)
int64_t getEpochMillis(TinyGPSDate &d, TinyGPSTime &t) {
  if (!d.isValid() || !t.isValid()) {
    return (int64_t)millis(); // fallback ถ้ายังจับเวลา GPS ไม่ได้
  }
  struct tm tm;
  tm.tm_year = d.year() - 1900;
  tm.tm_mon  = d.month() - 1;
  tm.tm_mday = d.day();
  tm.tm_hour = t.hour();
  tm.tm_min  = t.minute();
  tm.tm_sec  = t.second();
  time_t epoch = mktime(&tm);
  return ((int64_t)epoch * 1000) + (t.centisecond() * 10);
}

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17); // ความเร็ว Baud rate มาตรฐานของ GPS NEO-6M

  Serial.println("\n--- กำลังเริ่มต้นระบบ Shuttle Tracker ---");

  // เชื่อมต่อ WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi เชื่อมต่อสำเร็จ!");

  // ตั้งค่า MQTT
  client.setServer(mqtt_server, mqtt_port);
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("กำลังเชื่อมต่อไปยัง MQTT Broker: ");
    Serial.println(mqtt_server);
    
    String clientId = "ESP32_Shuttle_" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT เชื่อมต่อสำเร็จ พร้อมส่งข้อมูล!");
    } else {
      Serial.print("เชื่อมต่อล้มเหลว (rc=");
      Serial.print(client.state());
      Serial.println(") จะลองใหม่ในอีก 5 วินาที");
      delay(5000);
    }
  }
}

void loop() {
  // อ่านสัญญาณ Serial จากโมดูล GPS ตลอดเวลา
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // ดูแลการเชื่อมต่อ MQTT
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // ตรวจสอบรอบเวลาส่งข้อมูล (ทุก 1.5 วินาที)
  unsigned long now = millis();
  if (now - lastPublishTime >= publishInterval) {
    lastPublishTime = now;

    // ตรวจสอบว่า GPS จับสัญญาณดาวเทียมได้พิกัดจริงแล้วหรือยัง
    if (gps.location.isValid()) {
      float lat = gps.location.lat();
      float lng = gps.location.lng();
      float speedKmh = gps.speed.kmph();      // TinyGPS++ แปลงเป็น km/h ให้อัตโนมัติ
      float heading = gps.course.deg();       // ทิศทาง 0-360 องศา
      int64_t timestamp = getEpochMillis(gps.date, gps.time);

      // สร้าง JSON Payload
      char payload[256];
      snprintf(payload, sizeof(payload),
        "{\"vehicle_id\":\"%s\",\"lat\":%.6f,\"lng\":%.6f,\"speed\":%.1f,\"heading\":%.1f,\"timestamp\":%lld}",
        vehicle_id, lat, lng, speedKmh, heading, (long long)timestamp
      );

      // ส่งข้อมูลขึ้น MQTT
      if (client.publish(mqtt_topic, payload)) {
        Serial.print("ส่งสำเร็จ: ");
        Serial.println(payload);
      } else {
        Serial.println("ส่งข้อมูลไม่สำเร็จ!");
      }
    } else {
      Serial.print("กำลังค้นหาสัญญาณดาวเทียม GPS... (จำนวนดาวเทียมที่พบ: ");
      Serial.print(gps.satellites.value());
      Serial.println(" ดวง)");
    }
  }
}
```

---

## 6. ลำดับการทดสอบเมื่อประกอบเสร็จ

1. **อัปโหลดโค้ดลงบอร์ด:** เปิด Serial Monitor ที่ Baud Rate `115200`
2. **รอจนกว่า GPS จะ Lock สัญญาณ:** 
   - นำตัวบอร์ดไปวางใกล้หน้าต่างหรือที่โล่งแจ้ง
   - สังเกตไฟ LED บนโมดูล GPS (ปกติไฟสีแดงหรือฟ้าจะเริ่มกระพริบเมื่อจับสัญญาณพิกัดได้แล้ว)
3. **ตรวจสอบ Serial Monitor:** เมื่อเห็นข้อความ `ส่งสำเร็จ: {"vehicle_id":"shuttle-01", ...}`
4. **เปิดดูหน้าเว็บแดชบอร์ด:**
   - จุดไฟสถานะบนเว็บจะเปลี่ยนเป็นสีเขียว (`Online`)
   - หมุดรถจะเคลื่อนไปปักที่พิกัดจริงของฮาร์ดแวร์ทันทีครับ
