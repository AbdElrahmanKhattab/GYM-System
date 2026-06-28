import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function ExpensesPage() {
  const { token } = useAuth();
  const { showToast, showConfirm } = useModal();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add Expense Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ amount: '', category: '', description: '', spentAt: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.append('endDate', end.toISOString());
      }

      const res = await fetch(`/api/expenses?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      
      setExpenses(data.expenses || []);
      setTotalAmount(data.totalAmount || 0);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: t('confirm.voidExpenseTitle'),
      message: t('confirm.voidExpenseMessage'),
      variant: 'danger',
      confirmText: t('common.void'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to void expense');
      fetchExpenses();
      showToast(t('toast.voidSuccess'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(addForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      
      setShowAddModal(false);
      setAddForm({ amount: '', category: '', description: '', spentAt: new Date().toISOString().split('T')[0] });
      fetchExpenses();
      showToast(t('toast.paymentRecorded'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString();

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{t('expenses.title')}</h1>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>{t('expenses.addExpense')}</button>
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
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>{t('expenses.totalExpenses')}:</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-color)' }}>${Number(totalAmount).toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
        ) : expenses.length === 0 ? (
          <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>{t('expenses.noExpenses')}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('expenses.category')}</th>
                <th>{t('expenses.description')}</th>
                <th>{t('expenses.amount')}</th>
                <th>{t('attendance.recordedBy')}</th>
                <th width="80">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(expense => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.spentAt)}</td>
                  <td className="fw-medium">{expense.category}</td>
                  <td>{expense.description || '—'}</td>
                  <td className="fw-medium text-danger">${Number(expense.amount).toFixed(2)}</td>
                  <td>{expense.recordedBy?.fullName}</td>
                  <td>
                    <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleDelete(expense.id)}>{t('common.void')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{t('expenses.addExpense')}</h2>
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label>{t('common.amount')}</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input" 
                  value={addForm.amount} 
                  onChange={e => setAddForm({...addForm, amount: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>{t('expenses.category')}</label>
                <input 
                  type="text" 
                  className="input" 
                  value={addForm.category} 
                  onChange={e => setAddForm({...addForm, category: e.target.value})} 
                  placeholder="e.g. Maintenance, Utilities, Equipment"
                  required 
                />
              </div>
              <div className="form-group">
                <label>{t('expenses.description')}</label>
                <textarea 
                  className="input" 
                  value={addForm.description} 
                  onChange={e => setAddForm({...addForm, description: e.target.value})} 
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>{t('common.date')}</label>
                <input 
                  type="date" 
                  className="input" 
                  value={addForm.spentAt} 
                  onChange={e => setAddForm({...addForm, spentAt: e.target.value})} 
                  required 
                />
              </div>
              <div className="modal-actions mt-4">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{t('expenses.addExpense')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
