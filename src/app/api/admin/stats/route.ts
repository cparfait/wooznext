import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

function isValidUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function escapeLiteral(v: string): string {
  return v.replace(/'/g, "''");
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || undefined;

    const serviceId =
      session.user.role === 'AGENT'
        ? (session.user.serviceId ?? undefined)
        : (searchParams.get('serviceId') || undefined);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const dayOfWeekParam = searchParams.get('dayOfWeek');
    const timeFromParam = searchParams.get('timeFrom');
    const timeToParam = searchParams.get('timeTo');

    if (serviceId && !isValidUUID(serviceId)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }
    if (agentId && !isValidUUID(agentId)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }

    let dateFrom: Date;
    let dateTo: Date;

    if (fromParam) {
      const d = new Date(fromParam);
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
      d.setHours(0, 0, 0, 0);
      dateFrom = d;
    } else {
      dateFrom = new Date();
      dateFrom.setHours(0, 0, 0, 0);
    }

    if (toParam) {
      const d = new Date(toParam);
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
      d.setHours(23, 59, 59, 999);
      dateTo = d;
    } else {
      dateTo = new Date();
      dateTo.setHours(23, 59, 59, 999);
    }

    const dayOfWeek = dayOfWeekParam ? parseInt(dayOfWeekParam, 10) : undefined;
    if (dayOfWeekParam && (isNaN(dayOfWeek!) || dayOfWeek! < 0 || dayOfWeek! > 6)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }

    const timeFrom = timeFromParam || undefined;
    const timeTo = timeToParam || undefined;

    if (timeFrom && !/^\d{1,2}:\d{2}$/.test(timeFrom)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }
    if (timeTo && !/^\d{1,2}:\d{2}$/.test(timeTo)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }

    const p = {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      serviceId,
      agentId,
      dayOfWeek,
      timeFromMinutes: timeFrom ? (() => { const [h, m] = timeFrom.split(':').map(Number); return h * 60 + m; })() : undefined,
      timeToMinutes: timeTo ? (() => { const [h, m] = timeTo.split(':').map(Number); return h * 60 + m; })() : undefined,
    };

    const baseWhereParts: string[] = [
      `"createdAt" >= '${escapeLiteral(p.dateFrom)}'`,
      `"createdAt" <= '${escapeLiteral(p.dateTo)}'`,
    ];
    if (p.serviceId) baseWhereParts.push(`"service_id" = '${p.serviceId}'`);
    if (p.agentId) baseWhereParts.push(`"called_by_id" = '${p.agentId}'`);
    const baseWhere = baseWhereParts.join(' AND ');

    const dayWhere = p.dayOfWeek !== undefined
      ? ` AND EXTRACT(DOW FROM "createdAt") = ${p.dayOfWeek}`
      : '';

    const timeWhereParts: string[] = [];
    if (p.timeFromMinutes !== undefined) {
      timeWhereParts.push(`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) >= ${p.timeFromMinutes}`);
    }
    if (p.timeToMinutes !== undefined) {
      timeWhereParts.push(`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) <= ${p.timeToMinutes}`);
    }
    const timeWhere = timeWhereParts.length > 0 ? ` AND ${timeWhereParts.join(' AND ')}` : '';

    const filterSuffix = dayWhere + timeWhere;

    const [
      totalResult,
      completedResult,
      noShowResult,
      avgResult,
      waitingNow,
      servingNow,
    ] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::int as count FROM tickets WHERE ${baseWhere}${filterSuffix}`
      ),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::int as count FROM tickets WHERE status = 'COMPLETED' AND ${baseWhere.replace(/"createdAt"/g, '"completed_at"')}${filterSuffix}`
      ),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::int as count FROM tickets WHERE status = 'NO_SHOW' AND ${baseWhere.replace(/"createdAt"/g, '"completed_at"')}${filterSuffix}`
      ),
      prisma.$queryRawUnsafe<Array<{ avg_seconds: number | null }>>(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - called_at))), 0)::int as avg_seconds
         FROM tickets
         WHERE status = 'COMPLETED' AND called_at IS NOT NULL
         AND completed_at >= '${p.dateFrom}' AND completed_at <= '${p.dateTo}'
         ${p.serviceId ? `AND service_id = '${p.serviceId}'` : ''}
         ${p.agentId ? `AND called_by_id = '${p.agentId}'` : ''}`
      ),
      prisma.ticket.count({
        where: { status: TicketStatus.WAITING, ...(p.serviceId ? { serviceId: p.serviceId } : {}) },
      }),
      prisma.ticket.count({
        where: { status: TicketStatus.SERVING, ...(p.serviceId ? { serviceId: p.serviceId } : {}), ...(p.agentId ? { calledById: p.agentId } : {}) },
      }),
    ]);

    const totalToday = Number(totalResult[0]?.count ?? 0);
    const completedToday = Number(completedResult[0]?.count ?? 0);
    const noShowToday = Number(noShowResult[0]?.count ?? 0);
    const avgServiceTimeSeconds = Number(avgResult[0]?.avg_seconds ?? 0);

    const serviceFilter = p.serviceId ? `AND t.service_id = '${p.serviceId}'` : '';
    const agentFilter = p.agentId ? `AND t.called_by_id = '${p.agentId}'` : '';

    const perService = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; total: bigint; completed: bigint; waiting: bigint }>>(
      `SELECT s.id, s.name,
        COUNT(t.id)::int as total,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int as waiting
       FROM services s
       LEFT JOIN tickets t ON t.service_id = s.id
         AND t."createdAt" >= '${p.dateFrom}' AND t."createdAt" <= '${p.dateTo}'
         ${agentFilter} ${dayWhere.replace(/"createdAt"/g, 't."createdAt"')} ${timeWhere.replace(/"createdAt"/g, 't."createdAt"')}
       WHERE s."isActive" = true ${p.serviceId ? `AND s.id = '${p.serviceId}'` : ''}
       GROUP BY s.id, s.name
       HAVING COUNT(t.id) > 0
       ORDER BY s.name`
    );

    const perAgent = await prisma.$queryRawUnsafe<Array<{ id: string; first_name: string; last_name: string; completed: bigint; no_show: bigint; avg_seconds: number | null }>>(
      `SELECT a.id, a.first_name, a.last_name,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'NO_SHOW' THEN 1 END)::int as no_show,
        COALESCE(AVG(CASE WHEN t.status = 'COMPLETED' AND t.called_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.completed_at - t.called_at)) END), 0)::int as avg_seconds
       FROM agents a
       JOIN tickets t ON t.called_by_id = a.id
       WHERE t.completed_at >= '${p.dateFrom}' AND t.completed_at <= '${p.dateTo}'
         AND t.status IN ('COMPLETED', 'NO_SHOW')
         ${serviceFilter} ${agentFilter}
         ${dayWhere.replace(/"createdAt"/g, 't."createdAt"')} ${timeWhere.replace(/"createdAt"/g, 't."createdAt"')}
       GROUP BY a.id, a.first_name, a.last_name
       ORDER BY a.first_name, a.last_name`
    );

    const isToday = dateFrom.toDateString() === dateTo.toDateString();
    const isFilteredByDay = dayOfWeek !== undefined;

    let chartByHour: { label: string; total: number; completed: number; noShow: number }[] = [];
    let chartByDayOfWeek: { label: string; total: number; completed: number; noShow: number }[] = [];

    if (isToday || isFilteredByDay) {
      const hourData = await prisma.$queryRawUnsafe<Array<{ hour: number; total: bigint; completed: bigint; no_show: bigint }>>(
        `SELECT EXTRACT(HOUR FROM "createdAt")::int as hour,
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as completed,
          COUNT(CASE WHEN status = 'NO_SHOW' THEN 1 END)::int as no_show
         FROM tickets
         WHERE ${baseWhere} ${filterSuffix}
         GROUP BY hour ORDER BY hour`
      );
      chartByHour = hourData.map((r) => ({
        label: `${String(r.hour).padStart(2, '0')}h`,
        total: Number(r.total),
        completed: Number(r.completed),
        noShow: Number(r.no_show),
      }));
    }

    if (!isToday || isFilteredByDay) {
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const dowData = await prisma.$queryRawUnsafe<Array<{ dow: number; total: bigint; completed: bigint; no_show: bigint }>>(
        `SELECT EXTRACT(DOW FROM "createdAt")::int as dow,
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as completed,
          COUNT(CASE WHEN status = 'NO_SHOW' THEN 1 END)::int as no_show
         FROM tickets
         WHERE ${baseWhere}
         GROUP BY dow ORDER BY dow`
      );
      chartByDayOfWeek = dowData.map((r) => ({
        label: days[r.dow] ?? String(r.dow),
        total: Number(r.total),
        completed: Number(r.completed),
        noShow: Number(r.no_show),
      }));
    }

    return NextResponse.json({
      totalToday,
      completedToday,
      noShowToday,
      waitingNow,
      servingNow,
      avgServiceTimeSeconds,
      perService: perService.map((s) => ({
        id: s.id,
        name: s.name,
        total: Number(s.total),
        completed: Number(s.completed),
        waiting: Number(s.waiting),
      })),
      perAgent: perAgent.map((a) => ({
        id: a.id,
        name: `${a.first_name} ${a.last_name}`,
        completed: Number(a.completed),
        noShow: Number(a.no_show),
        avgServiceTimeSeconds: Number(a.avg_seconds ?? 0),
      })),
      chartByHour,
      chartByDayOfWeek,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
