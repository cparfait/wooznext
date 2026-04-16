import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

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
    if (dayOfWeekParam && (isNaN(dayOfWeek!) || dayOfWeek! < 0 || dayOfWeek! > 6)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }
    const timeFrom = timeFromParam || undefined;
    const timeTo = timeToParam || undefined;

    if (serviceId && !/^[0-9a-f-]{36}$/i.test(serviceId)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }
    if (agentId && !/^[0-9a-f-]{36}$/i.test(agentId)) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }

    const baseWhereParts: (string | Prisma.Sql)[] = [
      Prisma.sql`"createdAt" >= ${dateFrom}`,
      Prisma.sql`"createdAt" <= ${dateTo}`,
    ];
    if (serviceId) baseWhereParts.push(Prisma.sql`"service_id" = ${serviceId}`);
    if (agentId) baseWhereParts.push(Prisma.sql`"called_by_id" = ${agentId}`);

    const baseWhere = Prisma.join(baseWhereParts, ' AND ');

    let dayWhere: Prisma.Sql | string = '';
    if (dayOfWeek !== undefined) {
      dayWhere = Prisma.sql` AND EXTRACT(DOW FROM "createdAt") = ${dayOfWeek}`;
    }

    const timeFromMinutes = timeFrom ? (() => {
      const [h, m] = timeFrom.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    })() : undefined;
    const timeToMinutes = timeTo ? (() => {
      const [h, m] = timeTo.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    })() : undefined;
    if (timeFromMinutes === null || timeToMinutes === null) {
      return NextResponse.json({ error: 'Parametre invalide' }, { status: 400 });
    }

    const timeWhereParts: Prisma.Sql[] = [];
    if (timeFromMinutes !== undefined) {
      timeWhereParts.push(Prisma.sql`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) >= ${timeFromMinutes}`);
    }
    if (timeToMinutes !== undefined) {
      timeWhereParts.push(Prisma.sql`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) <= ${timeToMinutes}`);
    }
    const timeWhere = timeWhereParts.length > 0
      ? Prisma.sql` AND ${Prisma.join(timeWhereParts, ' AND ')}`
      : '';

    const timeWherePartsT: Prisma.Sql[] = [];
    if (timeFromMinutes !== undefined) {
      timeWherePartsT.push(Prisma.sql`(EXTRACT(HOUR FROM t."createdAt") * 60 + EXTRACT(MINUTE FROM t."createdAt")) >= ${timeFromMinutes}`);
    }
    if (timeToMinutes !== undefined) {
      timeWherePartsT.push(Prisma.sql`(EXTRACT(HOUR FROM t."createdAt") * 60 + EXTRACT(MINUTE FROM t."createdAt")) <= ${timeToMinutes}`);
    }

    const filterSuffix = Prisma.join([dayWhere, timeWhere], '');

    const [
      totalResult,
      completedResult,
      noShowResult,
      avgResult,
      waitingNow,
      servingNow,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::int as count FROM tickets WHERE ${baseWhere}${filterSuffix}`
      ),
      prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::int as count FROM tickets WHERE status = 'COMPLETED' AND "completed_at" >= ${dateFrom} AND "completed_at" <= ${dateTo}
          ${serviceId ? Prisma.sql`AND "service_id" = ${serviceId}` : Prisma.empty}
          ${agentId ? Prisma.sql`AND "called_by_id" = ${agentId}` : Prisma.empty}
          ${filterSuffix}`
      ),
      prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::int as count FROM tickets WHERE status = 'NO_SHOW' AND "completed_at" >= ${dateFrom} AND "completed_at" <= ${dateTo}
          ${serviceId ? Prisma.sql`AND "service_id" = ${serviceId}` : Prisma.empty}
          ${agentId ? Prisma.sql`AND "called_by_id" = ${agentId}` : Prisma.empty}
          ${filterSuffix}`
      ),
      prisma.$queryRaw<Array<{ avg_seconds: number | null }>>(
        Prisma.sql`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - called_at))), 0)::int as avg_seconds
         FROM tickets
         WHERE status = 'COMPLETED' AND called_at IS NOT NULL
         AND completed_at >= ${dateFrom} AND completed_at <= ${dateTo}
         ${serviceId ? Prisma.sql`AND service_id = ${serviceId}` : Prisma.empty}
         ${agentId ? Prisma.sql`AND called_by_id = ${agentId}` : Prisma.empty}`
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

    const perService = await prisma.$queryRaw<Array<{ id: string; name: string; total: bigint; completed: bigint; waiting: bigint }>>(
      Prisma.sql`SELECT s.id, s.name,
        COUNT(t.id)::int as total,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int as waiting
       FROM services s
       LEFT JOIN tickets t ON t.service_id = s.id
         AND t."createdAt" >= ${dateFrom} AND t."createdAt" <= ${dateTo}
         ${agentId ? Prisma.sql`AND t.called_by_id = ${agentId}` : Prisma.empty}
         ${dayOfWeek !== undefined ? Prisma.sql`AND EXTRACT(DOW FROM t."createdAt") = ${dayOfWeek}` : Prisma.empty}
         ${timeWherePartsT.length > 0 ? Prisma.sql`AND ${Prisma.join(timeWherePartsT, ' AND ')}` : Prisma.empty}
       WHERE s."isActive" = true ${serviceId ? Prisma.sql`AND s.id = ${serviceId}` : Prisma.empty}
       GROUP BY s.id, s.name
       HAVING COUNT(t.id) > 0
       ORDER BY s.name`
    );

    const perAgent = await prisma.$queryRaw<Array<{ id: string; first_name: string; last_name: string; completed: bigint; no_show: bigint; avg_seconds: number | null }>>(
      Prisma.sql`SELECT a.id, a.first_name, a.last_name,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'NO_SHOW' THEN 1 END)::int as no_show,
        COALESCE(AVG(CASE WHEN t.status = 'COMPLETED' AND t.called_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.completed_at - t.called_at)) END), 0)::int as avg_seconds
       FROM agents a
       JOIN tickets t ON t.called_by_id = a.id
       WHERE t.completed_at >= ${dateFrom} AND t.completed_at <= ${dateTo}
         AND t.status IN ('COMPLETED', 'NO_SHOW')
         ${serviceId ? Prisma.sql`AND t.service_id = ${serviceId}` : Prisma.empty}
         ${agentId ? Prisma.sql`AND t.called_by_id = ${agentId}` : Prisma.empty}
       GROUP BY a.id, a.first_name, a.last_name
       ORDER BY a.first_name, a.last_name`
    );

    const isToday = dateFrom.toDateString() === dateTo.toDateString();
    const isFilteredByDay = dayOfWeek !== undefined;

    let chartByHour: { label: string; total: number; completed: number; noShow: number }[] = [];
    let chartByDayOfWeek: { label: string; total: number; completed: number; noShow: number }[] = [];

    if (isToday || isFilteredByDay) {
      const hourData = await prisma.$queryRaw<Array<{ hour: number; total: bigint; completed: bigint; no_show: bigint }>>(
        Prisma.sql`SELECT EXTRACT(HOUR FROM "createdAt")::int as hour,
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
      const dowData = await prisma.$queryRaw<Array<{ dow: number; total: bigint; completed: bigint; no_show: bigint }>>(
        Prisma.sql`SELECT EXTRACT(DOW FROM "createdAt")::int as dow,
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
