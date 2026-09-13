# Enterprise AI Smart Door Lock System

An advanced, military-grade biometric security system built with the MERN stack and Edge AI. Designed as a comprehensive B.Tech Final Year Project, this application integrates artificial intelligence, real-time WebSockets, and IoT to provide impenetrable access control.

## 🚀 Key Features

* **Edge AI Face Recognition:** Utilizes `face-api.js` (TensorFlow.js) to extract 128-dimensional facial embeddings directly in the browser via WebGL, ensuring absolute privacy and zero server latency.
* **Liveness Detection (Anti-Spoofing):** Calculates Eye Aspect Ratio (EAR) across 68 facial landmarks to mathematically verify human blinks, preventing photo or video spoofing.
* **Emotion Threat Detection (Panic Alarm):** Analyzes micro-expressions to detect fear or anger. If a user is forced to unlock the door under duress, the system unlocks but secretly triggers a silent panic alarm on the admin dashboard.
* **Two-Factor Authentication (2FA):** Combines biometrics with possession-based security by generating dynamic OTPs.
* **Real-Time WebSocket Dashboard:** A Socket.io-powered admin control center that instantly reflects door traffic, new registrations, and panic alarms without refreshing.
* **Time-Based Access Control:** Fine-grained employee scheduling (e.g., restricted 9-to-5 access).
* **IoT Hardware Integration:** Uses MQTT protocol to publish unlock payloads to physical microcontrollers (ESP32/Raspberry Pi) connected to the smart door.

## 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS, Recharts, Socket.io-client
* **AI Engine:** face-api.js (SSD MobileNet V1, 68-Point Landmark, Expression Net)
* **Backend:** Node.js, Express.js, Socket.io, MQTT
* **Database:** MongoDB Atlas (Mongoose ODM)
* **Security:** JSON Web Tokens (JWT), bcryptjs

## ⚙️ Installation & Setup

### 1. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory and add your MongoDB connection string:
```
MONGO_URI=<YOUR_MONGODB_CONNECTION_STRING>
```
Start the backend server:
```bash
node server.js
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```
Start the React development server:
```bash
npm run dev
```

## 🔐 Default Admin Credentials
* **Username:** `#`
* **Password:** `@`

## 📡 IoT Trigger Example
When access is granted, the Node.js server publishes the following payload to the `btech/smarthome/door/unlock` MQTT topic:
```json
{
  "action": "unlock",
  "user": "John Doe",
  "timestamp": "2026-09-13T10:00:00.000Z",
  "panic": false
}
```
Any ESP32 or IoT device subscribed to this topic can listen for this payload and trigger the physical relay to open the door.

---
*Developed as a Final Year B.Tech Computer Science Project.*

