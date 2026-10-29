# Secure Mock Examination & Monitoring Platform

A secure, independent, full-stack mock examination platform with real-time browser activity monitoring, server-side scoring, mistake analysis, and dual-administrator command bridge for team members.

---

## 🛡️ Single Entry Routing: Discrete Name Input & Admin Number

The platform features a clean, discrete single-field entry screen: **"Enter your name"**

### 1. Authorized Administrators (Admin Room Access)
| Administrator | Role | Preconfigured Admin Number | Access Granted |
|---|---|---|---|
| **Tony Stark (Iron Man)** | Administrator 1 | **`224488`** (Default) / `3000` | **Admin Room (Command Bridge)** |
| **Steve Rogers (Captain America)** | Administrator 2 | `1941` / `1002` | **Admin Room (Command Bridge)** |

- When entering the default admin number **`224488`** in the name input field, the backend discretely authorizes and routes to the **Admin Room**.

### 2. Common Room Operatives (Student Access)
- Entering any member name (such as `Rishith`, `Arjun`, `Rahul`, `Peter Parker`, etc.) routes the operative directly to the **Common Room**.
- Operatives can attend mock exams, submit answers, and view their individual mistake analysis and score trends.

### 3. Server-Side Security Rules Enforced
- **Strict Number Validation:** Only registered administrator numbers are accepted. Unauthorized or unknown numbers (e.g. `1234`, `9999`) return an explicit `401 Unauthorized` refusal.
- **Name Spoofing Protection:** Typing an administrator's name (e.g., `Tony Stark` or `Steve Rogers`) will **never** grant administrator privileges; typing names strictly assigns student role permissions.
- **Hidden Admin Registry:** Administrator numbers exist solely on the server backend and are never bundled or exposed in client-side code.
- **Protected Sessions & Logout:** Administrator sessions are secured via cryptographic JWT tokens, with a dedicated top-bar logout control.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
# In project root:
npm run install:all
```

### 2. Launch Development Servers (Concurrent)
```bash
# Starts both Express + Socket.IO server (Port 5000) and Vite React Client (Port 5173):
npm run dev
```

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API & WebSockets:** [http://localhost:5000](http://localhost:5000)

---

## 🏛️ Platform Architecture

### 1. Authentication & Role Permissions
- Secure JWT-based authentication stored in local storage and sent via `Authorization: Bearer <token>`.
- Strict server-side role validation (`requireAdmin`).
- Display names or client-supplied role parameters are never trusted. All self-registrations default strictly to `student`.

### 2. Common Room (Student / Member Experience)
- **Available Mock Exams:** View mock exams, duration, question count, marking scheme (+marks, -penalty), and instructions.
- **Pre-Exam Readiness:** Fullscreen verification, webcam preview test with privacy notice, and operational policy agreement.
- **Exam Room:**
  - 4 multiple choice options per question.
  - Real-time countdown timer with visual urgency alerts (Amber < 5m, Red pulsing < 1m).
  - Auto-submission immediately on timer expiration.
  - Question Palette (Answered, Unanswered, Marked for Review, Answered & Marked, Not Visited).
  - Clear selection & Mark for Review toggle.
  - Final submission confirmation modal.
- **Mistake Analysis:**
  - Complete review of every question after submission: question text, selected option, official correct option, status, technical rationale/explanation, and **Related Concept to Revise**.
  - Admin release support: when exams are set to `admin_released`, answers remain locked until Tony Stark or Steve Rogers toggles release.
- **Member Personal Dossier:**
  - Overall accuracy %, best score, average score, performance trajectory chart.
  - Aggregated **Topics Needing Improvement** highlighting recurring conceptual weaknesses.

### 3. Admin Room (Command Bridge for Tony Stark & Steve Rogers)
- **Live Student Telemetry (Socket.IO):**
  - Real-time active student table displaying student name, badge ID, active exam, start time, questions answered / total, time remaining, and strike count.
  - Interventions: Dispatch official warnings directly to student screens or force-terminate sessions.
- **Security Audit Stream:**
  - Real-time event feed of tab switching, window focus loss, fullscreen exits, and clipboard misuse.
- **Exam Management:**
  - Create and configure exams: questions, options, correct answers, explanations, duration, marks, negative penalties, strike limits, and answer key release mode.
  - 1-click **Release / Restrict Answer Keys** button.
- **Reports & Audits:**
  - Complete historical records of all attempts (submitted and terminated).
  - Search by student or exam title.
  - Session reset capability (allowing retake if technical issues occurred).
  - One-click **Export to CSV**.

### 4. Browser Monitoring & Proctoring Engine
- Monitors supported browser events:
  - Tab switching / page hiding (`visibilitychange`)
  - Leaving examination window (`window.blur`)
  - Exiting fullscreen mode (`fullscreenchange`)
  - Copy, cut, and paste attempts (`copy`, `cut`, `paste`)
  - Developer tool shortcut blocking (`F12`, `Ctrl+Shift+I`)
- Configurable violation policies:
  - Strike 1: Warning modal alert dialog with strike level gauge.
  - Strike 2: Severe warning with audible beep.
  - Strike 3 (threshold): Session automatically terminated on server! Current answers are locked, timestamped, reasons recorded, and both Tony Stark and Captain America are alerted via Socket.IO.
- **Proctoring Transparency Notice:** Clearly discloses technical boundaries of browser-based monitoring without false claims of external hardware detection.

---

## 🧪 Automated Verification
Run the end-to-end integration test suite anytime:
```bash
node server/tests/verify_platform.js
```
