import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';
import SubscriptionModal from '../components/SubscriptionModal';
import './SubscriptionsPage.css';

export default function SubscriptionsPage() {
  const { token, isAdmin } = useAuth();
  const { showToast } = useModal();
  const { t } = useLanguage();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch subscriptions');
      
      setSubscriptions(data.subscriptions);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [token]);

  const handleCreate = () => {
    setSelectedSubscription(null);
    setIsModalOpen(true);
  };

  const handleEdit = (subscription) => {
    setSelectedSubscription(subscription);
    setIsModalOpen(true);
  };

  const handleModalClose = (wasSaved) => {
    setIsModalOpen(false);
    if (wasSaved) {
      fetchSubscriptions();
    }
  };

  const handleArchiveToggle = async (subscription) => {
    if (!isAdmin) return;
    
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !subscription.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to toggle status');
      }

      fetchSubscriptions();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getDurationTypeLabel = (type, val) => {
    switch (type) {
      case 'months': return t('subscriptions.months');
      case 'days': return t('subscriptions.days');
      case 'sessions': return t('subscriptions.sessions');
      default: return type;
    }
  };

  if (loading && subscriptions.length === 0) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('subscriptions.title')}</h1>
          <p className="page-subtitle">{t('subscriptions.subtitle')}</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={handleCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {t('subscriptions.addPlan')}
          </button>
        )}
      </div>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('subscriptions.order')}</th>
              <th>{t('subscriptions.name')}</th>
              <th>{t('subscriptions.duration')}</th>
              <th>{t('subscriptions.price')}</th>
              <th>{t('members.freeze')}</th>
              <th>{t('common.status')}</th>
              {isAdmin && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="text-center empty-state">
                  {t('subscriptions.noPlans')}
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className={!sub.isActive ? 'row-inactive' : ''}>
                  <td>{sub.displayOrder}</td>
                  <td>
                    <div className="fw-medium">{sub.name}</div>
                    {sub.description && <div className="text-sm text-muted">{sub.description}</div>}
                  </td>
                  <td>{sub.durationValue} {getDurationTypeLabel(sub.durationType, sub.durationValue)}</td>
                  <td className="fw-medium text-success">${Number(sub.price).toFixed(2)}</td>
                  <td>
                    {sub.freezeAllowed ? (
                      <span className="badge badge-info">{t('common.allowed')}</span>
                    ) : (
                      <span className="badge badge-neutral">{t('common.no')}</span>
                    )}
                  </td>
                  <td>
                    {sub.isActive ? (
                      <span className="badge badge-success">{t('subscriptions.active')}</span>
                    ) : (
                      <span className="badge badge-warning">{t('subscriptions.archived')}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon" onClick={() => handleEdit(sub)} title={t('subscriptions.editPlan')}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button 
                          className="btn-icon text-warning" 
                          onClick={() => handleArchiveToggle(sub)}
                          title={sub.isActive ? t('common.archive') : t('common.restore')}
                        >
                          {sub.isActive ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="21 8 21 21 3 21 3 8"/>
                              <rect x="1" y="3" width="22" height="5"/>
                              <line x1="10" y1="12" x2="14" y2="12"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="9 22 9 12 15 12 15 22"/>
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <SubscriptionModal
          subscription={selectedSubscription}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
