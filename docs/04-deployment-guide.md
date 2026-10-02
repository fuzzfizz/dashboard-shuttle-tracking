# คู่มือการนำระบบขึ้นใช้งานจริง (Production Deployment Guide)
## ระบบติดตามรถรับ-ส่ง (Shuttle Tracking System)

เอกสารนี้รวบรวมขั้นตอน แนวทางปฏิบัติที่ดีที่สุด (Best Practices) และคำสั่งทั้งหมดสำหรับการนำระบบติดตามรถรับ-ส่งขึ้นรันบนเครื่อง Server จริง (Cloud VPS เช่น DigitalOcean, AWS EC2, GCP Compute Engine, Hetzner หรือ On-Premise Ubuntu Server)

---

## 📑 สารบัญ

1. [สถาปัตยกรรมและพอร์ตระบบ (System Architecture & Ports)](#1-สถาปัตยกรรมและพอร์ตระบบ-system-architecture--ports)
2. [ความต้องการของเครื่องแม่ข่าย (System Requirements)](#2-ความต้องการของเครื่องแม่ข่าย-system-requirements)
3. [การเตรียมเครื่อง Server (Server Provisioning & Firewall)](#3-การเตรียมเครื่อง-server-server-provisioning--firewall)
4. [การติดตั้ง Docker และเครื่องมือจำเป็น](#4-การติดตั้ง-docker-และเครื่องมือจำเป็น)
5. [การเตรียมโค้ดและการตั้งค่า Environment Variables](#5-การเตรียมโค้ดและการตั้งค่า-environment-variables)
6. [การปรับแต่ง Docker Compose สำหรับ Production Hardening](#6-การปรับแต่ง-docker-compose-สำหรับ-production-hardening)
7. [การตั้งค่า Reverse Proxy & SSL (HTTPS / WSS)](#7-การตั้งค่า-reverse-proxy--ssl-https--wss)
   - [ทางเลือกที่ 1: Nginx + Certbot (มาตรฐานที่นิยมสูงสุด)](#ทางเลือกที่-1-nginx--certbot-มาตรฐานที่นิยมสูงสุด)
   - [ทางเลือกที่ 2: Caddy Server (ติดตั้งง่าย Auto-SSL ในตัว)](#ทางเลือกที่-2-caddy-server-ติดตั้งง่าย-auto-ssl-ในตัว)
8. [การสั่งรันระบบและตรวจสอบความถูกต้อง (Start & Healthcheck)](#8-การสั่งรันระบบและตรวจสอบความถูกต้อง-start--healthcheck)
9. [การตั้งค่าความปลอดภัยขั้นสูง (Production Security Hardening)](#9-การตั้งค่าความปลอดภัยขั้นสูง-production-security-hardening)
10. [ระบบสำรองข้อมูลอัตโนมัติ (Automated Database Backup)](#10-ระบบสำรองข้อมูลอัตโนมัติ-automated-database-backup)
11. [การอัปเดตเวอร์ชันใหม่และคำสั่งบำรุงรักษา (Maintenance & Updates)](#11-การอัปเดตเวอร์ชันใหม่และคำสั่งบำรุงรักษา-maintenance--updates)

---

## 1. สถาปัตยกรรมและพอร์ตระบบ (System Architecture & Ports)

ระบบประกอบด้วย 4 เซอร์วิสหลักที่ทำงานร่วมกันในเครือข่าย Docker Network:

```mermaid
graph TD
    User["🌐 ผู้ใช้งาน (Browser / Mobile)"]
    GPS["🛰️ กล่อง GPS Tracker / Simulator"]

    subgraph Server["Server Host (Ubuntu 22.04/24.04 LTS)"]
        FW["🛡️ UFW Firewall (80, 443, 1883, 22)"]

        subgraph ReverseProxy["Reverse Proxy (Nginx / Caddy)"]
            SSL["SSL / TLS 1.3 Termination"]
        end

        subgraph DockerCompose["Docker Network (shuttle-network)"]
            FE["frontend: Next.js 15 (Port 3000)"]
            API["api: Fastify API & WS (Port 3000)"]
            MOSQ["mosquitto: MQTT Broker (Port 1883)"]
            DB[("postgres: PostGIS 3.4 (Port 5432 internal)")]
        end
    end

    User -->|HTTPS 443 / WSS| FW
    GPS -->|TCP MQTT 1883| FW
    FW --> ReverseProxy
    FW -->|Direct TCP 1883| MOSQ
    ReverseProxy -->|Proxy /| FE
    ReverseProxy -->|Proxy /api/v1| API
    ReverseProxy -->|Proxy /ws| API
    API --> MOSQ
    API --> DB
```

### ตารางแจกแจงพอร์ตและความปลอดภัย (Port Exposure Matrix)

| Service | Container Port | Host Port | Exposure | วัตถุประสงค์ |
| :--- | :---: | :---: | :---: | :--- |
| **SSH** | - | `22` | **Public** | รีโมตจัดการเซิร์ฟเวอร์ (แนะนำให้เปลี่ยนพอร์ตหรือจำกัด IP) |
| **HTTP (Nginx/Caddy)** | - | `80` | **Public** | Redirect ไปยัง HTTPS / ขอใบรับรอง Let's Encrypt |
| **HTTPS (Nginx/Caddy)** | - | `443` | **Public** | เข้าใช้งาน Web Dashboard, REST API, WebSocket (WSS) |
| **MQTT Broker** | `1883` | `1883` | **Public** | รับ Telemetry จากกล่อง GPS Tracker บนรถ |
| **Next.js Frontend** | `3000` | `127.0.0.1:3001` | **Localhost Only** | Nginx เป็นตัวกลาง proxy_pass เข้ามา |
| **Fastify API & WS** | `3000` | `127.0.0.1:3000` | **Localhost Only** | Nginx เป็นตัวกลาง proxy_pass เข้ามา |
| **PostgreSQL + PostGIS** | `5432` | `None (Internal)` | **Docker Only** | **ห้ามเปิดสู่ Public Internet เด็ดขาด!** |

---

## 2. ความต้องการของเครื่องแม่ข่าย (System Requirements)

### 2.1 สเปกเครื่องที่แนะนำ

| ขนาดระบบ | จำนวนรถ | vCPU | RAM | SSD Storage | ผู้ให้บริการที่แนะนำ |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Small (MVP / เริ่มต้น)** | 1 - 10 คัน | 1 - 2 vCPU | 2 GB | 25 - 40 GB | DigitalOcean ($12/mo), Hetzner CX22 (€4/mo), AWS t3.small |
| **Medium (Production ทั่วไป)** | 10 - 50 คัน | 2 vCPU | 4 GB | 50 - 80 GB | DigitalOcean ($24/mo), Hetzner CPX21 (€7.5/mo), AWS t3.medium |
| **Large (ฟลีตขนาดใหญ่)** | 50 - 200+ คัน | 4 vCPU | 8 GB | 100+ GB | Hetzner CPX31 (€15/mo), AWS c6g.xlarge |

> [!TIP]
> สำหรับเครื่องที่มี RAM 2GB แนะนำให้สร้าง **Swap Space ขนาด 2GB - 4GB** เพื่อป้องกันกรณี Out of Memory (OOM) ระหว่างการ build container ของ Next.js

### 2.2 โดเมนเนมและ DNS (Domain Name & DNS)

เตรียม Domain หรือ Subdomain ชี้ A Record มายัง Public IP ของเครื่อง Server เช่น:
- `shuttle.yourdomain.com` -> `<SERVER_PUBLIC_IP>`

---

## 3. การเตรียมเครื่อง Server (Server Provisioning & Firewall)

เชื่อมต่อเข้าเครื่อง Server ผ่าน SSH:

```bash
ssh root@<SERVER_IP>
```

### 3.1 อัปเดตแพ็กเกจระบบและตั้งค่า Timezone

```bash
# 1. อัปเดตระบบ
sudo apt update && sudo apt upgrade -y

# 2. ตั้งค่า Timezone ให้เป็นประเทศไทย (ICT / UTC+7)
sudo timedatectl set-timezone Asia/Bangkok

# 3. ติดตั้งเครื่องมือพื้นฐาน
sudo apt install -y curl wget git ufw htop ca-certificates gnupg lsb-release
```

### 3.2 ตั้งค่า Swap Space (แนะนำอย่างยิ่งสำหรับ Server RAM 2GB)

```bash
# สร้างไฟล์ Swap ขนาด 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# บันทึกเพื่อให้ทำงานถาวรแม้รีบูต
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.3 ตั้งค่า Firewall (UFW)

```bash
# อนุญาต SSH, HTTP, HTTPS และ MQTT Port
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 1883/tcp comment 'MQTT GPS Ingestion'

# เปิดใช้งาน Firewall
sudo ufw enable
sudo ufw status
```

---

## 4. การติดตั้ง Docker และเครื่องมือจำเป็น

ติดตั้ง **Docker Engine** และ **Docker Compose v2** (Official Repository):

```bash
# 1. เพิ่ม GPG Key ของ Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 2. เพิ่ม Repository ของ Docker
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. ติดตั้ง Docker Engine และ Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. ทดสอบความถูกต้อง
docker --version
docker compose version
```

---

## 5. การเตรียมโค้ดและการตั้งค่า Environment Variables

### 5.1 Clone โค้ดลงไดเรกทอรีใช้งาน

```bash
# โคลนโปรเจกต์มาที่ /opt/shuttle-tracking
sudo mkdir -p /opt/shuttle-tracking
sudo chown -R $USER:$USER /opt/shuttle-tracking
git clone https://github.com/fuzzfizz/dashboard-shuttle-tracking.git /opt/shuttle-tracking
cd /opt/shuttle-tracking
```

### 5.2 สร้างค่าความลับที่ปลอดภัย (Production Secrets)

รันคำสั่งต่อไปนี้เพื่อสุ่มสร้างรหัสผ่านที่มีความแข็งแกร่งสูง:

```bash
# สร้างรหัสผ่านสุ่ม 32 ตัวอักษร
openssl rand -hex 24   # สำหรับ POSTGRES_PASSWORD
openssl rand -hex 32   # สำหรับ JWT_SECRET
```

### 5.3 สร้างไฟล์ `.env` สำหรับ Production

คัดลอกไฟล์ตัวอย่างและใส่ค่ารหัสผ่านที่สุ่มขึ้นมาใหม่:

```bash
cp .env.example .env
nano .env
```

แก้ไขไฟล์ `.env` ดังนี้:

```env
# ==========================================
# Production Environment Configuration
# ==========================================

# 1. Database (PostgreSQL 16 + PostGIS 3.4)
POSTGRES_DB=shuttle_tracking
POSTGRES_USER=shuttle
POSTGRES_PASSWORD=เปลี่ยน_ใส่รหัสผ่านสุ่มที่ได้จาก_openssl_ตรงนี้!
DATABASE_URL=postgres://shuttle:เปลี่ยน_ใส่รหัสผ่านสุ่มที่ได้จาก_openssl_ตรงนี้!@postgres:5432/shuttle_tracking

# 2. MQTT Broker
MQTT_BROKER_URL=mqtt://mosquitto:1883

# 3. Backend API
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
JWT_SECRET=เปลี่ยน_ใส่คีย์สุ่ม_jwt_ความยาว32bytesขึ้นไป_ตรงนี้!
JWT_EXPIRES_IN=24h

# 4. Frontend Domain Configuration (ถ้าใช้ Reverse Proxy รวมเป็นโดเมนเดียว)
NEXT_PUBLIC_API_URL=https://shuttle.yourdomain.com/api/v1
NEXT_PUBLIC_WS_URL=wss://shuttle.yourdomain.com
```

---

## 6. การปรับแต่ง Docker Compose สำหรับ Production Hardening

เพื่อความปลอดภัยสูงสุด แนะนำให้แก้ไขไฟล์ `docker-compose.yml` เพื่อปิดไม่ให้ Database Expose สู่ Host ภายนอก และผูกพอร์ตของ API/Frontend ไว้ที่ `127.0.0.1` เท่านั้น:

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    container_name: shuttle-postgres
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-shuttle_tracking}
      POSTGRES_USER: ${POSTGRES_USER:-shuttle}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    # เอา ports 5432 ออก เพื่อความปลอดภัย ไม่เปิดสู่ภายนอก
    # ports:
    #   - "127.0.0.1:5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-shuttle} -d ${POSTGRES_DB:-shuttle_tracking}"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"

  mosquitto:
    image: eclipse-mosquitto:2.0
    container_name: shuttle-mosquitto
    restart: always
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - ./mosquitto/config/acl.conf:/mosquitto/config/acl.conf:ro
      - mosq_data:/mosquitto/data
      - mosq_log:/mosquitto/log
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: shuttle-backend
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      MQTT_BROKER_URL: ${MQTT_BROKER_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-24h}
    depends_on:
      postgres:
        condition: service_healthy
      mosquitto:
        condition: service_started
    logging:
      driver: "json-file"
      options:
        max-size: "30m"
        max-file: "3"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: shuttle-frontend
    restart: always
    ports:
      - "127.0.0.1:3001:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL}
    depends_on:
      - api
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"

volumes:
  pg_data:
  mosq_data:
  mosq_log:
```

---

## 7. การตั้งค่า Reverse Proxy & SSL (HTTPS / WSS)

### ทางเลือกที่ 1: Nginx + Certbot (มาตรฐานที่นิยมสูงสุด)

#### 1. ติดตั้ง Nginx และ Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

#### 2. สร้างไฟล์คอนฟิก Nginx
```bash
sudo nano /etc/nginx/sites-available/shuttle-tracking
```

ใส่เนื้อหาคอนฟิกดังต่อไปนี้ (เปลี่ยน `shuttle.yourdomain.com` เป็นโดเมนจริงของคุณ):

```nginx
# HTTP - Redirect all traffic to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name shuttle.yourdomain.com;

    # Certbot challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name shuttle.yourdomain.com;

    # SSL Certificates (จะถูกเพิ่มหรืออัปเดตอัตโนมัติด้วย Certbot)
    # ssl_certificate /etc/letsencrypt/live/shuttle.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/shuttle.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 10M;

    # 1. Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    # 2. WebSocket Server (รองรับทั้ง /ws และ /ws/public)
    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 3. Frontend Next.js Application
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 3. เปิดใช้งานคอนฟิกและขอใบรับรอง SSL
```bash
# ลบ default site และเปิดใช้งาน site ใหม่
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/shuttle-tracking /etc/nginx/sites-enabled/

# ทดสอบ syntax ของ Nginx
sudo nginx -t

# ขอใบรับรอง Let's Encrypt SSL อัตโนมัติ
sudo certbot --nginx -d shuttle.yourdomain.com

# รีโหลด Nginx
sudo systemctl reload nginx
```

---

### ทางเลือกที่ 2: Caddy Server (ติดตั้งง่าย Auto-SSL ในตัว)

หากต้องการความเรียบง่ายโดยไม่ต้องคอนฟิก Certbot แยก Caddy จะทำการขอและต่ออายุ SSL ให้อัตโนมัติ:

```bash
# 1. ติดตั้ง Caddy บน Ubuntu
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

แก้ไขไฟล์ `/etc/caddy/Caddyfile`:

```caddy
shuttle.yourdomain.com {
    # WebSocket & REST API
    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle /ws* {
        reverse_proxy 127.0.0.1:3000
    }

    # Frontend
    handle {
        reverse_proxy 127.0.0.1:3001
    }
}
```

สั่งรีสตาร์ท Caddy:
```bash
sudo systemctl reload caddy
```

---

## 8. การสั่งรันระบบและตรวจสอบความถูกต้อง (Start & Healthcheck)

### 8.1 บิลด์และสั่งรัน Containers

เข้าไปยังโฟลเดอร์โปรเจกต์และสั่งสตาร์ท:

```bash
cd /opt/shuttle-tracking
docker compose up -d --build
```

### 8.2 ตรวจสอบสถานะการทำงาน (Verification)

```bash
# 1. ดูสถานะ Containers ทั้งหมด
docker compose ps

# ผลลัพธ์ควรแสดงสถานะ Up ทั้ง 4 เซอร์วิส:
# NAME                IMAGE                 COMMAND                  SERVICE      STATUS
# shuttle-backend     shuttle-backend       "node src/server.js"     api          Up
# shuttle-frontend    shuttle-frontend      "node server.js"         frontend     Up
# shuttle-mosquitto   eclipse-mosquitto:2.0 "/docker-entrypoint.…"   mosquitto    Up
# shuttle-postgres    postgis/postgis:16    "docker-entrypoint.s…"   postgres     Up (healthy)

# 2. ตรวจสอบการโหลด Database Migration และ Seed Data
docker compose logs postgres | grep -E "CREATE TABLE|INSERT"

# 3. ทดสอบเรียก API Health ผ่าน curl
curl -I http://127.0.0.1:3000/api/v1/vehicles
# ควรได้ HTTP/1.1 200 OK

# 4. ทดสอบเรียกผ่าน Domain และ HTTPS
curl -I https://shuttle.yourdomain.com/api/v1/vehicles
```

### 8.3 ทดสอบการจำลองส่งพิกัดรถสด (GPS Simulator Smoke Test)

รัน Simulator 2 คันเพื่อตรวจสอบว่าข้อมูลพิกัดขึ้นแผนที่แบบเรียลไทม์:

```bash
node tools/gps-simulator.js --count 2 --protocol mqtt --broker mqtt://localhost:1883
```
เปิดเบราว์เซอร์เข้าไปที่ `https://shuttle.yourdomain.com` จะเห็นรถบัส 2 คันขยับบนแผนที่ OpenStreetMap ทันที!

---

## 9. การตั้งค่าความปลอดภัยขั้นสูง (Production Security Hardening)

> [!IMPORTANT]
> ต้องปฏิบัติตามข้อกำหนดต่อไปนี้อย่างเคร่งครัดก่อนเปิดให้ผู้ใช้ภายนอกใช้งาน:

### 1. เปลี่ยนรหัสผ่าน Admin และ Operator เริ่มต้น
หลังจากติดตั้ง ฐานข้อมูลจะมีผู้ใช้เริ่มต้นคือ:
- `admin@example.com` / `admin123456`
- `viewer@example.com` / `viewer123456`

ให้เข้าสู่ระบบที่ `/login` และทำการเปลี่ยนรหัสผ่านทันที หรืออัปเดตผ่าน SQL โดยตรง:
```bash
# เข้าไปแก้ hash รหัสผ่านใน PostgreSQL
docker exec -it shuttle-postgres psql -U shuttle -d shuttle_tracking
```

### 2. ปรับการตั้งค่าความปลอดภัยของ Mosquitto MQTT
สำหรับ Production ที่มีกล่อง GPS ฮาร์ดแวร์จริง แนะนำให้เปลี่ยนจากการอนุญาตไม่ระบุตัวตน (`allow_anonymous true`) มาเป็นกำหนด Password ให้กับแต่ละอุปกรณ์:

1. สร้างไฟล์รหัสผ่านด้วยคำสั่ง:
```bash
docker exec -it shuttle-mosquitto mosquitto_passwd -c /mosquitto/config/passwords.txt device_user
```
2. แก้ไข `mosquitto/config/mosquitto.conf`:
```conf
allow_anonymous false
password_file /mosquitto/config/passwords.txt
```
3. สั่ง Restart Mosquitto:
```bash
docker compose restart mosquitto
```

### 3. ติดตั้งและเปิดใช้งาน Fail2ban
ป้องกันการสุ่มเดารหัสผ่าน SSH จากอินเทอร์เน็ต:
```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

---

## 10. ระบบสำรองข้อมูลอัตโนมัติ (Automated Database Backup)

ข้อมูลพิกัด GPS ประวัติการเดินทาง และบัญชีผู้ใช้ต้องได้รับการสำรองอย่างสม่ำเสมอ

### 10.1 สร้างสคริปต์ Backup

สร้างโฟลเดอร์และไฟล์สคริปต์:
```bash
sudo mkdir -p /opt/shuttle-tracking/backups
sudo mkdir -p /opt/shuttle-tracking/scripts
nano /opt/shuttle-tracking/scripts/backup-db.sh
```

ใส่เนื้อหาสคริปต์:
```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/shuttle-tracking/backups"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
FILENAME="shuttle_backup_${TIMESTAMP}.dump.gz"
CONTAINER="shuttle-postgres"
DB_USER="shuttle"
DB_NAME="shuttle_tracking"

# 1. สั่ง Dump ฐานข้อมูลและบีบอัด gzip
docker exec -t $CONTAINER pg_dump -U $DB_USER -d $DB_NAME -Fc | gzip > "${BACKUP_DIR}/${FILENAME}"

# 2. ปรับสิทธิ์ไฟล์
chmod 600 "${BACKUP_DIR}/${FILENAME}"

# 3. ลบไฟล์สำรองที่มีอายุเกิน 14 วัน
find "${BACKUP_DIR}" -name "shuttle_backup_*.dump.gz" -mtime +14 -delete

echo "[$(date)] Database backup completed successfully: ${FILENAME}"
```

ให้สิทธิ์ execute สคริปต์:
```bash
chmod +x /opt/shuttle-tracking/scripts/backup-db.sh
```

### 10.2 ตั้งเวลาทำงานผ่าน Crontab

สั่งรันแบ็กอัปอัตโนมัติทุกวันเวลา 03:00 น.:
```bash
sudo crontab -e
```
เพิ่มบรรทัดนี้ลงไปท้ายไฟล์:
```cron
0 3 * * * /opt/shuttle-tracking/scripts/backup-db.sh >> /var/log/shuttle_backup.log 2>&1
```

### 10.3 การกู้คืนฐานข้อมูล (Restore Database)

เมื่อต้องการนำไฟล์แบ็กอัปกลับมาใช้งาน:
```bash
# คลายบีบอัดและ restore เข้า container
gunzip -c /opt/shuttle-tracking/backups/shuttle_backup_20260909_030000.dump.gz | \
  docker exec -i shuttle-postgres pg_restore -U shuttle -d shuttle_tracking --clean --if-exists
```

---

## 11. การอัปเดตเวอร์ชันใหม่และคำสั่งบำรุงรักษา (Maintenance & Updates)

### 11.1 ขั้นตอนการอัปเดตโค้ดเวอร์ชันใหม่ (Zero/Minimal Downtime Deploy)

```bash
cd /opt/shuttle-tracking

# 1. ดึงโค้ดล่าสุดจาก Git
git pull origin main

# 2. บิลด์เฉพาะ service ที่มีการเปลี่ยนแปลงและรันขึ้นมาใหม่
docker compose up -d --build --no-deps api frontend

# 3. ล้าง Docker image ขยะที่ไม่ได้ใช้งานเพื่อคืนพื้นที่ฮาร์ดดิสก์
docker image prune -f
```

### 11.2 คำสั่งดู Logs ตรวจสอบปัญหา

```bash
# ดู log ทั้งหมดแบบเรียลไทม์
docker compose logs -f

# ดู log เฉพาะ Backend API
docker compose logs -f --tail=100 api

# ดู log เฉพาะ MQTT Broker
docker compose logs -f --tail=100 mosquitto

# ดู log Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 11.3 คำสั่ง Restart ระบบทั้งหมด

```bash
docker compose down
docker compose up -d
```
