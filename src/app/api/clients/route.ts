import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, isAdmin } from '@/lib/permissions';
import { fetchClients, attachClientCounts, createClient, isClientStatus } from '@/lib/data';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const assignedTo = searchParams.get('assigned_to');
  const search = searchParams.get('search');

  try {
    const clients = await fetchClients({
      status,
      assignedTo,
      search,
      userRole: user.role,
      userId: user.id,
    });
    const clientsWithCounts = await attachClientCounts(clients);
    return NextResponse.json(clientsWithCounts);
  } catch (err: any) {
    console.error('Error fetching clients:', err);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

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
      leadSource,
      tags,
      monthlyFee,
      contractType,
    } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    let userIdsToAssign: string[] = [];
    if (isAdmin(user)) {
      if (Array.isArray(assignedUserIds)) {
        userIdsToAssign = assignedUserIds.filter((uid: unknown) => typeof uid === 'string');
      }
    } else {
      userIdsToAssign = [user.id];
    }

    const servicesList = Array.isArray(services)
      ? services.filter((s: unknown) => typeof s === 'string')
      : typeof services === 'string'
        ? services.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

    const newClient = await createClient(
      {
        name,
        location,
        status: status && isClientStatus(status) ? status : null,
        services: servicesList,
        notes,
        industry,
        website,
        contactName,
        contactEmail,
        contactPhone,
        startDate,
        leadSource,
        tags: Array.isArray(tags) ? tags : undefined,
      },
      userIdsToAssign,
      isAdmin(user) ? { monthlyFee: monthlyFee ? Number(monthlyFee) : null, contractType } : null,
      isAdmin(user)
    );

    return NextResponse.json(newClient, { status: 201 });
  } catch (err: any) {
    console.error('Error creating client:', err);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
