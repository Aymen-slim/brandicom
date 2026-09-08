import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient, isAdmin } from '@/lib/permissions';
import { fetchClientDetail, updateClient, isClientStatus, upsertContract, upsertClientSocials } from '@/lib/data';
import { isPlatform } from '@/lib/data';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied to this client' }, { status: 403 });
  }

  try {
    const detail = await fetchClientDetail(clientId, user);
    if (!detail) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...detail.client,
      deliverables: detail.deliverables,
      creatorAssignments: detail.creatorAssignments,
      messages: detail.messages,
    });
  } catch (err: any) {
    console.error('Error fetching client detail:', err);
    return NextResponse.json({ error: 'Failed to fetch client detail' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) {
    console.warn(`[authz] Client update denied for user ${user.email} on client ${clientId}`);
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name,
      location,
      status,
      services,
      notes,
      assignedUserIds,
      industry,
      website,
      contactName,
      contactEmail,
      contactPhone,
      startDate,
      endDate,
      leadSource,
      churnReason,
      tags,
      assetsUrl,
      socialAccounts,
      contract,
    } = body;

    const servicesList =
      services === undefined
        ? undefined
        : Array.isArray(services)
          ? services.filter((s: unknown) => typeof s === 'string')
          : typeof services === 'string'
            ? services.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];

    const updated = await updateClient(
      clientId,
      {
        name,
        location,
        status: status !== undefined && isClientStatus(status) ? status : undefined,
        services: servicesList,
        notes,
        industry,
        website,
        contactName,
        contactEmail,
        contactPhone,
        startDate,
        endDate,
        leadSource,
        churnReason,
        tags: Array.isArray(tags) ? tags : undefined,
        assetsUrl,
      },
      Array.isArray(assignedUserIds) ? assignedUserIds : undefined
    );

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (Array.isArray(socialAccounts)) {
      await upsertClientSocials(
        clientId,
        socialAccounts
          .filter((s: any) => s && isPlatform(s.platform))
          .map((s: any) => ({
            platform: s.platform,
            handle: s.handle,
            url: s.url,
            followers: s.followers != null ? Number(s.followers) : null,
          }))
      );

      // Persist baseline follower counts into client tags
      const currentTags = (updated.tags || []).filter((t: string) => typeof t === 'string' && !t.startsWith('baseline:'));
      for (const s of socialAccounts) {
        if (s && s.initialFollowers != null && !isNaN(Number(s.initialFollowers))) {
          currentTags.push(`baseline:${s.platform}:${Number(s.initialFollowers)}`);
        }
      }
      const supabase = createServerSupabaseClient();
      await supabase.from('clients').update({ tags: currentTags }).eq('id', clientId);
    }

    if (isAdmin(user) && contract && typeof contract === 'object') {
      await upsertContract(clientId, {
        contractType: contract.contractType,
        monthlyFee: contract.monthlyFee != null ? Number(contract.monthlyFee) : null,
        billingDay: contract.billingDay != null ? Number(contract.billingDay) : null,
        startDate: contract.startDate,
        endDate: contract.endDate,
        notes: contract.notes,
      });
    }

    const detail = await fetchClientDetail(clientId, user);
    return NextResponse.json(detail?.client || updated);
  } catch (err: any) {
    console.error('Error updating client:', err);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete clients' }, { status: 403 });
  }

  try {
    const supabase = createServerSupabaseClient();
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', params.id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true, message: 'Client deleted' });
  } catch (err: any) {
    console.error('Error deleting client:', err);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
