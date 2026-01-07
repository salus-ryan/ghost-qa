import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// Styles
const styles = {
  window: {
    width: '100%',
    height: '100vh',
    background: '#1a1a2e',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
  },
  titlebar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#16213e',
    WebkitAppRegion: 'drag',
    cursor: 'move',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#fff',
  },
  ghostIcon: {
    fontSize: '20px',
    animation: 'float 3s ease-in-out infinite',
  },
  windowControls: {
    display: 'flex',
    gap: '8px',
    WebkitAppRegion: 'no-drag',
  },
  controlBtn: {
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: '20px',
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    color: '#a0a0a0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    background: '#16213e',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
  },
  halfInput: {
    flex: 1,
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 20px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #e94560, #ff6b6b)',
    color: 'white',
  },
  dangerBtn: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid #ef4444',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(74, 222, 128, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 222, 128, 0.3)',
  },
  pulse: {
    width: '12px',
    height: '12px',
    background: '#4ade80',
    borderRadius: '50%',
    animation: 'pulse 2s ease-in-out infinite',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 8px',
    background: '#16213e',
    borderRadius: '8px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '10px',
    color: '#a0a0a0',
    textTransform: 'uppercase',
    marginTop: '4px',
  },
  screenshotContainer: {
    background: '#16213e',
    borderRadius: '8px',
    overflow: 'hidden',
    flex: 1,
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
  },
  screenshotHeader: {
    padding: '10px 14px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#a0a0a0',
    background: '#0f3460',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#000',
  },
  screenshotPlaceholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a0a0a0',
    fontSize: '13px',
  },
  logContainer: {
    background: '#16213e',
    borderRadius: '8px',
    overflow: 'hidden',
    maxHeight: '120px',
  },
  logHeader: {
    padding: '10px 14px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#a0a0a0',
    background: '#0f3460',
  },
  logList: {
    height: '80px',
    overflowY: 'auto',
    padding: '8px',
  },
  logItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '4px 8px',
    fontSize: '11px',
    borderRadius: '4px',
    marginBottom: '2px',
  },
  logTime: {
    color: '#a0a0a0',
    flexShrink: 0,
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px',
  },
  tab: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#a0a0a0',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: '#e94560',
    borderColor: '#e94560',
    color: '#fff',
  },
};

const logColors = {
  error: '#ef4444',
  success: '#4ade80',
  warning: '#fbbf24',
  action: '#60a5fa',
  navigation: '#a78bfa',
  info: '#a0a0a0',
  ai: '#f472b6',
};

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState({
    url: 'http://localhost:3000',
    interval: 2000,
    maxActions: 100,
    screenshotOnError: true,
    screenshotInterval: 5000,
    aiMode: false,
    ollamaModel: 'llama3.1:8b',
  });
  const [stats, setStats] = useState({
    actionsPerformed: 0,
    errorsFound: 0,
    pagesVisited: 0,
    runtime: 0,
  });
  const [logs, setLogs] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [activeTab, setActiveTab] = useState('screenshot');
  const [isStarting, setIsStarting] = useState(false);
  const logListRef = useRef(null);

  useEffect(() => {
    // Set up listeners
    window.ghostAPI.onTestLog((log) => {
      setLogs((prev) => [...prev.slice(-99), log]);
    });

    window.ghostAPI.onTestError((error) => {
      setLogs((prev) => [
        ...prev.slice(-99),
        { level: 'error', message: `${error.type}: ${error.message}`, timestamp: error.timestamp },
      ]);
    });

    window.ghostAPI.onTestStats((newStats) => {
      setStats(newStats);
    });

    window.ghostAPI.onTestScreenshot((data) => {
      setScreenshot(data);
    });

    // Check initial status
    window.ghostAPI.getStatus().then((status) => {
      if (status.running) {
        setIsRunning(true);
        if (status.stats) setStats(status.stats);
      }
    });

    return () => {
      window.ghostAPI.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStart = async () => {
    if (!config.url.trim()) {
      alert('Please enter a URL');
      return;
    }

    setIsStarting(true);
    const result = await window.ghostAPI.startTesting(config);

    if (result.success) {
      setIsRunning(true);
      setLogs([]);
      setScreenshot(null);
    } else {
      alert('Failed to start: ' + result.error);
    }
    setIsStarting(false);
  };

  const handleStop = async () => {
    await window.ghostAPI.stopTesting();
    setIsRunning(false);
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatLogTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div style={styles.window}>
      {/* Titlebar */}
      <div style={styles.titlebar}>
        <div style={styles.title}>
          <span style={styles.ghostIcon}>👻</span>
          <span>Ghost QA</span>
        </div>
        <div style={styles.windowControls}>
          <button
            style={{ ...styles.controlBtn, background: '#fbbf24', color: '#000' }}
            onClick={() => {}}
          >
            −
          </button>
          <button
            style={{ ...styles.controlBtn, background: '#ef4444', color: '#fff' }}
            onClick={() => window.close()}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {!isRunning ? (
          /* Config Section */
          <>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Target URL</label>
              <input
                type="url"
                style={styles.input}
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="http://localhost:3000"
              />
            </div>

            <div style={styles.inputRow}>
              <div style={{ ...styles.inputGroup, ...styles.halfInput }}>
                <label style={styles.label}>Action Interval (ms)</label>
                <input
                  type="number"
                  style={styles.input}
                  value={config.interval}
                  onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) || 2000 })}
                  min={500}
                  max={10000}
                />
              </div>
              <div style={{ ...styles.inputGroup, ...styles.halfInput }}>
                <label style={styles.label}>Max Actions</label>
                <input
                  type="number"
                  style={styles.input}
                  value={config.maxActions}
                  onChange={(e) => setConfig({ ...config, maxActions: parseInt(e.target.value) || 100 })}
                  min={10}
                  max={1000}
                />
              </div>
            </div>

            <div style={styles.inputRow}>
              <div style={{ ...styles.inputGroup, ...styles.halfInput }}>
                <label style={styles.label}>Screenshot Interval (ms)</label>
                <input
                  type="number"
                  style={styles.input}
                  value={config.screenshotInterval}
                  onChange={(e) => setConfig({ ...config, screenshotInterval: parseInt(e.target.value) || 5000 })}
                  min={1000}
                  max={30000}
                />
              </div>
              <div style={{ ...styles.inputGroup, ...styles.halfInput }}>
                <div style={styles.checkboxGroup}>
                  <input
                    type="checkbox"
                    id="screenshotOnError"
                    checked={config.screenshotOnError}
                    onChange={(e) => setConfig({ ...config, screenshotOnError: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#e94560' }}
                  />
                  <label htmlFor="screenshotOnError" style={{ fontSize: '13px', color: '#a0a0a0' }}>
                    Save on error
                  </label>
                </div>
              </div>
            </div>

            {/* AI Mode Section */}
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.1), rgba(168, 85, 247, 0.1))',
              borderRadius: '8px',
              border: '1px solid rgba(244, 114, 182, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🤖</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#f472b6' }}>AI Mode</span>
                </div>
                <div style={styles.checkboxGroup}>
                  <input
                    type="checkbox"
                    id="aiMode"
                    checked={config.aiMode}
                    onChange={(e) => setConfig({ ...config, aiMode: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#f472b6' }}
                  />
                  <label htmlFor="aiMode" style={{ fontSize: '13px', color: '#a0a0a0' }}>
                    Enable
                  </label>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#a0a0a0', marginBottom: config.aiMode ? '12px' : '0' }}>
                Uses local Ollama LLM to intelligently explore your app instead of random clicking.
              </p>
              {config.aiMode && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Ollama Model</label>
                  <select
                    style={{ ...styles.input, cursor: 'pointer' }}
                    value={config.ollamaModel}
                    onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
                  >
                    <option value="llama3.1:8b">Llama 3.1 8B (Recommended)</option>
                    <option value="mistral:7b">Mistral 7B</option>
                    <option value="qwen2:7b">Qwen2 7B</option>
                    <option value="gemma:7b">Gemma 7B</option>
                    <option value="phi3:latest">Phi-3</option>
                  </select>
                </div>
              )}
            </div>

            <button
              style={{ ...styles.btn, ...styles.primaryBtn }}
              onClick={handleStart}
              disabled={isStarting}
            >
              <span>{isStarting ? '⏳' : '▶'}</span>
              {isStarting ? 'Starting...' : 'Start Testing'}
            </button>
          </>
        ) : (
          /* Running Section */
          <>
            <div style={styles.statusIndicator}>
              <div style={styles.pulse}></div>
              <span style={{ fontSize: '13px', color: '#4ade80' }}>Testing in progress...</span>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.stat}>
                <span style={styles.statValue}>{stats.actionsPerformed}</span>
                <span style={styles.statLabel}>Actions</span>
              </div>
              <div style={styles.stat}>
                <span style={{ ...styles.statValue, color: stats.errorsFound > 0 ? '#ef4444' : '#fff' }}>
                  {stats.errorsFound}
                </span>
                <span style={styles.statLabel}>Errors</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statValue}>{stats.pagesVisited}</span>
                <span style={styles.statLabel}>Pages</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statValue}>{formatTime(stats.runtime)}</span>
                <span style={styles.statLabel}>Runtime</span>
              </div>
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
              <button
                style={{ ...styles.tab, ...(activeTab === 'screenshot' ? styles.activeTab : {}) }}
                onClick={() => setActiveTab('screenshot')}
              >
                Live View
              </button>
              <button
                style={{ ...styles.tab, ...(activeTab === 'logs' ? styles.activeTab : {}) }}
                onClick={() => setActiveTab('logs')}
              >
                Activity Log
              </button>
            </div>

            {activeTab === 'screenshot' ? (
              <div style={styles.screenshotContainer}>
                <div style={styles.screenshotHeader}>
                  <span>Browser Screenshot</span>
                  {screenshot && (
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>
                      {new URL(screenshot.url).pathname}
                    </span>
                  )}
                </div>
                {screenshot ? (
                  <img src={screenshot.dataUrl} alt="Browser" style={styles.screenshotImage} />
                ) : (
                  <div style={styles.screenshotPlaceholder}>Waiting for screenshot...</div>
                )}
              </div>
            ) : (
              <div style={{ ...styles.logContainer, maxHeight: 'none', flex: 1 }}>
                <div style={styles.logHeader}>Activity Log</div>
                <div style={{ ...styles.logList, height: '200px' }} ref={logListRef}>
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.logItem,
                        background: log.level === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                      }}
                    >
                      <span style={styles.logTime}>{formatLogTime(log.timestamp)}</span>
                      <span style={{ color: logColors[log.level] || '#fff', wordBreak: 'break-word' }}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button style={{ ...styles.btn, ...styles.dangerBtn }} onClick={handleStop}>
              <span>■</span>
              Stop Testing
            </button>
          </>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: transparent;
          overflow: hidden;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #16213e;
        }
        ::-webkit-scrollbar-thumb {
          background: #0f3460;
          border-radius: 3px;
        }
        input:focus {
          border-color: #e94560 !important;
          box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);
        }
        button:hover {
          transform: translateY(-2px);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}

// Mount the app
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
