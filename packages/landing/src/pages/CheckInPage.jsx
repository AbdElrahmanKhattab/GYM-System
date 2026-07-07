import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'gym_checkin_session';

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok && data.error) throw new Error(data.error.message);
  return data;
}

function CheckInPage() {
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);

  // Login form state
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Confirm state
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSessionToken(stored);
      validateSession(stored);
    } else {
      setLoading(false);
    }
  }, []);

  const validateSession = async (token) => {
    try {
      const data = await api('/api/public/checkin/session', {
        headers: { 'x-session-token': token },
      });
      if (data.valid) {
        setMember(data.member);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setSessionToken(null);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setSessionToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const data = await api('/api/public/checkin/login', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.replace(/[\s-]/g, ''), pin }),
      });
      localStorage.setItem(STORAGE_KEY, data.sessionToken);
      setSessionToken(data.sessionToken);
      setMember(data.member);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setResult(null);
    try {
      const data = await api('/api/public/checkin/confirm', {
        method: 'POST',
        headers: { 'x-session-token': sessionToken },
      });
      setResult(data);
    } catch (err) {
      setResult({ result: 'error', message: err.message });
    } finally {
      setConfirming(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api('/api/public/checkin/logout', {
        method: 'POST',
        headers: { 'x-session-token': sessionToken },
      });
    } catch { }
    localStorage.removeItem(STORAGE_KEY);
    setSessionToken(null);
    setMember(null);
    setResult(null);
    setPhone('');
    setPin('');
  };

  const handleReset = () => {
    setResult(null);
  };

  // Show gym brand header
  const Header = () => (
    <div style={{
      textAlign: 'center',
      padding: '24px 16px 8px',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'linear-gradient(135deg, #d4af37, #f5e6a3)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 20, color: '#0a0a0a',
        marginBottom: 8,
      }}>G</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#f6f6f6' }}>Gym Check-In</div>
    </div>
  );

  if (loading) {
    return (
      <div style={styles.container}>
        <Header />
        <div style={styles.centerBox}>
          <div style={styles.spinner} />
        </div>
      </div>
    );
  }

  // ─── RESULT SCREEN ───
  if (result) {
    const isSuccess = result.result === 'success';
    const isRejected = result.result === 'rejected';
    const isError = result.result === 'error';

    return (
      <div style={styles.container}>
        <Header />
        <div style={{
          ...styles.resultCard,
          background: isSuccess
            ? 'linear-gradient(135deg, #065f46, #059669)'
            : isRejected
              ? 'linear-gradient(135deg, #7f1d1d, #dc2626)'
              : 'linear-gradient(135deg, #1e3a5f, #2563eb)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {isSuccess ? '✓' : isRejected ? '✗' : '!'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {isSuccess ? 'Welcome!' : isRejected ? 'Check-In Not Allowed' : 'Error'}
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 20 }}>
            {result.message}
          </div>

          {isSuccess && result.member && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{result.member.fullName}</div>
              {result.subscription && (
                <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
                  {result.subscription.name}
                  {result.subscription.remainingSessions !== null && (
                    <> — {result.subscription.remainingSessions} session(s) left</>
                  )}
                  {result.subscription.remainingDays !== null && (
                    <> — {result.subscription.remainingDays} day(s) left</>
                  )}
                </div>
              )}
              {result.pendingBalance > 0 && (
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  Pending balance: ${Number(result.pendingBalance).toFixed(2)}
                </div>
              )}
              {result.warning && (
                <div style={{
                  marginTop: 12, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)', fontSize: 13, fontWeight: 500,
                }}>
                  {result.warning === 'EXPIRING_SOON' && '⚠ Membership expiring soon'}
                  {result.warning === 'UNPAID_BALANCE' && '⚠ Outstanding balance'}
                  {result.warning === 'EXPIRED_ALLOWED' && '⚠ Membership expired'}
                </div>
              )}
              {result.checkedInAt && (
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  {new Date(result.checkedInAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {!isSuccess && result.member && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{result.member.fullName}</div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4, textTransform: 'capitalize' }}>
                Status: {result.member.status?.replace(/_/g, ' ')}
              </div>
            </div>
          )}

          <button onClick={handleReset} style={styles.btn}>
            {isSuccess ? 'Done' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  // ─── CONFIRM SCREEN (logged in, session exists) ───
  if (sessionToken && member) {
    return (
      <div style={styles.container}>
        <Header />
        <div style={styles.confirmBox}>
          {member.photoUrl && (
            <img
              src={member.photoUrl}
              alt=""
              style={{
                width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
                marginBottom: 16, border: '3px solid #d4af37',
              }}
            />
          )}
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f6f6f6', marginBottom: 4 }}>
            {member.fullName}
          </div>
          <div style={{ fontSize: 14, color: '#8a8a8a', marginBottom: 32, textTransform: 'capitalize' }}>
            {member.status?.replace(/_/g, ' ')}
          </div>

          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              ...styles.btn, ...styles.btnPrimary,
              opacity: confirming ? 0.6 : 1,
            }}
          >
            {confirming ? 'Checking...' : 'Confirm Check-In'}
          </button>

          <button
            onClick={handleLogout}
            style={{ ...styles.btn, background: 'transparent', color: '#8a8a8a', marginTop: 12, fontSize: 13 }}
          >
            Not you? Log out
          </button>
        </div>
      </div>
    );
  }

  // ─── LOGIN SCREEN ───
  return (
    <div style={styles.container}>
      <Header />
      <div style={styles.loginBox}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f6f6f6', marginBottom: 4 }}>
          Member Login
        </div>
        <div style={{ fontSize: 13, color: '#8a8a8a', marginBottom: 28 }}>
          Enter your phone number and PIN to check in
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. 01001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={styles.input}
              inputMode="numeric"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={styles.label}>PIN</label>
            <input
              type="password"
              placeholder="4–6 digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={styles.input}
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]*"
              required
            />
          </div>

          {loginError && (
            <div style={{
              color: '#f87171', fontSize: 13, marginBottom: 16,
              padding: '8px 12px', background: 'rgba(220,38,38,0.1)',
              borderRadius: 8, textAlign: 'center',
            }}>
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loginSubmitting}
            style={{
              ...styles.btn, ...styles.btnPrimary,
              opacity: loginSubmitting ? 0.6 : 1,
            }}
          >
            {loginSubmitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div style={{ fontSize: 12, color: '#5a5a5a', marginTop: 24, textAlign: 'center' }}>
          Forgot your PIN? Ask the front desk to reset it.
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100dvh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  centerBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 32, height: 32, border: '3px solid #2a2a2a', borderTopColor: '#d4af37',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  loginBox: {
    flex: 1,
    padding: '0 24px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
    margin: '0 auto',
  },
  confirmBox: {
    flex: 1,
    padding: '0 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
    margin: '0 auto',
  },
  resultCard: {
    flex: 1,
    margin: '16px 16px 32px',
    borderRadius: 20,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f6f6f6',
    textAlign: 'center',
  },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#a0a0a0',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  input: {
    width: '100%', padding: '14px 16px', fontSize: 16,
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
    color: '#f6f6f6', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  btn: {
    width: '100%', padding: '14px 24px', fontSize: 16, fontWeight: 600,
    border: 'none', borderRadius: 12, cursor: 'pointer',
    color: '#f6f6f6', background: '#2a2a2a',
    transition: 'opacity 0.2s',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #d4af37, #f5e6a3)',
    color: '#0a0a0a',
  },
};

export default CheckInPage;
