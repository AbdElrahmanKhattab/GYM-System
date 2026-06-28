import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';
import './AttendanceHistoryPage.css';

export default function AttendanceHistoryPage() {
  const { token, isAdmin } = useAuth();
  const { showToast, showConfirm } = useModal();
  const { t } = useLanguage();
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [todayCount, setTodayCount] = useState(0);

  const getEntryMethodLabel = (method) => {
    switch (method) {
      case 'qr': return t('attendance.qrScan');
      case 'manual_code': return t('attendance.manualCode');
      case 'search_name': return t('attendance.nameSearch');
      case 'search_phone': return t('attendance.phoneSearch');
      default: return method;
    }
  };

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 50 });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/attendance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Failed');
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch attendance records:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, startDate, endDate]);

  // Fetch today's count
  useEffect(() => {
    const fetchToday = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`/api/attendance?startDate=${today}&endDate=${today}&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setTodayCount(data.total || 0);
      } catch {
        // ignore
      }
    };
    fetchToday();
  }, [token]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleVoid = async (recordId) => {
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
        throw new Error(data.error?.message || 'Void failed');
      }
      await fetchRecords();
      showToast(t('toast.voidSuccess'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const totalPages = Math.ceil(total / 50);

  const formatDate = (d) => {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (d) => {
    return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <h1>{t('attendance.title')}</h1>
        <p>{t('attendance.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="attendance-stats">
        <div className="attendance-stat-card">
          <div className="attendance-stat-value">{todayCount}</div>
          <div className="attendance-stat-label">{t('attendance.todayCheckins')}</div>
        </div>
        <div className="attendance-stat-card">
          <div className="attendance-stat-value">{total}</div>
          <div className="attendance-stat-label">{t('attendance.totalRecords')}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="attendance-filters">
        <div className="attendance-filter-group">
          <label>{t('attendance.startDate')}</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
        </div>
        <div className="attendance-filter-group">
          <label>{t('attendance.endDate')}</label>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Table */}
      <div className="attendance-table-container">
        {loading ? (
          <div className="attendance-empty">
            <p>{t('common.loading')}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="attendance-empty">
            <i className="fa-solid fa-clipboard-list"></i>
            <p>{t('attendance.noRecords')}</p>
          </div>
        ) : (
          <>
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.time')}</th>
                  <th>{t('attendance.member')}</th>
                  <th>{t('attendance.entryMethod')}</th>
                  <th>{t('attendance.subscription')}</th>
                  <th>{t('attendance.sessionsLeft')}</th>
                  <th>{t('attendance.recordedBy')}</th>
                  <th>{t('common.status')}</th>
                  {isAdmin && <th>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} className={rec.isVoided ? 'voided-row' : ''}>
                    <td>{formatDate(rec.checkedInAt)}</td>
                    <td>{formatTime(rec.checkedInAt)}</td>
                    <td>
                      <div className="member-cell">
                         <div className="member-cell-avatar">
                          {rec.member?.fullName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="member-cell-name">{rec.member?.fullName || 'Unknown'}</div>
                          <div className="member-cell-code">{rec.member?.manualCode}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="entry-badge">
                        {getEntryMethodLabel(rec.entryMethod)}
                      </span>
                    </td>
                    <td>{rec.memberSubscription?.subscription?.name || '—'}</td>
                    <td>{rec.sessionsRemainingAfter !== null ? rec.sessionsRemainingAfter : '—'}</td>
                    <td>{rec.recordedBy?.fullName || 'System'}</td>
                    <td>
                      {rec.isVoided ? (
                        <span className="voided-badge">{t('attendance.voided')}</span>
                      ) : (
                        <span className="entry-badge" style={{ borderColor: 'rgba(46,213,115,0.4)', color: '#2ed573' }}>
                          {t('attendance.valid')}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        {!rec.isVoided && (
                          <button className="btn-void" onClick={() => handleVoid(rec.id)}>
                            {t('common.void')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div className="attendance-pagination">
              <span className="attendance-pagination-info">
                {t('common.showing')} {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} {t('common.of')} {total}
              </span>
              <div className="attendance-pagination-controls">
                <button className="btn-page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t('common.prev')}
                </button>
                <button className="btn-page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  {t('common.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
