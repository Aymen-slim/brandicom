'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InvoiceData, PaymentData, PaymentMethod } from '@/types';
import { formatMoney, VAT_RATE } from '@/lib/format';
import { Printer, CheckCircle, FileText, ArrowRight, Building2, MapPin, Mail, Phone, Plus, Trash2, X } from 'lucide-react';
import { FactureDocument } from './FactureDocument';

export function InvoiceDetail({
  invoice: initialInvoice,
  payments: initialPayments,
}: {
  invoice: InvoiceData;
  payments: PaymentData[];
}) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceData>(initialInvoice);
  const [payments, setPayments] = useState<PaymentData[]>(initialPayments);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [recording, setRecording] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showFactureModal, setShowFactureModal] = useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, invoice.total - totalPaid);
  const isPaid = totalPaid >= invoice.total;
  const isPartiallyPaid = !isPaid && totalPaid > 0;

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return;

    setRecording(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          method,
          reference: reference.trim() || null,
          paidAt: paidAt || undefined,
        }),
      });

      if (res.ok) {
        const p = await res.json();
        const nextPayments = [...payments, p];
        setPayments(nextPayments);
        const nextTotalPaid = totalPaid + numAmount;
        const nextStatus = nextTotalPaid >= invoice.total ? 'paid' : 'partially_paid';

        setInvoice((prev) => ({
          ...prev,
          paidAmount: nextTotalPaid,
          status: nextStatus,
        }));

        setAmount('');
        setReference('');
        // Automatically open the Facture modal so admin gets the facture receipt immediately!
        setShowFactureModal(true);
      }
    } finally {
      setRecording(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Voulez-vous vraiment supprimer définitivement la facture ${invoice.number} et ses règlements ?`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/finance/invoices');
        router.refresh();
      } else {
        alert('Erreur lors de la suppression de la facture.');
      }
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      alert('Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`status-badge-pill ${isPaid ? 'paid' : isPartiallyPaid ? 'partially-paid' : 'pending'}`}>
            {isPaid ? '✓ Payée / Paid' : isPartiallyPaid ? 'Partiellement Payée' : 'En Attente'}
          </span>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Facture <strong>{invoice.number}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowFactureModal(true)}
            className="btn btn-secondary btn-sm"
          >
            <FileText size={14} /> Aperçu Facture
          </button>
          <Link
            href={`/finance/invoices/${invoice.id}/print`}
            className="btn btn-primary btn-sm"
          >
            <Printer size={14} /> Imprimer / PDF
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-danger btn-sm"
            title="Supprimer la facture"
          >
            <Trash2 size={13} /> {deleting ? '…' : 'Supprimer'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16 }}>
        {/* Left Column: Client details & Invoice Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Client Details Box */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={13} /> Client Facturé
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
              {invoice.client?.name || invoice.clientName}
            </h2>

            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#4b5563' }}>
              {invoice.client?.contactName && (
                <div>
                  <span style={{ color: '#9ca3af' }}>Contact: </span>
                  <strong>{invoice.client.contactName}</strong>
                </div>
              )}
              {invoice.client?.contactEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={12} color="#9ca3af" />
                  <span>{invoice.client.contactEmail}</span>
                </div>
              )}
              {invoice.client?.contactPhone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={12} color="#9ca3af" />
                  <span>{invoice.client.contactPhone}</span>
                </div>
              )}
              {invoice.client?.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} color="#9ca3af" />
                  <span>{invoice.client.location}</span>
                </div>
              )}
            </div>

            {invoice.client?.services && invoice.client.services.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
                {invoice.client.services.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10.5,
                      padding: '2px 8px',
                      background: '#f1f5f9',
                      borderRadius: 4,
                      color: '#475569',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Invoice Financial Breakdown */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Détail des Montants (TND)</h3>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Émission: {invoice.issueDate} {invoice.dueDate ? `· Échéance: ${invoice.dueDate}` : ''}
              </span>
            </div>

            <table className="data-table">
              <tbody>
                <tr>
                  <td>Total Brut HT</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(invoice.subtotal)}
                  </td>
                </tr>
                <tr>
                  <td>TVA {Math.round((invoice.vatRate || VAT_RATE) * 100)}%</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(invoice.total - invoice.subtotal)}
                  </td>
                </tr>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td style={{ fontSize: 14 }}>Total TTC</td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                    {formatMoney(invoice.total)}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#059669' }}>Total Encaissé / Payé</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(totalPaid)}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: remaining > 0 ? '#dc2626' : '#6b7280' }}>
                    Solde Restant Dû
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#dc2626' : '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(remaining)}
                  </td>
                </tr>
              </tbody>
            </table>

            {invoice.notes && (
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 14, fontStyle: 'italic' }}>
                Note: {invoice.notes}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Payments & Record Payment Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Règlements Encaissés</h3>
              <span style={{ fontSize: 12, fontWeight: 600, color: isPaid ? '#059669' : '#d97706' }}>
                {payments.length} versement(s)
              </span>
            </div>

            {payments.length === 0 ? (
              <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '12px 0' }}>
                Aucun paiement enregistré pour cette facture.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12.5,
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>
                        {formatMoney(p.amount)}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                        {p.paidAt} · {p.method.replace('_', ' ')}
                        {p.reference && ` · Réf: ${p.reference}`}
                      </div>
                    </div>
                    <span style={{ color: '#059669', fontSize: 11, fontWeight: 700 }}>
                      Encaissé ✓
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Record Payment Form */}
            {remaining > 0 ? (
              <form onSubmit={record} style={{ marginTop: 16, borderTop: '1px solid #eaedf0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                  Enregistrer un Règlement
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                    Montant Encaissé (TND) *
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="input-field"
                      type="number"
                      step="0.001"
                      required
                      placeholder={`Max: ${remaining.toFixed(3)}`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setAmount(String(remaining))}
                      className="btn btn-secondary btn-sm"
                      title="Solder le reste dû"
                    >
                      Totalité
                    </button>
                  </div>
                </div>

                <div className="grid-responsive-2" style={{ gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                      Mode de Règlement
                    </label>
                    <select
                      className="input-field"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    >
                      <option value="bank_transfer">Virement bancaire</option>
                      <option value="cash">Espèces</option>
                      <option value="check">Chèque</option>
                      <option value="card">Carte bancaire</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                      Date de Paiement
                    </label>
                    <input
                      className="input-field"
                      type="date"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                    Référence / N° Chèque ou Transaction (optionnel)
                  </label>
                  <input
                    className="input-field"
                    placeholder="ex: VIR-92840 / CHQ-1082"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={recording || !amount}
                  className="btn btn-primary"
                  style={{ marginTop: 4, width: '100%' }}
                >
                  <Plus size={14} /> {recording ? 'Enregistrement…' : 'Valider le Règlement & Obtenir Facture'}
                </button>
              </form>
            ) : (
              <div style={{ marginTop: 12, padding: 14, background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={20} color="#059669" />
                <div>
                  <div style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>
                    Facture entièrement soldée
                  </div>
                  <div style={{ fontSize: 11.5, color: '#065f46' }}>
                    Le client a réglé la totalité du montant dû ({formatMoney(invoice.total)}).
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Facture Preview Modal */}
      {showFactureModal && (
        <div className="modal-overlay" onClick={() => setShowFactureModal(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: 900, width: '96vw', padding: 24, overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Facture Officielle — {invoice.number}
              </h3>
              <button
                type="button"
                onClick={() => setShowFactureModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <FactureDocument
              invoice={invoice}
              payments={payments}
              onClose={() => setShowFactureModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
