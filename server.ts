import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API route to handle the audit
  app.post("/api/audit", async (req, res) => {
    try {
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
             'User-Agent': 'aistudio-build',
          }
        }
      });
      
      const { transactions } = req.body;
      
      const config = {
          systemInstruction: "You are an elite forensic financial auditor. Analyze the provided transaction ledger rows carefully. CRITICAL AUDITING RULES: 1. ONLY flag a transaction as a \"duplicate\" if you see the exact same Amount, Date, and Vendor Description appearing more than once in the dataset. Do not invent or infer duplicate patterns or ID matches for unique individual rows. 2. Focus heavily on identifying other contextual anomalies: - Round-dollar amounts sitting strategically just beneath major regulatory tracking or internal capitalization thresholds (e.g., items near $5,000 or $10,000). - Ambiguous or high-value line items left under the 'Uncategorized' classification. - Sudden high-frequency expense sweeps or unusual transactions occurring on unusual dates (like New Year's Eve business sweeps). You must write out your true phase-by-phase data validations inside the 'audit_reasoning' token block before assembling the final JSON schema metrics.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              audit_reasoning: {
                type: Type.STRING,
                description: "A comprehensive monospace breakdown of overall patterns found."
              },
              risk_score: {
                type: Type.INTEGER,
                description: "Integer between 1 and 100"
              },
              flagged_anomalies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    severity: { type: Type.STRING },
                    reason_flagged: { type: Type.STRING }
                  },
                  required: ["date", "description", "amount", "severity", "reason_flagged"]
                }
              }
            },
            required: ["audit_reasoning", "risk_score", "flagged_anomalies"]
          }
      };

      try {
        const response = await ai.models.generateContent({
          model: "gemma-4-26b-a4b-it",
          contents: `Here are the transactions to audit:\n${JSON.stringify(transactions)}`,
          config
        });
        res.json(JSON.parse(response.text!));
      } catch (err: any) {
        if (err?.message?.includes("404") || err?.status === 404) {
            console.log("Requested model not found, gracefully falling back to gemini-3.1-pro-preview");
            const response = await ai.models.generateContent({
              model: "gemini-3.1-pro-preview",
              contents: `Here are the transactions to audit:\n${JSON.stringify(transactions)}`,
              config
            });
            res.json(JSON.parse(response.text!));
        } else {
            throw err;
        }
      }
    } catch (error: any) {
      console.error("Audit error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // API route to handle what-if scenario simulations
  app.post("/api/simulate-scenario", async (req, res) => {
    try {
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
             'User-Agent': 'aistudio-build',
          }
        }
      });
      
      const { anomaly, proposedCategory, taxBracket } = req.body;
      
      const config = {
          systemInstruction: "You are a specialized tax simulator and risk forensic AI. Analyze the proposed categorization change for this transaction and its impact on tax liability and audit risk under standard tax frameworks. Provide your reasoning and calculate estimated financial and risk deltas.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              simulation_reasoning: {
                type: Type.STRING,
                description: "Monospace string detailing why the change impacts tax liability or compliance profile under standard tax frameworks."
              },
              original_tax_impact: {
                type: Type.NUMBER
              },
              new_tax_impact: {
                type: Type.NUMBER
              },
              audit_risk_delta: {
                type: Type.INTEGER,
                description: "Negative or positive integer representing percentage change"
              },
              regulatory_note: {
                type: Type.STRING,
                description: "A single-sentence official warning or guidance note."
              }
            },
            required: ["simulation_reasoning", "original_tax_impact", "new_tax_impact", "audit_risk_delta", "regulatory_note"]
          }
      };

      const contents = `Original Anomaly Details: ${JSON.stringify(anomaly)}\nProposed Alternative Classification: ${proposedCategory}\nAssumed Tax Bracket: ${taxBracket}%\n\nPlease process the simulation based on these parameters.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemma-4-26b-a4b-it",
          contents: contents,
          config
        });
        res.json(JSON.parse(response.text!));
      } catch (err: any) {
        if (err?.message?.includes("404") || err?.status === 404) {
            console.log("Requested model not found, gracefully falling back to gemini-3.1-pro-preview");
            const response = await ai.models.generateContent({
              model: "gemini-3.1-pro-preview",
              contents: contents,
              config
            });
            res.json(JSON.parse(response.text!));
        } else {
            throw err;
        }
      }
    } catch (error: any) {
      console.error("Simulation error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
