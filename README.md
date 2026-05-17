# 🔒 LedgerGuard: Local-First Forensic Financial Auditor

A privacy-core, offline-first accounting sandbox powered by the 128K long-context temporal coherence of Gemma 4.

## ✨ CORE FEATURES

*   **Zero-Cloud File Ingestion**: Securely parse and ingest CSV financial data purely client-side without initial server uploads.
*   **Local Device Encrypted Cache**: Utilizes in-browser IndexedDB to persistently cache ledger states across sessions, keeping your sandbox data locally stored.
*   **Real-Time Streaming Forensic Audit Log**: A dedicated code-terminal dashboard powered by Gemma 4 that visually typewrites its forensic logic and structural patterns upon analyzing your ledger.
*   **Interactive "What-If" Scenario Simulator**: Select flagged anomalies and propose alternative tax categories or accounting classifications to dynamically visualize estimated tax impact deltas and audit risk shifts.

## 🧠 ARCHITECTURAL INTENT: WHY GEMMA 4?

Financial ledgers face a critical "timeline fragmentation" problem. Traditional Large Language Models restricted to 8K token windows require data chunking, which inherently severs the connection between distant rows or related events spread across time.

LedgerGuard utilizes Gemma 4's massive 128K context window to enable true **Temporal Coherence**. This deep context allows the AI to catch nuanced anomalies—like a threshold avoidance scheme enacted in January that correlates perfectly with an unusual expense sweep in November—all while analyzing the entire dataset holistically. 

Furthermore, Gemma 4 is ideal for this task due to its mathematical benchmark mastery (scoring ~89% on complex AIME reasoning tests). This level of precision is fundamentally required when processing financial validations, performing tax risk impact tracking, and catching subtle pattern variations associated with structural fraud risks.

## 🛠️ TECHNICAL ARCHITECTURE MAP

```text
[User UI / CSV Dropzone] ──> [Local Browser IndexedDB Cache] ──> [Stateless Node.js/Express Proxy (server.ts)] ──> [Secure Handshake via @google/genai SDK] ──> [Gemma 4 (gemma-4-26b-a4b-it)]
```

## ⚡ QUICK START (LOCAL RUNTIME SETUP)

Follow these steps to deploy your local privacy sandbox environment.

**Step 1: Install Ollama and pull the model**
```bash
ollama pull gemma4:26b
```

**Step 2: Clone repo & install dependencies**
```bash
npm install
```

**Step 3: Configure local environment secrets**
Create a `.env` file containing:
```env
GEMINI_API_KEY=your_ai_studio_key
```

**Step 4: Boot up the concurrent local environments**
```bash
npm run dev
```

## 📄 LICENSING & HACKATHON ATTRIBUTION

This project was custom-built for the global **Build with Gemma 4 Challenge**.
