import React, { useRef, useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Play, RotateCcw, Code2, Users, Loader2 } from "lucide-react";

const SUPPORTED_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
];

/**
 * CodeEditor
 * Collaborative Monaco editor with live synchronization and in-browser execution.
 */
export const CodeEditor = ({
  code,
  language,
  onChangeCode,
  onChangeLanguage,
  onResetCode,
  onRunCode,
  isRunning,
  socket,
  roomId,
  peerName,
}) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const isRemoteChangeRef = useRef(false);
  const [peerCursor, setPeerCursor] = useState(null);
  const debounceTimerRef = useRef(null);

  // Handle Editor Mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register Ctrl+Enter / Cmd+Enter run shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onRunCode) onRunCode();
    });

    // Cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      if (socket && roomId) {
        socket.emit("room:cursor-change", {
          roomId,
          cursor: {
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          },
        });
      }
    });
  };

  // Socket Synchronization Listeners
  useEffect(() => {
    if (!socket || !roomId) return;

    // Remote code updates
    const handleRemoteCode = ({ code: newCode }) => {
      if (editorRef.current && newCode !== editorRef.current.getValue()) {
        isRemoteChangeRef.current = true;
        const currentPosition = editorRef.current.getPosition();
        editorRef.current.setValue(newCode);
        if (currentPosition) {
          editorRef.current.setPosition(currentPosition);
        }
        onChangeCode(newCode, false); // false = do not re-broadcast
        isRemoteChangeRef.current = false;
      }
    };

    // Remote cursor position updates
    const handleRemoteCursor = ({ cursor, user }) => {
      if (cursor) {
        setPeerCursor({
          line: cursor.lineNumber,
          col: cursor.column,
          name: user?.name || peerName || "Peer",
        });
      }
    };

    // Remote language change
    const handleRemoteLanguage = ({ language: newLang }) => {
      if (newLang && newLang !== language) {
        onChangeLanguage(newLang, false);
      }
    };

    socket.on("room:code-update", handleRemoteCode);
    socket.on("room:cursor-update", handleRemoteCursor);
    socket.on("room:language-updated", handleRemoteLanguage);

    return () => {
      socket.off("room:code-update", handleRemoteCode);
      socket.off("room:cursor-update", handleRemoteCursor);
      socket.off("room:language-updated", handleRemoteLanguage);
    };
  }, [socket, roomId, language, peerName, onChangeCode, onChangeLanguage]);

  // Handle local text change
  const handleLocalChange = useCallback(
    (value) => {
      const updatedValue = value || "";
      onChangeCode(updatedValue, true);

      if (isRemoteChangeRef.current) return;

      // Debounce socket emit to prevent network thrashing
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (socket && roomId) {
          socket.emit("room:code-change", {
            roomId,
            code: updatedValue,
            version: Date.now(),
          });
        }
      }, 50);
    },
    [socket, roomId, onChangeCode]
  );

  const handleLanguageSelect = (newLang) => {
    onChangeLanguage(newLang, true);
    if (socket && roomId) {
      socket.emit("room:language-change", {
        roomId,
        language: newLang,
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950 border-r border-neutral-800 overflow-hidden">
      {/* Editor Toolbar */}
      <div className="h-10 px-3 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded px-2 py-1">
            <Code2 className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={language}
              onChange={(e) => handleLanguageSelect(e.target.value)}
              className="bg-transparent text-xs font-mono text-neutral-200 outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id} className="bg-neutral-900 text-neutral-200">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Code */}
          <button
            type="button"
            onClick={onResetCode}
            title="Reset to starter code"
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center / Right: Peer Cursor Badge + Run Action */}
        <div className="flex items-center gap-2.5">
          {peerCursor && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="truncate max-w-[120px]">{peerCursor.name}</span>
              <span className="text-neutral-500">Ln {peerCursor.line}</span>
            </div>
          )}

          {/* Run Code Button */}
          <button
            type="button"
            onClick={onRunCode}
            disabled={isRunning}
            title="Run Code (Ctrl + Enter)"
            className="px-3 py-1 rounded bg-neutral-100 hover:bg-white text-neutral-950 font-mono text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run</span>
            <span className="hidden sm:inline text-[10px] text-neutral-600 font-sans ml-1">⌘↵</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor Canvas */}
      <div className="flex-1 w-full min-h-0">
        <Editor
          height="100%"
          language={language}
          value={code}
          theme="vs-dark"
          onChange={handleLocalChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            lineHeight: 20,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "all",
            overviewRulerBorder: false,
            folding: true,
            cursorBlinking: "smooth",
            smoothScrolling: true,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;

