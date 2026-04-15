import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';

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

    let dateFrom: Date;
    let dateTo: Date;

    if (fromParam) {
      dateFrom = new Date(fromParam);
      dateFrom.setHours(0, 0, 0, 0);
    } else {
      dateFrom = new Date();
      dateFrom.setHours(0, 0, 0, 0);
    }

    if (toParam) {
      dateTo = new Date(toParam);
      dateTo.setHours(23, 59, 59, 999);
    } else {
      dateTo = new Date();
      dateTo.setHours(23, 59, 59, 999);
    }

    const dayOfWeek = dayOfWeekParam ? parseInt(dayOfWeekParam, 10) : undefined;
    const timeFrom = timeFromParam || undefined;
    const timeTo = timeToParam || undefined;

    const baseWhereParts: string[] = [
      `"createdAt" >= '${dateFrom.toISOString()}'`,
      `"createdAt" <= '${dateTo.toISOString()}'`,
    ];
    if (serviceId) baseWhereParts.push(`"service_id" = '${serviceId}'`);
    if (agentId) baseWhereParts.push(`"called_by_id" = '${agentId}'`);

    const baseWhere = baseWhereParts.join(' AND ');

    const dayWhere = dayOfWeek !== undefined
      ? ` AND EXTRACT(DOW FROM "createdAt") = ${dayOfWeek}`
      : '';

    const timeWhereParts: string[] = [];
    if (timeFrom) {
      const [h, m] = timeFrom.split(':').map(Number);
      timeWhereParts.push(`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) >= ${h * 60 + m}`);
    }
    if (timeTo) {
      const [h, m] = timeTo.split(':').map(Number);
      timeWhereParts.push(`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) <= ${h * 60 + m}`);
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
         AND completed_at >= '${dateFrom.toISOString()}' AND completed_at <= '${dateTo.toISOString()}'
         ${serviceId ? `AND service_id = '${serviceId}'` : ''}
         ${agentId ? `AND called_by_id = '${agentId}'` : ''}
         ${filterSuffix.replace(/"createdAt"/g, '"created_at"')}`
      ),
      prisma.ticket.count({
        where: { status: TicketStatus.WAITING, ...(serviceId ? { serviceId } : {}) },
      }),
      prisma.ticket.count({
        where: { status: TicketStatus.SERVING, ...(serviceId ? { serviceId } : {}), ...(agentId ? { calledById: agentId } : {}) },
      }),
    ]);

    const totalToday = Number(totalResult[0]?.count ?? 0);
    const completedToday = Number(completedResult[0]?.count ?? 0);
    const noShowToday = Number(noShowResult[0]?.count ?? 0);
    const avgServiceTimeSeconds = Number(avgResult[0]?.avg_seconds ?? 0);

    const serviceFilter = serviceId ? `AND t.service_id = '${serviceId}'` : '';
    const agentFilter = agentId ? `AND t.called_by_id = '${agentId}'` : '';

    const perService = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; total: bigint; completed: bigint; waiting: bigint }>>(
      `SELECT s.id, s.name,
        COUNT(t.id)::int as total,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int as waiting
       FROM services s
       LEFT JOIN tickets t ON t.service_id = s.id
         AND t."createdAt" >= '${dateFrom.toISOString()}' AND t."createdAt" <= '${dateTo.toISOString()}'
         ${agentFilter} ${dayWhere} ${timeWhere.replace(/"createdAt"/g, 't."createdAt"')}
       WHERE s."isActive" = true ${serviceId ? `AND s.id = '${serviceId}'` : ''}
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
       WHERE t.completed_at >= '${dateFrom.toISOString()}' AND t.completed_at <= '${dateTo.toISOString()}'
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
