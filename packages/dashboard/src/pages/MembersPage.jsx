import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useModal } from '../contexts/ModalContext';
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
  const { showToast, showConfirm } = useModal();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [pinFilter, setPinFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkPinModal, setShowBulkPinModal] = useState(false);
  const [bulkPinValue, setBulkPinValue] = useState('');
  const [bulkPinSubmitting, setBulkPinSubmitting] = useState(false);

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
      if (pinFilter) params.set('hasPin', pinFilter);

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
  }, [token, statusFilter, pinFilter]);

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

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayMembers.map((m) => m.id)));
    }
  };

  const handleBulkSetPin = async () => {
    const pin = bulkPinValue.trim();
    if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) {
      showToast('PIN must be 4-6 digits', 'error');
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = await showConfirm({
      title: 'Set PIN for selected members',
      message: `Set PIN for ${ids.length} member(s)?`,
      variant: 'primary',
      confirmText: 'Yes',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    setBulkPinSubmitting(true);
    try {
      const res = await fetch('/api/members/bulk-set-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberIds: ids, pin: pin || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed');
      }
      setShowBulkPinModal(false);
      setBulkPinValue('');
      setSelectedIds(new Set());
      await fetchMembers();
      showToast(pin ? 'PIN set successfully' : 'PIN removed', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBulkPinSubmitting(false);
    }
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
          onChange={(e) => { setStatusFilter(e.target.value); setSearchQuery(''); setSearchResults(null); setSelectedIds(new Set()); }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="status-filter"
          value={pinFilter}
          onChange={(e) => { setPinFilter(e.target.value); setSelectedIds(new Set()); }}
          style={{ minWidth: '130px' }}
        >
          <option value="">All PINs</option>
          <option value="true">Has PIN</option>
          <option value="false">No PIN</option>
        </select>
      </div>

      {/* Members Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={displayMembers.length > 0 && selectedIds.size === displayMembers.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th>{t('members.fullName')}</th>
              <th>{t('common.phone')}</th>
              <th>{t('common.code')}</th>
              <th>{t('members.subscription')}</th>
              <th>PIN</th>
              <th>{t('members.status')}</th>
              <th>{t('members.joinDate')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && displayMembers.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 9} className="text-center empty-state">{t('common.loading')}</td>
              </tr>
            ) : displayMembers.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 9} className="text-center empty-state">
                  {searchQuery ? t('members.noMatch') : t('members.noMembers')}
                </td>
              </tr>
            ) : (
              displayMembers.map((m) => (
                <tr key={m.id} className="clickable-row" onClick={() => navigate(`/members/${m.id}`)}>
                  {isAdmin && (
                    <td style={{ width: '36px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                      />
                    </td>
                  )}
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
                    <span className={`badge ${m.pinSetAt ? 'badge-success' : 'badge-neutral'}`}>
                      {m.pinSetAt ? 'PIN' : '—'}
                    </span>
                  </td>
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

      {/* Bulk action bar */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selectedIds.size} selected</span>
          <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }} onClick={() => { setBulkPinValue(''); setShowBulkPinModal(true); }}>
            Set PIN
          </button>
          <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }} onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Bulk PIN Modal */}
      {showBulkPinModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2>Set PIN for {selectedIds.size} member(s)</h2>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              Enter a 4-6 digit PIN. Leave empty to remove PIN from selected members.
            </p>
            <div className="form-group">
              <label>PIN (optional)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="input"
                placeholder="4-6 digits"
                value={bulkPinValue}
                onChange={(e) => setBulkPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div className="modal-actions mt-4">
              <button className="btn-secondary" onClick={() => setShowBulkPinModal(false)} disabled={bulkPinSubmitting}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleBulkSetPin} disabled={bulkPinSubmitting}>
                {bulkPinSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
