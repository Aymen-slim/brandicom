'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InvoiceData, PaymentData, PaymentMethod } from '@/types';
import { formatMoney, VAT_RATE } from '@/lib/format';
import {
  Printer,
  CheckCircle,
  FileText,
  ArrowRight,
  Building2,
  MapPin,
  Mail,
  Phone,
  Plus,
  Trash2,
  X,
  Calculator,
  Percent,
  BadgePercent,
  Receipt,
  Sparkles,
} from 'lucide-react';
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

  // Advance Payment & TVA Option State
  const [paymentType, setPaymentType] = useState<'standard' | 'advance'>('standard');
  const [tvaMode, setTvaMode] = useState<'ttc' | 'add_tva'>('ttc');
  const [paymentVatRate, setPaymentVatRate] = useState<number>(initialInvoice.vatRate ?? 0.19);
  const [isCustomVat, setIsCustomVat] = useState(false);
  const [customVatRate, setCustomVatRate] = useState('');
  const [amountHT, setAmountHT] = useState('');

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, invoice.total - totalPaid);
  const isPaid = totalPaid >= invoice.total;
  const isPartiallyPaid = !isPaid && totalPaid > 0;

  // Active TVA rate for calculation
  const activeVatRate = isCustomVat
    ? (Number(customVatRate) || 0) / 100
    : paymentVatRate;

  // Real-time calculation from HT when "add_tva" mode is active
  const computedFromHT = useMemo(() => {
    const ht = Number(amountHT) || 0;
    const vat = Math.round(ht * activeVatRate * 1000) / 1000;
    const ttc = Math.round((ht + vat) * 1000) / 1000;
    return { ht, vat, ttc };
  }, [amountHT, activeVatRate]);

  // Actual TTC amount to record against the invoice
  const effectiveAmountToRecord = tvaMode === 'add_tva' ? computedFromHT.ttc : Number(amount) || 0;

  // Preset quick advance payment amount
  const setAdvancePercent = (pct: number) => {
    const targetTTC = Math.round(invoice.total * pct * 1000) / 1000;
    if (tvaMode === 'add_tva') {
      const ht = activeVatRate > 0 ? targetTTC / (1 + activeVatRate) : targetTTC;
      setAmountHT(ht.toFixed(3));
    } else {
      setAmount(targetTTC.toFixed(3));
    }
  };

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = effectiveAmountToRecord;
    if (!Number.isFinite(numAmount) || numAmount <= 0) return;

    setRecording(true);
    try {
      let finalReference = reference.trim();
      if (tvaMode === 'add_tva') {
        const vatPct = Math.round(activeVatRate * 100);
        const tvaNote = `Base HT: ${formatMoney(computedFromHT.ht)} + TVA ${vatPct}% (${formatMoney(computedFromHT.vat)})`;
        if (paymentType === 'advance') {
          finalReference = finalReference ? `Acompte · ${tvaNote} · ${finalReference}` : `Acompte · ${tvaNote}`;
        } else {
          finalReference = finalReference ? `${tvaNote} · ${finalReference}` : tvaNote;
        }
      } else if (paymentType === 'advance') {
        finalReference = finalReference ? `Acompte · ${finalReference}` : 'Acompte';
      }

      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          method,
          reference: finalReference || null,
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
        setAmountHT('');
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
                  <td>
                    TVA {Math.round((invoice.vatRate ?? VAT_RATE) * 100)}%
                    {(invoice.vatRate ?? VAT_RATE) === 0 ? ' (Exonérée)' : ''}
                  </td>
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
                      <div style={{ fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {formatMoney(p.amount)}
                        {p.reference?.includes('Acompte') && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <BadgePercent size={10} /> Acompte
                          </span>
                        )}
                        {p.reference?.includes('TVA') && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Percent size={9} /> TVA incluse
                          </span>
                        )}
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
              <form onSubmit={record} style={{ marginTop: 16, borderTop: '1px solid #eaedf0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt size={15} color="#4338ca" />
                    Enregistrer un Paiement / Acompte
                  </div>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    Reste dû: <strong style={{ color: '#dc2626' }}>{formatMoney(remaining)}</strong>
                  </span>
                </div>

                {/* 1. Payment Nature Selector: Standard vs Acompte / Avance */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPaymentType('standard')}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: paymentType === 'standard' ? '#ffffff' : 'transparent',
                      color: paymentType === 'standard' ? '#1e293b' : '#64748b',
                      boxShadow: paymentType === 'standard' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Règlement Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('advance')}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: paymentType === 'advance' ? '#ffffff' : 'transparent',
                      color: paymentType === 'advance' ? '#d97706' : '#64748b',
                      boxShadow: paymentType === 'advance' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <BadgePercent size={13} /> Acompte / Avance
                  </button>
                </div>

                {/* Quick Advance presets if advance payment is chosen */}
                {paymentType === 'advance' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: '#fffbeb', padding: '8px 10px', borderRadius: 6, border: '1px solid #fef3c7' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>Acompte rapide :</span>
                    <button
                      type="button"
                      onClick={() => setAdvancePercent(0.3)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11, background: '#ffffff' }}
                      title="30% du montant total"
                    >
                      30% ({formatMoney(invoice.total * 0.3)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvancePercent(0.5)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11, background: '#ffffff' }}
                      title="50% du montant total"
                    >
                      50% ({formatMoney(invoice.total * 0.5)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvancePercent(1)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11, background: '#ffffff' }}
                      title="Totalité du montant"
                    >
                      100%
                    </button>
                  </div>
                )}

                {/* 2. TVA Option Switch: Direct TTC vs HT + Ajouter TVA */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calculator size={13} color="#4f46e5" />
                      Option TVA sur le versement
                    </label>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setTvaMode('ttc')}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: tvaMode === 'ttc' ? '1px solid #6366f1' : '1px solid #cbd5e1',
                          background: tvaMode === 'ttc' ? '#eff6ff' : '#ffffff',
                          color: tvaMode === 'ttc' ? '#4338ca' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        Montant Direct (TTC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTvaMode('add_tva')}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: tvaMode === 'add_tva' ? '1px solid #6366f1' : '1px solid #cbd5e1',
                          background: tvaMode === 'add_tva' ? '#eff6ff' : '#ffffff',
                          color: tvaMode === 'add_tva' ? '#4338ca' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        + Ajouter TVA (sur HT)
                      </button>
                    </div>
                  </div>

                  {tvaMode === 'add_tva' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                            Montant HT (Hors Taxe) *
                          </label>
                          <input
                            className="input-field"
                            type="number"
                            step="0.001"
                            required
                            placeholder="ex: 1000.000"
                            value={amountHT}
                            onChange={(e) => setAmountHT(e.target.value)}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                            Taux TVA
                          </label>
                          <select
                            className="input-field"
                            value={isCustomVat ? 'custom' : String(paymentVatRate)}
                            onChange={(e) => {
                              if (e.target.value === 'custom') {
                                setIsCustomVat(true);
                              } else {
                                setIsCustomVat(false);
                                setPaymentVatRate(Number(e.target.value));
                              }
                            }}
                          >
                            <option value="0.19">19% (Standard)</option>
                            <option value="0.07">7% (Réduit)</option>
                            <option value="0">0% (Sans TVA)</option>
                            <option value="custom">Autre %</option>
                          </select>
                        </div>
                      </div>

                      {isCustomVat && (
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                            Pourcentage TVA personnalisé (%)
                          </label>
                          <input
                            className="input-field"
                            type="number"
                            step="0.1"
                            placeholder="ex: 13"
                            value={customVatRate}
                            onChange={(e) => setCustomVatRate(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Real-time Calculation Breakdown Box */}
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '10px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1.2fr',
                          gap: 6,
                          textAlign: 'center',
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 10.5, color: '#64748b' }}>Base HT</div>
                          <div style={{ fontWeight: 700, color: '#334155' }}>{formatMoney(computedFromHT.ht)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: '#64748b' }}>TVA ({Math.round(activeVatRate * 100)}%)</div>
                          <div style={{ fontWeight: 700, color: '#4f46e5' }}>+{formatMoney(computedFromHT.vat)}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 6 }}>
                          <div style={{ fontSize: 10.5, color: '#64748b' }}>Total TTC Encaissé</div>
                          <div style={{ fontWeight: 800, color: '#059669', fontSize: 13 }}>
                            {formatMoney(computedFromHT.ttc)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Montant Encaissé TTC (TND) *
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
                  )}
                </div>

                {/* 3. Method & Date */}
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

                {/* 4. Reference */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                    Référence / Note (optionnel)
                  </label>
                  <input
                    className="input-field"
                    placeholder={paymentType === 'advance' ? 'ex: Acompte / Réf: VIR-92840' : 'ex: VIR-92840 / CHQ-1082'}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={recording || effectiveAmountToRecord <= 0}
                  className="btn btn-primary"
                  style={{ marginTop: 4, width: '100%' }}
                >
                  <Plus size={14} />{' '}
                  {recording
                    ? 'Enregistrement…'
                    : paymentType === 'advance'
                    ? `Valider l'Acompte (${formatMoney(effectiveAmountToRecord)}) & Obtenir Facture`
                    : `Valider le Règlement (${formatMoney(effectiveAmountToRecord)}) & Obtenir Facture`}
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
