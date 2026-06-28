import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function PaymentsPage() {
  const { token } = useAuth();
  const { showToast, showConfirm } = useModal();
  const { t } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', new Date(startDate).toISOString());
      // End date should include the full day
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.append('endDate', end.toISOString());
      }

      const res = await fetch(`/api/payments?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      
      setPayments(data.payments || []);
      setTotalAmount(data.totalAmount || 0);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: t('confirm.voidPaymentTitle'),
      message: t('confirm.voidPaymentMessage'),
      variant: 'danger',
      confirmText: t('common.void'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to void payment');
      fetchPayments();
      showToast(t('toast.voidSuccess'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'cash': return t('payments.cash');
      case 'visa': return t('payments.visa');
      case 'instapay': return t('payments.instapay');
      case 'vodafone_cash': return t('payments.vodafoneCash');
      default: return method.replace('_', ' ');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleString();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t('payments.title')}</h1>
      </div>

      <div className="filters-card card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{t('attendance.startDate')}</label>
          <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{t('attendance.endDate')}</label>
          <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <button className="btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>{t('common.clearFilters')}</button>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>{t('payments.totalForPeriod')}:</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>${Number(totalAmount).toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
        ) : payments.length === 0 ? (
          <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>{t('payments.noPayments')}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('payments.member')}</th>
                <th>{t('attendance.subscription')}</th>
                <th>{t('payments.method')}</th>
                <th>{t('payments.amount')}</th>
                <th>{t('attendance.recordedBy')}</th>
                <th width="80">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.paidAt)}</td>
                  <td className="fw-medium">{payment.member?.fullName}</td>
                  <td>{payment.memberSubscription?.subscription?.name || '—'}</td>
                  <td>{getPaymentMethodLabel(payment.paymentMethod)}</td>
                  <td className="fw-medium text-success">${Number(payment.amount).toFixed(2)}</td>
                  <td>{payment.recordedBy?.fullName}</td>
                  <td>
                    <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleDelete(payment.id)}>{t('common.void')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
