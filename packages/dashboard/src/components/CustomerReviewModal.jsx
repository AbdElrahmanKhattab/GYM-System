import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';
import './CustomerReviewModal.css';

export default function CustomerReviewModal({ customer, onClose }) {
  const { token, isAdmin } = useAuth();
  const { showConfirm } = useModal();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');

  if (!customer) return null;

  const isPending = customer.status === 'pending';

  const handleAction = async (newStatus) => {
    // Only admins can approve/reject
    if (!isAdmin) return;

    const confirmed = await showConfirm({
      title: newStatus === 'approved' ? t('confirm.approveTitle') : t('confirm.rejectTitle'),
      message: newStatus === 'approved' ? t('confirm.approveMessage') : t('confirm.rejectMessage'),
      variant: newStatus === 'approved' ? 'primary' : 'danger',
      confirmText: newStatus === 'approved' ? t('common.yes') : t('common.yes'),
      cancelText: t('common.no')
    });
    if (!confirmed) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/new-customers/${customer.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus, ...(pin ? { pin } : {}) }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || `Failed to ${newStatus}`);
      }

      onClose(true); // successful update
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container review-modal">
        <div className="modal-header">
          <h2>Registration Details</h2>
          <button className="btn-close" onClick={() => onClose(false)}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert-error">{error}</div>}
          
          <div className="review-grid">
            <div className="review-section">
              <h3>Personal Information</h3>
              <div className="data-row">
                <span className="data-label">Full Name</span>
                <span className="data-value">{customer.fullName}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Phone</span>
                <span className="data-value">{customer.phone}</span>
              </div>
              {isPending && (
                <div className="data-row">
                  <span className="data-label">Check-in PIN</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="4-6 digits (optional)"
                    className="pin-input"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
              )}
              <div className="data-row">
                <span className="data-label">Age</span>
                <span className="data-value">{customer.age} years</span>
              </div>
              <div className="data-row">
                <span className="data-label">Gender</span>
                <span className="data-value capitalize">{customer.gender}</span>
              </div>
            </div>

            <div className="review-section">
              <h3>Body Metrics (Optional)</h3>
              <div className="data-row">
                <span className="data-label">Height</span>
                <span className="data-value">{customer.heightCm ? `${customer.heightCm} cm` : 'Not provided'}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Weight</span>
                <span className="data-value">{customer.weightKg ? `${customer.weightKg} kg` : 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div className="review-section mt-4">
            <h3>Fitness Goals & Plan</h3>
            <div className="data-row stack">
              <span className="data-label">Primary Fitness Goal</span>
              <span className="data-value text-block">{customer.fitnessGoal}</span>
            </div>
            <div className="data-row stack">
              <span className="data-label">Preferred Plan</span>
              <span className="data-value">
                {customer.preferredSubscription ? (
                  <span className="badge badge-info">{customer.preferredSubscription.name}</span>
                ) : (
                  'No plan selected / Undecided'
                )}
              </span>
            </div>
            {customer.notes && (
              <div className="data-row stack">
                <span className="data-label">Additional Notes</span>
                <span className="data-value text-block">{customer.notes}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer space-between">
          <div>
            {!isPending && (
              <span className={`badge ${customer.status === 'approved' ? 'badge-success' : 'badge-warning'}`}>
                {customer.status.toUpperCase()}
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button className="btn-secondary" onClick={() => onClose(false)} disabled={loading}>
              {isPending ? 'Cancel' : 'Close'}
            </button>
            {isPending && isAdmin && (
              <>
                <button 
                  className="btn-danger" 
                  onClick={() => handleAction('rejected')} 
                  disabled={loading}
                >
                  Reject
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => handleAction('approved')} 
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Approve & Create Member'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
