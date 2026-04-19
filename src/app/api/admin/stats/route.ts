import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus, Prisma } from '@prisma/client';
import { logErrorWithId } from '@/lib/error-id';

function isValidUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
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

    const timeFromMinutes = timeFrom
      ? (() => { const [h, m] = timeFrom.split(':').map(Number); return h * 60 + m; })()
      : undefined;
    const timeToMinutes = timeTo
      ? (() => { const [h, m] = timeTo.split(':').map(Number); return h * 60 + m; })()
      : undefined;

    // DOW / hour filters always apply on `"createdAt"` (matches original behaviour),
    // while the range can target either `"createdAt"` or `"completed_at"`.
    function buildDateWhere(rangeCol: '"createdAt"' | '"completed_at"'): Prisma.Sql {
      const parts: Prisma.Sql[] = [
        Prisma.sql`${Prisma.raw(rangeCol)} >= ${dateFrom}`,
        Prisma.sql`${Prisma.raw(rangeCol)} <= ${dateTo}`,
      ];
      if (serviceId) parts.push(Prisma.sql`"service_id" = ${serviceId}`);
      if (agentId) parts.push(Prisma.sql`"called_by_id" = ${agentId}`);
      if (dayOfWeek !== undefined) {
        parts.push(Prisma.sql`EXTRACT(DOW FROM "createdAt") = ${dayOfWeek}`);
      }
      if (timeFromMinutes !== undefined) {
        parts.push(
          Prisma.sql`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) >= ${timeFromMinutes}`
        );
      }
      if (timeToMinutes !== undefined) {
        parts.push(
          Prisma.sql`(EXTRACT(HOUR FROM "createdAt") * 60 + EXTRACT(MINUTE FROM "createdAt")) <= ${timeToMinutes}`
        );
      }
      return Prisma.join(parts, ' AND ');
    }

    const whereCreated = buildDateWhere('"createdAt"');
    const whereCompleted = buildDateWhere('"completed_at"');

    // Base where without DOW/time filters (used for the day-of-week chart so it
    // still shows all days even when a specific day is selected).
    const baseParts: Prisma.Sql[] = [
      Prisma.sql`"createdAt" >= ${dateFrom}`,
      Prisma.sql`"createdAt" <= ${dateTo}`,
    ];
    if (serviceId) baseParts.push(Prisma.sql`"service_id" = ${serviceId}`);
    if (agentId) baseParts.push(Prisma.sql`"called_by_id" = ${agentId}`);
    const whereBase = Prisma.join(baseParts, ' AND ');

    const [
      totalResult,
      completedResult,
      noShowResult,
      avgResult,
      waitingNow,
      servingNow,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::int as count FROM tickets WHERE ${whereCreated}`
      ),
      prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::int as count FROM tickets WHERE status = 'COMPLETED' AND ${whereCompleted}`
      ),
      prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::int as count FROM tickets WHERE status = 'NO_SHOW' AND ${whereCompleted}`
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

    const perServiceJoinFilters: Prisma.Sql[] = [
      Prisma.sql`t."createdAt" >= ${dateFrom}`,
      Prisma.sql`t."createdAt" <= ${dateTo}`,
    ];
    if (agentId) perServiceJoinFilters.push(Prisma.sql`t.called_by_id = ${agentId}`);
    if (dayOfWeek !== undefined) perServiceJoinFilters.push(Prisma.sql`EXTRACT(DOW FROM t."createdAt") = ${dayOfWeek}`);
    if (timeFromMinutes !== undefined) {
      perServiceJoinFilters.push(
        Prisma.sql`(EXTRACT(HOUR FROM t."createdAt") * 60 + EXTRACT(MINUTE FROM t."createdAt")) >= ${timeFromMinutes}`
      );
    }
    if (timeToMinutes !== undefined) {
      perServiceJoinFilters.push(
        Prisma.sql`(EXTRACT(HOUR FROM t."createdAt") * 60 + EXTRACT(MINUTE FROM t."createdAt")) <= ${timeToMinutes}`
      );
    }
    const perServiceJoinWhere = Prisma.join(perServiceJoinFilters, ' AND ');

    const perService = await prisma.$queryRaw<Array<{ id: string; name: string; total: bigint; completed: bigint; waiting: bigint }>>(
      Prisma.sql`SELECT s.id, s.name,
        COUNT(t.id)::int as total,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int as waiting
       FROM services s
       LEFT JOIN tickets t ON t.service_id = s.id AND ${perServiceJoinWhere}
       WHERE s."isActive" = true ${serviceId ? Prisma.sql`AND s.id = ${serviceId}` : Prisma.empty}
       GROUP BY s.id, s.name
       HAVING COUNT(t.id) > 0
       ORDER BY s.name`
    );

    const perAgentFilters: Prisma.Sql[] = [
      Prisma.sql`t.completed_at >= ${dateFrom}`,
      Prisma.sql`t.completed_at <= ${dateTo}`,
      Prisma.sql`t.status IN ('COMPLETED', 'NO_SHOW')`,
    ];
    if (serviceId) perAgentFilters.push(Prisma.sql`t.service_id = ${serviceId}`);
    if (agentId) perAgentFilters.push(Prisma.sql`t.called_by_id = ${agentId}`);
    if (dayOfWeek !== undefined) perAgentFilters.push(Prisma.sql`EXTRACT(DOW FROM t."createdAt") = ${dayOfWeek}`);
    if (timeFromMinutes !== undefined) {
      perAgentFilters.push(
        Prisma.sql`(EXTRACT(HOUR FROM t."createdAt") * 60 + EXTRACT(MINUTE FROM t."createdAt")) >= ${timeFromMinutes}`
      );
    }
    if (timeToMinutes !== undefined) {
      perAgentFilters.push(
        Prisma.sql`(EXTRACT(HOUR FROM t."createdAt") * 60 + EXTRACT(MINUTE FROM t."createdAt")) <= ${timeToMinutes}`
      );
    }
    const perAgentWhere = Prisma.join(perAgentFilters, ' AND ');

    const perAgent = await prisma.$queryRaw<Array<{ id: string; first_name: string; last_name: string; completed: bigint; no_show: bigint; avg_seconds: number | null }>>(
      Prisma.sql`SELECT a.id, a.first_name, a.last_name,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'NO_SHOW' THEN 1 END)::int as no_show,
        COALESCE(AVG(CASE WHEN t.status = 'COMPLETED' AND t.called_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.completed_at - t.called_at)) END), 0)::int as avg_seconds
       FROM agents a
       JOIN tickets t ON t.called_by_id = a.id
       WHERE ${perAgentWhere}
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
         WHERE ${whereCreated}
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
         WHERE ${whereBase}
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
    const errorId = logErrorWithId('stats:fetch', error);
    return NextResponse.json({ error: 'Erreur serveur', errorId }, { status: 500 });
  }
}
