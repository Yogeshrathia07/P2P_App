import React, { useState } from "react";
import { Terminal, CheckCircle2, XCircle, ChevronUp, ChevronDown, Clock, AlertTriangle } from "lucide-react";

/**
 * ConsoleDrawer
 * Bottom collapsible test case assertion and raw terminal output console.
 */
export const ConsoleDrawer = ({
  testResults,
  consoleLogs,
  executionTimeMs,
  error,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState("tests"); // "tests" | "console"

  if (isCollapsed) {
    return (
      <div className="h-9 border-t border-neutral-800 bg-neutral-950 px-3 flex items-center justify-between select-none">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-neutral-500" />
          <span>Console & Tests</span>
          {testResults && testResults.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                testResults.every((t) => t.passed)
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                  : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
              }`}
            >
              {testResults.filter((t) => t.passed).length}/{testResults.length} Passed
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const passedCount = testResults?.filter((t) => t.passed).length || 0;
  const totalCount = testResults?.length || 0;

  return (
    <div className="h-48 border-t border-neutral-800 bg-neutral-950 flex flex-col overflow-hidden">
      {/* Console Tab Header */}
      <div className="h-9 px-3 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-1">
          {/* Test Cases Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("tests")}
            className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
              activeTab === "tests"
                ? "bg-neutral-800 text-neutral-100 border border-neutral-700/60"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span>Test Cases</span>
            {totalCount > 0 && (
              <span
                className={`text-[10px] px-1.5 rounded ${
                  passedCount === totalCount
                    ? "bg-emerald-950 text-emerald-300"
                    : "bg-rose-950 text-rose-300"
                }`}
              >
                {passedCount}/{totalCount}
              </span>
            )}
          </button>

          {/* Raw Console Log Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("console")}
            className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
              activeTab === "console"
                ? "bg-neutral-800 text-neutral-100 border border-neutral-700/60"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Terminal className="w-3 h-3 text-neutral-400" />
            <span>Stdout</span>
            {consoleLogs?.length > 0 && (
              <span className="text-[10px] px-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                {consoleLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Runtime info & collapse button */}
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && (
            <span className="text-[11px] font-mono text-neutral-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {executionTimeMs}ms
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse Console"
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs font-mono">
        {/* Runtime Crash Error */}
        {error && (
          <div className="mb-3 p-2.5 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        )}

        {/* Tab 1: Test Cases */}
        {activeTab === "tests" && (
          <div className="space-y-2">
            {!testResults || testResults.length === 0 ? (
              <div className="text-neutral-500 italic py-4 text-center">
                Click &ldquo;Run&rdquo; to execute test assertions against the current solution.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {testResults.map((tc) => (
                  <div
                    key={tc.index}
                    className={`p-2.5 rounded border ${
                      tc.passed
                        ? "bg-emerald-950/20 border-emerald-800/40 text-neutral-300"
                        : "bg-rose-950/20 border-rose-800/40 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-neutral-200">Test Case #{tc.index}</span>
                      <span
                        className={`flex items-center gap-1 text-[11px] font-mono ${
                          tc.passed ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {tc.passed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Failed
                          </>
                        )}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-neutral-400">
                      <div>
                        <span className="text-neutral-500 mr-1.5">Input:</span>
                        <span className="text-neutral-300">{JSON.stringify(tc.input)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 mr-1.5">Expected:</span>
                        <span className="text-emerald-400">{JSON.stringify(tc.expected)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 mr-1.5">Actual:</span>
                        <span className={tc.passed ? "text-neutral-300" : "text-rose-400 font-semibold"}>
                          {JSON.stringify(tc.actual)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Raw Console Log */}
        {activeTab === "console" && (
          <div className="space-y-1">
            {!consoleLogs || consoleLogs.length === 0 ? (
              <div className="text-neutral-500 italic py-4 text-center">
                No output logged to stdout. Statements like console.log() will appear here.
              </div>
            ) : (
              consoleLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px] py-0.5">
                  <span className="text-neutral-600 shrink-0 font-sans">{log.timestamp}</span>
                  <span
                    className={`font-mono ${
                      log.type === "error"
                        ? "text-rose-400"
                        : log.type === "warn"
                        ? "text-amber-400"
                        : "text-neutral-300"
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsoleDrawer;

