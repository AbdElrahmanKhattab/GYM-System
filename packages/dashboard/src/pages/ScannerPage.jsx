import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './ScannerPage.css';

const RESET_DELAY = 3500; // ms before auto-reset

export default function ScannerPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const hiddenInputRef = useRef(null);
  const resetTimerRef = useRef(null);

  const [state, setState] = useState('idle'); // idle | loading | success | rejected
  const [scanResult, setScanResult] = useState(null);
  const [hiddenValue, setHiddenValue] = useState('');

  // Fallback mode
  const [fallbackMode, setFallbackMode] = useState(null); // null | 'manual' | 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Keep the hidden input focused at all times
  const focusHiddenInput = useCallback(() => {
    if (!fallbackMode && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [fallbackMode]);

  useEffect(() => {
    focusHiddenInput();
    const interval = setInterval(focusHiddenInput, 500);
    return () => clearInterval(interval);
  }, [focusHiddenInput]);

  // Auto-reset to idle after showing result
  useEffect(() => {
    if (state === 'success' || state === 'rejected') {
      resetTimerRef.current = setTimeout(() => {
        resetToIdle();
      }, RESET_DELAY);
      return () => clearTimeout(resetTimerRef.current);
    }
  }, [state]);

  const resetToIdle = () => {
    setState('idle');
    setScanResult(null);
    setHiddenValue('');
    setFallbackMode(null);
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(focusHiddenInput, 50);
  };

  // ─── SCAN via API ───
  const performScan = async (payload) => {
    setState('loading');
    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setScanResult(data);
      setState(data.result === 'success' ? 'success' : 'rejected');
    } catch (err) {
      setScanResult({ result: 'rejected', rejectionReason: 'NETWORK_ERROR', message: 'Network Error' });
      setState('rejected');
    }
  };

  // ─── Hidden input handler (QR scanner HID) ───
  const handleHiddenKeyDown = (e) => {
    if (e.key === 'Enter' && hiddenValue.trim()) {
      e.preventDefault();
      const scannedToken = hiddenValue.trim();
      setHiddenValue('');
      performScan({ token: scannedToken, entryMethod: 'qr' });
    }
  };

  // ─── Manual code submit ───
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const code = e.target.elements.manualCode.value.trim();
    if (!code) return;
    setFallbackMode(null);
    performScan({ token: code, entryMethod: 'manual_code' });
  };

  // ─── Search members ───
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/members/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSearchResults(data.members || []);
    } catch {
      setSearchResults([]);
    }
  };

  const handleSearchSelect = (member) => {
    setFallbackMode(null);
    performScan({ memberId: member.id, entryMethod: 'search_name' });
  };

  // ─── Click anywhere to reset from result ───
  const handleScreenClick = () => {
    if (state === 'success' || state === 'rejected') {
      clearTimeout(resetTimerRef.current);
      resetToIdle();
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return t('common.statusActive');
      case 'pending_approval': return t('common.statusPendingApproval');
      case 'frozen': return t('common.statusFrozen');
      case 'expired': return t('common.statusExpired');
      case 'completed': return t('common.statusCompleted');
      case 'suspended': return t('common.statusSuspended');
      case 'deleted': return t('common.statusDeleted');
      default: return status;
    }
  };

  const getRejectionTitle = (reason) => {
    const titles = {
      NOT_FOUND: t('rejection.notFound'),
      EXPIRED: t('rejection.expired'),
      ALREADY_CHECKED_IN_TODAY: t('rejection.alreadyCheckedIn'),
      FROZEN: t('rejection.frozen'),
      COMPLETED_NO_SESSIONS: t('rejection.noSessions'),
      SUSPENDED: t('rejection.suspended'),
      NO_ACTIVE_SUBSCRIPTION: t('rejection.noSubscription'),
      NETWORK_ERROR: t('rejection.networkError'),
    };
    return titles[reason] || t('attendance.voided');
  };

  // ─── RENDER ───
  if (state === 'loading') {
    return (
      <div className="scanner-fullscreen scanner-loading">
        <div className="scan-processing">
          <div className="scan-pulse"></div>
          <p>{t('scanner.processing')}</p>
        </div>
      </div>
    );
  }

  if (state === 'success' && scanResult) {
    return (
      <div className="scanner-fullscreen scanner-success" onClick={handleScreenClick}>
        <div className="result-card success-card">
          <div className="result-icon success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <div className="result-avatar">
            {scanResult.member?.photoUrl ? (
              <img src={scanResult.member.photoUrl} alt="" />
            ) : (
              <span>{scanResult.member?.fullName?.charAt(0)?.toUpperCase()}</span>
            )}
          </div>

          <h1 className="result-name">{scanResult.member?.fullName}</h1>
          <p className="result-status badge badge-success">{getStatusLabel(scanResult.member?.status)}</p>
          <p className="result-message">✓ {t('scanner.attendanceRecorded')}</p>

          {scanResult.subscription && (
            <div className="result-details">
              <div className="result-detail-item">
                <span className="detail-label">{t('attendance.subscription')}</span>
                <span className="detail-value">{scanResult.subscription.name}</span>
              </div>

              {scanResult.subscription.remainingSessions !== null && (
                <div className="result-detail-item">
                  <span className="detail-label">{t('attendance.sessionsLeft')}</span>
                  <span className="detail-value highlight">
                    {scanResult.subscription.remainingSessions}
                  </span>
                </div>
              )}

              {scanResult.subscription.remainingDays !== null && scanResult.subscription.remainingDays !== undefined && (
                <div className="result-detail-item">
                  <span className="detail-label">{t('scanner.daysLeft')}</span>
                  <span className="detail-value highlight">{scanResult.subscription.remainingDays}</span>
                </div>
              )}

              <div className="result-detail-item">
                <span className="detail-label">{t('scanner.checkInTime')}</span>
                <span className="detail-value">
                  {new Date(scanResult.checkedInAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}

          {scanResult.warning === 'UNPAID_BALANCE' && (
            <div className="result-warning">
              ⚠ {t('members.pendingBalance')}: ${scanResult.pendingBalance?.toFixed(2)}
            </div>
          )}

          {scanResult.warning === 'EXPIRING_SOON' && (
            <div className="result-warning">
              ⚠ {t('dashboard.expiringSoon')}!
            </div>
          )}
        </div>
        <p className="auto-reset-hint">{t('scanner.resetPrompt')}</p>
      </div>
    );
  }

  if (state === 'rejected' && scanResult) {
    return (
      <div className="scanner-fullscreen scanner-rejected" onClick={handleScreenClick}>
        <div className="result-card rejected-card">
          <div className={`result-icon rejected-icon ${scanResult.rejectionReason}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>

          {scanResult.member && (
            <h2 className="result-name">{scanResult.member.fullName}</h2>
          )}

          <h1 className="rejection-title">{getRejectionTitle(scanResult.rejectionReason)}</h1>
          <p className="rejection-subtitle">{scanResult.message}</p>
        </div>
        <p className="auto-reset-hint">{t('scanner.resetPrompt')}</p>
      </div>
    );
  }

  // ─── IDLE STATE (Scanner Ready) ───
  return (
    <div className="scanner-fullscreen scanner-idle" onClick={focusHiddenInput}>
      {/* Exit Button */}
      <button className="kiosk-exit-btn" onClick={(e) => { e.stopPropagation(); navigate('/'); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        {t('common.exit')}
      </button>

      {/* Hidden input for HID scanner */}
      <input
        ref={hiddenInputRef}
        className="hidden-scanner-input"
        value={hiddenValue}
        onChange={(e) => setHiddenValue(e.target.value)}
        onKeyDown={handleHiddenKeyDown}
        autoFocus
      />

      <div className="scanner-ready">
        <div className="scanner-icon-container">
          <div className="scanner-ring"></div>
          <svg className="scanner-qr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="7" height="7" rx="1"/>
            <rect x="15" y="2" width="7" height="7" rx="1"/>
            <rect x="2" y="15" width="7" height="7" rx="1"/>
            <rect x="15" y="15" width="4" height="4"/>
            <line x1="22" y1="15" x2="22" y2="22"/>
            <line x1="15" y1="22" x2="22" y2="22"/>
          </svg>
        </div>

        <h1 className="scanner-title">{t('scanner.ready')}</h1>
        <p className="scanner-subtitle">{t('scanner.scanPrompt')}</p>
      </div>

      {/* Fallback Controls */}
      <div className="fallback-bar">
        {!fallbackMode && (
          <div className="fallback-buttons">
            <button className="fallback-btn" onClick={(e) => { e.stopPropagation(); setFallbackMode('manual'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
              {t('scanner.manualEntry')}
            </button>
            <button className="fallback-btn" onClick={(e) => { e.stopPropagation(); setFallbackMode('search'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              {t('scanner.searchMember')}
            </button>
          </div>
        )}

        {fallbackMode === 'manual' && (
          <form className="fallback-form" onSubmit={handleManualSubmit} onClick={(e) => e.stopPropagation()}>
            <input
              name="manualCode"
              className="fallback-input"
              placeholder={t('scanner.enterManualCode')}
              autoFocus
              maxLength={10}
              autoComplete="off"
            />
            <button type="submit" className="fallback-submit">{t('scanner.checkIn')}</button>
            <button type="button" className="fallback-cancel" onClick={() => setFallbackMode(null)}>✕</button>
          </form>
        )}

        {fallbackMode === 'search' && (
          <div className="fallback-search" onClick={(e) => e.stopPropagation()}>
            <input
              className="fallback-input"
              placeholder={t('members.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
              autoComplete="off"
            />
            <button type="button" className="fallback-cancel" onClick={() => setFallbackMode(null)}>✕</button>
            {searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((m) => (
                  <button key={m.id} className="search-result-item" onClick={() => handleSearchSelect(m)}>
                    <div className="search-result-avatar">{m.fullName?.charAt(0)?.toUpperCase()}</div>
                    <div className="search-result-info">
                      <span className="search-result-name">{m.fullName}</span>
                      <span className="search-result-phone">{m.phone} · {m.manualCode}</span>
                    </div>
                    <span className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {getStatusLabel(m.status)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
