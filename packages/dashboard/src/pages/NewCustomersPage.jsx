import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import CustomerReviewModal from '../components/CustomerReviewModal';
import './NewCustomersPage.css';

export default function NewCustomersPage() {
  const { token, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab state
  const [activeTab, setActiveTab] = useState('pending');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCustomers = async (status) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/new-customers?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch new customers');
      
      setCustomers(data.customers);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(activeTab);
  }, [activeTab, token]);

  const handleReview = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleModalClose = (wasUpdated) => {
    setIsModalOpen(false);
    if (wasUpdated) {
      fetchCustomers(activeTab); // refresh list
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getGenderLabel = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male': return t('members.male');
      case 'female': return t('members.female');
      default: return gender || '—';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('newCustomers.title')}</h1>
          <p className="page-subtitle">{t('newCustomers.subtitle')}</p>
        </div>
      </div>

      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          {t('newCustomers.pending')}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          {t('newCustomers.approved')}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          {t('newCustomers.rejected')}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="table-container">
        {loading && customers.length === 0 ? (
          <div className="empty-state text-center">{t('common.loading')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.name')}</th>
                <th>{t('common.phone')}</th>
                <th>{t('newCustomers.preferredPlan')}</th>
                {activeTab !== 'pending' && <th>{t('attendance.recordedBy')}</th>}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 5 : 6} className="text-center empty-state">
                    {t('newCustomers.noCustomers')}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td className="text-muted text-sm">{formatDate(c.createdAt)}</td>
                    <td>
                      <div className="fw-medium">{c.fullName}</div>
                      <div className="text-sm text-muted capitalize">{getGenderLabel(c.gender)}, {c.age} {t('common.years')}</div>
                    </td>
                    <td>{c.phone}</td>
                    <td>
                      {c.preferredSubscription ? (
                        <span className="badge badge-info">{c.preferredSubscription.name}</span>
                      ) : (
                        <span className="text-muted text-sm">{t('common.undecided')}</span>
                      )}
                    </td>
                    {activeTab !== 'pending' && (
                      <td className="text-sm text-muted">
                        {c.reviewedBy?.fullName || 'System'}
                      </td>
                    )}
                    <td>
                      <button 
                        className="btn-secondary btn-sm" 
                        onClick={() => handleReview(c)}
                      >
                        {activeTab === 'pending' ? t('newCustomers.review') : t('common.viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <CustomerReviewModal
          customer={selectedCustomer}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
