import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './ActivityLogPage.css';

export default function ActivityLogPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [actions, setActions] = useState([]);
  
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadataModal, setMetadataModal] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchActions();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedUser, selectedAction, startDate, endDate, page]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const fetchActions = async () => {
    try {
      const res = await fetch('/api/activity-log/actions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch (err) {
      console.error('Failed to fetch actions', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page,
        limit: 50,
        ...(selectedUser && { userId: selectedUser }),
        ...(selectedAction && { actionType: selectedAction }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });

      const res = await fetch(`/api/activity-log?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load activity logs');

      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString();
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1); // Reset to page 1 on filter change
  };

  return (
    <div className="activity-log-page">
      <div className="log-header">
        <h1>{t('activityLog.title')}</h1>
        <p>{t('activityLog.subtitle')}</p>
      </div>

      <div className="log-filters">
        <div className="filter-group">
          <label>{t('activityLog.user')}</label>
          <select value={selectedUser} onChange={handleFilterChange(setSelectedUser)}>
            <option value="">{t('activityLog.allUsers')}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>{t('activityLog.action')}</label>
          <select value={selectedAction} onChange={handleFilterChange(setSelectedAction)}>
            <option value="">{t('activityLog.allActions')}</option>
            {actions.map(a => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>{t('attendance.startDate')}</label>
          <input type="date" value={startDate} onChange={handleFilterChange(setStartDate)} />
        </div>

        <div className="filter-group">
          <label>{t('attendance.endDate')}</label>
          <input type="date" value={endDate} onChange={handleFilterChange(setEndDate)} />
        </div>
      </div>

      <div className="log-table-container">
        {loading && logs.length === 0 ? (
          <div className="loading-spinner">{t('common.loading')}</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--status-rejected)' }}>{error}</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">{t('activityLog.noLogs')}</div>
        ) : (
          <>
            <table className="log-table">
              <thead>
                <tr>
                  <th>{t('activityLog.timestamp')}</th>
                  <th>{t('activityLog.user')}</th>
                  <th>{t('activityLog.action')}</th>
                  <th>{t('activityLog.entityType')}</th>
                  <th>{t('activityLog.entityId')}</th>
                  <th>{t('activityLog.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>{log.user ? `${log.user.fullName}` : 'System / Public'}</td>
                    <td>
                      <span className="action-badge">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>{log.entityType || '-'}</td>
                    <td title={log.entityId || ''}>
                      {log.entityId ? `${log.entityId.substring(0, 8)}...` : '-'}
                    </td>
                    <td>
                      {log.metadata ? (
                        <button 
                          className="btn-icon" 
                          onClick={() => setMetadataModal(log)}
                          title={t('activityLog.details')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="pagination">
              <span className="pagination-info">
                {t('activityLog.showingPage', { page, totalPages, total: totalRecords })}
              </span>
              <div className="pagination-controls">
                <button 
                  className="btn-page" 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                >
                  {t('common.prev')}
                </button>
                <button 
                  className="btn-page" 
                  disabled={page === totalPages || totalPages === 0} 
                  onClick={() => setPage(p => p + 1)}
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {metadataModal && (
        <div className="modal-overlay" onClick={() => setMetadataModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('activityLog.activityDetails')}</h2>
              <button className="btn-close" onClick={() => setMetadataModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <strong>{t('activityLog.action')}:</strong> {metadataModal.action.replace(/_/g, ' ')}<br/>
                <strong>{t('activityLog.timestamp')}:</strong> {formatDate(metadataModal.createdAt)}
              </div>
              <pre className="metadata-pre">
                {JSON.stringify(metadataModal.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
