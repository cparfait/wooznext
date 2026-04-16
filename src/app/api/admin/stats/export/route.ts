import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';

function formatTime(seconds: number): string {
  if (!seconds) return '0min 00s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}min ${String(s).padStart(2, '0')}s`;
}

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
    const period = searchParams.get('period') || 'today';

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

    const df = dateFrom.toISOString();
    const dt = dateTo.toISOString();

    const svcFilter = serviceId ? `AND service_id = '${serviceId}'` : '';
    const agtFilter = agentId ? `AND called_by_id = '${agentId}'` : '';

    const [totalResult, completedResult, noShowResult, avgResult, waitingNow, servingNow] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::int as count FROM tickets WHERE "createdAt" >= '${df}' AND "createdAt" <= '${dt}' ${svcFilter} ${agtFilter}`
      ),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::int as count FROM tickets WHERE status = 'COMPLETED' AND "completed_at" >= '${df}' AND "completed_at" <= '${dt}' ${svcFilter} ${agtFilter}`
      ),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::int as count FROM tickets WHERE status = 'NO_SHOW' AND "completed_at" >= '${df}' AND "completed_at" <= '${dt}' ${svcFilter} ${agtFilter}`
      ),
      prisma.$queryRawUnsafe<Array<{ avg_seconds: number | null }>>(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - called_at))), 0)::int as avg_seconds
         FROM tickets WHERE status = 'COMPLETED' AND called_at IS NOT NULL
         AND completed_at >= '${df}' AND completed_at <= '${dt}' ${svcFilter} ${agtFilter}`
      ),
      prisma.ticket.count({ where: { status: TicketStatus.WAITING, ...(serviceId ? { serviceId } : {}) } }),
      prisma.ticket.count({ where: { status: TicketStatus.SERVING, ...(serviceId ? { serviceId } : {}), ...(agentId ? { calledById: agentId } : {}) } }),
    ]);

    const totalToday = Number(totalResult[0]?.count ?? 0);
    const completedToday = Number(completedResult[0]?.count ?? 0);
    const noShowToday = Number(noShowResult[0]?.count ?? 0);
    const avgServiceTimeSeconds = Number(avgResult[0]?.avg_seconds ?? 0);

    const perService = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; total: bigint; completed: bigint; waiting: bigint }>>(
      `SELECT s.id, s.name,
        COUNT(t.id)::int as total,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int as waiting
       FROM services s
       LEFT JOIN tickets t ON t.service_id = s.id
         AND t."createdAt" >= '${df}' AND t."createdAt" <= '${dt}'
         ${agentId ? `AND t.called_by_id = '${agentId}'` : ''}
       WHERE s."isActive" = true ${serviceId ? `AND s.id = '${serviceId}'` : ''}
       GROUP BY s.id, s.name HAVING COUNT(t.id) > 0 ORDER BY s.name`
    );

    const perAgent = await prisma.$queryRawUnsafe<Array<{ id: string; first_name: string; last_name: string; completed: bigint; no_show: bigint; avg_seconds: number | null }>>(
      `SELECT a.id, a.first_name, a.last_name,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN t.status = 'NO_SHOW' THEN 1 END)::int as no_show,
        COALESCE(AVG(CASE WHEN t.status = 'COMPLETED' AND t.called_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.completed_at - t.called_at)) END), 0)::int as avg_seconds
       FROM agents a JOIN tickets t ON t.called_by_id = a.id
       WHERE t.completed_at >= '${df}' AND t.completed_at <= '${dt}'
         AND t.status IN ('COMPLETED', 'NO_SHOW')
         ${serviceId ? `AND t.service_id = '${serviceId}'` : ''}
         ${agentId ? `AND t.called_by_id = '${agentId}'` : ''}
       GROUP BY a.id, a.first_name, a.last_name ORDER BY a.first_name, a.last_name`
    );

    const hourData = await prisma.$queryRawUnsafe<Array<{ hour: number; total: bigint; completed: bigint; no_show: bigint }>>(
      `SELECT EXTRACT(HOUR FROM "createdAt")::int as hour,
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(CASE WHEN status = 'NO_SHOW' THEN 1 END)::int as no_show
       FROM tickets
       WHERE "createdAt" >= '${df}' AND "createdAt" <= '${dt}'
       ${svcFilter} ${agtFilter}
       GROUP BY hour ORDER BY hour`
    );

    const PERIOD_LABELS: Record<string, string> = { today: "Aujourd'hui", week: '7 jours', month: '30 jours', custom: 'Personnalise' };

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(0, 110, 70);
    doc.text(`Statistiques — ${PERIOD_LABELS[period] ?? period}`, 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Exporte le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 14, 30);

    (doc as any).autoTable({
      startY: 38,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Tickets', String(totalToday)],
        ['Termines', String(completedToday)],
        ['Absents', String(noShowToday)],
        ['En attente', String(waitingNow)],
        ['En service', String(servingNow)],
        ['Temps moyen', formatTime(avgServiceTimeSeconds)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 110, 70] },
      styles: { fontSize: 10 },
    });

    let y = (doc as any).lastAutoTable.finalY + 10;

    if (perService.length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(0, 110, 70);
      doc.text('Par service', 14, y);
      (doc as any).autoTable({
        startY: y + 4,
        head: [['Service', 'Total', 'Termines', 'En attente']],
        body: perService.map((s) => [s.name, String(Number(s.total)), String(Number(s.completed)), String(Number(s.waiting))]),
        theme: 'grid',
        headStyles: { fillColor: [0, 110, 70] },
        styles: { fontSize: 10 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (perAgent.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setTextColor(0, 110, 70);
      doc.text('Par agent', 14, y);
      (doc as any).autoTable({
        startY: y + 4,
        head: [['Agent', 'Termines', 'Absents', 'Temps moyen']],
        body: perAgent.map((a) => [`${a.first_name} ${a.last_name}`, String(Number(a.completed)), String(Number(a.no_show)), formatTime(Number(a.avg_seconds ?? 0))]),
        theme: 'grid',
        headStyles: { fillColor: [0, 110, 70] },
        styles: { fontSize: 10 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (hourData.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setTextColor(0, 110, 70);
      doc.text('Visites par heure', 14, y);
      (doc as any).autoTable({
        startY: y + 4,
        head: [['Horaire', 'Total', 'Termines', 'Absents']],
        body: hourData.map((h) => [`${String(h.hour).padStart(2, '0')}h`, String(Number(h.total)), String(Number(h.completed)), String(Number(h.no_show))]),
        theme: 'grid',
        headStyles: { fillColor: [0, 110, 70] },
        styles: { fontSize: 10 },
      });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="stats-${period}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
