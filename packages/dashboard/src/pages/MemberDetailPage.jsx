import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';
import { QRCodeSVG } from 'qrcode.react';
import MemberCard from '../components/MemberCard';
import './MemberDetailPage.css';

const STATUS_COLORS = {
  active: 'badge-success',
  pending_approval: 'badge-warning',
  frozen: 'badge-info',
  expired: 'badge-danger',
  completed: 'badge-neutral',
  suspended: 'badge-danger',
  deleted: 'badge-neutral',
};

export default function MemberDetailPage() {
  const { id } = useParams();
  const { token, isAdmin } = useAuth();
  const { showToast, showConfirm } = useModal();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'cash', notes: '' });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const fetchMember = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/members/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      setMember(data.member);
    } catch (err) {
      console.error('Failed to fetch member:', err);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  const fetchAttendance = useCallback(async () => {
    try {
      setAttendanceLoading(true);
      const res = await fetch(`/api/attendance?memberId=${id}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceRecords(data.records || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setAttendanceLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchMember();
    fetchAttendance();
  }, [fetchMember, fetchAttendance]);

  const handleVoidAttendance = async (recordId) => {
    const confirmed = await showConfirm({
      title: t('confirm.voidAttendanceTitle'),
      message: t('confirm.voidAttendanceMessage'),
      variant: 'danger',
      confirmText: t('common.void'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/attendance/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed');
      }
      await fetchAttendance();
      await fetchMember(); // refresh sessions count
      showToast(t('toast.voidSuccess'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRegenerateQr = async () => {
    const confirmed = await showConfirm({
      title: t('confirm.regenerateQrTitle'),
      message: t('confirm.regenerateQrMessage'),
      variant: 'warning',
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/members/${id}/regenerate-qr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      await fetchMember();
      showToast(t('toast.qrRegenerated'), 'success');
    } catch (err) {
      showToast(t('toast.qrFailed'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: t('confirm.deleteTitle'),
      message: t('confirm.deleteMessage'),
      variant: 'danger',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      navigate('/members', { replace: true });
    } catch (err) {
      showToast(t('toast.deleteFailed'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/members/${id}/restore`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      await fetchMember();
    } catch (err) {
      showToast(t('toast.restoreFailed'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFreeze = async () => {
    const confirmed = await showConfirm({
      title: t('confirm.freezeTitle'),
      message: t('confirm.freezeMessage'),
      variant: 'warning',
      confirmText: t('members.freeze'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/members/${id}/freeze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to freeze');
      await fetchMember();
      showToast(t('toast.frozen'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreeze = async () => {
    const confirmed = await showConfirm({
      title: t('confirm.unfreezeTitle'),
      message: t('confirm.unfreezeMessage'),
      variant: 'primary',
      confirmText: t('members.unfreeze'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/members/${id}/unfreeze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to unfreeze');
      await fetchMember();
      showToast(t('toast.unfrozen', { days: data.daysFrozen }), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetPin = async () => {
    const pin = pinInput.trim();
    if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) {
      showToast('PIN must be 4-6 digits', 'error');
      return;
    }
    setPinSubmitting(true);
    try {
      const res = await fetch(`/api/members/${id}/set-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: pin || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to set PIN');
      }
      setShowPinModal(false);
      setPinInput('');
      await fetchMember();
      showToast(pin ? 'PIN set successfully' : 'PIN removed', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPinSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentSubmitting(true);
    try {
      const currentTerm = member.memberSubscriptions?.find(t => t.isCurrent);
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          memberId: member.id,
          memberSubscriptionId: currentTerm?.id,
          amount: paymentForm.amount,
          paymentMethod: paymentForm.paymentMethod,
          notes: paymentForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', paymentMethod: 'cash', notes: '' });
      await fetchMember();
      showToast(t('toast.paymentRecorded'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPaymentSubmitting(false);
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

  const getGenderLabel = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male': return t('members.male');
      case 'female': return t('members.female');
      default: return gender || '—';
    }
  };

  const getEntryMethodLabel = (method) => {
    switch (method) {
      case 'qr': return t('attendance.qrScan');
      case 'manual_code': return t('attendance.manualCode');
      case 'search_name': return t('attendance.nameSearch');
      case 'search_phone': return t('attendance.phoneSearch');
      default: return method;
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  const formatTime = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="loading-spinner"></div></div>;
  }

  if (!member) {
    return (
      <div className="page-container">
        <p>{t('common.noData')}</p>
        <button className="btn-secondary" onClick={() => navigate('/members')}>
          {t('members.backToMembers')}
        </button>
      </div>
    );
  }

  const currentTerm = member.memberSubscriptions?.find(t => t.isCurrent);

  return (
    <div className="page-container">
      <button className="btn-back" onClick={() => navigate('/members')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        {t('members.backToMembers')}
      </button>

      {/* Header Card */}
      <div className="detail-header-card">
        <div className="detail-header-left">
          <div className="detail-avatar">{member.fullName?.charAt(0)?.toUpperCase()}</div>
          <div>
            <h1 className="detail-name">{member.fullName}</h1>
            <div className="detail-meta">
              <span className={`badge ${STATUS_COLORS[member.status]}`}>{getStatusLabel(member.status)}</span>
              <span className="text-muted">{t('common.code')}: <code className="manual-code">{member.manualCode}</code></span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="detail-actions">
            {member.status === 'active' && currentTerm?.subscription?.freezeAllowed && (
              <button className="btn-secondary" onClick={handleFreeze} disabled={actionLoading}>
                {t('members.freeze')}
              </button>
            )}
            {member.status === 'frozen' && (
              <button className="btn-primary" onClick={handleUnfreeze} disabled={actionLoading}>
                {t('members.unfreeze')}
              </button>
            )}
            <button className="btn-secondary" onClick={handleRegenerateQr} disabled={actionLoading}>
              {t('members.regenerateQr')}
            </button>
            {member.deletedAt ? (
              <button className="btn-primary" onClick={handleRestore} disabled={actionLoading}>
                {t('common.restore')}
              </button>
            ) : (
              <button className="btn-danger" onClick={handleDelete} disabled={actionLoading}>
                {t('common.delete')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="detail-grid">
        {/* Left Column: Stats & Personal Info */}
        <div className="detail-left-column">
          {/* Current Subscription */}
          <div className="detail-card mb-4">
            <h3>{t('members.currentSubscription')}</h3>
            {currentTerm ? (
              <div className="subscription-info">
                <div className="plan-name">{currentTerm.subscription.name}</div>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">{t('members.startDate')}</span>
                    <span className="info-value">{formatDate(currentTerm.startDate)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">{t('members.endDate')}</span>
                    <span className="info-value">{formatDate(currentTerm.endDate)}</span>
                  </div>
                  {currentTerm.remainingSessions !== null && (
                    <div className="info-item">
                      <span className="info-label">{t('members.remainingSessions')}</span>
                      <span className="info-value fw-medium">{currentTerm.remainingSessions}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <span className="info-label">{t('members.frozenDays')}</span>
                    <span className="info-value">{currentTerm.totalFrozenDays}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted">{t('members.noSubscription')}</p>
            )}

            {/* Subscription History */}
            {member.memberSubscriptions?.length > 1 && (
              <div className="mt-3">
                <h4 className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>{t('members.subscriptionHistory')}</h4>
                {member.memberSubscriptions.filter(t => !t.isCurrent).map((t) => (
                  <div key={t.id} className="history-row">
                    <span>{t.subscription.name}</span>
                    <span className="text-sm text-muted">
                      {formatDate(t.startDate)} → {formatDate(t.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personal Info */}
          <div className="detail-card mb-4">
            <h3>{t('members.personalInfo')}</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">{t('common.phone')}</span>
                <span className="info-value">{member.phone}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.gender')}</span>
                <span className="info-value capitalize">{getGenderLabel(member.gender)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.birthday')}</span>
                <span className="info-value">{formatDate(member.birthday)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.emergencyContact')}</span>
                <span className="info-value">{member.emergencyContact || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.height')}</span>
                <span className="info-value">{member.heightCm ? `${member.heightCm} cm` : '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.weight')}</span>
                <span className="info-value">{member.weightKg ? `${member.weightKg} kg` : '—'}</span>
              </div>
            </div>
            {member.fitnessGoal && (
              <div className="info-item mt-3">
                <span className="info-label">{t('members.fitnessGoal')}</span>
                <span className="info-value text-block">{member.fitnessGoal}</span>
              </div>
            )}
            {member.notes && (
              <div className="info-item mt-3">
                <span className="info-label">{t('common.notes')}</span>
                <span className="info-value text-block">{member.notes}</span>
              </div>
            )}
          </div>

          {/* System Info */}
          <div className="detail-card">
            <h3>{t('members.systemInfo')}</h3>
            <div className="info-grid cols-2">
              <div className="info-item">
                <span className="info-label">{t('members.memberId')}</span>
                <span className="info-value text-sm">{member.id}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.joined')}</span>
                <span className="info-value">{formatDate(member.joinDate || member.createdAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.createdBy')}</span>
                <span className="info-value">{member.createdBy?.fullName || 'System'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('members.qrRegenerated')}</span>
                <span className="info-value">{formatDate(member.qrTokenRegeneratedAt)}</span>
              </div>
            </div>
          </div>

          {/* Financials block */}
          <div className="detail-card mb-4" style={{ borderLeft: '4px solid var(--warning-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{t('members.financials')}</h3>
              <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => setShowPaymentModal(true)}>
                {t('members.recordPayment')}
              </button>
            </div>
            <div className="mt-3">
              <span className="text-muted">{t('members.pendingBalance')}: </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: member.pendingBalance > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                ${Number(member.pendingBalance || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* PIN Management block */}
          <div className="detail-card mb-4" style={{ borderLeft: '4px solid var(--gold-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Check-in PIN</h3>
              {isAdmin && (
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => { setPinInput(''); setShowPinModal(true); }}
                >
                  {member.pinSetAt ? 'Reset PIN' : 'Set PIN'}
                </button>
              )}
            </div>
            <div className="mt-3">
              <span className="text-muted">Status: </span>
              <span style={{ fontWeight: 600, color: member.pinSetAt ? 'var(--success-color)' : 'var(--text-muted)' }}>
                {member.pinSetAt ? 'Active' : 'Not Set'}
              </span>
              {member.pinSetAt && (
                <span className="text-muted" style={{ marginLeft: '1rem', fontSize: '0.85rem' }}>
                  Set: {formatDate(member.pinSetAt)}
                </span>
              )}
            </div>
          </div>

          {/* Attendance History block */}
          <div className="detail-card mb-4">
            <h3>{t('members.attendanceHistory')}</h3>
            {attendanceLoading ? (
              <p className="text-muted">{t('common.loading')}</p>
            ) : attendanceRecords.length === 0 ? (
              <p className="text-muted">{t('members.noAttendance')}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('common.date')}</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('common.time')}</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('attendance.entryMethod')}</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('common.status')}</th>
                      {isAdmin && <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((rec) => (
                      <tr key={rec.id} style={{ opacity: rec.isVoided ? 0.5 : 1 }}>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>{formatDate(rec.checkedInAt)}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>{formatTime(rec.checkedInAt)}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>{getEntryMethodLabel(rec.entryMethod)}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                          {rec.isVoided 
                            ? <span style={{ color: '#ff4757', fontWeight: 600, fontSize: '0.75rem' }}>{t('attendance.voided')}</span>
                            : <span style={{ color: '#2ed573', fontWeight: 600, fontSize: '0.75rem' }}>{t('attendance.valid')}</span>
                          }
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            {!rec.isVoided && (
                              <button 
                                onClick={() => handleVoidAttendance(rec.id)} 
                                style={{ background: 'transparent', border: '1px solid rgba(255,71,87,0.4)', color: '#ff4757', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                              >
                                {t('common.void')}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Physical Digital Card Preview */}
        <div className="detail-right-column">
          <div className="detail-card sticky-card text-center" style={{ textAlign: 'center' }}>
            <h3>{t('members.memberQr')}</h3>
            <div className="qr-code-page-container" style={{ display: 'inline-block', padding: '0.75rem', background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border-primary)', margin: '1.5rem 0', boxShadow: 'var(--shadow-sm)' }}>
              <QRCodeSVG
                value={member.qrToken}
                size={160}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="card-preview-help">
              <p>{t('members.qrHelp')}</p>
              {isAdmin && (
                <button className="btn-primary w-100 mt-3" onClick={() => setShowCard(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,marginRight:8,verticalAlign:'middle'}}>
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                  {t('members.printCard')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Member Card Modal */}
      {showCard && (
        <MemberCard
          member={member}
          onClose={() => setShowCard(false)}
        />
      )}
      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2>{member.pinSetAt ? 'Reset Check-in PIN' : 'Set Check-in PIN'}</h2>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              Enter a 4-6 digit PIN the member will use for self check-in.
            </p>
            <div className="form-group">
              <label>PIN (leave empty to remove)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="input"
                placeholder="4-6 digits"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div className="modal-actions mt-4">
              <button className="btn-secondary" onClick={() => setShowPinModal(false)} disabled={pinSubmitting}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSetPin} disabled={pinSubmitting}>
                {pinSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{t('members.recordPayment')}</h2>
            <form onSubmit={handlePaymentSubmit}>
              <div className="form-group">
                <label>{t('common.amount')}</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input" 
                  value={paymentForm.amount} 
                  onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>{t('payments.paymentMethod')}</label>
                <select 
                  className="input" 
                  value={paymentForm.paymentMethod} 
                  onChange={e => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}
                >
                  <option value="cash">{t('payments.cash')}</option>
                  <option value="visa">{t('payments.visa')}</option>
                  <option value="instapay">{t('payments.instapay')}</option>
                  <option value="vodafone_cash">{t('payments.vodafoneCash')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('common.notes')}</label>
                <textarea 
                  className="input" 
                  value={paymentForm.notes} 
                  onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} 
                  rows="2"
                />
              </div>
              <div className="modal-actions mt-4">
                <button type="button" className="btn-secondary" onClick={() => setShowPaymentModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary" disabled={paymentSubmitting}>{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
