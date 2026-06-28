import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './MembersPage.css';

const STATUS_COLORS = {
  active: 'badge-success',
  pending_approval: 'badge-warning',
  frozen: 'badge-info',
  expired: 'badge-danger',
  completed: 'badge-neutral',
  suspended: 'badge-danger',
  deleted: 'badge-neutral',
};

export default function MembersPage() {
  const { token, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const STATUS_OPTIONS = [
    { value: '', label: t('members.allMembers') },
    { value: 'active', label: t('common.statusActive') },
    { value: 'frozen', label: t('common.statusFrozen') },
    { value: 'expired', label: t('common.statusExpired') },
    { value: 'completed', label: t('common.statusCompleted') },
    { value: 'suspended', label: t('common.statusSuspended') },
  ];

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

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/members?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      setMembers(data.members);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSearchResults(data.members);
      } catch {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const displayMembers = searchResults !== null ? searchResults : members;

  const getCurrentPlan = (member) => {
    const current = member.memberSubscriptions?.[0];
    return current?.subscription?.name || '—';
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('members.title')}</h1>
          <p className="page-subtitle">{t('members.totalMembers', { count: total })}</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => navigate('/members/new')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {t('members.addMember')}
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="members-toolbar">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder={t('members.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>&times;</button>
          )}
        </div>

        <select
          className="status-filter"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setSearchQuery(''); setSearchResults(null); }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Members Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('members.fullName')}</th>
              <th>{t('common.phone')}</th>
              <th>{t('common.code')}</th>
              <th>{t('members.subscription')}</th>
              <th>{t('members.status')}</th>
              <th>{t('members.joinDate')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && displayMembers.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center empty-state">{t('common.loading')}</td>
              </tr>
            ) : displayMembers.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center empty-state">
                  {searchQuery ? t('members.noMatch') : t('members.noMembers')}
                </td>
              </tr>
            ) : (
              displayMembers.map((m) => (
                <tr key={m.id} className="clickable-row" onClick={() => navigate(`/members/${m.id}`)}>
                  <td>
                    <div className="member-cell">
                      <div className="member-avatar">
                        {m.fullName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-medium">{m.fullName}</div>
                        <div className="text-sm text-muted capitalize">{getGenderLabel(m.gender)}</div>
                      </div>
                    </div>
                  </td>
                  <td>{m.phone}</td>
                  <td><code className="manual-code">{m.manualCode}</code></td>
                  <td>{getCurrentPlan(m)}</td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[m.status] || 'badge-neutral'}`}>
                      {getStatusLabel(m.status)}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{formatDate(m.joinDate || m.createdAt)}</td>
                  <td>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron-icon">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
