import { useState, useEffect, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, ShieldCheck, Database, Trash2, Search, TableProperties } from 'lucide-react';
import { cn } from './lib/utils';
import { parseCSV } from './lib/csv';
import { Transaction, addTransactions, getAllTransactions, clearTransactions } from './lib/db';

interface Anomaly {
  date: string;
  description: string;
  amount: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  reason_flagged: string;
}

interface AuditData {
  audit_reasoning: string;
  risk_score: number;
  flagged_anomalies: Anomaly[];
}

interface SimulationData {
  simulation_reasoning: string;
  original_tax_impact: number;
  new_tax_impact: number;
  audit_risk_delta: number;
  regulatory_note: string;
}

interface Override {
  date: string;
  description: string;
  amount: number;
  newCategory: string;
}

const CircularGauge = ({ score }: { score: number }) => {
    let colorClass = "text-green-400";
    if (score >= 40) colorClass = "text-yellow-400";
    if (score >= 70) colorClass = "text-rose-400";

    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
            <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" className="text-slate-800" fill="transparent" />
                <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" className={colorClass} fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s ease-out" }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center pt-0.5">
                <span className={cn("text-xl font-bold leading-none", colorClass)}>{score}</span>
                <span className="text-[8px] text-slate-500 uppercase tracking-widest mt-[2px]">Risk</span>
            </div>
        </div>
    )
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [displayedReasoning, setDisplayedReasoning] = useState("");

  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [proposedCategory, setProposedCategory] = useState("Marketing");
  const [taxBracket, setTaxBracket] = useState(25);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
        const data = await getAllTransactions();
        const sorted = data.sort((a, b) => {
            const timeA = new Date(a.date).getTime() || 0;
            const timeB = new Date(b.date).getTime() || 0;
            return timeB - timeA;
        });
        setTransactions(sorted);
    } catch (err) {
        console.error("Failed to load transactions", err);
    }
  };

  const handleClear = async () => {
      if (window.confirm("Are you sure you want to clear all locally stored records?")) {
        await clearTransactions();
        setTransactions([]);
        setAuditData(null);
        setDisplayedReasoning("");
        setOverrides([]);
      }
  };

  const processFile = async (file: File) => {
      if (!file) return;
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
          alert("Please upload a valid CSV file.");
          return;
      }

      setIsParsing(true);
      try {
          const parsedData = await parseCSV(file);
          if (parsedData.length === 0) {
              alert("No suitable rows found in CSV.");
              return;
          }
          
          await clearTransactions(); // Clear IndexedDB first
          await addTransactions(parsedData);
          
          // Flush local component state
          setAuditData(null);
          setDisplayedReasoning("");
          setOverrides([]);
          
          await loadTransactions();
      } catch (err) {
          console.error("Error processing CSV file:", err);
          alert("Failed to parse the CSV file.");
      } finally {
          setIsParsing(false);
      }
  };

  const runAudit = async () => {
    if (transactions.length === 0) return;
    setIsAuditing(true);
    setAuditData(null);
    setDisplayedReasoning("");
    setOverrides([]);
    
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Audit failed");
      }
      const data: AuditData = await response.json();
      setAuditData(data);
      
      let i = 0;
      const text = data.audit_reasoning || "";
      const timer = setInterval(() => {
        setDisplayedReasoning(text.substring(0, i));
        i += 3; // Type 3 chars at a time
        if (i > text.length) {
            setDisplayedReasoning(text);
            clearInterval(timer);
        }
      }, 10);
      
    } catch (err) {
      console.error(err);
      alert("Failed to execute forensic audit. Please try again.");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedAnomaly) return;
    setIsSimulating(true);
    setSimulationData(null);
    try {
      const response = await fetch("/api/simulate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anomaly: selectedAnomaly, proposedCategory, taxBracket })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Simulation failed");
      }
      const data: SimulationData = await response.json();
      setSimulationData(data);
    } catch (err) {
      console.error(err);
      alert("Failed to execute simulation. Please try again.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApplyOverride = () => {
    if (!selectedAnomaly) return;
    setOverrides(prev => [
      ...prev,
      {
        date: selectedAnomaly.date,
        description: selectedAnomaly.description,
        amount: selectedAnomaly.amount,
        newCategory: proposedCategory
      }
    ]);
    setSelectedAnomaly(null);
  };

  const exportCSV = () => {
    if (!auditData) return;
    
    const headers = ["Date", "Description", "Amount", "Severity Level", "Flag Reason", "Applied What-If Override"];
    const rows = auditData.flagged_anomalies.map(anom => {
      const override = overrides.find(o => o.date === anom.date && o.description === anom.description && o.amount === anom.amount);
      return [
        `"${anom.date}"`,
        `"${anom.description.replace(/"/g, '""')}"`, // escape quotes
        anom.amount,
        anom.severity,
        `"${anom.reason_flagged.replace(/"/g, '""')}"`,
        override ? `"${override.newCategory}"` : "None"
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ledgerguard_audit_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportPDF = () => {
    if (!auditData) return;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LedgerGuard Forensic Audit Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 40px; line-height: 1.5; }
        .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
        .title { margin: 0; font-size: 24px; letter-spacing: -0.05em; color: #1e3a8a; }
        .meta { font-size: 12px; color: #64748b; text-align: right; }
        .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px; display: inline-block; }
        .score { font-size: 36px; font-weight: bold; color: #ef4444; }
        .terminal-block { background: #0f172a; color: #cbd5e1; padding: 20px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; margin-bottom: 35px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f1f5f9; text-align: left; padding: 12px; font-size: 13px; color: #475569; border-bottom: 2px solid #cbd5e1; }
        td { padding: 12px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
        .severity { font-weight: bold; font-size: 11px; padding: 3px 8px; border-radius: 4px; display: inline-block; }
        .HIGH { background: #ffe4e6; color: #991b1b; }
        .MEDIUM { background: #fef3c7; color: #92400e; }
        .LOW { background: #e0f2fe; color: #075985; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">🔒 LEDGERGUARD FORENSIC COMPLIANCE REPORT</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">Automated Financial Anomaly Evaluation Ledger</p>
        </div>
        <div class="meta">
          <strong>Generated:</strong> ${new Date().toLocaleDateString()}<br>
          <strong>Engine:</strong> Gemma 4 (26B MoE Layer)
        </div>
      </div>

      <div class="metric-card">
        <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Overall Risk Index</div>
        <div class="score">${auditData.risk_score} / 100</div>
      </div>

      <h3>🧠 Forensic Audit Reasoning Log</h3>
      <div class="terminal-block">${auditData.audit_reasoning}</div>

      <h3>🚩 Flagged Transaction Discrepancies</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Severity</th>
            <th>Flag Analysis / Reason</th>
          </tr>
        </thead>
        <tbody>
          ${auditData.flagged_anomalies.map(item => `
            <tr>
              <td style="white-space: nowrap;">${item.date}</td>
              <td><strong>${item.description}</strong></td>
              <td style="color: #b91c1c;">$${item.amount.toFixed(2)}</td>
              <td><span class="severity ${item.severity}">${item.severity}</span></td>
              <td>${item.reason_flagged}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Pop-up blocked! Please allow pop-ups for AI Studio to export the PDF.");
      setShowExportMenu(false);
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 250);

    setShowExportMenu(false);
  };

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
          processFile(file);
      }
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          processFile(file);
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
  };

  const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          signDisplay: 'auto'
      }).format(amount);
  };

  return (
    <>
    <div className="h-screen flex flex-col bg-slate-950 text-slate-50 font-sans overflow-hidden print:hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 bg-slate-900 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-400 rounded-md flex items-center justify-center font-extrabold text-slate-950">
            L
          </div>
          <div>
            <h1 className="text-[18px] font-bold leading-tight">LedgerGuard</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider">PHASE 1 AUDITOR</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="bg-sky-400/10 border border-sky-400/30 text-sky-400 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5">
            <span>🔒</span> 100% Client-Side Sandbox
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-slate-400 hidden sm:inline">DB: Local IndexedDB</span>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Database className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Sidebar / Upload Section */}
        <aside className="w-80 border-r border-slate-700 bg-slate-900 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto hidden md:flex">
          <div>
            <h2 className="text-[14px] font-medium mb-2">Import Documents</h2>
            <p className="text-[12px] text-slate-400 mb-4">Upload CSV files for local audit. Data never leaves your machine.</p>
            
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                  "border-2 border-dashed rounded-xl h-[200px] flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer text-center p-5",
                  isDragging 
                      ? "border-sky-400 bg-sky-400/5" 
                      : "border-slate-700 hover:border-sky-400 hover:bg-sky-400/5"
              )}
            >
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={onFileChange} 
                  className="hidden" 
                  accept=".csv,text/csv" 
              />
              
              <div className="text-[32px] opacity-50 mb-1">
                {isParsing ? "⏳" : "📄"}
              </div>
              <p className="text-[13px] font-medium text-slate-50">
                {isParsing ? "Parsing data..." : "Drag & Drop CSV"}
              </p>
              <p className="text-[11px] text-slate-400">
                or click to browse local files
              </p>
            </div>
          </div>

          <div className="mt-auto">
            <div className="p-4 bg-white/5 rounded-lg border border-slate-700">
              <h3 className="text-[12px] mb-1 text-slate-50">Storage Stats</h3>
              <div className="w-full h-1 bg-slate-700 rounded-full my-2">
                <div className="w-[12%] h-full bg-sky-400 rounded-full"></div>
              </div>
              <p className="text-[10px] text-slate-400">1.2MB of 512MB utilized</p>
            </div>
          </div>
        </aside>

        {/* Content Area / Data Grid Section */}
        <section className="flex-1 p-6 flex flex-col gap-5 overflow-hidden">
          <div className="flex justify-between items-center shrink-0">
            <h2 className="text-[20px] font-semibold flex items-center gap-3 text-slate-50">
              Audit Records 
              <span className="text-slate-400 text-[14px] font-normal">({transactions.length} items)</span>
            </h2>
            <div className="flex gap-3">
              {transactions.length > 0 && (
                  <button 
                    onClick={handleClear}
                    className="bg-slate-800 text-slate-300 hover:text-rose-400 px-4 py-2 rounded-md font-semibold text-[13px] border border-slate-700 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Data</span>
                  </button>
              )}
              
              <div className="relative">
                 <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={!auditData}
                    className="bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:text-sky-400 px-4 py-2 rounded-md font-semibold text-[13px] border border-slate-700 transition-colors flex items-center gap-2"
                  >
                    Export Executive Report
                    <span className="text-[10px]">▼</span>
                 </button>
                 {showExportMenu && auditData && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
                      <button onClick={exportCSV} className="w-full text-left px-4 py-3 text-[12px] font-medium text-slate-300 hover:bg-slate-800 hover:text-sky-400 border-b border-slate-800 flex items-center gap-2">
                        <span>📊</span> Download Data Log (.CSV)
                      </button>
                      <button onClick={exportPDF} className="w-full text-left px-4 py-3 text-[12px] font-medium text-slate-300 hover:bg-slate-800 hover:text-sky-400 flex items-center gap-2">
                        <span>📄</span> Generate Audit Report (.PDF)
                      </button>
                    </div>
                 )}
              </div>

              <button 
                onClick={runAudit}
                disabled={transactions.length === 0 || isAuditing}
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-slate-50 px-5 py-2 rounded-md font-semibold text-[13px] shadow-sm hover:opacity-90 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
              >
                Run Ledger Audit
              </button>
            </div>
          </div>

          {/* Audit Dashboard module - visible if audit is complete */}
          {auditData && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 shrink-0 flex gap-6 shadow-sm">
                  <CircularGauge score={auditData.risk_score} />
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded p-4 font-mono text-[11px] text-slate-300 overflow-y-auto h-20 shadow-inner leading-relaxed">
                      <div className="whitespace-pre-wrap">{displayedReasoning}<span className="animate-pulse opacity-70 border-r border-slate-400 ml-0.5"></span></div>
                  </div>
              </div>
          )}

          {/* Show mobile upload area if sidebar hidden */}
          <div className="md:hidden">
             <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                  "border-2 border-dashed rounded-xl h-[120px] flex flex-col items-center justify-center transition-colors cursor-pointer text-center px-4",
                  isDragging 
                      ? "border-sky-400 bg-sky-400/5" 
                      : "border-slate-700 hover:border-sky-400 hover:bg-sky-400/5"
              )}
            >
              <p className="text-[13px] font-medium text-slate-50">
                {isParsing ? "Parsing data..." : "Tap to upload CSV"}
              </p>
            </div>
          </div>

          {/* Main area split: Anomalies and Data Grid */}
          <div className="flex-1 flex gap-5 overflow-hidden flex-col lg:flex-row">
             {auditData && auditData.flagged_anomalies && auditData.flagged_anomalies.length > 0 && (
                 <div className="lg:w-80 border border-slate-700 rounded-xl overflow-y-auto bg-slate-900 shrink-0">
                    <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-3 font-semibold text-[13px] shadow-[0_1px_0_0_#334155] z-10 flex items-center justify-between">
                        Suspicious Activity
                        <span className="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">{auditData.flagged_anomalies.length} Flagged</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {auditData.flagged_anomalies.map((anom, i) => (
                            <div 
                                key={i} 
                                onClick={() => {
                                    setSelectedAnomaly(anom);
                                    setSimulationData(null);
                                    setProposedCategory("Marketing");
                                    setTaxBracket(25);
                                }}
                                className="flex flex-col gap-2 p-3 rounded-lg bg-white/[0.02] border border-slate-700/50 cursor-pointer hover:bg-white/[0.04] hover:border-slate-500 transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[11px] font-mono text-slate-400">{anom.date}</span>
                                    <span className={cn(
                                        "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                        anom.severity === 'HIGH' ? "bg-rose-500/10 text-rose-400" :
                                        anom.severity === 'MEDIUM' ? "bg-amber-500/10 text-amber-500" :
                                        "bg-blue-500/10 text-blue-400"
                                    )}>
                                        {anom.severity}
                                    </span>
                                </div>
                                <div className="text-[12px] font-medium text-slate-200">{anom.description}</div>
                                <div className="text-[11px] font-mono font-medium text-slate-50">{formatCurrency(anom.amount)}</div>
                                <div className="text-[11px] text-slate-400 leading-relaxed bg-black/20 p-2 rounded border border-white/5">{anom.reason_flagged}</div>
                            </div>
                        ))}
                    </div>
                 </div>
             )}
             
             <div className="flex-1 border border-slate-700 rounded-xl overflow-auto bg-slate-900 min-h-0 relative">

            {transactions.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-2">
                      <TableProperties className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-[14px]">No records found. Import a CSV file to begin your audit.</p>
                </div>
            ) : (
                <table className="w-full text-left text-[13px] border-collapse relative">
                    <thead className="sticky top-0 z-10 m-0 shadow-[0_1px_0_0_#334155]">
                        <tr className="bg-slate-800 m-0">
                            <th className="text-slate-400 px-4 py-3 font-semibold uppercase text-[11px] tracking-wider whitespace-nowrap">Date</th>
                            <th className="text-slate-400 px-4 py-3 font-semibold uppercase text-[11px] tracking-wider">Description</th>
                            <th className="text-slate-400 px-4 py-3 font-semibold uppercase text-[11px] tracking-wider">Category</th>
                            <th className="text-slate-400 px-4 py-3 font-semibold uppercase text-[11px] tracking-wider">Account</th>
                            <th className="text-slate-400 px-4 py-3 font-semibold uppercase text-[11px] tracking-wider text-right whitespace-nowrap">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((tx, idx) => {
                            const override = overrides.find(o => o.date === tx.date && o.description === tx.description && o.amount === tx.amount);
                            const categoryToDisplay = override ? override.newCategory : (tx.category || 'Uncategorized');
                            
                            return (
                            <tr 
                                key={tx.id || idx} 
                                className="odd:bg-transparent even:bg-white/[0.02] hover:bg-slate-800 transition-colors group"
                            >
                                <td className="px-4 py-3 border-b border-slate-700 text-slate-50 whitespace-nowrap">
                                    {tx.date || '-'}
                                </td>
                                <td className="px-4 py-3 border-b border-slate-700 text-slate-50 truncate max-w-sm" title={tx.description}>
                                    {tx.description || '-'}
                                </td>
                                <td className="px-4 py-3 border-b border-slate-700 text-slate-50">
                                    {override ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-400/20">
                                            {categoryToDisplay} <span className="opacity-70 text-[9px] uppercase tracking-wider">(Override)</span>
                                        </span>
                                    ) : (
                                        categoryToDisplay
                                    )}
                                </td>
                                <td className="px-4 py-3 border-b border-slate-700 text-slate-50">
                                    {tx.account || '-'}
                                </td>
                                <td className={cn(
                                    "px-4 py-3 border-b border-slate-700 text-right font-medium whitespace-nowrap",
                                    tx.amount < 0 ? "text-rose-400" : "text-green-400"
                                )}>
                                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            )}
           </div>
          </div>
        </section>
      </main>

      {/* Loading Overlay */}
      {isAuditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-5 bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl">
                  <div className="w-12 h-12 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin"></div>
                  <p className="text-slate-300 text-[13px] font-medium animate-pulse tracking-wide font-mono">
                      Gemma 4 is executing forensic calculations...
                  </p>
              </div>
          </div>
      )}

      {/* Simulation Modal */}
      {selectedAnomaly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-slate-100 items-center flex gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                Simulate Adjustment
              </h3>
              <button onClick={() => setSelectedAnomaly(null)} className="text-slate-500 hover:text-slate-300 p-1">✕</button>
            </div>
            
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex flex-col gap-2 text-[13px] shadow-inner">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500 font-medium">Date</span>
                <span className="font-mono text-slate-300">{selectedAnomaly.date}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 py-2">
                <span className="text-slate-500 font-medium">Amount</span>
                <span className={cn("font-mono font-medium", selectedAnomaly.amount < 0 ? "text-rose-400" : "text-green-400")}>
                    {formatCurrency(selectedAnomaly.amount)}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500 font-medium">Description</span>
                <span className="text-slate-300 text-right truncate w-48 font-medium" title={selectedAnomaly.description}>{selectedAnomaly.description}</span>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2.5">
                <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Propose Alternative Classification</label>
                <select 
                  value={proposedCategory}
                  onChange={(e) => setProposedCategory(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-[13px] rounded-lg px-3 py-2.5 outline-none focus:border-sky-500 transition-colors shadow-sm"
                >
                  <option value="Marketing">Marketing</option>
                  <option value="Travel & Lodging">Travel & Lodging</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Meals & Entertainment">Meals & Entertainment</option>
                  <option value="Equipment/Assets">Equipment/Assets</option>
                  <option value="Personal">Personal / Owner Draw</option>
                </select>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Assumed Tax Bracket</label>
                  <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700 text-[12px] text-sky-400 font-mono font-bold">{taxBracket}%</div>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="40" 
                  value={taxBracket}
                  onChange={(e) => setTaxBracket(parseInt(e.target.value))}
                  className="w-full accent-sky-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {!simulationData && (
              <button 
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full mt-2 bg-slate-800 text-sky-400 border border-sky-400/30 hover:bg-sky-400/10 hover:border-sky-400/50 py-3 rounded-xl text-[13px] font-semibold transition-all flex justify-center items-center h-12 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isSimulating ? (
                    <span className="flex items-center gap-2 animate-pulse">
                        <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                        Calculating variance models...
                    </span>
                ) : (
                    "Run What-If Simulation"
                )}
              </button>
            )}

            {simulationData && (
              <div className="flex flex-col gap-5 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex gap-4">
                  <div className="flex-1 bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center gap-1.5 shadow-inner">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">🧾 Tax Shift</span>
                    <span className={cn("text-[18px] font-bold font-mono tracking-tight", (simulationData.new_tax_impact - simulationData.original_tax_impact) < 0 ? "text-green-400" : "text-slate-200")}>
                      {(simulationData.new_tax_impact - simulationData.original_tax_impact) > 0 ? "+" : ""}
                      {formatCurrency(simulationData.new_tax_impact - simulationData.original_tax_impact)}
                    </span>
                  </div>
                  <div className="flex-1 bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center gap-1.5 shadow-inner">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">⚠️ Audit Risk Variance</span>
                    <span className={cn("text-[18px] font-bold font-mono", simulationData.audit_risk_delta < 0 ? "text-green-400" : "text-rose-400")}>
                      {simulationData.audit_risk_delta > 0 ? "+" : ""}{simulationData.audit_risk_delta}%
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-[11px] text-slate-300 overflow-y-auto max-h-32 shadow-inner leading-relaxed">
                  {simulationData.simulation_reasoning}
                </div>

                <div className="text-[11px] text-slate-400 italic text-center px-2 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded text-amber-200/70">
                  {simulationData.regulatory_note}
                </div>

                <button 
                  onClick={handleApplyOverride}
                  className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-50 py-3 rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-sky-500/20 mt-1 border border-sky-400/50"
                >
                  Apply Adjustment Override
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-10 border-t border-slate-700 flex items-center justify-between px-6 text-[11px] text-slate-400 bg-slate-900 shrink-0">
        <div>Status: <span className="text-green-400">Connected to IndexedDB</span></div>
        <div>LedgerGuard v1.0.4-alpha &bull; Precision Financial Privacy</div>
      </footer>
    </div>
    
      {/* Print-Only Layout */}
      <div className="hidden print:block w-full text-black bg-white p-8 font-sans">
        {auditData && (
          <div className="space-y-8">
            <div className="border-b-4 border-slate-900 pb-4 mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight uppercase">LedgerGuard Forensic Compliance Report</h1>
              <p className="text-sm font-medium text-slate-500 mt-1">Generated: {new Date().toLocaleString()}</p>
            </div>

            <div className="flex gap-8 items-start">
              <div className="w-48 p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-slate-500 uppercase tracking-widest mb-2">Risk Score</span>
                <span className={cn("text-6xl font-black", auditData.risk_score >= 70 ? "text-red-600" : auditData.risk_score >= 40 ? "text-amber-600" : "text-green-600")}>
                  {auditData.risk_score}
                </span>
                <span className="text-xs font-semibold text-slate-400 mt-2">/ 100</span>
              </div>

              <div className="flex-1 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-base font-bold uppercase tracking-wider mb-3 text-slate-800">Audit Reasoning Log</h3>
                <div className="font-mono text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {auditData.audit_reasoning}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-4 text-slate-800 border-b border-slate-200 pb-2">Flagged Items Ledger</h3>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="py-2 pr-4 font-bold">Date</th>
                    <th className="py-2 pr-4 font-bold">Description</th>
                    <th className="py-2 pr-4 font-bold text-right">Amount</th>
                    <th className="py-2 px-4 font-bold">Severity</th>
                    <th className="py-2 pl-4 font-bold">Flag Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {auditData.flagged_anomalies.map((anom, i) => (
                    <tr key={i} className="break-inside-avoid">
                      <td className="py-3 pr-4 whitespace-nowrap font-mono">{anom.date}</td>
                      <td className="py-3 pr-4 max-w-[200px] truncate" title={anom.description}>{anom.description}</td>
                      <td className={cn("py-3 pr-4 text-right font-medium whitespace-nowrap", anom.amount < 0 ? "text-red-600" : "text-green-600")}>
                        {formatCurrency(anom.amount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-xs uppercase tracking-wider">{anom.severity}</span>
                      </td>
                      <td className="py-3 pl-4 text-xs text-slate-600">{anom.reason_flagged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {overrides.length > 0 && (
              <div className="mt-8 break-before-auto">
                <h3 className="text-lg font-bold uppercase tracking-wider mb-4 text-slate-800 border-b border-slate-200 pb-2">Simulation Impact History</h3>
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-800">
                      <th className="py-2 pr-4 font-bold">Date</th>
                      <th className="py-2 pr-4 font-bold">Description</th>
                      <th className="py-2 pl-4 font-bold">Applied Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {overrides.map((override, i) => (
                      <tr key={i} className="break-inside-avoid">
                        <td className="py-3 pr-4 whitespace-nowrap font-mono">{override.date}</td>
                        <td className="py-3 pr-4 max-w-[300px] truncate">{override.description}</td>
                        <td className="py-3 pl-4 font-bold text-sky-700 uppercase tracking-wider text-xs">
                          {override.newCategory}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

